import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Ocean } from './Ocean.js';
import { Point } from './Point.js';
import Delaunator from 'https://cdn.skypack.dev/delaunator@5.0.0';

var camera, scene, renderer, ocean, mainDirectionalLight, cubeMesh, group, controls, options, isAnimating = true;
var points = [];
var pointCoords = [];
var delaunay = null;
var lastTime = new Date().getTime();
var scale = 0.35;

function init() {
    
    const buttonBackground = document.getElementById('button1');
    buttonBackground.addEventListener('click', () => {
      if (isAnimating) {
        isAnimating = false;
      }
      else {
        isAnimating = true;
      }
    });

    // Initialize Renderer
    renderer = new THREE.WebGLRenderer({  antialias:true,  precision: "highp" , }); // logarithmicDepthBuffer: true 
    renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild(renderer.domElement);

    // Initialize Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color('skyblue');

    // Initialize Camera
    camera = new THREE.PerspectiveCamera(55.0, window.innerWidth / window.innerHeight, 0.5, 50000);
    camera.position.set(0, 500, 0);
    camera.lookAt(0, -15, 25);
    scene.add(camera);

    controls = new FirstPersonControls(camera);
    controls.lookSpeed = 0.001;
    // Initialize Dolly
    //group = new THREE.Group();
    //group.position.set(0,0,0);
    //group.add(camera);
    //scene.add(group);
    
    // Initialize Main Directional Light
    mainDirectionalLight = new THREE.DirectionalLight(new THREE.Color( 1, 0.95, 0.9 ), 1.0);
    mainDirectionalLight.position.set(2300, 5000, 1550);
    scene.add(mainDirectionalLight);

    const ambientLight = new THREE.AmbientLight(0x444444);
    scene.add(ambientLight);
    
    // Create Cube
    cubeMesh = new THREE.Mesh( new THREE.BoxGeometry(1000 * scale, 500 * scale, 1000 * scale), new THREE.MeshPhongMaterial({ color: 0x3f9b0b }) );
    cubeMesh.position.x = 5000 * scale;
    scene.add( cubeMesh );

    const loader = new GLTFLoader();
    loader.load('./testIsland/scene.gltf', (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.position.set(0, -50 * scale, -1000 * scale);
        gltf.scene.scale.set(0.2 * scale, 0.2 * scale, 0.2 * scale);
    }, undefined, (error) => {
        console.error(error);
    });

    // Create Ocean
    options = {
        INITIAL_SIZE : 1000.0,
        INITIAL_WIND : [ 10.0, 10.0 ],
        INITIAL_CHOPPINESS : 2.6,
        CLEAR_COLOR : [ 1.0, 1.0, 1.0, 0.0 ],
        SUN_DIRECTION : mainDirectionalLight.position.clone(),
        OCEAN_COLOR: new THREE.Vector3( 28/256, 120/256, 236/256 ),
        SKY_COLOR: new THREE.Vector3( 10.0, 13.0, 15.0 ),
        EXPOSURE : 0.15,
        GEOMETRY_RESOLUTION: 512,
        RESOLUTION : 512
    };
    ocean = new Ocean(renderer, camera, scene, points, delaunay, options);    

    // Initialize VR Button
    document.body.appendChild( VRButton.createButton( renderer ) );
    renderer.xr.enabled = true;

    // Set group position & add resize listener
    //group.position.set(0,6000 * scale,-10000 * scale);
    //group.position.set(0, 600, -2000);
    onWindowResize();
    window.addEventListener('resize', onWindowResize);

    ocean.render();
    ocean.update();
    
    document.addEventListener("keydown", onDocumentKeyDown, false);
}

function onDocumentKeyDown(event) {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);

    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(camera.quaternion);

    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(camera.quaternion);
    /*var keyCode = event.which;
    if (keyCode == 87) { // W
        group.position.add(group.getWorldDirection(new THREE.Vector3()).multiplyScalar(100 * scale));
    } else if (keyCode == 83) { // S
        group.position.sub(group.getWorldDirection(new THREE.Vector3()).multiplyScalar(100 * scale));
    } else if (keyCode == 65) { // A
        group.position.sub(new THREE.Vector3().crossVectors(group.getWorldDirection(new THREE.Vector3()), new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(100 * scale));
    } else if (keyCode == 68) { // D
        group.position.add(new THREE.Vector3().crossVectors(group.getWorldDirection(new THREE.Vector3()), new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(100 * scale));
    } else if (keyCode == 81) { // Q
        group.rotateZ(0.05);
    } else if (keyCode == 69) { // E
        group.rotateZ(-0.05);
    } else if (keyCode == 38) { // Up
        group.rotateX(-0.05);
    } else if (keyCode == 40) { // Down 
        group.rotateX(0.05);
    } else if (keyCode == 37) { // Left
        group.rotateY(0.05);
    } else if (keyCode == 39) { // Right
        group.rotateY(-0.05);
    } else if (keyCode == 32) { // Space
        group.position.add(up.multiplyScalar(100 * scale));
    } else if (keyCode == 16) { // Shift
        group.position.sub(up.multiplyScalar(100 * scale));
    } else if (keyCode == 79) { // Shift
        ocean.size*=10;
    } else if (keyCode == 80) { // Shift
        ocean.size/=10;
    }*/
};

function update() {
    if (camera) {
        var currentTime = new Date().getTime();
        ocean.deltaTime = (currentTime - lastTime) / 5000 || 0.0;
        controls.update((currentTime - lastTime) / 10);
        lastTime = currentTime;
        
        document.querySelector(".label1").innerText = "Coord: (" + camera.position.x.toFixed(1) + ", " + camera.position.y.toFixed(1) + ", " + camera.position.z.toFixed(1) + ")";

        if (isAnimating) {
            renderer.xr.enabled = false;
            ocean.render();
            ocean.update();
            renderer.xr.enabled = true;
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

fetch('./ParameterPoints.json')
.then(response => response.json())
.then(data => {
    points = data.points.map(point => new Point(point[0], point[1], point[2], point[3], point[4]))
    const numCirclePoints = data.numBoundaryPoints;
    const radius = data.boundaryRadius;
    for (let i = 0; i < numCirclePoints; i++) {
        const angle = (2 * Math.PI * i) / numCirclePoints; 
        const x = radius * Math.cos(angle); 
        const y = radius * Math.sin(angle); 
        points.push(new Point(x, y, 0, 0, 0));
    }
    pointCoords = points.map(point => point.getCoord()).flat();
    delaunay = new Delaunator(pointCoords);
    console.log(delaunay.triangles);
    init();
    render();
});