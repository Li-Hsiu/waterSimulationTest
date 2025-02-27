/**
 * Original work:
 * @author David Li / http://david.li/waves/
 *
 * Three.js version:
 * @author Aleksandr Albert / http://www.routter.co.tt
 * 
 * Modified:
 * @author jbouny / https://github.com/fft-ocean
 */
 
// Author: Aleksandr Albert
// Website: www.routter.co.tt

// Description: A deep water ocean shader set
// based on an implementation of a Tessendorf Waves
// originally presented by David Li ( www.david.li/waves )

// The general method is to apply shaders to simulation Framebuffers
// and then sample these framebuffers when rendering the ocean mesh

// The set uses 7 shaders:

// -- Simulation shaders
// [1] ocean_sim_vertex         -> Vertex shader used to set up a 2x2 simulation plane centered at (0,0)
// [2] ocean_subtransform       -> Fragment shader used to subtransform the mesh (generates the displacement map)
// [3] ocean_initial_spectrum   -> Fragment shader used to set intitial wave frequency at a texel coordinate
// [4] ocean_phase              -> Fragment shader used to set wave phase at a texel coordinate
// [5] ocean_spectrum           -> Fragment shader used to set current wave frequency at a texel coordinate
// [6] ocean_normal             -> Fragment shader used to set face normals at a texel coordinate

// -- Rendering Shader
// [7] ocean_main               -> Vertex and Fragment shader used to create the final render
import * as THREE from 'three';

