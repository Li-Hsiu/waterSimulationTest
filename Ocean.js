/**
 * @author jbouny / https://github.com/fft-ocean
 *
 * Based on:
 * @author Aleksandr Albert / http://www.routter.co.tt
 */
import * as THREE from 'three';
import { MirrorRenderer } from './MirrorRenderer.js';

const Ocean = function (renderer, camera, scene, points, delaunay, options) { // constructor
	// flag used to trigger parameter changes
	this.changed = true;
	this.initial = true;
	this.camera = camera;
	
	this.points = points;
	this.numPoints = points.length;
	this.delaunay = delaunay;
	this.numTriangles = delaunay.triangles.length/3;
	// console.log(this.delaunay);
	// console.log(this.numPoints);
	// console.log(this.numTriangles);

	// Assign required parameters as object properties
	this.oceanCamera = new THREE.OrthographicCamera(); //camera.clone();
	this.oceanCamera.position.z = 1;
	this.renderer = renderer;
	this.renderer.clearColor( 0xffffff );

	this.scene = new THREE.Scene();
	//this.scene.background = new THREE.Color(0x000000); //skyblue

	// Create mirror rendering
	this.mirror = new MirrorRenderer( renderer, this.camera, scene ) ;
	this.mirror.position.y = -10.0;

	// Assign optional parameters as variables and object properties
	function optionalParameter(value, defaultValue) {
		return value !== undefined ? value : defaultValue;
	};
	function optionalParameterArray(value, index, defaultValue) {
		return value !== undefined ? value[index] : defaultValue;
	};
	options = options || {};
	this.sunDirection = optionalParameter(options.SUN_DIRECTION, new THREE.Vector3(-1.0, 1.0, 1.0 ));
	this.oceanColor = optionalParameter(options.OCEAN_COLOR, new THREE.Vector3(0.0, 0.0, 0.0));
	this.skyColor = optionalParameter(options.SKY_COLOR, new THREE.Vector3(3.2, 9.6, 12.8));
	this.exposure = optionalParameter(options.EXPOSURE, 0.35);
	this.geometryResolution = optionalParameter(options.GEOMETRY_RESOLUTION, 32);
	this.geometrySize = optionalParameter(options.GEOMETRY_SIZE, 2000);
	this.resolution = optionalParameter(options.RESOLUTION, 64);
	this.floatSize = optionalParameter(options.SIZE_OF_FLOAT, 4);
	this.size = optionalParameter(options.INITIAL_SIZE, 250.0),
	this.choppiness = optionalParameter(options.INITIAL_CHOPPINESS, 1.5);

	this.matrixNeedsUpdate = false;

	// Setup framebuffer pipeline
	var BaseParams = {
		format: THREE.RGBAFormat,
		stencilBuffer: false,
		depthBuffer: false,
		premultiplyAlpha: false,
		type: THREE.FloatType
	};
	var LinearClampParams = JSON.parse(JSON.stringify(BaseParams));
	LinearClampParams.minFilter = LinearClampParams.magFilter = THREE.LinearFilter ;
	LinearClampParams.wrapS = LinearClampParams.wrapT = THREE.ClampToEdgeWrapping ;

	var NearestClampParams = JSON.parse(JSON.stringify(BaseParams));
	NearestClampParams.minFilter = NearestClampParams.magFilter = THREE.NearestFilter ;
	NearestClampParams.wrapS = NearestClampParams.wrapT = THREE.ClampToEdgeWrapping ;

	var NearestRepeatParams = JSON.parse(JSON.stringify(BaseParams));
	NearestRepeatParams.minFilter = NearestRepeatParams.magFilter = THREE.NearestFilter ;
	NearestRepeatParams.wrapS = NearestRepeatParams.wrapT = THREE.RepeatWrapping ;

	var LinearRepeatParams = JSON.parse(JSON.stringify(BaseParams));
	LinearRepeatParams.minFilter = LinearRepeatParams.magFilter = THREE.LinearFilter ;
	LinearRepeatParams.wrapS = LinearRepeatParams.wrapT = THREE.RepeatWrapping ;

	this.initialSpectrumFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestRepeatParams);
	this.spectrumFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.pingPhaseFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.pongPhaseFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.pingTransformFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.pongTransformFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);

	this.displacementMapFramebufferList = [];
	this.normalMapFramebufferList = [];
	for (let i=0; i<6; i++) {
		this.displacementMapFramebufferList.push(new THREE.WebGLRenderTarget(this.resolution, this.resolution, LinearRepeatParams));
		this.normalMapFramebufferList.push(new THREE.WebGLRenderTarget(this.resolution, this.resolution, LinearRepeatParams));
	}

	// store points as data texture
	var vertexOneTwoArray = new window.Float32Array(this.numTriangles * 4);
	var vertexThreeArray = new window.Float32Array(this.numTriangles * 4);
	var triangleColorArray = new window.Float32Array(this.numTriangles * 4);
	var triangleToVertexArray = new window.Float32Array(this.numTriangles * 4);
	for (let i = 0; i < this.numTriangles; i++) {
		vertexOneTwoArray[i * 4] = this.points[this.delaunay.triangles[i*3]].getCoord()[0];
		vertexOneTwoArray[i * 4 + 1] = this.points[this.delaunay.triangles[i*3]].getCoord()[1];
		vertexOneTwoArray[i * 4 + 2] = this.points[this.delaunay.triangles[i*3+1]].getCoord()[0];
		vertexOneTwoArray[i * 4 + 3] = this.points[this.delaunay.triangles[i*3+1]].getCoord()[1];
		vertexThreeArray[i * 4] = this.points[this.delaunay.triangles[i*3+2]].getCoord()[0];
		vertexThreeArray[i * 4 + 1] = this.points[this.delaunay.triangles[i*3+2]].getCoord()[1];
		vertexThreeArray[i * 4 + 2] = 0.0;
		vertexThreeArray[i * 4 + 3] = 0.0;
		triangleColorArray[i * 4] = Math.random();
		triangleColorArray[i * 4 + 1] = Math.random();
		triangleColorArray[i * 4 + 2] = Math.random();
		triangleColorArray[i * 4 + 3] = 0.0;
		triangleToVertexArray[i * 4] = this.delaunay.triangles[i*3];
		triangleToVertexArray[i * 4 + 1] = this.delaunay.triangles[i*3+1];
		triangleToVertexArray[i * 4 + 2] = this.delaunay.triangles[i*3+2];
		triangleToVertexArray[i * 4 + 3] = 0.0;
	}
	this.vertexOneTwoTexture = new THREE.DataTexture(vertexOneTwoArray, this.numTriangles, 1, THREE.RGBAFormat, THREE.FloatType);
	this.vertexThreeTexture = new THREE.DataTexture(vertexThreeArray, this.numTriangles, 1, THREE.RGBAFormat, THREE.FloatType);
	this.triangleColorTexture = new THREE.DataTexture(triangleColorArray, this.numTriangles, 1, THREE.RGBAFormat, THREE.FloatType);
	this.triangleToVertexTexture = new THREE.DataTexture(triangleToVertexArray, this.numTriangles, 1, THREE.RGBAFormat, THREE.FloatType);
	var vertexColorArray = new window.Float32Array(6 * 4);
	for (let i = 0; i < 6; i++) {
		vertexColorArray[i * 4] = Math.random();
		vertexColorArray[i * 4 + 1] = Math.random();
		vertexColorArray[i * 4 + 2] = Math.random();
		vertexColorArray[i * 4 + 3] = 0.0;
	}
	this.vertexColorTexture = new THREE.DataTexture(vertexColorArray, 6, 1, THREE.RGBAFormat, THREE.FloatType);

	// Define shaders and constant uniforms
	////////////////////////////////////////

	// 0 - The vertex shader used in all of the simulation steps
	var fullscreeenVertexShader = THREE.ShaderLib["ocean_sim_vertex"];

	// 1 - Horizontal wave vertices used for FFT
	var oceanHorizontalShader = THREE.ShaderLib["ocean_subtransform"];
	var oceanHorizontalUniforms = THREE.UniformsUtils.clone(oceanHorizontalShader.uniforms);
	this.materialOceanHorizontal = new THREE.ShaderMaterial({
		uniforms: oceanHorizontalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: "#define HORIZONTAL \n" + oceanHorizontalShader.fragmentShader,
	});
	this.materialOceanHorizontal.uniforms.u_transformSize = { type: "f", value: this.resolution };
	this.materialOceanHorizontal.uniforms.u_subtransformSize = { type: "f", value: null };
	this.materialOceanHorizontal.uniforms.u_input = { type: "t", value: null };
	this.materialOceanHorizontal.depthTest = false;

	// 2 - Vertical wave vertices used for FFT
	var oceanVerticalShader = THREE.ShaderLib["ocean_subtransform"];
	var oceanVerticalUniforms = THREE.UniformsUtils.clone(oceanVerticalShader.uniforms);
	this.materialOceanVertical = new THREE.ShaderMaterial({
		uniforms: oceanVerticalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: oceanVerticalShader.fragmentShader,
	});
	this.materialOceanVertical.uniforms.u_transformSize = { type: "f", value: this.resolution };
	this.materialOceanVertical.uniforms.u_subtransformSize = { type: "f", value: null };
	this.materialOceanVertical.uniforms.u_input = { type: "t", value: null };
	this.materialOceanVertical.depthTest = false;

	// 3 - Initial spectrum used to generate height map
	var initialSpectrumShader = THREE.ShaderLib["ocean_initial_spectrum"];
	var initialSpectrumUniforms = THREE.UniformsUtils.clone(initialSpectrumShader.uniforms);
	this.materialInitialSpectrum = new THREE.ShaderMaterial({
		uniforms: initialSpectrumUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader:initialSpectrumShader.fragmentShader,
	});
	this.materialInitialSpectrum.uniforms.u_resolution = { type: "f", value: this.resolution };
	this.materialInitialSpectrum.depthTest = false;

	// 4 - Phases used to animate heightmap
	var phaseShader = THREE.ShaderLib["ocean_phase"];
	var phaseUniforms = THREE.UniformsUtils.clone(phaseShader.uniforms);
	this.materialPhase = new THREE.ShaderMaterial({
		uniforms: phaseUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: phaseShader.fragmentShader,
	});
	this.materialPhase.uniforms.u_resolution = { type: "f", value: this.resolution };
	this.materialPhase.depthTest = false;

	// 5 - Shader used to update spectrum
	var spectrumShader = THREE.ShaderLib["ocean_spectrum"];
	var spectrumUniforms = THREE.UniformsUtils.clone(spectrumShader.uniforms);
	this.materialSpectrum = new THREE.ShaderMaterial({
		uniforms: spectrumUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: spectrumShader.fragmentShader,
	});
	this.materialSpectrum.uniforms.u_initialSpectrum = { type: "t", value: null };
	this.materialSpectrum.uniforms.u_resolution = { type: "f", value: this.resolution };
	this.materialSpectrum.uniforms.u_choppiness.value = this.choppiness ;
	this.materialSpectrum.depthTest = false;

	// 6 - Shader used to update spectrum normals
	var normalShader = THREE.ShaderLib["ocean_normals"];
	var normalUniforms = THREE.UniformsUtils.clone(normalShader.uniforms);
	this.materialNormal = new THREE.ShaderMaterial({
		uniforms: normalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: normalShader.fragmentShader,
	});
	this.materialNormal.uniforms.u_displacementMap = { type: "t", value: null };
	this.materialNormal.uniforms.u_resolution = { type: "f", value: this.resolution };
	this.materialNormal.depthTest = false;

	// 7 - Shader used to update normals
	var oceanShader = THREE.ShaderLib["ocean_main"];
	var oceanUniforms = THREE.UniformsUtils.clone(oceanShader.uniforms);
	var vertexShaderOcean = oceanShader.vertexShader;
	{
		var gl = renderer.getContext();
		if ( gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) === 0 ) {
			vertexShaderOcean = oceanShader.vertexShaderNoTexLookup;
		}
	}
	this.materialOcean = new THREE.ShaderMaterial({
		uniforms: oceanUniforms,
		vertexShader: vertexShaderOcean,
		//vertexShader: oceanShader.vertexTriangleShader,
		fragmentShader: oceanShader.fragmentShader,
		//fragmentShader: oceanShader.triangulationShader,
		side: THREE.FrontSide,
		wireframe: false
	});
	
	//this.materialOcean.wireframe = true;
	this.materialOcean.uniforms.u_geometrySize = { type: "f", value: this.resolution };
	this.materialOcean.uniforms.u_displacementMap0 = { type: "t", value: this.displacementMapFramebufferList[0] };
	this.materialOcean.uniforms.u_displacementMap1 = { type: "t", value: this.displacementMapFramebufferList[1] };
	this.materialOcean.uniforms.u_displacementMap2 = { type: "t", value: this.displacementMapFramebufferList[2] };
	this.materialOcean.uniforms.u_displacementMap3 = { type: "t", value: this.displacementMapFramebufferList[3] };
	this.materialOcean.uniforms.u_displacementMap4 = { type: "t", value: this.displacementMapFramebufferList[4] };
	this.materialOcean.uniforms.u_displacementMap5 = { type: "t", value: this.displacementMapFramebufferList[5] };
	this.materialOcean.uniforms.u_reflection = { type: "t", value: this.mirror.texture };
	this.materialOcean.uniforms.u_mirrorMatrix = { type: "m4", value: this.mirror.textureMatrix };
	this.materialOcean.uniforms.u_normalMap0 = { type: "t", value: this.normalMapFramebufferList[0] };
	this.materialOcean.uniforms.u_normalMap1 = { type: "t", value: this.normalMapFramebufferList[1] };
	this.materialOcean.uniforms.u_normalMap2 = { type: "t", value: this.normalMapFramebufferList[2] };
	this.materialOcean.uniforms.u_normalMap3 = { type: "t", value: this.normalMapFramebufferList[3] };
	this.materialOcean.uniforms.u_normalMap4 = { type: "t", value: this.normalMapFramebufferList[4] };
	this.materialOcean.uniforms.u_normalMap5 = { type: "t", value: this.normalMapFramebufferList[5] };
	this.materialOcean.uniforms.u_oceanColor = { type: "v3", value: this.oceanColor }; 
	this.materialOcean.uniforms.u_skyColor = { type: "v3", value: this.skyColor };
	this.materialOcean.uniforms.u_sunDirection = { type: "v3", value: this.sunDirection };
	this.materialOcean.uniforms.u_exposure = { type: "f", value: this.exposure };
	this.materialOcean.uniforms.u_vertexOneTwo = { type: "t", value: this.vertexOneTwoTexture };
	this.materialOcean.uniforms.u_vertexThree = { type: "t", value: this.vertexThreeTexture };
	this.materialOcean.uniforms.u_triangleColor = { type: "t", value: this.triangleColorTexture };
	this.materialOcean.uniforms.u_triangleToVertex = { type: "t", value: this.triangleToVertexTexture };
	this.materialOcean.uniforms.u_vertexColor = { type: "t", value: this.vertexColorTexture };
	this.materialOcean.uniforms.u_numTriangles = { type: "i", value: this.numTriangles };
	this.materialOcean.uniforms.u_numPoints = { type: "i", value: this.numPoints };

	// Disable blending to prevent default premultiplied alpha values
	this.materialOceanHorizontal.blending = 0;
	this.materialOceanVertical.blending = 0;
	this.materialInitialSpectrum.blending = 0;
	this.materialPhase.blending = 0;
	this.materialSpectrum.blending = 0;
	this.materialNormal.blending = 0;
	this.materialOcean.blending = 0;

	this.materialOcean.uniforms.u_size.value = this.size;
	this.materialOcean.uniforms.u_exposure.value = this.exposure;

	// Create the simulation plane
	this.screenQuad = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ) );
	this.scene.add(this.screenQuad);

	// Initialise spectrum data
	this.generateSeedPhaseTexture();

	// Generate the ocean mesh
	this.generateMesh();
	this.mirror.mesh = this.oceanMesh;
	this.camera.add( this.oceanMesh );
};

