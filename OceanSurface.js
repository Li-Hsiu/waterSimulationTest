import * as THREE from 'three';
import { Ocean2 } from './Ocean2.js';

const OceanSurface = function(renderer, camera, scene, options) {

    this.resolution = options.RESOLUTION;
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
    
    this.ocean2 = new Ocean2(renderer, camera, scene, options, [[   0,  600,   10,   0.1,   0],
                                                            [-1000,   -2,   10,   0.1,   0],
                                                            [ 1000,   -2,  -20,     0,   5]] , this.pingPhaseTexture);   
    this.ocean = new Ocean2(renderer, camera, scene, options, [[   0,  -600,   10,   0.1,   0],
                                                            [-1000,   2,   10,   0.1,   0],
                                                            [ 1000,   2,  -20,     0,   5]], this.pingPhaseTexture);     

}

OceanSurface.prototype.timeChange = function(delta) {
    this.ocean2.deltaTime = delta;
    this.ocean.deltaTime = delta;
}

OceanSurface.prototype.render = function() {
    this.ocean2.render();
    this.ocean.render();

    this.ocean2.update();
    this.ocean.update();
}

export {OceanSurface}