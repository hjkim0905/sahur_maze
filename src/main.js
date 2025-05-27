import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 게임 상태 관리
let gameState = 'menu'; // 'menu', 'playing', 'gameover'
let difficulty = 'medium'; // 'easy', 'medium', 'hard'
let viewMode = 'third'; // 'first', 'third'
let stamina = 100;
let isRunning = false;
let staminaRegenTimer = 0;
let gameEnded = false;

// 플레이어 관련 변수
let player;
const move = { forward: false, backward: false, left: false, right: false };
const speed = 0.08;

// 카메라 관련 변수
let cameraAngle = 0;
let cameraElevation = 0.8; // 위에서 내려다보는 각도
const cameraDistance = 10;
const minElev = -Math.PI / 2 + 0.1;
const maxElev = Math.PI / 2 - 0.1;

// 적 관련 변수
let enemy;
const enemySpeed = 0.05;
let enemyPath = [];
let enemyPathIdx = 0;
let enemyPathTimer = 0;

// 미로 관련 변수
let mazeMap;
const wallSize = 2; // 벽 하나의 크기(2x2x2)
const wallHeight = 2; // 벽의 높이(2)
const wallGeometry = new THREE.BoxGeometry(wallSize, wallHeight, wallSize);
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x333366, transparent: true, opacity: 0.6 });
let wallMeshes = [];

// 씬, 카메라, 렌더러 생성
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // 하늘색 배경
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true; // 그림자 활성화

// 조명 추가
// 주변광 (전체적인 밝기)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// 방향성 조명 (태양광 같은 효과)
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// 렌더러 DOM 요소 추가
document.querySelector('#app').innerHTML = ''; // 기존 텍스트 제거
document.querySelector('#app').appendChild(renderer.domElement);

// UI 요소들
const menuDiv = document.createElement('div');
menuDiv.style.position = 'fixed';
menuDiv.style.top = '50%';
menuDiv.style.left = '50%';
menuDiv.style.transform = 'translate(-50%, -50%)';
menuDiv.style.textAlign = 'center';
menuDiv.style.zIndex = '100';

const titleDiv = document.createElement('div');
titleDiv.textContent = 'SAHUR MAZE RUNNER';
titleDiv.style.fontSize = '4rem';
titleDiv.style.fontWeight = 'bold';
titleDiv.style.color = '#fff';
titleDiv.style.textShadow = '0 0 10px #222, 0 0 20px #222';
titleDiv.style.marginBottom = '2rem';
menuDiv.appendChild(titleDiv);

// 시점 선택 UI
const viewModeDiv = document.createElement('div');
viewModeDiv.style.marginBottom = '2rem';
const viewModes = ['first', 'third'];
viewModes.forEach((mode) => {
    const btn = document.createElement('button');
    btn.textContent = mode === 'first' ? '1인칭 시점' : '3인칭 시점';
    btn.style.fontSize = '1.5rem';
    btn.style.margin = '0.5rem';
    btn.style.padding = '0.5em 1.5em';
    btn.style.borderRadius = '1em';
    btn.style.border = 'none';
    btn.style.background = '#222';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
        viewMode = mode;
        updateViewModeButtons();
    };
    viewModeDiv.appendChild(btn);
});
menuDiv.appendChild(viewModeDiv);

// 난이도 선택 UI
const difficultyDiv = document.createElement('div');
difficultyDiv.style.marginBottom = '2rem';

const difficulties = ['easy', 'medium', 'hard'];
difficulties.forEach((diff) => {
    const btn = document.createElement('button');
    btn.textContent = diff.toUpperCase();
    btn.style.fontSize = '2rem';
    btn.style.margin = '0.5rem';
    btn.style.padding = '0.5em 1.5em';
    btn.style.borderRadius = '1em';
    btn.style.border = 'none';
    btn.style.background = '#222';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
        difficulty = diff;
        updateDifficultyButtons();
    };
    difficultyDiv.appendChild(btn);
});
menuDiv.appendChild(difficultyDiv);

// 시작 버튼
const startBtn = document.createElement('button');
startBtn.textContent = '게임 시작';
startBtn.style.fontSize = '2.5rem';
startBtn.style.padding = '0.5em 1.5em';
startBtn.style.borderRadius = '1em';
startBtn.style.border = 'none';
startBtn.style.background = '#4CAF50';
startBtn.style.color = '#fff';
startBtn.style.cursor = 'pointer';
startBtn.onclick = startGame;
menuDiv.appendChild(startBtn);

