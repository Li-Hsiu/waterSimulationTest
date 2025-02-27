/**
 * @author jbouny / https://github.com/fft-ocean
 */
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
		"u_subtransformSize": { type: "f", value: 250.0 }
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
		//	'return (1.0 - exp(-2.0 * x)) / (1.0 + exp(-2.0 * x));',
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

    "u_coord1" : { type: "v2", value: null},
    "u_coord2" : { type: "v2", value: null},
    "u_coord3" : { type: "v2", value: null},
	"u_displacementMap0": { type: "t", value: null },
    "u_displacementMap1": { type: "t", value: null },
    "u_displacementMap2": { type: "t", value: null },
	"u_reflection": { type: "t", value: null },
	"u_normalMap0": { type: "t", value: null },
	"u_normalMap1": { type: "t", value: null },
	"u_normalMap2": { type: "t", value: null },
	"u_geometrySize": { type: "f", value: null },
	"u_size": { type: "f", value: null },
	"u_mirrorMatrix": { type: "m4", value: null },
	"u_cameraPosition": { type: "v3", value: null },
	"u_skyColor": { type: "v3", value: null },
	"u_oceanColor": { type: "v3", value: null },
	"u_sunDirection": { type: "v3", value: null },
	"u_exposure": { type: "f", value: null },

},

THREE.ShaderChunk[ "oceanfft_pars_vertex" ] = [

    'uniform vec2 u_coord1;',
    'uniform vec2 u_coord2;',
    'uniform vec2 u_coord3;',
	'uniform sampler2D u_displacementMap0;',
    'uniform sampler2D u_displacementMap1;',
    'uniform sampler2D u_displacementMap2;',
	'uniform float u_geometrySize;',
	'uniform float u_size;',
		
].join('\n');

THREE.ShaderChunk[ "oceanfft_pars_fragment" ] = [
  
].join('\n');

THREE.ShaderChunk[ "oceanfft_fragment" ] = [
	
].join('\n');

