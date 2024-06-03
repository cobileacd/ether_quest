"use strict";

/* NOTE(@cobileacd):
- all objects that have (virtual(?)) scripts 
  attached (we don't have this notion, yet(?)) 
  must have a unique name because internal references 
  across sessions could break.
*/

/* FINAL SPRINT:
- Hide colliders when hiding helpers 
- Create Anim class for Enemies 
- Attack Logic for player and enemies 
*/

/* TODO(@cobileacd):
 * - Integrate models for enemies (with animations).
 * - Optmize performance. 
 * - Fix player camera (follow player when moved with mouse).
 * - Find a way to save animators. 
 * - Fix player movement. (DONE)
 * - Add lights to scene, make possibly to choose intensity and color.
 * - Instead of removing/adding helpers each time we switch between show and update, just switch visibility true/false.
     different from when saving because we don't want them in scene graph.
 * - On object properties display real world position coords instead of local ones. (DONE)
 * - Fix lights... (DONE)
 * - Fix bug where spot light helpers don't have correct reference to its light. (DONE)
 * - Move clone/delete logic to editor's class.
 * - Add missing logic to input system. (DONE)
 * - FIX WEIRD MOUSE ROTATION. (HACKIT: arrow keys) (DONE?)
 * - Play/Editor mode differentiation. (DONE)
 * - Sperate scene helpers from sceneGraph; (DONE)
 * - Clip cursor on mouse1 (when rotating camera). (DONE)
 * - Save scene on a server file. (DONE)
 * - Visual representation of game objects. (pos, scale, rotation). (DONE)
*/

// NOTE(@cobileacd): import scene file as a string.
import sceneFileString from './scene.json?raw';

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Stats from 'stats.js';