THREE.ShaderLib['ocean_sim_vertex'] = {
	varying: {
		"vUV": { type: "v2" }
	},
	vertexShader: [
		'varying vec2 vUV;',

		'void main (void) {', 
			'vUV = position.xy * 0.5 + 0.5;',
			'gl_Position = vec4(position, 1.0 );',
		'}'
	].join('\n')
};
THREE.ShaderLib['ocean_subtransform'] = {
	uniforms: {
		"u_input": { type: "t", value: null },
		"u_transformSize": { type: "f", value: 512.0 },
		"u_subtransformSize": { type: "f", value: 250.0 },
	},
	varying: {
		"vUV": { type: "v2" }
	},
	fragmentShader: [
		//GPU FFT using a Stockham formulation

		'const float PI = 3.14159265359;',

		'uniform sampler2D u_input;',
		'uniform float u_transformSize;',
		'uniform float u_subtransformSize;',

		'varying vec2 vUV;',
		
		'vec2 multiplyComplex (vec2 a, vec2 b) {',
			'return vec2(a[0] * b[0] - a[1] * b[1], a[1] * b[0] + a[0] * b[1]);',
		'}',

		'void main (void) {',
			'#ifdef HORIZONTAL',
				'float index = vUV.x * u_transformSize - 0.5;',
			'#else',
				'float index = vUV.y * u_transformSize - 0.5;',
			'#endif',

			'float evenIndex = floor(index / u_subtransformSize) * (u_subtransformSize * 0.5) + mod(index, u_subtransformSize * 0.5);',

			//transform two complex sequences simultaneously
			'#ifdef HORIZONTAL',
				'vec4 even = texture2D(u_input, vec2(evenIndex + 0.5, gl_FragCoord.y) / u_transformSize).rgba;',
				'vec4 odd = texture2D(u_input, vec2(evenIndex + u_transformSize * 0.5 + 0.5, gl_FragCoord.y) / u_transformSize).rgba;',
			'#else',
				'vec4 even = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + 0.5) / u_transformSize).rgba;',
				'vec4 odd = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + u_transformSize * 0.5 + 0.5) / u_transformSize).rgba;',
			'#endif',

			'float twiddleArgument = -2.0 * PI * (index / u_subtransformSize);',
			'vec2 twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));',

			'vec2 outputA = even.xy + multiplyComplex(twiddle, odd.xy);',
			'vec2 outputB = even.zw + multiplyComplex(twiddle, odd.zw);',

			'gl_FragColor = vec4(outputA, outputB);',
		'}'
	].join('\n')
};
THREE.ShaderLib['ocean_initial_spectrum'] = {
	uniforms: {
		"u_wind": { type: "v2", value: new THREE.Vector2(10.0, 10.0) },
		"u_resolution": { type: "f", value: 512.0 },
		"u_size": { type: "f", value: 250.0 },
	},
	fragmentShader: [

		'const float PI = 3.14159265359;',
		'const float G = 9.81;',
		'const float KM = 370.0;',
		'const float CM = 0.23;',

		'uniform vec2 u_wind;',
		'uniform float u_resolution;',
		'uniform float u_size;',
		
		'float square (float x) {',
			'return x * x;',
		'}',

		'float omega (float k) {',
			'return sqrt(G * k * (1.0 + square(k / KM)));',
		'}',

		//'float tanh (float x) {',
			//'return (1.0 - exp(-2.0 * x)) / (1.0 + exp(-2.0 * x));',
		//'}',

		'void main (void) {',
			'vec2 coordinates = gl_FragCoord.xy - 0.5;',

			'float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;',
			'float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;',

			'vec2 K = (2.0 * PI * vec2(n, m)) / u_size;',
			'float k = length(K);',

			'float l_wind = length(u_wind);',

			'float Omega = 0.84;',
			'float kp = G * square(Omega / l_wind);',

			'float c = omega(k) / k;',
			'float cp = omega(kp) / kp;',

			'float Lpm = exp(-1.25 * square(kp / k));',
			'float gamma = 1.7;',
			'float sigma = 0.08 * (1.0 + 4.0 * pow(Omega, -3.0));',
			'float Gamma = exp(-square(sqrt(k / kp) - 1.0) / 2.0 * square(sigma));',
			'float Jp = pow(gamma, Gamma);',
			'float Fp = Lpm * Jp * exp(-Omega / sqrt(10.0) * (sqrt(k / kp) - 1.0));',
			'float alphap = 0.006 * sqrt(Omega);',
			'float Bl = 0.5 * alphap * cp / c * Fp;',

			'float z0 = 0.000037 * square(l_wind) / G * pow(l_wind / cp, 0.9);',
			'float uStar = 0.41 * l_wind / log(10.0 / z0);',
			'float alpham = 0.01 * ((uStar < CM) ? (1.0 + log(uStar / CM)) : (1.0 + 3.0 * log(uStar / CM)));',
			'float Fm = exp(-0.25 * square(k / KM - 1.0));',
			'float Bh = 0.5 * alpham * CM / c * Fm * Lpm;',

			'float a0 = log(2.0) / 4.0;',
			'float am = 0.13 * uStar / CM;',
			'float Delta = tanh(a0 + 4.0 * pow(c / cp, 2.5) + am * pow(CM / c, 2.5));',

			'float cosPhi = dot(normalize(u_wind), normalize(K));',

			'float S = (1.0 / (2.0 * PI)) * pow(k, -4.0) * (Bl + Bh) * (1.0 + Delta * (2.0 * cosPhi * cosPhi - 1.0));',

			'float dk = 2.0 * PI / u_size;',
			'float h = sqrt(S / 2.0) * dk;',

			'if (K.x == 0.0 && K.y == 0.0) {',
				'h = 0.0;', //no DC term
			'}',
			'gl_FragColor = vec4(h, 0.0, 0.0, 0.0);',
		'}'
	].join('\n')
};
THREE.ShaderLib['ocean_phase'] = {
	uniforms: {
		"u_phases": { type: "t", value: null },
		"u_deltaTime": { type: "f", value: null },
		"u_resolution": { type: "f", value: null },
		"u_size": { type: "f", value: null },
	},
	varying: {
		"vUV": { type: "v2" }
	},
	fragmentShader: [

		'const float PI = 3.14159265359;',
		'const float G = 9.81;',
		'const float KM = 370.0;',

		'varying vec2 vUV;',

		'uniform sampler2D u_phases;',
		'uniform float u_deltaTime;',
		'uniform float u_resolution;',
		'uniform float u_size;',

		'float omega (float k) {',
			'return sqrt(G * k * (1.0 + k * k / KM * KM));',
		'}',

		'void main (void) {',
			'vec2 coordinates = gl_FragCoord.xy - 0.5;',
			'float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;',
			'float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;',
			'vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;',

			'float phase = texture2D(u_phases, vUV).r;',
			'float deltaPhase = omega(length(waveVector)) * u_deltaTime;',
			'phase = mod(phase + deltaPhase, 2.0 * PI);',
		
			'gl_FragColor = vec4(phase, 0.0, 0.0, 0.0);',
		'}'
	].join('\n')
};
THREE.ShaderLib['ocean_spectrum'] = {
	uniforms: {
		"u_size": { type: "f", value: null },
		"u_resolution": { type: "f", value: null },
		"u_choppiness": { type: "f", value: null },
		"u_phases": { type: "t", value: null },
		"u_initialSpectrum": { type: "t", value: null },
	},
	varying: {
		"vUV": { type: "v2" }
	},
	fragmentShader: [

		'const float PI = 3.14159265359;',
		'const float G = 9.81;',
		'const float KM = 370.0;',

		'varying vec2 vUV;',
		
		'uniform float u_size;',
		'uniform float u_resolution;',
		'uniform float u_choppiness;',
		'uniform sampler2D u_phases;',
		'uniform sampler2D u_initialSpectrum;',

		'vec2 multiplyComplex (vec2 a, vec2 b) {',
			'return vec2(a[0] * b[0] - a[1] * b[1], a[1] * b[0] + a[0] * b[1]);',
		'}',

		'vec2 multiplyByI (vec2 z) {',
			'return vec2(-z[1], z[0]);',
		'}',

		'float omega (float k) {',
			'return sqrt(G * k * (1.0 + k * k / KM * KM));',
		'}',

		'void main (void) {',
			'vec2 coordinates = gl_FragCoord.xy - 0.5;',
			'float n = (coordinates.x < u_resolution * 0.5) ? coordinates.x : coordinates.x - u_resolution;',
			'float m = (coordinates.y < u_resolution * 0.5) ? coordinates.y : coordinates.y - u_resolution;',
			'vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;',

			'float phase = texture2D(u_phases, vUV).r;',
			'vec2 phaseVector = vec2(cos(phase), sin(phase));',

			'vec2 h0 = texture2D(u_initialSpectrum, vUV).rg;',
			'vec2 h0Star = texture2D(u_initialSpectrum, vec2(1.0 - vUV + 1.0 / u_resolution)).rg;',
			'h0Star.y *= -1.0;',

			'vec2 h = multiplyComplex(h0, phaseVector) + multiplyComplex(h0Star, vec2(phaseVector.x, -phaseVector.y));',
			
			'vec2 hX = -multiplyByI(h * (waveVector.x / length(waveVector))) * u_choppiness;',
			'vec2 hZ = -multiplyByI(h * (waveVector.y / length(waveVector))) * u_choppiness;',

			//no DC term
			'if (waveVector.x == 0.0 && waveVector.y == 0.0) {',
				'h = vec2(0.0);',
				'hX = vec2(0.0);',
				'hZ = vec2(0.0);',
			'}',
		
			'gl_FragColor = vec4(hX + multiplyByI(h), hZ);',
		'}'
	].join('\n')
};
THREE.ShaderLib['ocean_normals'] = {
	uniforms: {
		"u_displacementMap": { type: "t", value: null },
		"u_resolution": { type: "f", value: null },
		"u_size": { type: "f", value: null },
	},
	varying: {
		"vUV": { type: "v2" }
	},
	fragmentShader: [

		'varying vec2 vUV;',
		
		'uniform sampler2D u_displacementMap;',
		'uniform float u_resolution;',
		'uniform float u_size;',

		'void main (void) {',
			'float texel = 1.0 / u_resolution;',
			'float texelSize = u_size / u_resolution;',

			'vec3 center = texture2D(u_displacementMap, vUV).rgb;',
			'vec3 right = vec3(texelSize, 0.0, 0.0) + texture2D(u_displacementMap, vUV + vec2(texel, 0.0)).rgb - center;',
			'vec3 left = vec3(-texelSize, 0.0, 0.0) + texture2D(u_displacementMap, vUV + vec2(-texel, 0.0)).rgb - center;',
			'vec3 top = vec3(0.0, 0.0, -texelSize) + texture2D(u_displacementMap, vUV + vec2(0.0, -texel)).rgb - center;',
			'vec3 bottom = vec3(0.0, 0.0, texelSize) + texture2D(u_displacementMap, vUV + vec2(0.0, texel)).rgb - center;',

			'vec3 topRight = cross(right, top);',
			'vec3 topLeft = cross(top, left);',
			'vec3 bottomLeft = cross(left, bottom);',
			'vec3 bottomRight = cross(bottom, right);',
		
			'gl_FragColor = vec4(normalize(topRight + topLeft + bottomLeft + bottomRight), 1.0);',
		'}'
	].join('\n')
};

