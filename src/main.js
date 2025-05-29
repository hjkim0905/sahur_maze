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

// 위험 조명 시스템 관련 변수들
let dangerMode = false;
let dangerIntensity = 0;
let dangerTimer = 0;
let originalAmbientIntensity = 0.6;
let originalBgColor = 0x87ceeb;

// 게임오버 카메라 관련 변수들 추가 (기존 변수들 아래에)
let gameOverCameraTransition = false;
let gameOverTimer = 0;
let originalCameraPos = new THREE.Vector3();
let originalCameraTarget = new THREE.Vector3();

// 미로 관련 변수
let mazeMap;
const wallSize = 2; // 벽 하나의 크기(2x2x2)
const wallHeight = 2; // 벽의 높이(2)
const wallGeometry = new THREE.BoxGeometry(wallSize, wallHeight, wallSize);
const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b4513, // 갈색 벽
    roughness: 0.7,
    metalness: 0.2,
    transparent: false,
});
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

const dangerLight = new THREE.DirectionalLight(0xff0000, 0); // 빨간 조명
dangerLight.position.set(0, 10, 0);
dangerLight.castShadow = false; // 그림자 비활성화로 성능 향상
scene.add(dangerLight);

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

// 미로 생성 함수 (개선된 버전)
function generateMaze(width, height) {
    // 미로 초기화 (모든 칸을 벽으로)
    const maze = Array.from({ length: height }, () => Array(width).fill(1));

    // 시작점과 출구 위치 설정
    const startX = 1;
    const startZ = 1;
    const exitX = width - 3;
    const exitZ = height - 3;

    // 시작점 설정
    maze[startZ][startX] = 0;

    // DFS를 사용한 미로 생성 (일직선 경로 제거)
    const stack = [];
    const visited = new Set();

    // 시작점부터 미로 생성 시작
    stack.push([startX, startZ]);
    visited.add(`${startX},${startZ}`);

    while (stack.length > 0) {
        const [x, z] = stack[stack.length - 1];

        // 4방향 랜덤 순서로 탐색
        const directions = [
            [0, -2], // 위
            [2, 0], // 오른쪽
            [0, 2], // 아래
            [-2, 0], // 왼쪽
        ].sort(() => Math.random() - 0.5);

        let moved = false;
        for (const [dx, dz] of directions) {
            const nx = x + dx;
            const nz = z + dz;
            const key = `${nx},${nz}`;

            // 경계 체크 및 방문 체크
            if (nz > 0 && nz < height - 1 && nx > 0 && nx < width - 1 && !visited.has(key)) {
                // 벽 제거 (현재 위치와 다음 위치 사이)
                maze[z + dz / 2][x + dx / 2] = 0;
                maze[nz][nx] = 0;

                // 새 위치로 이동
                stack.push([nx, nz]);
                visited.add(key);
                moved = true;
                break;
            }
        }

        if (!moved) {
            stack.pop();
        }
    }

    maze[exitZ][width - 1] = 0;

    // 출구로의 연결 보장 (최소한의 연결만)
    ensureExitConnection(maze, width, height, exitX, exitZ);

    // 난이도에 따른 추가 통로 생성 (더 신중하게)
    addExtraPaths(maze, width, height, exitX, exitZ);

    // 막다른 길 제거 (선택적)
    if (difficulty === 'easy') {
        removeDeadEnds(maze, width, height, startX, startZ, exitX, exitZ);
    }

    return maze;
}