document.body.appendChild(menuDiv);

// 게임 상태 UI
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
    menuDiv.style.display = 'block';
    gameState = 'menu';
    gameEnded = false;
    document.exitPointerLock?.();
};
uiDiv.appendChild(resetBtn);
document.body.appendChild(uiDiv);

// 스태미나 UI
const staminaBar = document.createElement('div');
staminaBar.style.position = 'fixed';
staminaBar.style.bottom = '20px';
staminaBar.style.left = '50%';
staminaBar.style.transform = 'translateX(-50%)';
staminaBar.style.width = '200px';
staminaBar.style.height = '20px';
staminaBar.style.background = '#333';
staminaBar.style.borderRadius = '10px';
staminaBar.style.display = 'none';

const staminaFill = document.createElement('div');
staminaFill.style.width = '100%';
staminaFill.style.height = '100%';
staminaFill.style.background = '#4CAF50';
staminaFill.style.borderRadius = '10px';
staminaFill.style.transition = 'width 0.3s';
staminaBar.appendChild(staminaFill);
document.body.appendChild(staminaBar);

// 메인 메뉴 UI 생성
function updateViewModeButtons() {
    const buttons = viewModeDiv.getElementsByTagName('button');
    for (let btn of buttons) {
        btn.style.background = btn.textContent.includes(viewMode === 'first' ? '1인칭' : '3인칭') ? '#4CAF50' : '#222';
    }
}

function updateDifficultyButtons() {
    const buttons = difficultyDiv.getElementsByTagName('button');
    for (let btn of buttons) {
        btn.style.background = btn.textContent.toLowerCase() === difficulty ? '#4CAF50' : '#222';
    }
}

// 스태미나 바 업데이트
function updateStaminaBar() {
    staminaFill.style.width = `${stamina}%`;
}

// 미로 생성 함수 (반복문 기반)
function generateMaze(width, height) {
    const maze = Array.from({ length: height }, () => Array(width).fill(1));
    const stack = [];
    const visited = new Set();

    // 시작점 설정
    maze[1][1] = 0;
    stack.push([1, 1]);
    visited.add('1,1');

    // DFS를 반복문으로 구현
    while (stack.length > 0) {
        const [x, y] = stack[stack.length - 1];
        const directions = [
            [0, -2],
            [2, 0],
            [0, 2],
            [-2, 0],
        ].sort(() => Math.random() - 0.5);

        let moved = false;
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;

            if (ny > 0 && ny < height - 1 && nx > 0 && nx < width - 1 && !visited.has(key)) {
                // 벽 제거
                maze[y + dy / 2][x + dx / 2] = 0;
                maze[ny][nx] = 0;

                // 새 위치로 이동
                stack.push([nx, ny]);
                visited.add(key);
                moved = true;
                break;
            }
        }

        if (!moved) {
            stack.pop();
        }
    }

    // 끝점 설정
    maze[height - 2][width - 2] = 0;

    // 추가 통로 생성 (20% 확률)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (maze[y][x] === 1 && Math.random() < 0.2) {
                const dirs = [
                    [0, -1],
                    [0, 1],
                    [-1, 0],
                    [1, 0],
                ];
                for (const [dx, dy] of dirs) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && maze[ny][nx] === 0) {
                        maze[y][x] = 0;
                        break;
                    }
                }
            }
        }
    }

    return maze;
}

// 초기 미로 생성
mazeMap = generateMaze(15, 11);

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

// 초기 미로 구축
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
    if (e.code === 'ShiftLeft') isRunning = true;
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') move.forward = false;
    if (e.code === 'KeyS') move.backward = false;
    if (e.code === 'KeyA') move.left = false;
    if (e.code === 'KeyD') move.right = false;
    if (e.code === 'ShiftLeft') isRunning = false;
});

// 씬 생성 후, 바닥 추가
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0; // y=0에 바닥
scene.add(ground);

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