THREE.UniformsLib[ "oceanfft" ] = {
	"u_displacementMap0": { type: "t", value: null },
	"u_displacementMap1": { type: "t", value: null },
	"u_displacementMap2": { type: "t", value: null },
	"u_displacementMap3": { type: "t", value: null },
	"u_displacementMap4": { type: "t", value: null },
	"u_displacementMap5": { type: "t", value: null },
	"u_reflection": { type: "t", value: null },
	"u_normalMap0": { type: "t", value: null },
	"u_normalMap1": { type: "t", value: null },
	"u_normalMap2": { type: "t", value: null },
	"u_normalMap3": { type: "t", value: null },
	"u_normalMap4": { type: "t", value: null },
	"u_normalMap5": { type: "t", value: null },
	"u_geometrySize": { type: "f", value: null },
	"u_size": { type: "f", value: null },
	"u_mirrorMatrix": { type: "m4", value: null },
	"u_cameraPosition": { type: "v3", value: null },
	"u_skyColor": { type: "v3", value: null },
	"u_oceanColor": { type: "v3", value: null },
	"u_sunDirection": { type: "v3", value: null },
	"u_exposure": { type: "f", value: null },
	"u_vertexOneTwo": { type: "t", value: null },
	"u_vertexThree": { type: "t", value: null },
	"u_triangleColor": { type: "t", value: null },
	"u_numTriangles": { type: "i", value: null },
	"u_numPoints": { type: "i", value: null },
	"u_triangleToVertex": { type: "t", value: null },
	"u_vertexColor": { type: "t", value: null },
	"u_cameraPosition": { type: "v3", value: null },
},

