import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 씬, 카메라, 렌더러 생성
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

document.querySelector('#app').innerHTML = ''; // 기존 텍스트 제거
document.querySelector('#app').appendChild(renderer.domElement);

// 브라우저 리사이즈 시 캔버스 크기 자동 조정
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// body 스타일로 스크롤 금지 및 전체화면
Object.assign(document.body.style, {
    margin: '0',
    padding: '0',
    overflow: 'hidden',
    width: '100vw',
    height: '100vh',
});

// 조명 추가
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // 은은한 전체 조명
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 태양빛 같은 방향성 조명
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

let player;
const move = { forward: false, backward: false, left: false, right: false };
const speed = 0.08;

// 카메라 각도(라디안)
let cameraAngle = 0;
let cameraElevation = 0.8; // 위에서 내려다보는 각도
const cameraDistance = 10;

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
    cameraElevation = Math.max(-Math.PI / 8, Math.min(Math.PI / 1.5, cameraElevation));
}

// 더 큰 미로 맵 (15x11)
const mazeMap = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const wallSize = 2; // 벽 하나의 크기(2x2x2)
const wallHeight = 2; // 벽의 높이(2)

const wallGeometry = new THREE.BoxGeometry(wallSize, wallHeight, wallSize);
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x333366, transparent: true, opacity: 0.6 });

for (let z = 0; z < mazeMap.length; z++) {
    for (let x = 0; x < mazeMap[z].length; x++) {
        if (mazeMap[z][x] === 1) {
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(
                (x - mazeMap[z].length / 2) * wallSize,
                wallHeight / 2,
                (z - mazeMap.length / 2) * wallSize
            );
            wall.castShadow = true;
            wall.receiveShadow = true;
            scene.add(wall);
        }
    }
}

// 충돌 판정 함수
function canMoveTo(x, z) {
    const mazeX = Math.round(x / wallSize + mazeMap[0].length / 2);
    const mazeZ = Math.round(z / wallSize + mazeMap.length / 2);
    return (
        mazeZ >= 0 && mazeZ < mazeMap.length && mazeX >= 0 && mazeX < mazeMap[0].length && mazeMap[mazeZ][mazeX] === 0
    );
}

// glTF 로더로 '나' 캐릭터 불러오기
const loader = new GLTFLoader();
loader.load(
    '/my_character/scene.gltf',
    (gltf) => {
        player = gltf.scene;
        // 미로의 (1,1) 위치에서 시작
        player.position.set((1 - mazeMap[0].length / 2) * wallSize, 0.1, (1 - mazeMap.length / 2) * wallSize);
        scene.add(player);
        animate();
    },
    undefined,
    (error) => {
        console.error('GLTF 로드 에러:', error);
    }
);

// 카메라 위치 조정
camera.position.set(0, 2, 10);

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
        // 카메라가 바라보는 방향(전방) 벡터
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        // 카메라의 오른쪽 벡터
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // 이동 방향 계산
        const moveDir = new THREE.Vector3();
        if (move.forward) moveDir.add(forward);
        if (move.backward) moveDir.sub(forward);
        if (move.left) moveDir.sub(right);
        if (move.right) moveDir.add(right);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            const nextX = player.position.x + moveDir.x * speed;
            const nextZ = player.position.z + moveDir.z * speed;
            if (canMoveTo(nextX, nextZ)) {
                player.position.x = nextX;
                player.position.z = nextZ;
            }
            // 이동 방향으로 모델의 앞을 맞추기
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            player.rotation.y = targetAngle;
        }

        // 카메라 위치를 캐릭터 뒤쪽에 배치
        const camTarget = player.position.clone();
        const camPos = camTarget
            .clone()
            .add(
                new THREE.Vector3(
                    Math.sin(cameraAngle) * Math.cos(cameraElevation) * cameraDistance,
                    Math.sin(cameraElevation) * cameraDistance + 2,
                    Math.cos(cameraAngle) * Math.cos(cameraElevation) * cameraDistance
                )
            );
        camera.position.copy(camPos);
        camera.lookAt(camTarget);
    }

    renderer.render(scene, camera);
}
