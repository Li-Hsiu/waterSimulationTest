import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { Ocean } from './Ocean.js';
import { Ocean2 } from './Ocean2.js';
import { OceanSurface } from './OceanSurface.js';
import { Point } from './Point.js';
import Delaunator from 'https://cdn.skypack.dev/delaunator@5.0.0';

var camera, scene, renderer, ocean, ocean2, oceanSurface, mainDirectionalLight, loadingManager, isLoaded = false, cubeMesh, modelStrings, controls, options, isAnimating = true;
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

    loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = function () {
        console.log("Finished Loading!")
        isLoaded = true;
    };
    loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
        console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
    };

    // Initialize Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color('skyblue');

    let s = 2;
    let y = -5;

    // Initialize Camera
    camera = new THREE.PerspectiveCamera(55.0, window.innerWidth / window.innerHeight, 0.5, 50000);
    camera.position.set(0, 100*s, 0);
    camera.lookAt(0, 0, 0);
    scene.add(camera);

    controls = new FirstPersonControls(camera);
    controls.lookSpeed = 0.001;
    controls.movementSpeed = s;

    // Initialize Main Directional Light
    mainDirectionalLight = new THREE.DirectionalLight(new THREE.Color( 1, 0.95, 0.9 ), 1.0);
    mainDirectionalLight.position.set(2300, 5000, 1550);
    scene.add(mainDirectionalLight);

    const ambientLight = new THREE.AmbientLight(0xFFFFFF);
    scene.add(ambientLight);
    
    // Create Cube
    cubeMesh = new THREE.Mesh( new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({ color: 0x3f9b0b }) );
    //  cubeMesh.position.x = 5000 * scale;
    //scene.add( cubeMesh );

    const loader = new GLTFLoader(loadingManager);
    // loader.load('./testIsland/scene.gltf', (gltf) => {
    //     //scene.add(gltf.scene);
    //     gltf.scene.position.set(0, -50 * scale, -1000 * scale);
    //     gltf.scene.scale.set(0.2 * scale, 0.2 * scale, 0.2 * scale);
    // }, undefined, (error) => {
    //     console.error(error);
    // });
    
    modelStrings.forEach((modelPath) => {
        loader.load(modelPath, (gltf) => {
            const model = gltf.scene;
            model.position.set(-822875*s, y, 816500*s);
            model.scale.set(s, s, s);
            model.traverse((child) => {
                if (child.isMesh) {
                    child.material.polygonOffset = true;
                    child.material.polygonOffsetFactor = 10;
                    child.material.polygonOffsetUnits = 10; 
                }
            });
            scene.add(model);
        }, undefined, (error) => {
            console.error(error);
        });
    });
    /*
    loader.load('./10-SE-6A/TERRAIN(TB)/T22500162000106E10/T22500162000106E10.gltf', (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.position.set(-822875*s, y, 816500*s);
        gltf.scene.scale.set(s, s, s);
    }, undefined, (error) => {
        console.error(error);
    });

    loader.load('./10-SE-6C/TERRAIN(TB)/T22500156000106E10/T22500156000106E10.gltf', (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.position.set(-822875*s, y, 816500*s);
        gltf.scene.scale.set(s, s, s);
    }, undefined, (error) => {
        console.error(error);
    });*/

    // Create Ocean
    options = {
        INITIAL_SIZE : 5000.0,
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
    //oceanSurface = new OceanSurface(renderer, camera, scene, options); 

    // Initialize VR Button
    document.body.appendChild( VRButton.createButton( renderer ) );
    renderer.xr.enabled = true;

    onWindowResize();
    window.addEventListener('resize', onWindowResize);

    //oceanSurface.render();
    ocean.render();
    ocean.update();

}

function update() {
    if (camera && isLoaded) {
        var currentTime = new Date().getTime();
        ocean.deltaTime = (currentTime - lastTime) / 1000 || 0.0;
        //oceanSurface.timeChange((currentTime - lastTime) / 1000 || 0.0);
        controls.update((currentTime - lastTime) / 10);
        lastTime = currentTime;
        
        document.querySelector(".label1").innerText = "Coord: (" + camera.position.x.toFixed(1) + ", " + camera.position.y.toFixed(1) + ", " + camera.position.z.toFixed(1) + ")";

        if (isAnimating) {
            renderer.xr.enabled = false;
            //oceanSurface.render();
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

fetch('./modelStrings.json')
.then(response => response.json())
.then(data => {
    modelStrings = data;
    console.log(modelStrings)
})

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
    //console.log(delaunay.triangles);
    init();
    render();
});