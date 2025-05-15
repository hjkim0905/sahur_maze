import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 씬, 카메라, 렌더러 생성
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector('#app').innerHTML = ''; // 기존 텍스트 제거
document.querySelector('#app').appendChild(renderer.domElement);

// 조명 추가 (이 부분을 추가하세요)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // 은은한 전체 조명
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 태양빛 같은 방향성 조명
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// glTF 로더로 '나' 캐릭터 불러오기
const loader = new GLTFLoader();
loader.load(
    '/my_character/scene.gltf',
    (gltf) => {
        scene.add(gltf.scene);
        animate();
    },
    undefined,
    (error) => {
        console.error('GLTF 로드 에러:', error);
    }
);

// 카메라 위치 조정
camera.position.set(0, 1.5, 5);

// 렌더링 루프
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