THREE.ShaderChunk[ "oceanfft_pars_vertex" ] = [
	'uniform sampler2D u_displacementMap0;',
	'uniform sampler2D u_displacementMap1;',
	'uniform sampler2D u_displacementMap2;',
	'uniform sampler2D u_displacementMap3;',
	'uniform sampler2D u_displacementMap4;',
	'uniform sampler2D u_displacementMap5;',
	'uniform float u_geometrySize;',
	'uniform float u_size;',
		
].join('\n');

THREE.ShaderChunk[ "oceanfft_vertex" ] = [
	/*
	'float x1 = 300.0;',
	'float x2 = -300.0;',
	'vec3 displacement;', 
	'if (worldPosition.z > 500.0 || worldPosition.z < 0.0 || worldPosition.x < -500.0 || worldPosition.x > 500.0) {',
		'displacement = vec3(0.0);',
	'}',
	'else if (worldPosition.x > x1) {',
		'displacement = texture2D( u_displacementMap, worldPosition.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
	'}',
	'else if (worldPosition.x < x2) {',
		'displacement = texture2D( u_displacementMap2, worldPosition.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
	'}',
	'else {',
		'float t = (worldPosition.x - x2) / (x1 - x2);',
		'vec3 displacement160 = texture2D(u_displacementMap2, worldPosition.xz * 0.002).rgb * (u_geomertySize / u_size);',
		'vec3 displacement340 = texture2D(u_displacementMap, worldPosition.xz * 0.002).rgb * (u_geometrySize / u_size);',
		'displacement = mix(displacement160, displacement340, t);',
	'}',*/
	'vec3 displacement = vec3(0.0, 0.0, 0.0);',
	'bool isInTriangle = false;',
	'for (int i=0; i<u_numTriangles; i++) {',
		'vec2 v1 = texture(u_vertexOneTwo, vec2(float(i)/float(u_numTriangles-1), 0.0)).rg;',
		'vec2 v2 = texture(u_vertexOneTwo, vec2(float(i)/float(u_numTriangles-1), 0.0)).ba;',
		'vec2 v3 = texture(u_vertexThree, vec2(float(i)/float(u_numTriangles-1), 0.0)).xy;',
		'vec3 areas = isPointInTriangle(worldPosition.x, worldPosition.z, v1.x, v1.y, v2.x, v2.y, v3.x, v3.y);',
		'if (areas != vec3(-1.0)) {',
			'isInTriangle = true;',
			'float totalArea = abs((v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x));',
			'float alpha = areas.y / totalArea;',
			'float beta = areas.z / totalArea;',
			'float gamma = areas.x / totalArea;',
			'vec3 vertexIdx = texture(u_triangleToVertex, vec2(float(i)/float(u_numTriangles-1), 0.0)).xyz;',
			'vec3 displacementV1 = vec3(0.0);',
			'if (vertexIdx.x > 5.0) displacementV1 = getTotalAverageDisplacementMap(worldPosition.xyz);',
			'else displacementV1 = getDisplacementMap(int(vertexIdx.x), worldPosition.xyz);',
			'vec3 displacementV2 = vec3(0.0);',
			'if (vertexIdx.y > 5.0) displacementV2 = getTotalAverageDisplacementMap(worldPosition.xyz);',
			'else displacementV2 = getDisplacementMap(int(vertexIdx.y), worldPosition.xyz);',
			'vec3 displacementV3 = vec3(0.0);',
			'if (vertexIdx.z > 5.0) displacementV3 = getTotalAverageDisplacementMap(worldPosition.xyz);',
			'else displacementV3 = getDisplacementMap(int(vertexIdx.z), worldPosition.xyz);',
			'displacement = alpha * displacementV1 + beta * displacementV2 + gamma * displacementV3;',
			'break;',
		'}',
	'}',
	'if (isInTriangle == false) displacement = getTotalAverageDisplacementMap(worldPosition.xyz);',

	'float distToCamera = length( getCameraPos(getRotation()) - worldPosition.xyz );',
	'float t = clamp(distToCamera/5000.0, 0.0, 1.0);',
	'vec3 interpolatedDisplacement = mix(displacement, vec3(0.0, 0.0, 0.0), t);',

	//'vec4 oceanfftWorldPosition = worldPosition + vec4( interpolatedDisplacement.x, interpolatedDisplacement.y, interpolatedDisplacement.z, 0.0 );',
	'vec4 oceanfftWorldPosition = worldPosition + vec4( displacement.x, displacement.y, displacement.z, 0.0 );',
	
].join('\n');