//--------------------------------------------------------------------------------------------------------
// TINY Engine API
//--------------------------------------------------------------------------------------------------------
// TODO(@cobileacd): description.
//  This contains the main engine API that abstracts away the logical components used
//  in a typical game.
const TINY = 
{
    transformObject: class
    {
        constructor(x, y, z) 
        {
            this.x = x;
            this.y = y;
            this.y = z;
        }
    },

    renderComponent: class
    {
        constructor(geometry, material, object) 
        {
            this.geometry = geometry;
            this.material = material;
            this.object = object;
        }
    },

    colliderComponent: class
    {
        radius;
        size;
        shape;

        constructor(size, shape)
        {
            if (shape == 'circle')
                    this.radius = size;
            if (shape == 'rect')
                    this.size = size;

            this.shape = shape;
        }

        // NOTE: args: game_object that collided with us. 
        onCollisionEnter(game_object) {} 
    },

    gameObject: class
    {
        constructor(render_component, transform, name, collider) 
        {
            this.render_component = render_component;
            this.object = this.render_component; // three.js Object3D
            this.name = name;
            this.collider_component = collider
        }

        update(dt) {}
    },

    clamp : function (num, min, max) 
    {
        return Math.min(Math.max(num, min), max);
    },

    random_range : function (min, max)
    {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
};

let INITIALIZATION_DONE = false;

// TODO: re-think this.
const helper = {

    initEmptyScene: function (sceneElements) {

        sceneElements.sceneGraph = new THREE.Scene();

        const width = window.innerWidth;
        const height = window.innerHeight;
        // ************************** //
        // Add ambient light
        // ************************** //
        const ambientLight = new THREE.AmbientLight('rgb(255, 255, 255)', 0.2);
        sceneElements.sceneGraph.add(ambientLight);

        // *********************************** //
        // Create renderer (with shadow map)
        // *********************************** //
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        sceneElements.renderer = renderer;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor('rgb(30, 30, 30)', 1.0);
        renderer.setSize(width, height);

        // Setup shadowMap property
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // **************************************** //
        // Add the rendered image in the HTML DOM
        // **************************************** //
        const htmlElement = document.querySelector("#Tag3DScene");
        htmlElement.appendChild(renderer.domElement);
    },

    render: function render(sceneElements, graph) {
        sceneElements.renderer.render(graph, sceneElements.cameraObj);
    },
};

//--------------------------------------------------------------------------------------------------------
/* INPUT */
//--------------------------------------------------------------------------------------------------------
// input = key[old_state, new_state]
const input = {};

function is_button_down(key)
{
        if (input[key])
                return input[key].cur_state;
        return false;
}

function was_button_down(key)
{
        if (input[key])
                return !input[key].cur_state && input[key].old_state;
        return false;
}

function update_input()
{
        for (var key in input) 
        {
                input[key].old_state = input[key].cur_state;
        }
}

let MOUSE_POS = null;
window.addEventListener('mousemove', (event) => 
        {
                MOUSE_POS = { x: event.clientX, y: event.clientY };
        });

document.addEventListener("keydown", function(event) 
        {
                if (input[event.code])
                {
                        input[event.code].cur_state = true;
                }
                else
                {
                        input[event.code] = { cur_state : true, old_state : false};
                }
        });

document.addEventListener("keyup", function(event) 
        {
                input[event.code].cur_state = false;
        });

document.body.onpointerdown = function(event)
        {
                //console.log(event);
                if (event.button == 0)
                {
                        //input['MouseButton1'] = true;

                        // DEBUG: capture pointer
                        //if (ENABLE_DEBUG_CAMERA)
                        //        sceneElements.renderer.domElement.requestPointerLock(); 
                }
                else if (event.button == 2)
                {
                        //input['MouseButton2'] = true;
                }
        }

document.body.onpointerup = function(event)
        {
                if (event.button == 0)
                {
                        //input['MouseButton1'] = false;

                        // DEBUG: capture pointer
                        document.exitPointerLock(); 

                        hit_test(event);
                }
                else if (event.button == 2)
                {
                        //input['MouseButton2'] = false;
                }
        }

document.addEventListener('mousemove', (event) => 
        {
                if (document.pointerLockElement === sceneElements.renderer.domElement) 
                {
                        const drag_X = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
                        const drag_Y = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

                        //input.MouseDragX = drag_X;
                        //input.MouseDragY = drag_Y;

                        //console.log(drag_Y);
                        //console.log(drag_X);
                }
        });
/* END INPUT */

//--------------------------------------------------------------------------------------------------------
/* ANIMATION */
//--------------------------------------------------------------------------------------------------------

let model, skeleton, mixer;
let idle_action, walk_action, run_action, death_action, receive_hit_action, attack_action;
let idle_weight, walk_weight, run_weight, death_weight, attack_weight;
let actions;

function toggleMorphAttributes(obj, restore) {
  obj.traverse(c => {
    if (c.geometry) {
      if (restore) {
        c.geometry.morphAttributes =
          c.geometry.userData.morphAttributes || {};
        delete c.geometry.userData.morphAttributes;
      } else {
        c.geometry.userData.morphAttributes = c.geometry.morphAttributes;
        c.geometry.morphAttributes = {};
      }
      c.geometry.boundingBox = null;
    }
  });
}

// TODO: Move this to player's class
function InitPlayerAnimator()
{
        const loader = new GLTFLoader();
        loader.load('data/Anne.glb', async function ( gltf ) {
                model = gltf.scene;

                model.name = 'anim';

                model.traverse(function (object) {
                        if (object.isMesh) object.castShadow = true;
                });

                // @fixit: fix metallic look
                const material = new THREE.MeshStandardMaterial(
                        {
                                map: model.children[0].children[1].material.map
                        });
                model.children[0].children[1].material = material;

                const customBoundingBox = new THREE.Box3(
                        new THREE.Vector3(-2, -2, -2),
                        new THREE.Vector3(2, 2, 2)
                );
                model.traverse(function (object) {
                        if (object.isMesh) {
                               applyCustomBoundingBox(object, customBoundingBox);
                        }
                });

                //model.position.set(0, -0.65, 0);
                sceneElements.sceneGraph.add(model);

                skeleton = new THREE.SkeletonHelper(model);
                skeleton.visible = true;
                skeleton.name = 'anim';
                skeleton.userData = {'isSkeleton' : true};
                sceneElements.sceneGraph.add( skeleton );

                const animations = gltf.animations;
                mixer = new THREE.AnimationMixer(model);
                sceneElements.mixers.push(mixer);

                //console.log(gltf.animations);

                death_action = mixer.clipAction(animations[0]);
                idle_action = mixer.clipAction(animations[3]);
                walk_action = mixer.clipAction(animations[4]);
                run_action = mixer.clipAction(animations[9]);
                attack_action = mixer.clipAction(animations[10]);

                attack_action.setLoop(THREE.LoopOnce);

                //console.log(attack_action);

                actions = [ idle_action, walk_action, run_action, death_action, attack_action ];

                //@fixit: for some reason position is not set correctly without sleeping
                //await new Promise(r => setTimeout(r, 1000)); 
                const new_position = sceneElements.player.serialized_position;
                model.position.copy(new THREE.Vector3(new_position.x, new_position.y, new_position.z));
                sceneElements.player.object = model;
                //toggleMorphAttributes(model, false);
                model.scale.set(2, 2, 2);
                //toggleMorphAttributes(model, true);
                //sceneElements.player.object.position.copy(sceneElements.player.serialized_position);

                //idle_action.play();
                //prepare_cross_fade(idle_action, walk_action, 0.5);
                activate_all_actions();
                INITIALIZATION_DONE = true;
        });
}

function applyCustomBoundingBox(mesh, customBoundingBox) {
    if (!mesh.geometry) return;

    // Update the geometry's bounding box with the custom bounding box
    mesh.geometry.boundingBox = customBoundingBox.clone();

    // Optionally, update the bounding sphere based on the custom bounding box
    const boundingSphere = new THREE.Sphere();
    customBoundingBox.getBoundingSphere(boundingSphere);
    mesh.geometry.boundingSphere = boundingSphere;

    //console.log('Applied Custom Bounding Box:', mesh.geometry.boundingBox);
    //console.log('Applied Custom Bounding Sphere:', mesh.geometry.boundingSphere);
}

function recalculateBoundingBox(mesh) {
    if (!mesh.geometry) return;

    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;

    mesh.geometry.computeBoundingSphere();
    const sphere = mesh.geometry.boundingSphere;

    //console.log('Recalculated Bounding Box:', box);
    //console.log('Recalculated Bounding Sphere:', sphere);

    mesh.geometry.boundingBox = box;
    mesh.geometry.boundingSphere = sphere;
}

function init_anim()
{
        const fbx_loader = new FBXLoader();
        fbx_loader.load('data/Sparrow_Animations.fbx', function (object) {
                sceneElements.sparrow = object;
                const material = new THREE.MeshStandardMaterial(
                        {
                                map: object.children[0].material.map
                        });
                //console.log(object);
                object.children[0].material = material;

                object.position.set(-11, -1, -14);

                object.name = 'anim';

                sceneElements.sceneGraph.add(object);
                object.scale.set(0.1, 0.1, 0.1);

                const skeleton = new THREE.SkeletonHelper(object);
                skeleton.visible = true;
                skeleton.name = 'anim';
                skeleton.userData = {'isSkeleton' : true};
                sceneElements.sceneGraph.add(skeleton);

                const animations = object.animations;
                const mixer = new THREE.AnimationMixer(object);
                sceneElements.mixers.push(mixer);

                //console.log(animations);
                const idle_c = mixer.clipAction(animations[1]);

                idle_c.timeScale = 0.5;
                idle_c.play();
        });
}

function convertPhongToStandard(phongMaterial) {
  var standardMaterial = new THREE.MeshStandardMaterial();

  // Set the uniforms, vertex shader, and fragment shader
  /*
  standardMaterial.uniforms = phongMaterial.uniforms;
  standardMaterial.vertexShader = phongMaterial.vertexShader;
  standardMaterial.fragmentShader = phongMaterial.fragmentShader;
  */

  // Loop through all the properties of the PhongShaderMaterial
  for (var prop in phongMaterial) {
    // Check if the property exists in the StandardShaderMaterial
    if (prop in standardMaterial && prop != 'type' && prop != 'id') {
      // Set the corresponding property in the StandardShaderMaterial to the value in the PhongShaderMaterial
      standardMaterial[prop] = phongMaterial[prop];
    }
  }

  standardMaterial.flatShading = true;

  return standardMaterial;
}

function animate()
{
        if (mixer)
        {
                idle_weight = idle_action.getEffectiveWeight();
                walk_weight = walk_action.getEffectiveWeight();
                run_weight = run_action.getEffectiveWeight();
                attack_weight = attack_action.getEffectiveWeight();
        }
}

function set_weight(action, weight)
{
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
}

function execute_cross_fade(start_action, end_action, duration)
{
        set_weight(end_action, 1);
        end_action.time = 0;

        start_action.crossFadeTo(end_action, duration, true);
}

function blend_animation(start_action, end_action) 
{
        set_weight(start_action, 0.5);
        set_weight(end_action, 0.5);
}

function prepare_cross_fade(start_action, end_action, duration)
{
        unpause_all_actions();

        // NOTE(@cobileacd): much better results than the tutorial.
        execute_cross_fade(start_action, end_action, duration);
        /*
        if (start_action === idle_action) 
        {
                //execute_cross_fade(start_action, end_action, duration);
        } 
        else 
        {
                //synchronize_cross_fade(start_action, end_action, duration);
        }
        */
}

function synchronize_cross_fade(start_action, end_action, duration)
{
        mixer.addEventListener('loop', onLoopFinished);

        function onLoopFinished(event) {

                if (event.action === start_action) {

                        mixer.removeEventListener('loop', onLoopFinished);

                        execute_cross_fade(start_action, end_action, duration);

                }

        }
}

function clear_weights()
{
        set_weight(idle_action, 0);
        set_weight(walk_action, 0);
        set_weight(run_action, 0);
        set_weight(attack_action, 0);
        set_weight(death_action, 0);

}

function activate_all_actions()
{
        set_weight(idle_action, 1);
        set_weight(walk_action, 0);
        set_weight(run_action, 0);
        set_weight(attack_action, 0);
        set_weight(death_action, 0);

        actions.forEach(function (action) {
                action.play();
        });
}

function unpause_all_actions()
{
        actions.forEach(function (action) {
                action.paused = false;
        });
}
/* END ANIMATION */

//--------------------------------------------------------------------------------------------------------
/* LIGHTING */
//--------------------------------------------------------------------------------------------------------
function add_light(x, y, z)
{
        const spotLight = new THREE.SpotLight('rgb(255, 255, 255)', 0.5);
        //spotLight.position.set(0, 10, 100);
        spotLight.position.set(x, y, z);
        sceneElements.sceneGraph.add(spotLight);

	const spotLightHelper = new THREE.SpotLightHelper( spotLight );
	sceneElements.sceneGraph.add( spotLightHelper );

        // Setup shadow properties for the spotlight
        spotLight.castShadow = false;
        spotLight.shadow.mapSize.width = 2048;
        spotLight.shadow.mapSize.height = 2048;

        // Give a name to the spot light
        spotLight.name = "light";

        const geometry = new THREE.BoxGeometry( 3, 3, 3 );
        const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        const cube = new THREE.Mesh( geometry, material );

        cube.position.copy(spotLight.position);

        sceneElements.sceneGraph.add(cube);

        cube.name = 'cubeSpotLightHelper';
        cube.userData = { 'light': spotLight };
        //sceneElements.sceneGraph.add();
}

function add_point_light(x, y, z, color)
{
        const light = new THREE.PointLight( color, 1, 100 );
        light.position.set( x, y, z );
        light.castShadow = false;
        sceneElements.sceneGraph.add( light );

        const sphereSize = 1;
        const pointLightHelper = new THREE.PointLightHelper( light, sphereSize );
        sceneElements.sceneGraph.add( pointLightHelper );

        // (?)
        pointLightHelper.position.copy(light.position.clone());
}

//--------------------------------------------------------------------------------------------------------
/* CAMERA */
//--------------------------------------------------------------------------------------------------------

let ENABLE_DEBUG_CAMERA = true;
class classCamera
{
        constructor(camera)
        {
                this.camera = camera;
                this.follow_speed = 0.01;
                this.max_width = 5;
                this.max_height = 5;
                this.targetPosition = new THREE.Vector3();

                // char animation
                this.clock = new THREE.Clock();
                this.anim_time = 3;
                this.anim_dt = 0;
                this.cooldown_time = 5;
                this.cooldown_dt = 0;

                // DEBUG
                this.velocity = 70;
                this.old_cam_pos = this.camera.position.clone();
        }

        update(player_pos, dt)
        {
                // NOTE(@cobileac): locked room logic
                //const x = TINY.clamp(player_pos.x, -this.max_width, this.max_width);
                //const z = TINY.clamp(player_pos.z, -this.max_height, this.max_height);

                if (ENABLE_DEBUG_CAMERA)
                {
                        if (is_button_down('KeyW'))
                        {
                                this.camera.translateZ(-this.velocity * dt);
                        }
                        if (is_button_down('KeyA'))
                        {
                                this.camera.translateX(-this.velocity * dt);
                        }
                        if (is_button_down('KeyS'))
                        {
                                this.camera.translateZ(this.velocity * dt);
                        }
                        if (is_button_down('KeyD'))
                        {
                                this.camera.translateX(this.velocity * dt);
                        }

                        const rotation_speed = 0.01;
                        if (is_button_down('KeyJ'))
                        {
                                this.camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 1 * rotation_speed);

                        }
                        if (is_button_down('KeyL'))
                        {
                                this.camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -1 * rotation_speed);
                        }
                        if (is_button_down('KeyI'))
                        {
                                this.camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), 1 * rotation_speed);
                        }
                        if (is_button_down('KeyK'))
                        {
                                this.camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), -1 * rotation_speed);
                        }
                }
                else 
                {
                        const x = player_pos.x;
                        const z = player_pos.z;

                        this.targetPosition = new THREE.Vector3(x, 20, z + 40); // TODO: temp

                        // final position of camera which is known, target_position...
                        // position of player 
                        /*
                        const cringe = new THREE.Object3D();
                        cringe.position.copy(this.targetPosition);
                        cringe.lookAt(player_pos);

                        const quaternion = new THREE.Quaternion();
                        quaternion.setFromEuler(cringe.rotation);
                        //quaternion.invert();
                        */

                        //const current_rotation = new THREE.Quaternion().setFromEuler(this.camera.rotation);
                        //const camera_rotation = current_rotation.rotateTowards(quaternion, followSpeed);

                        const cameraPosition = this.camera.position.clone().lerp(this.targetPosition, followSpeed);

                        this.camera.position.copy(cameraPosition);
                        //this.camera.rotation.copy(new THREE.Euler().setFromQuaternion(camera_rotation));
                        //this.camera.lookAt(player_pos);
                        //this.camera.position.copy(player_pos);

                        if (is_button_down('Space')) 
                        {
                                //this.charge_animation(player_pos, dt);
                        }
                        else
                        {
                                this.anim_dt = this.anim_time;
                        }
                }
        }

        charge_animation(player_pos, dt)
        {
                if (this.anim_dt <= 0)
                {
                        this.anim_dt = this.anim_time;
                }

                const cameraPosition = this.camera.position.clone()
                        .lerp(player_pos, 0.01 * (this.anim_time - this.anim_dt));
                this.camera.position.copy(cameraPosition);

                var x = TINY.random_range(-1, 1);
                var z = TINY.random_range(-1, 1);

                //console.log(this.anim_dt);
                const noise = new THREE.Vector3(x, 0, z).normalize()
                        .multiplyScalar((this.anim_time - this.anim_dt) / 15);
                this.camera.position.add(noise);

                this.anim_dt -= dt;
        }
}
/* END CAMERA */