Ocean.prototype.generateMesh = function () {

	var geometry = new THREE.PlaneGeometry( 1, 1, this.geometryResolution, this.geometryResolution );
	this.oceanMesh = new THREE.Mesh( geometry, this.materialOcean );
	//this.oceanMesh.scale.set(1, 1, 1);
};

Ocean.prototype.update = function () {

	this.overrideMaterial = this.materialOcean;

	this.materialOcean.uniforms.u_normalMap0.value = this.normalMapFramebufferList[0];
	this.materialOcean.uniforms.u_normalMap1.value = this.normalMapFramebufferList[1];
	this.materialOcean.uniforms.u_normalMap2.value = this.normalMapFramebufferList[2];
	this.materialOcean.uniforms.u_normalMap3.value = this.normalMapFramebufferList[3];
	this.materialOcean.uniforms.u_normalMap4.value = this.normalMapFramebufferList[4];
	this.materialOcean.uniforms.u_normalMap5.value = this.normalMapFramebufferList[5];
	this.materialOcean.uniforms.u_displacementMap0.value = this.displacementMapFramebufferList[0];
	this.materialOcean.uniforms.u_displacementMap1.value = this.displacementMapFramebufferList[1];
	this.materialOcean.uniforms.u_displacementMap2.value = this.displacementMapFramebufferList[2];
	this.materialOcean.uniforms.u_displacementMap3.value = this.displacementMapFramebufferList[3];
	this.materialOcean.uniforms.u_displacementMap4.value = this.displacementMapFramebufferList[4];
	this.materialOcean.uniforms.u_displacementMap5.value = this.displacementMapFramebufferList[5];
	this.materialOcean.depthTest = true;
	
};

