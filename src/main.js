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

const minElev = -Math.PI / 2 + 0.1;
const maxElev = Math.PI / 2 - 0.1;

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
    cameraElevation = Math.max(minElev, Math.min(maxElev, cameraElevation));
}

// 미로 자동 생성 함수 (랜덤 DFS 백트래킹, 홀수 크기)
function generateMaze(width, height) {
    // width, height는 홀수여야 함
    const maze = Array.from({ length: height }, () => Array(width).fill(1));
    function carve(x, y) {
        const dirs = [
            [0, -2],
            [2, 0],
            [0, 2],
            [-2, 0],
        ].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (ny > 0 && ny < height && nx > 0 && nx < width && maze[ny][nx] === 1) {
                maze[y + dy / 2][x + dx / 2] = 0;
                maze[ny][nx] = 0;
                carve(nx, ny);
            }
        }
    }
    maze[1][1] = 0;
    carve(1, 1);

    // 추가 통로 생성 (20% 확률로 벽을 뚫음)
    for (let z = 1; z < height - 1; z++) {
        for (let x = 1; x < width - 1; x++) {
            if (maze[z][x] === 1 && Math.random() < 0.2) {
                // 상하좌우 중 랜덤하게 한 방향으로 통로 생성
                const dirs = [
                    [0, -1],
                    [0, 1],
                    [-1, 0],
                    [1, 0],
                ].sort(() => Math.random() - 0.5);

                for (const [dx, dz] of dirs) {
                    const nx = x + dx;
                    const nz = z + dz;
                    if (nx > 0 && nx < width - 1 && nz > 0 && nz < height - 1 && maze[nz][nx] === 0) {
                        maze[z][x] = 0;
                        break;
                    }
                }
            }
        }
    }

    // 출구 만들기 (오른쪽 아래)
    maze[height - 1][width - 2] = 0;
    maze[height - 1][width - 1] = 0;
    return maze;
}

let mazeMap = generateMaze(15, 11);

const wallSize = 2; // 벽 하나의 크기(2x2x2)
const wallHeight = 2; // 벽의 높이(2)

const wallGeometry = new THREE.BoxGeometry(wallSize, wallHeight, wallSize);
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x333366, transparent: true, opacity: 0.6 });

let wallMeshes = [];
function buildMaze() {
    // 기존 벽 제거
    for (const mesh of wallMeshes) scene.remove(mesh);
    wallMeshes = [];
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
                wallMeshes.push(wall);
            }
        }
    }
}
buildMaze();

// 충돌 판정 함수
function canMoveTo(x, z) {
    const mazeX = Math.round(x / wallSize + mazeMap[0].length / 2);
    const mazeZ = Math.round(z / wallSize + mazeMap.length / 2);
    return (
        mazeZ >= 0 && mazeZ < mazeMap.length && mazeX >= 0 && mazeX < mazeMap[0].length && mazeMap[mazeZ][mazeX] === 0
    );
}

// glTF 로더로 '나' 캐릭터 불러오기
let playerLoader = null;
function spawnPlayer() {
    if (player) scene.remove(player);
    player = null;
    playerLoader = new GLTFLoader();
    playerLoader.load(
        '/my_character/scene.gltf',
        (gltf) => {
            player = gltf.scene;
            player.position.set((1 - mazeMap[0].length / 2) * wallSize, 0.1, (1 - mazeMap.length / 2) * wallSize);
            scene.add(player);
        },
        undefined,
        (error) => {
            console.error('GLTF 로드 에러:', error);
        }
    );
}
spawnPlayer();

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

let enemy;
const enemySpeed = 0.05;

// enemy glTF 불러오기
let enemyLoaderInstance = null;
function spawnEnemy() {
    if (enemy) scene.remove(enemy);
    enemy = null;
    enemyLoaderInstance = new GLTFLoader();
    enemyLoaderInstance.load(
        '/enemy/scene.gltf',
        (gltf) => {
            enemy = gltf.scene;
            enemy.scale.set(0.2, 0.2, 0.2); // 더 작게
            // 미로의 (1,9) 위치에서 시작 (출구와 먼 곳)
            enemy.position.set(
                (1 - mazeMap[0].length / 2) * wallSize,
                0.1,
                (mazeMap.length - 2 - mazeMap.length / 2) * wallSize
            );
            scene.add(enemy);
        },
        undefined,
        (error) => {
            console.error('Enemy GLTF 로드 에러:', error);
        }
    );
}
spawnEnemy();

let gameEnded = false;

// A* 경로 탐색 알고리즘
function astar(maze, start, goal) {
    const [sx, sz] = start;
    const [gx, gz] = goal;
    const w = maze[0].length;
    const h = maze.length;
    const open = [];
    const closed = Array.from({ length: h }, () => Array(w).fill(false));
    const cameFrom = Array.from({ length: h }, () => Array(w).fill(null));
    const gScore = Array.from({ length: h }, () => Array(w).fill(Number.POSITIVE_INFINITY));
    const fScore = Array.from({ length: h }, () => Array(w).fill(Number.POSITIVE_INFINITY));
    function hCost(x, z) {
        return Math.abs(x - gx) + Math.abs(z - gz);
    }
    gScore[sz][sx] = 0;
    fScore[sz][sx] = hCost(sx, sz);
    open.push({ x: sx, z: sz, f: fScore[sz][sx] });
    const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];
    while (open.length) {
        open.sort((a, b) => a.f - b.f);
        const { x, z } = open.shift();
        if (x === gx && z === gz) {
            // 경로 복원
            const path = [];
            let cx = x;
            let cz = z;
            while (cameFrom[cz][cx]) {
                path.push([cx, cz]);
                [cx, cz] = cameFrom[cz][cx];
            }
            path.reverse();
            return path;
        }
        closed[z][x] = true;
        for (const [dx, dz] of dirs) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= w || nz < 0 || nz >= h) continue;
            if (maze[nz][nx] !== 0 || closed[nz][nx]) continue;
            const tentativeG = gScore[z][x] + 1;
            if (tentativeG < gScore[nz][nx]) {
                cameFrom[nz][nx] = [x, z];
                gScore[nz][nx] = tentativeG;
                fScore[nz][nx] = tentativeG + hCost(nx, nz);
                if (!open.some((n) => n.x === nx && n.z === nz)) {
                    open.push({ x: nx, z: nz, f: fScore[nz][nx] });
                }
            }
        }
    }
    return null; // 경로 없음
}