class classPlayer extends TINY.gameObject
{
        constructor(render_component, transform, name, collider)
        {
                super(render_component, transform, name, collider);
                this.velocity = 12;
                this.direction = new THREE.Vector3();
                this.direction_offset = 0;

                // Used for serialization
                this.serialized_position = new THREE.Vector3();
        }

        update(dt)
        {
                if (!ENABLE_DEBUG_CAMERA)
                {
                        // @fixit
                        this.object.visible = true;

                        this.direction = new THREE.Vector3(0, 0, 0);
                        if (is_button_down('KeyW')) {
                        this.direction.z = -1;
                        }
                        if (is_button_down('KeyA')) {
                        this.direction.x = -1;
                        }
                        if (is_button_down('KeyS')) {
                        this.direction.z = 1;
                        }
                        if (is_button_down('KeyD')) {
                        this.direction.x = 1;
                        }
                        if (is_button_down('Space')) {
                        this.attack = true;
                        }


                        // Calculate direction offset based on pressed keys
                        if (this.direction.x === -1 && this.direction.z === -1) {
                                this.direction_offset = -Math.PI / 4 - Math.PI / 2;
                        } else if (this.direction.x === 1 && this.direction.z === -1) {
                                this.direction_offset = Math.PI / 4 + Math.PI / 2;
                        } else if (this.direction.x === -1 && this.direction.z === 1) {
                                this.direction_offset = -Math.PI / 4;
                        } else if (this.direction.x === 1 && this.direction.z === 1) {
                                this.direction_offset = Math.PI / 4;
                        } else if (this.direction.z === -1) {
                                this.direction_offset = Math.PI;
                        } else if (this.direction.x === -1) {
                                this.direction_offset = -Math.PI / 2;
                        } else if (this.direction.z === 1) {
                                this.direction_offset = 0;
                        } else if (this.direction.x === 1) {
                                this.direction_offset = Math.PI / 2;
                        }

                        this.direction.normalize();
                        this.object.position.x += this.direction.x * this.velocity * dt;
                        this.object.position.z += this.direction.z * this.velocity * dt;

                        const rotate_quat = new THREE.Quaternion();
                        const rotate_angle = new THREE.Vector3(0, 1, 0);

                        rotate_quat.setFromAxisAngle(rotate_angle, this.direction_offset);
                        this.object.quaternion.rotateTowards(rotate_quat, 0.2);

                        
                        // animation
                        if (this.direction.x == 0 && this.direction.z == 0)
                        {
                                if (run_weight == 1)
                                {
                                        prepare_cross_fade(run_action, idle_action, 0.1);
                                }
                        }
                        else
                        {
                                if (idle_weight == 1)
                                {
                                        prepare_cross_fade(idle_action, run_action, 0.1);
                                }

                        }

                        if (this.attack && !attack_action.isRunning())
                        {
                                set_weight(attack_action, 1);
                                attack_action.play().reset();
                        }


                        this.attack = false;
                }
        }

        // TODO: re-think this.
        onLoadScene() 
        {
                InitPlayerAnimator();
                //console.log(this.object.position);
        }

        onSaveScene()
        {
                //console.log(this.object.parent.position);

                this.serialized_position = this.object.position;
                this.object = null;
        }

        onCollisionEnter(game_object)
        {
                if (game_object.name == "enemy" && attack_action.isRunning())
                {
                        game_object.Die();
                        ////console.log("[Player]: Hit by enemy!");
                        ////console.log(this.object.position);
                }
        }
}

