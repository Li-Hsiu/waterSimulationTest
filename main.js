import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { Ocean } from './Ocean.js';

var camera, scene, renderer, ocean, mainDirectionalLight, cubeMesh, group, options;

function init() {
    
    // Initialize Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    document.body.appendChild(renderer.domElement);

    // Initialize Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color('skyblue');

    // Initialize Camera
    camera = new THREE.PerspectiveCamera(55.0, window.innerWidth / window.innerHeight, 0.5, 1000000);
    camera.position.set(0, 0, 0);

    // Initialize Dolly
    group = new THREE.Group();
    group.position.set(0,0,0);
    group.add(camera);
    scene.add(group);
    
    // Initialize Main Directional Light
    mainDirectionalLight = new THREE.DirectionalLight(new THREE.Color( 1, 0.95, 0.9 ), 1.5);
    mainDirectionalLight.position.set(0.2, 0.5, 1);
    scene.add(mainDirectionalLight);
    
    // Create Cube
    cubeMesh = new THREE.Mesh( new THREE.BoxGeometry( 200, 200, 200 ), new THREE.MeshPhongMaterial({ color: 'pink' }) );
    cubeMesh.position.y = 200;
    scene.add( cubeMesh );

    // Create Ocean
    options = {
        INITIAL_SIZE : 200.0,
        INITIAL_WIND : [ 10.0, 10.0 ],
        INITIAL_CHOPPINESS : 3.6,
        CLEAR_COLOR : [ 1.0, 1.0, 1.0, 0.0 ],
        SUN_DIRECTION : mainDirectionalLight.position.clone(),
        OCEAN_COLOR: new THREE.Vector3( 0.35, 0.4, 0.45 ),
        SKY_COLOR: new THREE.Vector3( 10.0, 13.0, 15.0 ),
        EXPOSURE : 0.15,
        GEOMETRY_RESOLUTION: 256,
        GEOMETRY_SIZE : 512,
        RESOLUTION : 512
    };
    ocean = new Ocean(renderer, camera, scene, options);    

    // Initialize VR Button
    document.body.appendChild( VRButton.createButton( renderer ) );
    renderer.xr.enabled = true;

    // Set group position & add resize listener
    group.position.set(300,200,800);
    onWindowResize();
    window.addEventListener('resize', onWindowResize);

    //ocean.render();
    //ocean.update();
}

var initialized = false;
function update() {
    if (camera) {
        if (renderer.xr.isPresenting && initialized == false) {
            //ocean.init(renderer, camera, scene, options, renderer.xr.getCamera(camera).cameras[0], false)
            //ocean.init(renderer, camera, scene, options, camera, true)
            initialized = true;
        }

        var currentTime = new Date().getTime();
        ocean.deltaTime = (currentTime - lastTime) / 1000 || 0.0;
        lastTime = currentTime;
        
        //group.position.z -= 1;
        if (renderer.xr.isPresenting) {
            ocean.render();
            ocean.update();
        }
        else {
            ocean.render();
            ocean.update();
            
        }
        
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
    }
}

function render() {
	renderer.setAnimationLoop(update);
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
}

var lastTime = new Date().getTime();
init();
render();