let enemyPath = [];
let enemyPathIdx = 0;
let enemyPathTimer = 0;

// 렌더링 루프
function animate() {
    requestAnimationFrame(animate);

    if (gameEnded) return;

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

    // --- enemy가 플레이어를 따라오게 (미로 우회 포함) ---
    if (enemy && player) {
        // 미로 인덱스 계산
        const ex = Math.round(enemy.position.x / wallSize + mazeMap[0].length / 2);
        const ez = Math.round(enemy.position.z / wallSize + mazeMap.length / 2);
        const px = Math.round(player.position.x / wallSize + mazeMap[0].length / 2);
        const pz = Math.round(player.position.z / wallSize + mazeMap.length / 2);

        // 일정 주기마다 경로 재계산
        enemyPathTimer += 1 / 60;
        if (enemyPathTimer > 0.2 || !enemyPath.length) {
            enemyPath = astar(mazeMap, [ex, ez], [px, pz]) || [];
            enemyPathIdx = 0;
            enemyPathTimer = 0;
        }
        // 경로가 있으면 다음 칸으로 이동
        if (enemyPath.length > 0 && enemyPathIdx < enemyPath.length) {
            const [tx, tz] = enemyPath[enemyPathIdx];
            const targetX = (tx - mazeMap[0].length / 2) * wallSize;
            const targetZ = (tz - mazeMap.length / 2) * wallSize;
            const toTarget = new THREE.Vector3(targetX - enemy.position.x, 0, targetZ - enemy.position.z);
            if (toTarget.length() > 0.05) {
                toTarget.normalize();
                enemy.position.x += toTarget.x * enemySpeed;
                enemy.position.z += toTarget.z * enemySpeed;
                enemy.rotation.y = Math.atan2(toTarget.x, toTarget.z);
            } else {
                // 다음 칸 도달
                enemy.position.x = targetX;
                enemy.position.z = targetZ;
                enemyPathIdx++;
            }
        }
        // --- 게임 오버 판정 ---
        const dist = enemy.position.distanceTo(player.position);
        if (dist < 1.5) {
            gameEnded = true;
            uiDiv.style.display = 'block';
            uiDivText.textContent = 'GAME OVER!';
            setTimeout(() => {
                document.exitPointerLock?.();
            }, 100);
        }
    }

    // --- 탈출 성공 판정 ---
    if (player) {
        // 출구: 오른쪽 아래 2칸 중 하나에 도달하면 성공
        const px = player.position.x / wallSize + mazeMap[0].length / 2;
        const pz = player.position.z / wallSize + mazeMap.length / 2;
        if (
            (Math.round(px) === mazeMap[0].length - 1 || Math.round(px) === mazeMap[0].length - 2) &&
            Math.round(pz) === mazeMap.length - 1
        ) {
            gameEnded = true;
            uiDiv.style.display = 'block';
            uiDivText.textContent = '탈출 성공!';
            setTimeout(() => {
                document.exitPointerLock?.();
            }, 100);
        }
    }

    renderer.render(scene, camera);
}

// UI 표시용 div 추가
const uiDiv = document.createElement('div');
uiDiv.style.position = 'fixed';
uiDiv.style.top = '50%';
uiDiv.style.left = '50%';
uiDiv.style.transform = 'translate(-50%, -50%)';
uiDiv.style.fontSize = '3rem';
uiDiv.style.fontWeight = 'bold';
uiDiv.style.color = '#fff';
uiDiv.style.textShadow = '0 0 10px #222, 0 0 20px #222';
uiDiv.style.zIndex = '10';
uiDiv.style.display = 'none';
uiDiv.style.textAlign = 'center';

const uiDivText = document.createElement('div');
uiDiv.appendChild(uiDivText);

const resetBtn = document.createElement('button');
resetBtn.textContent = '다시 시작';
resetBtn.style.fontSize = '2rem';
resetBtn.style.marginTop = '2rem';
resetBtn.style.padding = '0.5em 1.5em';
resetBtn.style.borderRadius = '1em';
resetBtn.style.border = 'none';
resetBtn.style.background = '#222';
resetBtn.style.color = '#fff';
resetBtn.style.cursor = 'pointer';
resetBtn.style.display = 'block';
resetBtn.onclick = () => {
    uiDiv.style.display = 'none';
    gameEnded = false;
    mazeMap = generateMaze(15, 11);
    buildMaze();
    spawnPlayer();
    spawnEnemy();
    enemyPath = [];
    enemyPathIdx = 0;
    enemyPathTimer = 0;
    document.exitPointerLock?.();
};
uiDiv.appendChild(resetBtn);
document.body.appendChild(uiDiv);

animate();