class classEnemyModel 
{
        constructor(self, position) 
        {
                this.model = '';
                this.skeleton = '';
                this.mixer = '';
                this.idle_action = '';
                this.walk_action = '';
                this.run_action = '';
                this.death_action = '';
                this.receive_hit_action = '';
                this.attack_action = '';
                this.idle_weight = '';
                this.walk_weight = '';
                this.run_weight = '';
                this.death_weight = '';
                this.attack_weight = '';
                this.actions = '';

                this.initAnimator(self, position);
        }

        initAnimator(self, position)
        {
                const loader = new GLTFLoader();
                loader.load('data/BlueDemon.glb', async (gltf) => { 
                        this.model = gltf.scene;

                        this.model.name = 'anim';

                        this.model.traverse(function (object) {
                                if (object.isMesh) object.castShadow = true;
                        });

                        //console.log(this.model);
                        this.model.traverse((object) => {
                                if (object.isSkinnedMesh) {
                                        object.material.metalness = 0;
                                        object.material.roughness = 0.5;
                                }
                        });

                        const customBoundingBox = new THREE.Box3(
                                new THREE.Vector3(-2, -2, -2),
                                new THREE.Vector3(2, 2, 2)
                        );
                        this.model.traverse(function (object) {
                                if (object.isMesh) {
                                        applyCustomBoundingBox(object, customBoundingBox);
                                }
                        });

                        //model.position.set(0, -0.65, 0);
                        sceneElements.sceneGraph.add(this.model);

                        this.skeleton = new THREE.SkeletonHelper(this.model);
                        this.skeleton.visible = true;
                        this.skeleton.name = 'anim';
                        this.skeleton.userData = { 'isSkeleton': true };
                        //console.log(this.skeleton);
                        //sceneElements.sceneGraph.add(this.skeleton);

                        const animations = gltf.animations;
                        this.mixer = new THREE.AnimationMixer(this.model);
                        sceneElements.mixers.push(this.mixer);

                        //console.log(gltf.animations);

                        this.death_action = this.mixer.clipAction(animations[0]);
                        this.idle_action = this.mixer.clipAction(animations[3]);
                        this.walk_action = this.mixer.clipAction(animations[4]);
                        this.run_action = this.mixer.clipAction(animations[9]);
                        this.attack_action = this.mixer.clipAction(animations[13]);

                        this.attack_action.setLoop(THREE.LoopOnce);
                        this.death_action.setLoop(THREE.LoopOnce);

                        this.actions = [this.idle_action, this.walk_action, this.run_action, this.death_action, this.attack_action];

                        //@fixit: for some reason position is not set correctly without sleeping
                        //await new Promise(r => setTimeout(r, 1000)); 
                        //const new_position = sceneElements.player.serialized_position;
                        this.model.position.copy(position);
                        this.model.position.setY(-1.5);

                        sceneElements.sceneGraph.remove(self.object);
                        self.object = this.model;
                        self.render_component = this.model;
                        //sceneElements.player.object = model;
                        //toggleMorphAttributes(model, false);
                        //toggleMorphAttributes(model, true);
                        //sceneElements.player.object.position.copy(sceneElements.player.serialized_position);

                        //idle_action.play();
                        //prepare_cross_fade(idle_action, walk_action, 0.5);
                        this.activate_all_actions();
                });
        }

        unpause_all_actions() 
        {
                this.actions.forEach(function (action) 
                {
                        action.paused = false;
                });
        }

        animate() 
        {
                if (this.mixer) 
                {
                        this.idle_weight = this.idle_action.getEffectiveWeight();
                        this.walk_weight = this.walk_action.getEffectiveWeight();
                        this.run_weight = this.run_action.getEffectiveWeight();
                        this.attack_weight = this.attack_action.getEffectiveWeight();
                }
        }

        activate_all_actions() 
        {
                set_weight(this.idle_action, 1);
                set_weight(this.walk_action, 0);
                set_weight(this.run_action, 0);
                set_weight(this.attack_action, 0);
                set_weight(this.death_action, 0);

                this.actions.forEach(function (action) {
                        action.play();
                });
        }

        prepare_cross_fade(start_action, end_action, duration) {
                this.unpause_all_actions();

                execute_cross_fade(start_action, end_action, duration);
        }

        clear_weights()
        {
                set_weight(this.idle_action, 0);
                set_weight(this.walk_action, 0);
                set_weight(this.run_action, 0);
                set_weight(this.attack_action, 0);
                set_weight(this.death_action, 0);

        }
}

class classEnemy extends TINY.gameObject
{
        constructor(render_component, transform, name, collider)
        {
                super(render_component, transform, name, collider);
                this.velocity = 4;
                this.is_aggro = false;
                this.radius = 8;
                this.collider_active = true;

                // HP
                this.dead = false;
                this.hp = 50;

                // Attack
                this.attack_radius = 1;

                const position = this.object.position;
                //this.object.visible = false;
                this.animator = new classEnemyModel(this, position);
                //this.object.position.copy(new_position);
        }

        follow_player(dt) {
                const pos = new THREE.Vector3();
                this.object.getWorldPosition(pos);

                const player_pos = new THREE.Vector3();
                sceneElements.player.object.getWorldPosition(player_pos);

                const dir = new THREE.Vector3().subVectors(player_pos, pos).normalize();

                this.object.position.x += this.velocity * dt * dir.x;
                this.object.position.z += this.velocity * dt * dir.z;

                let direction_offset = Math.atan2(dir.x, dir.z);

                dir.normalize();

                const rotate_quat = new THREE.Quaternion();
                const rotate_angle = new THREE.Vector3(0, 1, 0);

                rotate_quat.setFromAxisAngle(rotate_angle, direction_offset);
                this.object.quaternion.rotateTowards(rotate_quat, 0.1);
        }

        update(dt) {
                // follow only if aggro
                if (!this.dead)
                {
                        if (this.is_aggro) {
                                this.follow_player(dt);
                        }

                        if (this.object.position.distanceToSquared(sceneElements.player.object.position) < this.radius * this.radius)
                                this.is_aggro = true;

                        if (this.object.position.distanceToSquared(sceneElements.player.object.position) > this.radius * this.radius * 2)
                                this.is_aggro = false;

                        if (this.object.position.distanceToSquared(sceneElements.player.object.position) < this.radius * this.radius)
                                this.attack = true;
                        else {
                                this.attack = false;
                        }

                        if (!this.is_aggro) {
                                if (this.animator.run_weight == 1) {
                                        this.animator.prepare_cross_fade(this.animator.run_action, this.animator.idle_action, 0.1);
                                }
                        }
                        else {
                                if (this.animator.idle_weight == 1) {
                                        this.animator.prepare_cross_fade(this.animator.idle_action, this.animator.run_action, 0.1);
                                }
                        }
                }
        }

        Die() 
        {
                if (!this.dead)
                {
                        this.animator.clear_weights();
                        set_weight(this.animator.death_action, 1);

                        this.animator.death_action.reset();
                        this.animator.death_action.setLoop(THREE.LoopOnce); // Ensure death action does not loop

                        this.animator.death_action.play();

                        // Set an event listener to freeze the model when the death animation ends
                        this.animator.death_action.clampWhenFinished = true;
                        this.animator.death_action.onFinished = () => {
                                // Ensure the model stays in the final frame of the death animation
                                this.animator.mixer.stopAllAction(); // Stop all actions to prevent any animation from playing
                        };

                        this.dead = true;
                        this.collider_active = false;
                }
        }

        onCollisionEnter(game_object)
        {
                if (game_object.name == "player" && !this.dead)
                {
                        if (!this.animator.attack_action.isRunning())
                        {
                                set_weight(this.animator.attack_action, 1);
                                this.animator.attack_action.play().reset();
                        }
                }
        }
}