// 출구로의 연결을 보장하는 함수
function ensureExitConnection(maze, width, height, exitX, exitZ) {
    // 출구 주변에서 연결 가능한 지점 찾기
    const connectionPoints = [];

    // 출구 주변 체크
    for (let z = exitZ - 1; z <= exitZ + 3; z++) {
        for (let x = exitX - 1; x <= exitX + 3; x++) {
            if (z >= 0 && z < height && x >= 0 && x < width && maze[z][x] === 0) {
                // 출구 영역이 아닌 빈 공간이면 연결점 후보
                if (!(x >= exitX && x <= exitX + 2 && z >= exitZ && z <= exitZ + 2)) {
                    connectionPoints.push([x, z]);
                }
            }
        }
    }

    // 가장 가까운 연결점과 출구를 연결
    if (connectionPoints.length > 0) {
        const closestPoint = connectionPoints.reduce((closest, point) => {
            const distToCurrent = Math.abs(point[0] - exitX) + Math.abs(point[1] - exitZ);
            const distToClosest = Math.abs(closest[0] - exitX) + Math.abs(closest[1] - exitZ);
            return distToCurrent < distToClosest ? point : closest;
        });

        // 연결점과 출구 사이를 연결
        connectPoints(maze, closestPoint[0], closestPoint[1], exitX + 1, exitZ + 1);
    }
}

// 두 점을 연결하는 함수
function connectPoints(maze, x1, z1, x2, z2) {
    let x = x1;
    let z = z1;

    while (x !== x2 || z !== z2) {
        maze[z][x] = 0;

        if (x < x2) x++;
        else if (x > x2) x--;
        else if (z < z2) z++;
        else if (z > z2) z--;
    }
    maze[z2][x2] = 0;
}

// 추가 통로 생성 함수 (더 신중하게)
function addExtraPaths(maze, width, height, exitX, exitZ) {
    const extraPathProbability = difficulty === 'easy' ? 0.2 : difficulty === 'medium' ? 0.08 : 0.04;

    for (let z = 1; z < height - 1; z++) {
        for (let x = 1; x < width - 1; x++) {
            // 출구 주변 5칸은 건드리지 않기
            if (Math.abs(x - exitX) <= 4 && Math.abs(z - exitZ) <= 4) continue;

            // 시작점 주변 3칸도 너무 복잡하지 않게
            if (Math.abs(x - 1) <= 2 && Math.abs(z - 1) <= 2 && Math.random() > 0.3) continue;

            if (maze[z][x] === 1 && Math.random() < extraPathProbability) {
                // 주변에 빈 공간이 있는지 확인
                const neighbors = [
                    [x, z - 1],
                    [x, z + 1],
                    [x - 1, z],
                    [x + 1, z],
                ];

                const emptyNeighbors = neighbors.filter(
                    ([nx, nz]) => nx > 0 && nx < width - 1 && nz > 0 && nz < height - 1 && maze[nz][nx] === 0
                );

                // 이지 모드에서는 더 관대하게 통로 생성
                const maxConnections = difficulty === 'easy' ? 3 : 2;
                if (emptyNeighbors.length >= 1 && emptyNeighbors.length <= maxConnections) {
                    maze[z][x] = 0;
                }
            }
        }
    }

    // 이지 모드 전용: 넓은 공간 생성
    if (difficulty === 'easy') {
        createOpenAreas(maze, width, height, exitX, exitZ);

        // 벽 뭉침 제거
        removeWallClusters(maze, width, height);

        // 연결성 개선 (적이 막히지 않도록)
        improveConnectivity(maze, width, height);
    }
}

// 막다른 길 제거 함수 (쉬운 난이도용)
function removeDeadEnds(maze, width, height, startX, startZ, exitX, exitZ) {
    let changed = true;
    let iterations = 0;
    const maxIterations = 3; // 너무 많이 제거하지 않도록 제한

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        for (let z = 1; z < height - 1; z++) {
            for (let x = 1; x < width - 1; x++) {
                // 시작점과 출구는 건드리지 않기
                if ((x === startX && z === startZ) || (x === width - 1 && z === exitZ)) {
                    continue;
                }

                if (maze[z][x] === 0) {
                    // 주변 빈 공간 개수 세기
                    const neighbors = [maze[z - 1][x], maze[z + 1][x], maze[z][x - 1], maze[z][x + 1]];

                    const emptyCount = neighbors.filter((n) => n === 0).length;

                    // 막다른 길이면 제거 (연결이 1개뿐인 경우)
                    // 단, 50% 확률로만 제거 (일부 막다른 길은 유지)
                    if (emptyCount === 1 && Math.random() < 0.5) {
                        maze[z][x] = 1;
                        changed = true;
                    }
                }
            }
        }
    }
}