Ocean.prototype.render = function () {

	this.scene.overrideMaterial = null;

	for (let i=0; i<6; i++) {
		var point = this.points[i];

		this.renderInitialSpectrum(point.getWindVec2()[0], point.getWindVec2()[1]);
		this.mirror.render();
		this.renderWavePhase();
		
		this.renderSpectrum(point.getChoppiness());
		this.renderSpectrumFFT(i);
		this.renderNormalMap(i);
	}

	this.scene.overrideMaterial = null;
	
};

Ocean.prototype.generateSeedPhaseTexture = function() {

	// Setup the seed texture
	this.pingPhase = true;
	var phaseArray = new window.Float32Array(this.resolution * this.resolution * 4);
	for (var i = 0; i < this.resolution; i++) {
		for (var j = 0; j < this.resolution; j++) {
			phaseArray[i * this.resolution * 4 + j * 4] = Math.random() * 2.0 * Math.PI;
			phaseArray[i * this.resolution * 4 + j * 4 + 1] = 0.0;
			phaseArray[i * this.resolution * 4 + j * 4 + 2] = 0.0;
			phaseArray[i * this.resolution * 4 + j * 4 + 3] = 0.0;
		}
	}
	
	this.pingPhaseTexture = new THREE.DataTexture(phaseArray, this.resolution, this.resolution, THREE.RGBAFormat);
	this.pingPhaseTexture.minFilter = THREE.NearestFilter;
	this.pingPhaseTexture.magFilter = THREE.NearestFilter;
	this.pingPhaseTexture.wrapS = THREE.ClampToEdgeWrapping;
	this.pingPhaseTexture.wrapT = THREE.ClampToEdgeWrapping;
	this.pingPhaseTexture.type = THREE.FloatType;
	this.pingPhaseTexture.needsUpdate = true;
	
};

