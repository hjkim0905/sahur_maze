import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 씬, 카메라, 렌더러 생성
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector('#app').innerHTML = ''; // 기존 텍스트 제거
document.querySelector('#app').appendChild(renderer.domElement);

// 조명 추가
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // 은은한 전체 조명
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 태양빛 같은 방향성 조명
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

let player;
const move = { forward: false, backward: false, left: false, right: false };
const speed = 0.05;

// 카메라 각도(라디안)
let cameraAngle = 0;
let cameraElevation = 0.3; // 위아래 각도 제한
const cameraDistance = 5;

// Pointer Lock 활성화
renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener('mousemove', onMouseMove, false);
    } else {
        document.removeEventListener('mousemove', onMouseMove, false);
    }
});

function onMouseMove(e) {
    cameraAngle -= e.movementX * 0.01;
    cameraElevation -= e.movementY * 0.01;
    cameraElevation = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, cameraElevation));
}

// glTF 로더로 '나' 캐릭터 불러오기
const loader = new GLTFLoader();
loader.load(
    '/my_character/scene.gltf',
    (gltf) => {
        player = gltf.scene;
        player.position.set(0, 0.1, 0); // y=0.1로 살짝 띄우기
        scene.add(player);
        animate();
    },
    undefined,
    (error) => {
        console.error('GLTF 로드 에러:', error);
    }
);

// 카메라 위치 조정
camera.position.set(0, 1.5, 5);

// WASD 입력 처리
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') move.forward = true;
    if (e.code === 'KeyS') move.backward = true;
    if (e.code === 'KeyA') move.left = true;
    if (e.code === 'KeyD') move.right = true;
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') move.forward = false;
    if (e.code === 'KeyS') move.backward = false;
    if (e.code === 'KeyA') move.left = false;
    if (e.code === 'KeyD') move.right = false;
});

// 씬 생성 후, 바닥 추가
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0; // y=0에 바닥
scene.add(ground);

// 렌더링 루프
function animate() {
    requestAnimationFrame(animate);

    if (player) {
        // 카메라가 바라보는 방향 벡터 계산
        const dir = new THREE.Vector3(
            Math.sin(cameraAngle) * Math.cos(cameraElevation),
            Math.sin(cameraElevation),
            Math.cos(cameraAngle) * Math.cos(cameraElevation)
        );

        // WASD 이동 (카메라 방향 기준)
        const moveDir = new THREE.Vector3();
        if (move.forward) moveDir.z -= 1;
        if (move.backward) moveDir.z += 1;
        if (move.left) moveDir.x -= 1;
        if (move.right) moveDir.x += 1;
        if (moveDir.length() > 0) {
            moveDir.normalize();
            // 카메라의 y축 회전만 반영해서 이동
            const angle = cameraAngle;
            const moveX = moveDir.x * Math.cos(angle) - moveDir.z * Math.sin(angle);
            const moveZ = moveDir.x * Math.sin(angle) + moveDir.z * Math.cos(angle);
            player.position.x += moveX * speed;
            player.position.z += moveZ * speed;
        }

        // 카메라 위치를 캐릭터 뒤쪽에 배치
        const camTarget = player.position.clone();
        const camPos = camTarget
            .clone()
            .add(
                new THREE.Vector3(
                    Math.sin(cameraAngle) * Math.cos(cameraElevation) * cameraDistance,
                    Math.sin(cameraElevation) * cameraDistance + 1.5,
                    Math.cos(cameraAngle) * Math.cos(cameraElevation) * cameraDistance
                )
            );
        camera.position.copy(camPos);
        camera.lookAt(camTarget);
    }

    renderer.render(scene, camera);
}