// General scene state
const sceneElements = {
        sceneGraph:   null,
        camera:       null,
        three_camera: null,
        renderer:     null,
        player:       null,
        mixers:       [],   // used for animations, need to be updated
        enemies:      [],
        collider_gos: [],
        rooms:        [],   // data about rooms: pos_x, pos_z 
                            // may be necessary for enemy spawns or we just place spawners in scene
        
        transform_controls: null,
};

/* SCENE editor */
function is_a_parent_of_b(objectA, objectB) {
        let parent = objectB.parent;

        while (parent !== null && parent !== objectA) {
                parent = parent.parent;
        }

        return parent === objectA;
}

// TODO: Move this to editor class.
function delete_object(object)
{
        g_editor.unselect_object();

        if (object.light != undefined)
        {
                sceneElements.sceneGraph.remove(object);
                sceneElements.sceneGraph.remove(object.light);

                return;
        }

        if (object.parent.isGroup)
                sceneElements.sceneGraph.remove(object.parent);
        else
                sceneElements.sceneGraph.remove(object);

}

function clone_object(object)
{
        // special case for lights
        if (object.light != undefined)
        {
                object = object.light

                const new_object = object.clone();
                new_object.translateY(5);
                sceneElements.sceneGraph.add(new_object);

                // TODO(@cobileacd): move to separate
                const sphereSize = 1;
                const pointLightHelper = new THREE.PointLightHelper( new_object, sphereSize );
                sceneElements.sceneGraph.add( pointLightHelper );

                // RESEARCH(@cobileacd): helper's position isn't the same 
                // as light's pos when created(?) parenting, relative pos?
                pointLightHelper.position.copy(new_object.position.clone());

                g_editor.select_object(pointLightHelper);
        }
        else if (object.name == 'collider')
        {
                const new_object = object.clone();
                new_object.translateY(5);
                sceneElements.sceneGraph.add(new_object);

                new_object.name = 'collider';

                const collider_component = new TINY.colliderComponent(0, 'rect');
                const collider = { 'object' : new_object, 'collider_component' : collider_component, isStatic: true }; 

                sceneElements.collider_gos.push(collider);


                g_editor.select_object(new_object);
        }
        else if (object.parent.isGroup)
        {
                //console.log('group');
                const new_object = object.parent.clone();
                //console.log(new_object);
                new_object.translateY(5);
                sceneElements.sceneGraph.add(new_object);

                g_editor.select_object(new_object);
        }
        else
        {
                const new_object = object.clone();
                //console.log(new_object);
                new_object.translateY(5);
                sceneElements.sceneGraph.add(new_object);

                g_editor.select_object(new_object);
        }
}

function init_transform_controls()
{
        const controls = new TransformControls(
                sceneElements.three_camera, 
                sceneElements.renderer.domElement
        );
        g_editor.set_controls(controls);

        sceneElements.sceneGraph.add(controls);
}

function update_helpers()
{
        sceneElements.sceneGraph.traverse( function( object ) 
        {
                if (object.isPointLight)
                {
                        const sphereSize = 1;
                        const pointLightHelper = new THREE.PointLightHelper( object, sphereSize );
                        sceneElements.sceneGraph.add( pointLightHelper );

                        // (?)
                        pointLightHelper.position.copy(object.position.clone());
                }
                if (object.isSpotLight)
                {
                        const spotLightHelper = new THREE.SpotLightHelper(object);
                        sceneElements.sceneGraph.add(spotLightHelper);

                        const geometry = new THREE.BoxGeometry(3, 3, 3);
                        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                        const cube = new THREE.Mesh(geometry, material);

                        cube.position.copy(object.position);

                        sceneElements.sceneGraph.add(cube);

                        cube.name = 'cubeSpotLightHelper';
                        cube.userData = { 'light': object };
                }
        } );
}

// TODO(@cobileacd): re-think this.
function show_helpers()
{
        g_editor.unselect_object(); // remove transform controls

        const helpers = [];
        sceneElements.sceneGraph.traverse(function (obj) 
        {
                if (obj.type == 'PointLightHelper') 
                {
                        //helpers.push(obj);
                        obj.visible = true;
                }
                else if (obj.type == 'SpotLightHelper') 
                {
                        //helpers.push(obj);
                        obj.visible = true;
                }
                else if (obj.name == 'cubeSpotLightHelper') // our version of the helper
                {
                        //helpers.push(obj);
                        obj.visible = true;
                }
                else if (obj.userData.isSkeleton != undefined)
                {
                        obj.visible = true;
                }
        });

}

function hide_helpers()
{
        g_editor.unselect_object(); // remove transform controls

        const helpers = [];
        sceneElements.sceneGraph.traverse(function (obj) 
        {
                if (obj.type == 'PointLightHelper') 
                {
                        //helpers.push(obj);
                        obj.visible = false;
                }
                else if (obj.type == 'SpotLightHelper') 
                {
                        //helpers.push(obj);
                        obj.visible = false;
                }
                else if (obj.name == 'cubeSpotLightHelper') // our version of the helper
                {
                        //helpers.push(obj);
                        obj.visible = false;
                }
                else if (obj.userData.isSkeleton != undefined)
                {
                        obj.visible = false;
                }
        });

        /*
        for (var helper of helpers)
        {
                sceneElements.sceneGraph.remove(helper);
        }
        */
}

function remove_helpers()
{
        g_editor.unselect_object(); // remove transform controls

        const helpers = [];
        sceneElements.sceneGraph.traverse(function (obj) 
        {
                if (obj.type == 'PointLightHelper') 
                {
                        helpers.push(obj);
                }
                else if (obj.type == 'SpotLightHelper') 
                {
                        helpers.push(obj);
                }
                else if (obj.name == 'cubeSpotLightHelper') // our version of the helper
                {
                        helpers.push(obj);
                }
                else if (obj.userData.isSkybox != undefined)
                {
                        helpers.push(obj);
                }
        });

        for (var helper of helpers)
        {
                sceneElements.sceneGraph.remove(helper);
        }
}

function RemoveAnimators() 
{
        const anims = [];
        sceneElements.sceneGraph.traverse(function (obj)
        {
                if (obj.name == 'anim' | obj.name == 'Character')
                {
                        anims.push(obj);
                }
        });

        for (var anim of anims)
        {
                sceneElements.sceneGraph.remove(anim);
        }
}

function SaveScene()
{
        // TODO: maybe implement this for all game objects?
        // We don't need to serialize player's model because we load the model regardless
        sceneElements.player.onSaveScene();

        // Remove editor's helpers (transform helpers, lights, etc...)
        remove_helpers();

        // Remove animators from scene to not cause problems with mixers, actions, etc...
        RemoveAnimators(); 

        const packed_state = { 
                'sceneGraph' : sceneElements.sceneGraph.toJSON(),
                'player' : JSON.stringify(sceneElements.player),
                'enemies' : JSON.stringify(sceneElements.enemies),
                'collider_gos' : JSON.stringify(sceneElements.collider_gos),
                'rooms' : JSON.stringify(sceneElements.rooms),
        };

        const scene_state_string = JSON.stringify(packed_state);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://localhost:3000/saves');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
                if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                        //console.log(xhr.responseText);
                }
        };
        xhr.send(scene_state_string);       

        update_helpers();
}

// Scene Editor State
class sceneEditor
{
        constructor()
        {
                this.controls = null;
                this.raycaster = new THREE.Raycaster();

                this.selected_object = null;
                this.selected_object_box = null;
                this.show_helpers = true;
        }