Ocean.prototype.renderInitialSpectrum = function (windX, windY) {
	
	this.scene.overrideMaterial = this.materialInitialSpectrum;
	this.materialInitialSpectrum.uniforms.u_wind.value.set( windX, windY );
	this.materialInitialSpectrum.uniforms.u_size.value = this.size;
	this.renderer.setRenderTarget(this.initialSpectrumFramebuffer);
	this.renderer.render(this.scene, this.oceanCamera);
	
};

Ocean.prototype.renderWavePhase = function () {

	this.scene.overrideMaterial = this.materialPhase;
	this.screenQuad.material = this.materialPhase;
	if (this.initial) {
		this.materialPhase.uniforms.u_phases.value = this.pingPhaseTexture;
		this.initial = false;
	}
	else {
		this.materialPhase.uniforms.u_phases.value = this.pingPhase ? this.pingPhaseFramebuffer : this.pongPhaseFramebuffer;
	}
	this.materialPhase.uniforms.u_deltaTime.value = this.deltaTime;
	this.materialPhase.uniforms.u_size.value = this.size;
	this.renderer.setRenderTarget(this.pingPhase ? this.pongPhaseFramebuffer : this.pingPhaseFramebuffer);
	this.renderer.render(this.scene, this.oceanCamera);
	this.pingPhase = !this.pingPhase;
	
};