// 렌더링 루프
function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'menu') {
        // 메뉴 화면에서는 카메라 회전 애니메이션
        camera.position.x = Math.sin(Date.now() * 0.001) * 10;
        camera.position.z = Math.cos(Date.now() * 0.001) * 10;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        return;
    }

    if (gameEnded) return;

    if (player) {
        // 스태미나 관리
        if (isRunning && stamina > 0) {
            stamina -= 0.5;
            updateStaminaBar();
        } else if (!isRunning && stamina < 100) {
            staminaRegenTimer += 1 / 60;
            if (staminaRegenTimer >= 0.1) {
                stamina = Math.min(100, stamina + 0.2);
                staminaRegenTimer = 0;
                updateStaminaBar();
            }
        }

        // 이동 속도 계산
        const currentSpeed = isRunning && stamina > 0 ? speed * 1.5 : speed;

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
            const nextX = player.position.x + moveDir.x * currentSpeed;
            const nextZ = player.position.z + moveDir.z * currentSpeed;
            if (canMoveTo(nextX, nextZ)) {
                player.position.x = nextX;
                player.position.z = nextZ;
            }
            // 이동 방향으로 모델의 앞을 맞추기
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            player.rotation.y = targetAngle;
        }

        // 카메라 위치 조정
        if (viewMode === 'first') {
            // 1인칭 시점
            const eyeHeight = 1.6; // 눈 높이
            const forwardOffset = 0.5; // 카메라를 앞으로

            // 플레이어의 위치를 기준으로 카메라 위치 계산
            camera.position.copy(player.position);
            camera.position.y += eyeHeight; // 눈 높이만큼 올림

            // 플레이어가 바라보는 방향으로 앞쪽에 위치
            const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);
            camera.position.add(forward.multiplyScalar(forwardOffset));

            // 카메라가 바라보는 방향 설정 (수직으로 서있는 상태)
            camera.rotation.x = 0; // 수평 시야 유지
            camera.rotation.z = 0; // 기울기 없음

            // 플레이어의 회전을 카메라 회전과 동기화
            player.rotation.y = camera.rotation.y;
        } else {
            // 3인칭 시점
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
            gameOver();
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
            escapeSuccess();
        }
    }

    renderer.render(scene, camera);
}

// 게임 시작 함수 수정
function startGame() {
    gameState = 'playing';
    menuDiv.style.display = 'none';
    uiDiv.style.display = 'none';
    staminaBar.style.display = 'block';
    stamina = 100;
    updateStaminaBar();

    // 난이도에 따른 설정
    let mazeSize, enemySpeed;
    switch (difficulty) {
        case 'easy':
            mazeSize = { width: 11, height: 9 };
            enemySpeed = 0.04;
            break;
        case 'medium':
            mazeSize = { width: 15, height: 11 };
            enemySpeed = 0.06;
            break;
        case 'hard':
            mazeSize = { width: 19, height: 13 };
            enemySpeed = 0.08;
            break;
    }

    // 게임 초기화
    gameEnded = false;
    mazeMap = generateMaze(mazeSize.width, mazeSize.height);
    buildMaze();
    spawnPlayer();
    spawnEnemy();
    enemyPath = [];
    enemyPathIdx = 0;
    enemyPathTimer = 0;

    // 포인터 락 활성화 (안전하게 처리)
    try {
        if (renderer.domElement && document.body.contains(renderer.domElement)) {
            renderer.domElement.requestPointerLock();
        }
    } catch (error) {
        console.error('포인터 락 활성화 실패:', error);
    }
}

// 게임오버 처리 수정
function gameOver() {
    gameState = 'gameover';
    gameEnded = true;
    uiDiv.style.display = 'block';
    uiDivText.textContent = 'GAME OVER!';
    setTimeout(() => {
        document.exitPointerLock?.();
    }, 100);
}

// 탈출 성공 처리 수정
function escapeSuccess() {
    gameState = 'gameover';
    gameEnded = true;
    uiDiv.style.display = 'block';
    uiDivText.textContent = '탈출 성공!';
    setTimeout(() => {
        document.exitPointerLock?.();
    }, 100);
}

animate();

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
    if (viewMode === 'first') {
        // 1인칭 시점에서는 카메라 회전 (마우스 움직임과 자연스럽게)
        camera.rotation.y -= e.movementX * 0.01; // 좌우 회전
        camera.rotation.x -= e.movementY * 0.01; // 상하 회전
        // 수직 회전 제한 (위아래로 더 넓게 볼 수 있도록)
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    } else {
        // 3인칭 시점에서는 기존처럼 카메라 각도 변경
        cameraAngle -= e.movementX * 0.01;
        cameraElevation -= e.movementY * 0.01;
        cameraElevation = Math.max(minElev, Math.min(maxElev, cameraElevation));
    }
}