// 이지 모드 전용: 넓은 공간 생성
function createOpenAreas(maze, width, height, exitX, exitZ) {
    const areaCount = Math.floor((width * height) / 200); // 미로 크기에 비례한 넓은 공간 개수

    for (let i = 0; i < areaCount; i++) {
        // 랜덤한 위치에 2x2 또는 3x2 크기의 넓은 공간 생성
        const centerX = Math.floor(Math.random() * (width - 6)) + 3;
        const centerZ = Math.floor(Math.random() * (height - 6)) + 3;

        // 출구나 시작점 주변은 피하기
        if (
            (Math.abs(centerX - 1) <= 3 && Math.abs(centerZ - 1) <= 3) ||
            (Math.abs(centerX - exitX) <= 4 && Math.abs(centerZ - exitZ) <= 4)
        ) {
            continue;
        }

        // 넓은 공간 생성 (2x2 또는 3x2)
        const sizeX = Math.random() < 0.7 ? 2 : 3;
        const sizeZ = Math.random() < 0.8 ? 2 : 3;

        for (let z = centerZ; z < centerZ + sizeZ && z < height - 1; z++) {
            for (let x = centerX; x < centerX + sizeX && x < width - 1; x++) {
                maze[z][x] = 0;
            }
        }
    }
}

// 벽 뭉침 제거
function removeWallClusters(maze, width, height) {
    for (let z = 2; z < height - 2; z++) {
        for (let x = 2; x < width - 2; x++) {
            if (maze[z][x] === 1) {
                // 3x3 영역에서 벽의 개수 체크
                let wallCount = 0;
                for (let dz = -1; dz <= 1; dz++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (maze[z + dz][x + dx] === 1) {
                            wallCount++;
                        }
                    }
                }

                // 벽이 너무 많이 뭉쳐있으면 일부 제거
                if (wallCount >= 7) {
                    // 중앙의 벽을 제거할지 50% 확률로 결정
                    if (Math.random() < 0.5) {
                        maze[z][x] = 0;
                    }
                }
            }
        }
    }
}

// 연결성 개선 (적이 막히지 않도록)
function improveConnectivity(maze, width, height) {
    // flood fill로 연결된 영역들 찾기
    const visited = Array.from({ length: height }, () => Array(width).fill(false));
    const areas = [];

    for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
            if (maze[z][x] === 0 && !visited[z][x]) {
                const area = floodFill(maze, visited, x, z, width, height);
                if (area.length > 3) {
                    // 너무 작은 영역은 무시
                    areas.push(area);
                }
            }
        }
    }

    // 가장 큰 두 영역을 연결
    if (areas.length >= 2) {
        areas.sort((a, b) => b.length - a.length);
        const area1 = areas[0];
        const area2 = areas[1];

        // 두 영역 사이의 최단 연결점 찾기
        let minDist = Infinity;
        let connectPoint1, connectPoint2;

        for (const [x1, z1] of area1) {
            for (const [x2, z2] of area2) {
                const dist = Math.abs(x1 - x2) + Math.abs(z1 - z2);
                if (dist < minDist) {
                    minDist = dist;
                    connectPoint1 = [x1, z1];
                    connectPoint2 = [x2, z2];
                }
            }
        }

        // 연결 통로 생성
        if (connectPoint1 && connectPoint2) {
            connectPoints(maze, connectPoint1[0], connectPoint1[1], connectPoint2[0], connectPoint2[1]);
        }
    }
}