THREE.ShaderChunk[ "oceanfft_pars_fragment" ] = [
  
].join('\n');

THREE.ShaderChunk[ "oceanfft_fragment" ] = [
	
].join('\n');

THREE.ShaderLib['ocean_main'] = {
	uniforms: THREE.UniformsLib[ "oceanfft" ],
  
	vertexShader: [
		'#define MAX_MAPS 20',
		'precision highp float;',
		
		'varying vec2 vUV;',
		'varying vec3 vWorldPosition;',
		'varying vec4 vReflectCoordinates;',

		'uniform mat4 u_mirrorMatrix;',
		
		'uniform sampler2D u_vertexOneTwo;',
		'uniform sampler2D u_vertexThree;',
		'uniform sampler2D u_triangleToVertex;',
		'uniform int u_numTriangles;',
		'uniform int u_numPoints;',

		THREE.ShaderChunk[ "screenplane_pars_vertex" ],
		THREE.ShaderChunk[ "oceanfft_pars_vertex" ],

		'vec3 isPointInTriangle(float px, float py, float ax, float ay, float bx, float by, float cx, float cy) {',
			'float area1 = (px - ax) * (by - ay) - (py - ay) * (bx - ax);', // cross product without 0.5
			'float area2 = (px - bx) * (cy - by) - (py - by) * (cx - bx);',
			'float area3 = (px - cx) * (ay - cy) - (py - cy) * (ax - cx);',
			'if ((area1 >= 0.0 && area2 >= 0.0 && area3 >= 0.0) || (area1 <= 0.0 && area2 <= 0.0 && area3 <= 0.0)) {',
				'return vec3(area1, area2, area3);',
			'}',
			'return vec3(-1.0);',
		'}',

		'vec3 getDisplacementMap(int id, vec3 pos) {',
			'switch(id) {',
				'case 0:',
					'return texture2D( u_displacementMap0, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
					'break;',
				'case 1:',
					'return texture2D( u_displacementMap1, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
					'break;',
				'case 2:',
					'return texture2D( u_displacementMap2, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
					'break;',
				'case 3:',
					'return texture2D( u_displacementMap3, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
					'break;',
				'case 4:',
					'return texture2D( u_displacementMap4, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
					'break;',
				'case 5:',
					'return texture2D( u_displacementMap5, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
					'break;',
			'}',
			
		'}',
		'vec3 getTotalAverageDisplacementMap(vec3 pos) {',
			'vec3 averageDisplacement = vec3(0.0);',
			'averageDisplacement += texture2D( u_displacementMap0, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
			'averageDisplacement += texture2D( u_displacementMap1, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
			'averageDisplacement += texture2D( u_displacementMap2, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
			'averageDisplacement += texture2D( u_displacementMap3, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
			'averageDisplacement += texture2D( u_displacementMap4, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
			'averageDisplacement += texture2D( u_displacementMap5, pos.xz * 0.002 ).rgb * ( u_geometrySize / u_size );',
			'averageDisplacement /= 6.0;',
			'return averageDisplacement;',
		'}',


		'void main (void) {',
			THREE.ShaderChunk[ "screenplane_vertex" ],
			'vec4 worldPosition = screenPlaneWorldPosition;',

			THREE.ShaderChunk[ "oceanfft_vertex" ],
			'vWorldPosition = oceanfftWorldPosition.xyz;',
			'vReflectCoordinates = u_mirrorMatrix * oceanfftWorldPosition;',

			'vUV = position.xy * 0.5 + 0.5;',

			'gl_Position = projectionMatrix * viewMatrix * vec4(oceanfftWorldPosition.x, oceanfftWorldPosition.y, oceanfftWorldPosition.z, 1.0);',
			
		'}'
	].join('\n'),

	vertexTriangleShader: [

		'varying vec3 vWorldPosition;',
		THREE.ShaderChunk[ "screenplane_pars_vertex" ],

		'void main (void) {',
			THREE.ShaderChunk[ "screenplane_vertex" ],
			'vec4 worldPosition = screenPlaneWorldPosition;',

			'vWorldPosition = worldPosition.xyz;',
			'gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition.x, worldPosition.y, worldPosition.z, 1.0);',
			
		'}'
  	].join('\n'),

	fragmentShader: [
		'varying vec3 vWorldPosition;',
		'varying vec4 vReflectCoordinates;',

		'uniform sampler2D u_reflection;',
		'uniform sampler2D u_normalMap0;',
		'uniform sampler2D u_normalMap1;',
		'uniform sampler2D u_normalMap2;',
		'uniform sampler2D u_normalMap3;',
		'uniform sampler2D u_normalMap4;',
		'uniform sampler2D u_normalMap5;',
		'uniform sampler2D u_vertexOneTwo;',
		'uniform sampler2D u_vertexThree;',
		'uniform sampler2D u_triangleToVertex;',
		'uniform int u_numTriangles;',
		'uniform int u_numPoints;',
		'uniform vec3 u_oceanColor;',
		'uniform vec3 u_sunDirection;',
		'uniform float u_exposure;',

		'vec3 hdr (vec3 color, float exposure) {',
			'return 1.0 - exp(-color * exposure);',
		'}',
		
		THREE.ShaderChunk["screenplane_pars_fragment"],

		'vec3 isPointInTriangle(float px, float py, float ax, float ay, float bx, float by, float cx, float cy) {',
			'float area1 = (px - ax) * (by - ay) - (py - ay) * (bx - ax);', // cross product without 0.5
			'float area2 = (px - bx) * (cy - by) - (py - by) * (cx - bx);',
			'float area3 = (px - cx) * (ay - cy) - (py - cy) * (ax - cx);',
			'if ((area1 >= 0.0 && area2 >= 0.0 && area3 >= 0.0) || (area1 <= 0.0 && area2 <= 0.0 && area3 <= 0.0)) {',
				'return vec3(area1, area2, area3);',
			'}',
			'return vec3(-1.0);',
		'}',

		'vec3 getNormalMap(int id, vec3 pos) {',
			'switch(id) {',
				'case 0:',
					'return texture2D( u_normalMap0, pos.xz * 0.002 ).rgb;',
					'break;',
				'case 1:',
					'return texture2D( u_normalMap1, pos.xz * 0.002 ).rgb;',
					'break;',
				'case 2:',
					'return texture2D( u_normalMap2, pos.xz * 0.002 ).rgb;',
					'break;',
				'case 3:',
					'return texture2D( u_normalMap3, pos.xz * 0.002 ).rgb;',
					'break;',
				'case 4:',
					'return texture2D( u_normalMap4, pos.xz * 0.002 ).rgb;',
					'break;',
				'case 5:',
					'return texture2D( u_normalMap5, pos.xz * 0.002 ).rgb;',
					'break;',
			'}',
		'}',

		'vec3 getTotalAverageNormalMap(vec3 pos) {',
			'vec3 averageNormal = vec3(0.0);',
			'averageNormal += texture2D( u_normalMap0, pos.xz * 0.002 ).rgb;',
			'averageNormal += texture2D( u_normalMap1, pos.xz * 0.002 ).rgb;',
			'averageNormal += texture2D( u_normalMap2, pos.xz * 0.002 ).rgb;',
			'averageNormal += texture2D( u_normalMap3, pos.xz * 0.002 ).rgb;',
			'averageNormal += texture2D( u_normalMap4, pos.xz * 0.002 ).rgb;',
			'averageNormal += texture2D( u_normalMap5, pos.xz * 0.002 ).rgb;',
			'averageNormal /= 6.0;',
			'return averageNormal;',
		'}',

		'void main (void) {',
			/*'if (vWorldPosition.z > 500.0 || vWorldPosition.z < 0.0 || vWorldPosition.x < -500.0 || vWorldPosition.x > 500.0) {',
				'gl_FragColor = vec4( 0.5294, 0.8078, 0.9216,  1.0 );',
				'return;',
			'}',
			'float x1 = 300.0;',
			'float x2 = -300.0;',
			'vec3 normal;',
			'if (vWorldPosition.x > x1) {',
				'normal = texture2D( u_normalMap, vWorldPosition.xz * 0.002 ).rgb;',
			'}',
			'else if (vWorldPosition.x < x2) {',
				'normal = texture2D( u_normalMap2, vWorldPosition.xz * 0.002 ).rgb;',
			'}',
			'else {',
				'float t = (vWorldPosition.x - x2) / (x1 - x2);',
				'vec3 normal160 = texture2D(u_normalMap2, vWorldPosition.xz * 0.002).rgb;',
				'vec3 normal340 = texture2D(u_normalMap, vWorldPosition.xz * 0.002).rgb;',
				'normal = mix(normal160, normal340, t);',
			'}',*/

			'vec3 normal = vec3(0.0);',
			'bool isInTriangle = false;',
			'for (int i=0; i<u_numTriangles; i++) {',
				'vec2 v1 = texture(u_vertexOneTwo, vec2(float(i)/float(u_numTriangles-1), 0.0)).rg;',
				'vec2 v2 = texture(u_vertexOneTwo, vec2(float(i)/float(u_numTriangles-1), 0.0)).ba;',
				'vec2 v3 = texture(u_vertexThree, vec2(float(i)/float(u_numTriangles-1), 0.0)).xy;',
				'vec3 areas = isPointInTriangle(vWorldPosition.x, vWorldPosition.z, v1.x, v1.y, v2.x, v2.y, v3.x, v3.y);',
				'if (areas != vec3(-1.0)) {',
					'isInTriangle = true;',
					'float totalArea = abs((v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x));',
					'float alpha = areas.y / totalArea;',
					'float beta = areas.z / totalArea;',
					'float gamma = areas.x / totalArea;',
					'vec3 vertexIdx = texture(u_triangleToVertex, vec2(float(i)/float(u_numTriangles-1), 0.0)).xyz;',
					'vec3 normalV1 = vec3(0.0);',
					'if (vertexIdx.x > 5.0) normalV1 = getTotalAverageNormalMap(vWorldPosition.xyz);',
					'else normalV1 = getNormalMap(int(vertexIdx.x), vWorldPosition.xyz);',
					'vec3 normalV2 = vec3(0.0);',
					'if (vertexIdx.y > 5.0) normalV2 = getTotalAverageNormalMap(vWorldPosition.xyz);',
					'else normalV2 = getNormalMap(int(vertexIdx.y), vWorldPosition.xyz);',
					'vec3 normalV3 = vec3(0.0);',
					'if (vertexIdx.z > 5.0) normalV3 = getTotalAverageNormalMap(vWorldPosition.xyz);',
					'else normalV3 = getNormalMap(int(vertexIdx.z), vWorldPosition.xyz);',
					'normal = alpha * normalV1 + beta * normalV2 + gamma * normalV3;',
					'break;',
				'}',
			'}',
			'if (!isInTriangle) {',
				'normal = getTotalAverageNormalMap(vWorldPosition.xyz);',
			'}',
			'normal = normalize(normal);',

			'float distToCamera = length( vCamPosition - vWorldPosition );',
			'float t = clamp(distToCamera/30000.0, 0.0, 1.0);',
			'vec3 interpolatedNormal = mix(normal, vec3(0.0, 1.0, 0.0), t);',

			'vec3 view = normalize( vCamPosition - vWorldPosition );',
			
			// Compute the specular factor
			'vec3 reflection = normalize( reflect( -u_sunDirection, interpolatedNormal ) );',
			'float specularFactor = pow( max( 0.0, dot( view, reflection ) ), 500.0 ) * 5.0;', // 20.0
		
			// Get reflection color
			'vec3 distortion = 200.0 * interpolatedNormal * vec3( 1.0, 0.0, 0.1 );',	
			'vec3 reflectionColor = texture2DProj( u_reflection, vReflectCoordinates.xyz + distortion ).xyz;',
			
			// Smooth the normal following the distance
			'float distanceRatio = min( 1.0, log( 1.0 / length( vCamPosition - vWorldPosition ) * 3000.0 + 1.0 ) );',
			'distanceRatio *= distanceRatio;',
			'distanceRatio = distanceRatio * 0.7 + 0.3;',
			//'distanceRatio = 1.0;',
			'interpolatedNormal = ( distanceRatio * interpolatedNormal + vec3( 0.0, 1.0 - distanceRatio, 0.0 ) ) * 0.5;',
			'interpolatedNormal /= length( interpolatedNormal );',
			
			// Compute the fresnel ratio
			'float fresnel = pow( 1.0 - dot( interpolatedNormal, view ), 2.0 );',
			
			// Compute the sky reflection and the water color
			'float skyFactor = ( fresnel + 0.2 ) * 10.0;',
			'vec3 waterColor = ( 1.0 - fresnel ) * u_oceanColor;',
			
			// Compute the final color
			'vec3 skyColor = vec3(135.0/256.0, 206.0/256.0, 235.0/256.0);',
			'reflectionColor = mix(reflectionColor, skyColor, 0.35);',
			'vec3 color = ( skyFactor + specularFactor + waterColor ) * reflectionColor + waterColor * 0.5 ;',
			'color = hdr( color, u_exposure );',
			//'gl_FragColor = vec4( interpolatedNormal,  1.0 );',
			'gl_FragColor = vec4( color,  1.0 );',
		'}'
	].join('\n'),

	triangulationShader: [
		'varying vec3 vWorldPosition;',

		'uniform sampler2D u_vertexOneTwo;',
		'uniform sampler2D u_vertexThree;',
		'uniform sampler2D u_triangleColor;',
		'uniform sampler2D u_triangleToVertex;',
		'uniform sampler2D u_vertexColor;',
		'uniform int u_numTriangles;',
		'uniform int u_numPoints;',
		
		'vec3 isPointInTriangle(float px, float py, float ax, float ay, float bx, float by, float cx, float cy) {',
			'float area1 = (px - ax) * (by - ay) - (py - ay) * (bx - ax);', // cross product without 0.5
			'float area2 = (px - bx) * (cy - by) - (py - by) * (cx - bx);',
			'float area3 = (px - cx) * (ay - cy) - (py - cy) * (ax - cx);',
			'if ((area1 >= 0.0 && area2 >= 0.0 && area3 >= 0.0) || (area1 <= 0.0 && area2 <= 0.0 && area3 <= 0.0)) {',
				'return vec3(area1, area2, area3);',
			'}',
			'return vec3(-1.0);',
		'}',

		'void main (void) {',
			'vec3 color = vec3(0.5294, 0.8078, 0.9216);',
			'for (int i=0; i<u_numTriangles; i++) {',
				'vec2 v1 = texture(u_vertexOneTwo, vec2(float(i)/float(u_numTriangles-1), 0.0)).rg;',
				'vec2 v2 = texture(u_vertexOneTwo, vec2(float(i)/float(u_numTriangles-1), 0.0)).ba;',
				'vec2 v3 = texture(u_vertexThree, vec2(float(i)/float(u_numTriangles-1), 0.0)).xy;',
				'vec3 areas = isPointInTriangle(vWorldPosition.x, vWorldPosition.z, v1.x, v1.y, v2.x, v2.y, v3.x, v3.y);',
				'if (areas != vec3(-1.0)) {',
					'float totalArea = abs((v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x));',
					'float alpha = areas.y / totalArea;',
					'float beta = areas.z / totalArea;',
					'float gamma = areas.x / totalArea;',
					'vec3 vertexIdx = texture(u_triangleToVertex, vec2(float(i)/float(u_numTriangles-1), 0.0)).xyz;',
					'vec3 colorV1 = texture(u_vertexColor, vec2(vertexIdx.x/float(u_numTriangles-1), 0.0)).rgb;',
					'vec3 colorV2 = texture(u_vertexColor, vec2(vertexIdx.y/float(u_numTriangles-1), 0.0)).rgb;',
					'vec3 colorV3 = texture(u_vertexColor, vec2(vertexIdx.z/float(u_numTriangles-1), 0.0)).rgb;',
					'color = alpha * colorV1 + beta * colorV2 + gamma * colorV3;',
					'color = texture(u_triangleColor, vec2(float(i)/float(u_numTriangles-1), 0.0)).rgb;',
					'break;',
				'}',
			'}',
			'gl_FragColor = vec4( color,  1.0 );',
		'}'
	].join('\n')
};