THREE.ShaderLib['ocean_main'] = {
	uniforms: THREE.UniformsLib[ "oceanfft" ],
  
	vertexShader: [
		'precision highp float;',
		
		'varying vec3 vWorldPosition;',
		'varying vec4 vReflectCoordinates;',
        'varying float isInTriangle;',

		'uniform mat4 u_mirrorMatrix;',
		
		THREE.ShaderChunk[ "screenplane_pars_vertex" ],
		THREE.ShaderChunk[ "oceanfft_pars_vertex" ],

		'void main (void) {',
			THREE.ShaderChunk[ "screenplane_vertex" ],
			
			'vec4 worldPosition = screenPlaneWorldPosition;',

            'float area1 = (worldPosition.x - u_coord1.x) * (u_coord2.y - u_coord1.y) - (worldPosition.z - u_coord1.y) * (u_coord2.x - u_coord1.x);',
            'float area2 = (worldPosition.x - u_coord2.x) * (u_coord3.y - u_coord2.y) - (worldPosition.z - u_coord2.y) * (u_coord3.x - u_coord2.x);',
            'float area3 = (worldPosition.x - u_coord3.x) * (u_coord1.y - u_coord3.y) - (worldPosition.z - u_coord3.y) * (u_coord1.x - u_coord3.x);',
            
			'isInTriangle = 0.0;',
			'vec3 displacement = vec3(0.0, -100.0, 0.0);',
            'if ((area1 >= 0.0 && area2 >= 0.0 && area3 >= 0.0) || (area1 <= 0.0 && area2 <= 0.0 && area3 <= 0.0)) {',
				'float totalArea = area1 + area2 + area3;',
				'float bary1 = area2 / totalArea;',
				'float bary2 = area3 / totalArea;',
				'float bary3 = area1 / totalArea;',
				'vec3 disp1 = texture2D(u_displacementMap0, worldPosition.xz * 0.002).rgb * (u_geometrySize / u_size);',
				'vec3 disp2 = texture2D(u_displacementMap1, worldPosition.xz * 0.002).rgb * (u_geometrySize / u_size);',
				'vec3 disp3 = texture2D(u_displacementMap2, worldPosition.xz * 0.002).rgb * (u_geometrySize / u_size);',

                'displacement = bary1 * disp1 + bary2 * disp2 + bary3 * disp3;',
				//'displacement = vec3(0.0,0.0,0.0);',
                'isInTriangle = 1.0;',
            '}',
            
            'vec4 oceanfftWorldPosition = worldPosition + vec4( displacement, 0.0 );',
			
			'vWorldPosition = oceanfftWorldPosition.xyz;',
			'vReflectCoordinates = u_mirrorMatrix * oceanfftWorldPosition;',
			
			'gl_Position = projectionMatrix * viewMatrix * oceanfftWorldPosition;',
		'}'
	].join('\n'),
  
  
	fragmentShader: [
		'precision highp float;',
		'varying vec3 vWorldPosition;',
		'varying vec4 vReflectCoordinates;',
        'varying float isInTriangle;',

		'uniform vec2 u_coord1;',
		'uniform vec2 u_coord2;',
		'uniform vec2 u_coord3;',

		'uniform sampler2D u_reflection;',
		'uniform sampler2D u_normalMap0;',
        'uniform sampler2D u_normalMap1;',
        'uniform sampler2D u_normalMap2;',
		'uniform vec3 u_oceanColor;',
		'uniform vec3 u_sunDirection;',
		'uniform float u_exposure;',

		'vec3 hdr (vec3 color, float exposure) {',
			'return 1.0 - exp(-color * exposure);',
		'}',
		
		THREE.ShaderChunk["screenplane_pars_fragment"],

		'void main (void) {',

			'float area1 = (vWorldPosition.x - u_coord1.x) * (u_coord2.y - u_coord1.y) - (vWorldPosition.z - u_coord1.y) * (u_coord2.x - u_coord1.x);',
            'float area2 = (vWorldPosition.x - u_coord2.x) * (u_coord3.y - u_coord2.y) - (vWorldPosition.z - u_coord2.y) * (u_coord3.x - u_coord2.x);',
            'float area3 = (vWorldPosition.x - u_coord3.x) * (u_coord1.y - u_coord3.y) - (vWorldPosition.z - u_coord3.y) * (u_coord1.x - u_coord3.x);',
			'if (!((area1 >= 0.0 && area2 >= 0.0 && area3 >= 0.0) || (area1 <= 0.0 && area2 <= 0.0 && area3 <= 0.0))) {',
				'gl_FragColor = vec4( 0.5294, 0.8078, 0.9216, 0.0 );',
				'return;',
			'}',
			'float totalArea = area1 + area2 + area3;',
			'float bary1 = area2 / totalArea;',
			'float bary2 = area3 / totalArea;',
			'float bary3 = area1 / totalArea;',
			'vec3 norm1 = texture2D(u_normalMap0, vWorldPosition.xz * 0.002).rgb;',
			'vec3 norm2 = texture2D(u_normalMap1, vWorldPosition.xz * 0.002).rgb;',
			'vec3 norm3 = texture2D(u_normalMap2, vWorldPosition.xz * 0.002).rgb;',

			'vec3 normal =  bary1 * norm1 + bary2 * norm2 + bary3 * norm3;',

			'vec3 view = normalize( vCamPosition - vWorldPosition );',
			
			// Compute the specular factor
			'vec3 reflection = normalize( reflect( -u_sunDirection, normal ) );',
			'float specularFactor = pow( max( 0.0, dot( view, reflection ) ), 500.0 ) * 20.0;',
		
			// Get reflection color
			'vec3 distortion = 200.0 * normal * vec3( 1.0, 0.0, 0.1 );',	
			'vec3 reflectionColor = texture2DProj( u_reflection, vReflectCoordinates.xyz + distortion ).xyz;',
			
			// Smooth the normal following the distance
			'float distanceRatio = min( 1.0, log( 1.0 / length( vCamPosition - vWorldPosition ) * 3000.0 + 1.0 ) );',
			'distanceRatio *= distanceRatio;',
			'distanceRatio = distanceRatio * 0.7 + 0.3;',
			//'distanceRatio = 1.0;',
			'normal = ( distanceRatio * normal + vec3( 0.0, 1.0 - distanceRatio, 0.0 ) ) * 0.5;',
			'normal /= length( normal );',
			
			// Compute the fresnel ratio
			'float fresnel = pow( 1.0 - dot( normal, view ), 2.0 );',
			
			// Compute the sky reflection and the water color
			'float skyFactor = ( fresnel + 0.2 ) * 10.0;',
			'vec3 waterColor = ( 1.0 - fresnel ) * u_oceanColor;',
			
			// Compute the final color
			'vec3 color = ( skyFactor + specularFactor + waterColor ) * reflectionColor + waterColor * 0.5 ;',
			'color = hdr( color, u_exposure );',

			'gl_FragColor = vec4( color, 1.0 );',
		'}'
	].join('\n')
};