        update(dt)
        {
                if (was_button_down('KeyZ')) 
                {
                        this.controls.setMode('translate');
                }
                else if (was_button_down('KeyX')) 
                {
                        this.controls.setMode('rotate');
                }
                else if (was_button_down('KeyC')) 
                {
                        this.controls.setMode('scale');
                }
                else if (was_button_down('KeyP'))
                {
                        SaveScene();
                }
                else if (was_button_down('KeyM'))
                {
                        if (this.controls.object != null)
                        {
                                clone_object(this.controls.object);
                        }
                }
                else if (was_button_down('KeyN'))
                {
                        if (this.controls.object != null)
                        {
                                delete_object(this.controls.object);
                        }
                }
                else if (was_button_down('KeyV'))
                {
                        this.add_collider();
                }
                else if (was_button_down('KeyT'))
                {
                        ENABLE_DEBUG_CAMERA = !ENABLE_DEBUG_CAMERA;
                }
                else if (was_button_down('KeyY'))
                {
                        // Toggle helpers
                        if (this.show_helpers)
                        {
                                //remove_helpers();
                                hide_helpers();
                        }
                        else
                        {
                                //update_helpers();
                                show_helpers();
                        }

                        this.show_helpers = !this.show_helpers;
                }
        }

        set_controls(controls)
        {
                this.controls = controls;
                this.on_change = this.on_change.bind(this);
                this.controls.addEventListener('objectChange', this.on_change);
        }

        select_object(object)
        {
                this.unselect_object();

                // @fixit: special case for player move this to hit_test
                if (object.type == 'SkinnedMesh')
                {
                        object = object.parent.parent;
                }

                const controls = g_editor.controls;
                controls.attach(object);
                controls.visible = true;

                this.set_bounding_box(object);
                this.selected_object = object;

                ui_update_object_properties(object);
        }

        unselect_object()
        {
                const controls = g_editor.controls;
                controls.detach();
                controls.visible = false;

                this.unset_bounding_box();
                this.selected_object = null;

                // TEMP
                topRightText.innerText = help_text; 
        }

        set_bounding_box(object)
        {
                const box = new THREE.BoxHelper(object, 0xffff00);
                sceneElements.sceneGraph.add(box);

                this.selected_object_box = box;
        }

        unset_bounding_box()
        {
                sceneElements.sceneGraph.remove(this.selected_object_box);

                this.selected_object_box = null;
        }

        on_change()
        {
                const object = this.controls.object;
                this.unset_bounding_box();
                this.set_bounding_box(object);

                ui_update_object_properties(object);

                // DEBUG: light pos = light helper pos
                if (object.light != undefined)
                {
                        object.light.position.copy(object.position.clone());
                }
                if (object.userData.light != undefined)
                {
                        object.userData.light.position.copy(object.position.clone());
                        object.userData.light.rotation.copy(object.rotation.clone());
                }
        }

        add_collider()
        {
                const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
                const cubeMaterial = new THREE.MeshPhongMaterial({ color: 'rgb(0,255,0)' });
                const cubeObject = new THREE.Mesh(cubeGeometry, cubeMaterial);

                cubeMaterial.wireframe = true;

                sceneElements.sceneGraph.add(cubeObject);

                cubeObject.name = 'collider';

                const collider_component = new TINY.colliderComponent(0, 'rect');
                const collider = { 
                        'object' : cubeObject, 
                        'collider_component' : collider_component, 
                        isStatic : true 
                }; 

                sceneElements.collider_gos.push(collider);

                this.select_object(cubeObject);
        }
}



const MAX_HIT_DISTANCE = 1000;
function hit_in_range(intersects)
{
        for (var hit of intersects)
        {
                if (hit.distance < MAX_HIT_DISTANCE)
                {
                        return true;
                }

        }

        return false;
}

const g_editor = new sceneEditor();

function hit_test(event)
{
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        g_editor.raycaster.setFromCamera(mouse, sceneElements.three_camera);

        // NOTE(@cobileacd):
        // https://stackoverflow.com/questions/31072742/raycaster-intersectobjects-not-returning-anything
        const objects = [];
        sceneElements.sceneGraph.traverseVisible(function (child) {
                objects.push(child);
        } );

        const intersects = g_editor.raycaster.intersectObjects(
                objects, false
        );

        const controls = g_editor.controls;

        if (intersects.length > 0 && hit_in_range(intersects)) 
        {
                //console.log(intersects);
                let object = intersects[0].object;
                if (object.isTransformControlsPlane || object.isMesh != true)
                {
                        // just ignore TransformControlsPlane?
                        object = null;
                }
                else if (is_a_parent_of_b(controls, object))
                {
                        return;
                }

                for (let i = 1; i < intersects.length && !object; i++)
                {
                        if (!is_a_parent_of_b(controls, intersects[i].object) && 
                                intersects[i].object.isMesh == true)
                        {
                                object = intersects[i].object;
                        }
                }

                //console.log(object);
                //console.log(intersects);

                if (object) 
                {
                        g_editor.select_object(object);
                } 
                else 
                {
                        g_editor.unselect_object();
                }
        } 
        else 
        {
                g_editor.unselect_object();
        }
}

let TEXT_INPUT = false;
const model_text_field = document.getElementById("model-name");model_text_field.addEventListener("focus", () => {
        TEXT_INPUT = true;
});
model_text_field.addEventListener("blur", () => {
        TEXT_INPUT = false;
});

const loadModelButton = document.getElementById("load-model-button");
loadModelButton.addEventListener("click", () => {
        const modelNameInput = document.getElementById("model-name");
        const model_name = modelNameInput.value;
        //console.log(model_name);
        //load_model(model_name);
});

function load_model(model_name)
{
        const fbx_loader = new FBXLoader();
        const texture_loader = new THREE.TextureLoader();

        fbx_loader.load('./data/SimpleNaturePack/Models/' + model_name,
                (object) => {
                        const texture = texture_loader.load('./data/SimpleNaturePack/Models/Nature_Texture_01.png');
                        const material = new THREE.MeshStandardMaterial(
                                {
                                        map: texture // Set texture map
                                });

                        object.children[0].material = material;
                        sceneElements.sceneGraph.add(object)
                        g_editor.select_object(object);
                },
                (xhr) => {
                        //console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
                },
                (error) => {
                        //console.log(error)
                }
        )
}

const topRightText = document.getElementById("top-right-text");
let help_text = "y: show/hide helpers\nt: switch player/debug\nz: transform\nx: rotate\nc: scale\nv: add collider\n p: save scene\nn: delete obj\nm: copy object";
topRightText.innerText = help_text;

function ui_update_object_properties(object)
{
        //let final_string = topRightText.innerText; 
        let final_string = 'Object Properties:';

        final_string += '\nname: \'' + object.name + '\'';
        final_string += '\ntype: \'' + object.type+ '\'';

        // get world position instead of local
        let world_position = new THREE.Vector3(); 
        object.getWorldPosition(world_position);

        final_string += '\n\npos: x:' + 
                        world_position.x.toFixed(2) + 
                        ' y:' + world_position.y.toFixed(2) + 
                        ' z:' + world_position.z.toFixed(2);

        final_string += '\nsca: x:' + 
                        object.scale.x.toFixed(2) + 
                        ' y:' + object.scale.y.toFixed(2) + 
                        ' z:' + object.scale.z.toFixed(2);

        final_string += '\nrot: x:' + 
                        object.rotation.x.toFixed(2) + 
                        ' y:' + object.rotation.y.toFixed(2) + 
                        ' z:' + object.rotation.z.toFixed(2);

        topRightText.innerText = final_string;
}
/* SCENE editor end */

/* SAVING/LOADING */
function parse_render_component(json)
{
        // NOTE: get Object from scene graph and not from json representation
        const name = json.object.name;

        let object = null;
        for (var obj of sceneElements.sceneGraph.children)
        {
                if (obj.name != '' && obj.name == name)
                {
                        object = obj;
                        break;
                }
        }

        if (!object)
        {
                object = loader.parse(json.object);
        }

        //return new TINY.renderComponent(geometry, material, object);
        return object; 
}