// Flood fill 함수
function floodFill(maze, visited, startX, startZ, width, height) {
    const stack = [[startX, startZ]];
    const area = [];

    while (stack.length > 0) {
        const [x, z] = stack.pop();

        if (x < 0 || x >= width || z < 0 || z >= height || visited[z][x] || maze[z][x] === 1) {
            continue;
        }

        visited[z][x] = true;
        area.push([x, z]);

        // 4방향 탐색
        stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }

    return area;
}

// 기존 위험 상태 관리 함수를 이걸로 교체하세요!
function updateDangerMode(playerPos, enemyPos) {
    if (!playerPos || !enemyPos) return;

    const distance = playerPos.distanceTo(enemyPos);
    const dangerDistance = 15; // 위험 거리 임계값 (8 → 15로 증가)
    const criticalDistance = 6; // 심각한 위험 거리 (4 → 6으로 증가)

    if (distance <= dangerDistance) {
        // 위험 모드 활성화
        if (!dangerMode) {
            dangerMode = true;
            dangerTimer = 0;
        }

        // 거리에 따른 위험 강도 계산 (가까울수록 강해짐)
        const distanceRatio = Math.max(0, (dangerDistance - distance) / dangerDistance);
        const targetIntensity = Math.min(1.2, distanceRatio * 2); // 최대 강도 증가

        // 부드럽게 강도 조절
        dangerIntensity += (targetIntensity - dangerIntensity) * 0.08; // 더 천천히 변화
    } else {
        // 위험 모드 비활성화
        if (dangerMode && distance > dangerDistance + 3) {
            // 히스테리시스 효과 증가
            dangerMode = false;
        }

        // 점진적으로 강도 감소
        dangerIntensity *= 0.92; // 더 천천히 감소
        if (dangerIntensity < 0.01) {
            dangerIntensity = 0;
        }
    }
}