Ocean.prototype.renderSpectrum = function (chop) {

	this.scene.overrideMaterial = this.materialSpectrum;
	this.materialSpectrum.uniforms.u_initialSpectrum.value = this.initialSpectrumFramebuffer;
	this.materialSpectrum.uniforms.u_phases.value = this.pingPhase ? this.pingPhaseFramebuffer : this.pongPhaseFramebuffer;
	this.materialSpectrum.uniforms.u_choppiness.value = chop;
	this.materialSpectrum.uniforms.u_size.value = this.size;
	this.renderer.setRenderTarget(this.spectrumFramebuffer);
	this.renderer.render(this.scene, this.oceanCamera);
	
};

Ocean.prototype.renderSpectrumFFT = function(mapID) {

	// GPU FFT using Stockham formulation
	var iterations = Math.log2( this.resolution ) * 2; // log2
	
	this.scene.overrideMaterial = this.materialOceanHorizontal;
	var subtransformProgram = this.materialOceanHorizontal;
	
	// Processus 0-N
	// material = materialOceanHorizontal
	// 0 : material( spectrumFramebuffer ) > pingTransformFramebuffer
	
	// i%2==0 : material( pongTransformFramebuffer ) > pingTransformFramebuffer
	// i%2==1 : material( pingTransformFramebuffer ) > pongTransformFramebuffer
	
	// i == N/2 : material = materialOceanVertical
	
	// i%2==0 : material( pongTransformFramebuffer ) > pingTransformFramebuffer
	// i%2==1 : material( pingTransformFramebuffer ) > pongTransformFramebuffer
	
	// N-1 : materialOceanVertical( pingTransformFramebuffer / pongTransformFramebuffer ) > displacementMapFramebuffer
	
	var frameBuffer;
	var inputBuffer;
	
	for (var i = 0; i < iterations; i++) {
		if (i === 0) {
			inputBuffer = this.spectrumFramebuffer;
			frameBuffer = this.pingTransformFramebuffer ;
		} 
		else if (i === iterations - 1) {
			inputBuffer = ((iterations % 2 === 0)? this.pingTransformFramebuffer : this.pongTransformFramebuffer) ;
			frameBuffer = this.displacementMapFramebufferList[mapID];
		}
		else if (i % 2 === 1) {
			inputBuffer = this.pingTransformFramebuffer;
			frameBuffer = this.pongTransformFramebuffer ;
		}
		else {
			inputBuffer = this.pongTransformFramebuffer;
			frameBuffer = this.pingTransformFramebuffer ;
		}
		
		if (i === iterations / 2) {
			subtransformProgram = this.materialOceanVertical;
			this.scene.overrideMaterial = this.materialOceanVertical;
		}
		
		subtransformProgram.uniforms.u_input.value = inputBuffer;
		
		subtransformProgram.uniforms.u_subtransformSize.value = Math.pow(2, (i % (iterations / 2) + 1 ));
		this.renderer.setRenderTarget(frameBuffer);
		this.renderer.render(this.scene, this.oceanCamera);
	}
	
};

Ocean.prototype.renderNormalMap = function (mapID) {

	this.scene.overrideMaterial = this.materialNormal;
	if (this.changed) {
		this.materialNormal.uniforms.u_size.value = this.size;
		this.changed = false;
	}
	this.materialNormal.uniforms.u_displacementMap.value = this.displacementMapFramebufferList[mapID];
	this.renderer.setRenderTarget(this.normalMapFramebufferList[mapID]);
	this.renderer.render(this.scene, this.oceanCamera);
};

export {Ocean};