function parse_collider(collider)
{
        return new TINY.colliderComponent(collider.radius, 'rect');
}

function parse_player(player_json)
{
        const loader = new THREE.ObjectLoader();

        const render = parse_render_component(player_json.render_component);
        const serialized_position = player_json.serialized_position;
        const collider = parse_collider(player_json.collider_component);
        // TODO(@cobileacd): not sure if this is necessary.
        const transform = new TINY.transformObject(0, 0, 0); 

        const player = new classPlayer(render, transform, "player", collider);
        player.serialized_position = serialized_position;

        return player;
}

function parse_enemy(enemy_JSON)
{
        const loader = new THREE.ObjectLoader();

        const render = parse_render_component(enemy_JSON.render_component);
        const collider = parse_collider(enemy_JSON.collider_component);
        // TODO(@cobileacd): not sure if this is necessary.
        const transform = new TINY.transformObject(0, 0, 0); 

        return new classEnemy(render, transform, "enemy", collider);
}

function parse_enemies(enemies_JSON)
{
        //console.log(enemies_JSON);

        let arr = [];
        for (var enemy_JSON of enemies_JSON)
        {
                arr.push(parse_enemy(enemy_JSON));
        }

        return arr;
}

function parse_static_collider(collider_JSON)
{
        const loader = new THREE.ObjectLoader();

        const object = loader.parse(collider_JSON.object);

        const collider_component = new TINY.colliderComponent(0, 'rect');
        const collider = { 
                'object' : object, 
                'collider_component' : collider_component, 
                isStatic : true 
        }; 

        return collider;
}

function parse_colliders_GOS(colliders_JSON)
{
        //console.log(colliders_JSON);
        let arr = [];
        for (var go_JSON of colliders_JSON)
        {
                if (go_JSON.name == 'enemy')
                {
                        arr.push(parse_enemy(go_JSON));
                }
                else if (go_JSON.name == 'player')
                {
                        arr.push(sceneElements.player);
                }
                else if (go_JSON.isStatic)
                {
                        arr.push(parse_static_collider(go_JSON));
                }
        }

        return arr;
}

function load_scene_from_file()
{
        const loader = new THREE.ObjectLoader();

        const scene = JSON.parse(sceneFileString);
        const graph = loader.parse(scene.sceneGraph);
        sceneElements.sceneGraph = graph;
        sceneElements.player = parse_player(JSON.parse(scene.player));
        //sceneElements.enemies = parse_enemies(JSON.parse(scene.enemies));
        sceneElements.rooms = JSON.parse(scene.rooms);
        sceneElements.collider_gos = parse_colliders_GOS(JSON.parse(scene.collider_gos));

        //console.log(sceneElements);
        const width = window.innerWidth;
        const height = window.innerHeight;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        sceneElements.renderer = renderer;

        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor('rgb(20, 20, 20)', 1.0);
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const htmlElement = document.querySelector("#Tag3DScene");
        htmlElement.appendChild(renderer.domElement);

        do_additional_work();
}
/* END SAVING/LOADING */

// ON LOAD / INIT
load_scene_from_file();

function do_additional_work()
{
        //helper.initEmptyScene(sceneElements);
        init_camera();
        init_transform_controls();
        update_helpers();

        // @fixit: Find better way to code this
        sceneElements.player.onLoadScene();
        init_anim();

        createSkybox();

        requestAnimationFrame(computeFrame);

        //create_player(sceneElements.sceneGraph);
        /*
        load_tower_obj();
        load_bridge();
        load_flower();

        // scene lights
        add_light(-100, -10, 0);
        add_light(0, -10, 100);
        add_light(100, -10, 0);
        add_light(0, -10, -100);
        add_point_light(0, 10, 0, 0x8530d1);
        add_point_light(-15, 10, -15, 0x4ED1B0);
        add_point_light(15, 10, 15, 0x4ED1B0);
        add_point_light(-15, 10, 15, 0x9ACD32);
        add_point_light(15, 10, -15, 0x9ACD32);
        */
        // ------------
}

function init_camera()
{
        const width = window.innerWidth;
        const height = window.innerHeight;
        const camera = new THREE.PerspectiveCamera(45, width / height, 10, 10000);
        //sceneElements.camera = camera;
        camera.position.set(0, 20, 40);
        camera.lookAt(0, 0, 0);

        sceneElements.camera = new classCamera(camera);
        sceneElements.three_camera = camera;
        sceneElements.cameraObj = camera;
}

/*
function create_enemies(sceneGraph)
{
        for (let j = 0; j < sceneElements.rooms.length; j++)
        {
                for (let i = 0; i < 8; i++)
                {
                        const cubeGeometry = new THREE.BoxGeometry(1, 3, 1);
                        const cubeMaterial = new THREE.MeshPhongMaterial({ color: 'rgb(0,255,255)' });
                        const cubeObject = new THREE.Mesh(cubeGeometry, cubeMaterial);
                        sceneGraph.add(cubeObject);

                        cubeObject.name = 'enemy' + i + '' + j;

                        let max = 10; // room size TODO
                        let min = -10; // room size TODO
                        var x = Math.floor(Math.random() * (max - min + 1)) + min;
                        var z = Math.floor(Math.random() * (max - min + 1)) + min;

                        cubeObject.translateY(0.5);

                        const real_x = x + sceneElements.rooms[j][0];
                        const real_z = z + sceneElements.rooms[j][1];

                        cubeObject.translateX(real_x);
                        cubeObject.translateZ(real_z);

                        // Set shadow property
                        cubeObject.castShadow = true;
                        cubeObject.receiveShadow = true;

                        const enemy_renderer = new TINY.renderComponent(cubeGeometry, cubeMaterial, cubeObject);
                        const transform = new TINY.transformObject(0, 0, 0);
                        const collider = new TINY.colliderComponent(0.56, 'rect');
                        const enemy = new classEnemy(enemy_renderer, transform, "enemy", collider);
                        sceneElements.enemies.push(enemy);
                        sceneElements.collider_gos.push(enemy);
                }
        }
}
*/

function create_player(sceneGraph)
{
        const cubeGeometry = new THREE.BoxGeometry(1, 3, 1);
        const cubeMaterial = new THREE.MeshPhongMaterial({ color: 'rgb(255,0,0)' });
        const cubeObject = new THREE.Mesh(cubeGeometry, cubeMaterial);
        sceneGraph.add(cubeObject);

        cubeObject.name = 'player';

        // Set position of the cube
        // The base of the cube will be on the plane 
        cubeObject.translateY(0.5);

        // Set shadow property
        cubeObject.castShadow = true;
        cubeObject.receiveShadow = true;

        const player_renderer = new TINY.renderComponent(cubeGeometry, cubeMaterial, cubeObject);
        const transform = new TINY.transformObject(0, 0, 0);
        const collider = new TINY.colliderComponent(0.56, 'rect');
        sceneElements.player = new classPlayer(player_renderer, transform, "player", collider);
        sceneElements.collider_gos.push(sceneElements.player);
}