// 기존 위험 조명 효과 함수를 이걸로 교체하세요!
function applyDangerLighting() {
    if (dangerIntensity > 0) {
        dangerTimer += 1 / 60; // 60fps 기준

        // 사이렌 효과 (더 빠르고 불규칙한 깜빡임)
        const sirenSpeed = 4 + dangerIntensity * 6; // 더 빠른 깜빡임
        const sirenEffect = (Math.sin(dangerTimer * sirenSpeed) + 1) / 2;

        // 불규칙한 깜빡임 추가 (더 무서운 효과)
        const randomFlicker = Math.sin(dangerTimer * sirenSpeed * 2.3) * 0.3;
        const finalSirenEffect = Math.max(0, sirenEffect + randomFlicker);

        // 위험 조명 강도 적용 (더 강하게)
        const redIntensity = dangerIntensity * finalSirenEffect * 2.5; // 강도 증가
        dangerLight.intensity = redIntensity;

        // 주변광 더 어둡게 만들기
        const ambientReduction = dangerIntensity * 0.85; // 더 어둡게
        ambientLight.intensity = originalAmbientIntensity * (1 - ambientReduction);

        // 배경색 더 어둡고 붉게
        const darkenFactor = 1 - dangerIntensity * 0.7; // 더 어둡게
        const redTint = dangerIntensity * 0.5; // 더 붉게

        const newColor = new THREE.Color(
            Math.min(1, (0x87 / 255) * darkenFactor + redTint),
            Math.max(0, (0xce / 255) * darkenFactor * (1 - redTint * 0.8)),
            Math.max(0, (0xeb / 255) * darkenFactor * (1 - redTint * 0.9))
        );
        scene.background = newColor;

        // 방향성 조명 더 강하게 흔들리게
        const lightShake = dangerIntensity * 0.5; // 더 강한 흔들림
        const shakeEffect = Math.sin(dangerTimer * sirenSpeed * 1.7) * lightShake;
        directionalLight.intensity = Math.max(0.2, 0.8 + shakeEffect);

        // 추가 무서운 효과: 조명 위치도 약간 흔들리게
        if (dangerIntensity > 0.5) {
            const positionShake = dangerIntensity * 2;
            directionalLight.position.x = 10 + Math.sin(dangerTimer * 8) * positionShake;
            directionalLight.position.z = 10 + Math.cos(dangerTimer * 6) * positionShake;
        }
    } else {
        // 원래 상태로 복구
        dangerLight.intensity = 0;
        ambientLight.intensity = originalAmbientIntensity;
        scene.background = new THREE.Color(originalBgColor);
        directionalLight.intensity = 0.8;

        // 조명 위치 원상복구
        directionalLight.position.set(10, 20, 10);
    }
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

// 충돌 판정 함수 수정 (기존 canMoveTo 함수 교체)
function canMoveTo(x, z) {
    const mazeX = Math.round(x / wallSize + mazeMap[0].length / 2);
    const mazeZ = Math.round(z / wallSize + mazeMap.length / 2);

    // 출구 위치 계산
    const exitZ = mazeMap.length - 3;

    // 출구를 통해 나가는 경우는 허용
    if (mazeZ === exitZ && mazeX >= mazeMap[0].length - 1) {
        return true; // 출구로 나가는 것 허용
    }

    // 미로 경계 밖으로 나가는 경우도 허용 (탈출을 위해)
    if (mazeZ < 0 || mazeZ >= mazeMap.length || mazeX < 0 || mazeX >= mazeMap[0].length) {
        return true; // 경계 밖 허용
    }

    // 미로 내부에서는 기존 로직대로
    return mazeMap[mazeZ][mazeX] === 0;
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
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080, // 회색 바닥
    roughness: 0.8,
    metalness: 0.1,
    map: new THREE.TextureLoader().load('/textures/stone_tiles.jpg', (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 20);
    }),
});
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

    if (gameEnded) {
        // 게임오버 카메라 전환 처리
        if (gameState === 'gameover') {
            updateGameOverCamera();
        }
        renderer.render(scene, camera);
        return;
    }

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
        updateDangerMode(player.position, enemy.position);
        applyDangerLighting();

        if (dist < 1.5) {
            gameOver();
        }
    }

    // --- 탈출 성공 판정 ---
    if (player) {
        // 출구 위치 계산
        const exitZ = mazeMap.length - 3;

        // 플레이어 위치를 미로 좌표로 변환
        const px = Math.round(player.position.x / wallSize + mazeMap[0].length / 2);
        const pz = Math.round(player.position.z / wallSize + mazeMap.length / 2);

        // 미로 경계를 넘어섰는지 확인 (완전히 나가야 성공)
        if (px >= mazeMap[0].length || px < 0 || pz >= mazeMap.length || pz < 0) {
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
    let mazeSize;
    switch (difficulty) {
        case 'easy':
            mazeSize = { width: 25, height: 19 }; // 더 큰 미로
            break;
        case 'medium':
            mazeSize = { width: 35, height: 25 }; // 더 큰 미로
            break;
        case 'hard':
            mazeSize = { width: 45, height: 35 }; // 더 큰 미로
            break;
    }

    // 게임 초기화
    gameEnded = false;
    mazeMap = generateMaze(mazeSize.width, mazeSize.height);
    buildMaze();
    spawnPlayer();

    // 플레이어 다시 보이게 만들기
    setTimeout(() => {
        if (player) {
            player.visible = true;
        }
    }, 100); // 플레이어 로드 대기

    spawnEnemy();
    enemyPath = [];
    enemyPathIdx = 0;
    enemyPathTimer = 0;

    // 포인터 락 활성화
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
    if (gameState === 'gameover') return; // 중복 호출 방지

    gameState = 'gameover';
    gameEnded = true;

    // 게임오버 카메라 전환 시작
    if (player && enemy) {
        gameOverCameraTransition = true;
        gameOverTimer = 0;

        // 현재 카메라 위치 저장
        originalCameraPos.copy(camera.position);
        originalCameraTarget.copy(player.position);

        // 플레이어 숨기기 (적의 앞모습에만 집중)
        if (player) {
            player.visible = false;
        }

        // 위험 조명 효과 즉시 중단
        dangerLight.intensity = 0;
        ambientLight.intensity = originalAmbientIntensity;
        scene.background = new THREE.Color(originalBgColor);
        directionalLight.intensity = 0.8;
        directionalLight.position.set(10, 20, 10);
    }

    // UI는 카메라 전환 후에 표시 (2초 후로 단축)
    setTimeout(() => {
        uiDiv.style.display = 'block';
        uiDivText.textContent = 'GAME OVER!';
        document.exitPointerLock?.();
    }, 2000);
}

// updateGameOverCamera 함수를 이렇게 수정하세요!
function updateGameOverCamera() {
    if (!gameOverCameraTransition || !enemy || !player) return;

    gameOverTimer += 1 / 60; // 60fps 기준

    const transitionDuration = 2.0; // 2초로 단축
    const progress = Math.min(gameOverTimer / transitionDuration, 1);

    // Easing 함수 (부드러운 전환)
    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    const smoothProgress = easeInOut(progress);

    if (progress < 1) {
        // === 적의 정면으로 카메라 이동 ===

        const enemyPos = enemy.position.clone();
        const playerPos = player.position.clone();

        // 적이 바라보는 방향 계산 (플레이어 쪽)
        const enemyDirection = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();

        // 적의 정면에서 적을 바라보는 위치 (벽에 가려지지 않게)
        const cameraDistance = 2.5;
        const cameraHeight = 1.8;

        // 적 정면 위치 계산 (적이 바라보는 방향의 반대쪽)
        const targetCameraPos = enemyPos
            .clone()
            .add(enemyDirection.clone().multiplyScalar(cameraDistance)) // 적 앞쪽에 위치
            .add(new THREE.Vector3(0, cameraHeight, 0));

        // 적의 얼굴을 바라보는 목표점
        const targetLookAt = enemyPos.clone().add(new THREE.Vector3(0, 1.2, 0));

        // === 부드러운 카메라 전환 ===
        camera.position.lerpVectors(originalCameraPos, targetCameraPos, smoothProgress);

        // 시선 방향도 부드럽게 전환
        const currentTarget = originalCameraTarget.clone().lerp(targetLookAt, smoothProgress);
        camera.lookAt(currentTarget);

        // 조명 효과
        const dramaticLighting = 1 - smoothProgress * 0.3;
        ambientLight.intensity = originalAmbientIntensity * dramaticLighting;
        directionalLight.intensity = 0.8 + smoothProgress * 0.4;
    } else {
        // === 최종 시점: 적의 앞모습 완전히 고정 ===

        gameOverCameraTransition = false;

        const enemyPos = enemy.position.clone();
        const playerPos = player.position.clone();

        // 적이 바라보는 방향 (플레이어 쪽)
        const enemyDirection = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();

        // 적 정면에서 바라보는 최종 위치
        const finalCameraPos = enemyPos
            .clone()
            .add(enemyDirection.clone().multiplyScalar(2.5))
            .add(new THREE.Vector3(0, 1.8, 0));

        camera.position.copy(finalCameraPos);
        camera.lookAt(enemyPos.clone().add(new THREE.Vector3(0, 1.2, 0)));

        // 최종 조명: 적을 드라마틱하게 비추기
        ambientLight.intensity = originalAmbientIntensity * 0.7;
        directionalLight.intensity = 1.2;
        scene.background = new THREE.Color(0x2a2a2a);
    }
}

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
    // 게임오버 상태에서는 카메라 조작 불가
    if (gameState === 'gameover') {
        return;
    }

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