function createSkybox() 
{
        // Create skybox geometry
        const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);

        // Create custom shader material for skybox
        const skyboxMaterial = new THREE.ShaderMaterial({
                uniforms: {
                        topColor: { value: new THREE.Color(0x5c54a4) },
                        bottomColor: { value: new THREE.Color(0x070e17) },
                        gradientStart: { value: 200 } // Lower value means the gradient starts sooner
                },
                vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
                fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float gradientStart;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + vec3(0.0, gradientStart, 0.0)).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
            }
        `,
                side: THREE.BackSide
        });

        // Create skybox mesh
        const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
        skybox.userData = { 'isSkybox': true };
        sceneElements.sceneGraph.add(skybox);

        // Create stars
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1 });

        const starCount = 5000;
        const starPositions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
                const x = (Math.random() - 0.5) * 1000;
                const y = (Math.random() - 0.5) * 1000;
                const z = (Math.random() - 0.5) * 1000;

                starPositions[i * 3] = x;
                starPositions[i * 3 + 1] = y;
                starPositions[i * 3 + 2] = z;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const stars = new THREE.Points(starGeometry, starMaterial);
        stars.userData = { 'isSkybox': true };
        //console.log(stars);
        sceneElements.sceneGraph.add(stars);
}

function distanceVector( v1, v2 )
{
        var dx = v1.x - v2.x;
        var dy = v1.y - v2.y;
        var dz = v1.z - v2.z;

        return Math.sqrt( dx * dx + dy * dy + dz * dz );
}

// TODO(@cobileacd): This doesn't need to be done every frame, 30 fps should be fine.
function check_collisions() {
        const colliders = sceneElements.collider_gos;

        for (let i = 0; i < colliders.length; i++) {
                const obj1 = colliders[i];
                if (obj1.collider_active != undefined) { if (!obj1.collider_active) continue }

                const y1 = obj1.object.position.y;

                for (let j = i + 1; j < colliders.length; j++) {
                        const obj2 = colliders[j];
                        if (obj2.collider_active != undefined) { if (!obj2.collider_active) continue }
                        const y2 = obj2.object.position.y;

                        // Check collisions between circles
                        if (obj1.collider_component.shape === "circle" && obj2.collider_component.shape === "circle") {
                                const dist = obj1.object.position.distanceTo(obj2.object.position);
                                if (dist < obj1.collider_component.radius + obj2.collider_component.radius) {
                                        const pos1 = obj1.object.position.clone();
                                        const pos2 = obj2.object.position.clone();
                                        const dir = pos1.sub(pos2);
                                        const mag = obj1.collider_component.radius + obj2.collider_component.radius - dist;
                                        obj1.object.position.add(dir.normalize().multiplyScalar(mag / 2));
                                        obj2.object.position.add(dir.negate().normalize().multiplyScalar(mag / 2));
                                        obj1.onCollisionEnter(obj2);
                                        obj2.onCollisionEnter(obj1);
                                }
                        }

                        // Check collisions between rectangles
                        if (obj1.collider_component.shape === "rect" && obj2.collider_component.shape === "rect") {
                                const rect1 = obj1.object.position.clone();
                                const rect2 = obj2.object.position.clone();
                                
                                const size1 = new THREE.Vector3();
                                const size2 = new THREE.Vector3();
                                // Box from object
                                const box1 = new THREE.Box3().setFromObject(obj1.object, true); 
                                const box2 = new THREE.Box3().setFromObject(obj2.object, true); 
                                box1.getSize(size1);
                                box2.getSize(size2);

                                const halfSize1 = size1.clone().multiplyScalar(0.5);
                                const halfSize2 = size2.clone().multiplyScalar(0.5);

                                const distX = Math.abs(rect1.x - rect2.x);
                                const distY = Math.abs(rect1.y - rect2.y);
                                const distZ = Math.abs(rect1.z - rect2.z);
                                if (distX < halfSize1.x + halfSize2.x && distY < halfSize1.y + halfSize2.y && distZ < halfSize1.z + halfSize2.z) {
                                        const overlapX = halfSize1.x + halfSize2.x - distX;
                                        const overlapY = halfSize1.y + halfSize2.y - distY;
                                        const overlapZ = halfSize1.z + halfSize2.z - distZ;
                                        if (overlapX < overlapY && overlapX < overlapZ) {
                                                const dir = new THREE.Vector3(Math.sign(rect1.x - rect2.x), 0, 0);

                                                if (!obj1.isStatic)
                                                        obj1.object.position.add(dir.multiplyScalar(overlapX / 2));
                                                if (!obj2.isStatic)
                                                        obj2.object.position.sub(dir.multiplyScalar(overlapX / 2));
                                        } else if (overlapY < overlapX && overlapY < overlapZ) {
                                                const dir = new THREE.Vector3(0, Math.sign(rect1.y - rect2.y), 0);

                                                if (!obj1.isStatic)
                                                        obj1.object.position.add(dir.multiplyScalar(overlapY / 2));
                                                if (!obj2.isStatic)
                                                        obj2.object.position.sub(dir.multiplyScalar(overlapY / 2));
                                        } else {
                                                const dir = new THREE.Vector3(0, 0, Math.sign(rect1.z - rect2.z));
                                                if (!obj1.isStatic)
                                                        obj1.object.position.add(dir.multiplyScalar(overlapZ / 2));
                                                if (!obj2.isStatic)
                                                        obj2.object.position.sub(dir.multiplyScalar(overlapZ / 2));
                                        }
                                        
                                        // NOTE(@cobileacd): if onCollisionEnter is defined.
                                        if (typeof obj1.onCollisionEnter === 'function')
                                        {
                                                obj1.onCollisionEnter(obj2);
                                        }
                                        if (typeof obj2.onCollisionEnter === 'function')
                                        {
                                                obj2.onCollisionEnter(obj1);
                                        }
                                }
                        }

                        obj1.object.position.setY(y1);
                        obj2.object.position.setY(y2);
                }
        }
}

// define camera follow parameters
const followSpeed = 0.03; // the speed of the camera following the player
const max_width = 5;
const max_height = 5;
let targetPosition;
function update_camera_pos(player_pos)
{
        const camera = sceneElements.camera;

        if (Math.abs(player_pos.x) < max_height && Math.abs(player_pos.z) < max_width)
        {
                targetPosition = new THREE.Vector3(player_pos.x, 30, player_pos.z + 30); // TODO: temp
        }

        // interpolate the camera position towards the target position
        const cameraPosition = camera.position.clone().lerp(targetPosition, followSpeed);

        // set the new camera position
        camera.position.copy(cameraPosition);
}

// Displacement value
var delta = 0.8;

var collision_update_time = 1 / 60; // seconds/frame
var collision_dt = 0;

const stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom)

var counter = Date.now(); 
var last_counter = counter; 
function computeFrame(time) 
{
        if (!INITIALIZATION_DONE) {
                requestAnimationFrame(computeFrame);
                return;
        }

        stats.begin();

        counter = Date.now();
        var dt = (counter - last_counter) / 1000;

        // TODO: call update on entire gameObject hierarchy.

        if (TEXT_INPUT)
        {
                // clear key events
                for (var key in input)
                {
                        input[key].cur_state = false;
                }
        }

        sceneElements.player.update(dt);
        for (var enemy of sceneElements.collider_gos)
        {
                if (enemy.name == "enemy")
                        enemy.update(dt);
        }
        g_editor.update(dt);

        // TODO: test this later.
        if (collision_dt > collision_update_time)
        {
                collision_dt = 0;
                check_collisions();
        }
        collision_dt += dt;

        // update camera
        //update_camera_pos(sceneElements.player.object.position);
        sceneElements.camera.update(sceneElements.player.object.position, dt);

        sceneElements.mixers.forEach(function (mixer) {
                mixer.update(dt);
        });

        // Rendering
        helper.render(sceneElements, sceneElements.sceneGraph);

        animate(); //player
        for (var enemy of sceneElements.collider_gos)
        {
                if (enemy.animator != undefined)
                        enemy.animator.animate();
        }

        // DEBUG: clear mouse drag values.
        //input.MouseDragX = 0;
        //input.MouseDragY = 0;
        update_input();

        stats.end();
        last_counter = counter;

        // Call for the next frame
        requestAnimationFrame(computeFrame);
}