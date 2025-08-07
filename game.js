let scene, camera, renderer, controls;
const blocks = new Map();
const allBlocks = [];
const blockSize = 1;
const playerHeight = 1.8;
const playerRadius = 0.2;
const moveSpeed = 5.0;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const jumpPower = 0.3;
const gravity = -0.01;
let canJump = true;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let blockUpdateQueue = [];
let hotbarSlots = Array.from(document.querySelectorAll('#hotbar .slot'));
let selectedBlockId = hotbarSlots[0].dataset.blockId;
const clock = new THREE.Clock();
let raycaster;
let playerArm;
let heldBlock;
let isInventoryOpen = false;
document.getElementById('save-world-btn').addEventListener('click', saveWorld);
document.getElementById('load-world-btn').addEventListener('click', loadWorld);
let isTouchDevice = false;
let joystick, joystickX, joystickY, touchCameraX, touchCameraY;
let isMovingJoystick = false;
const joystickRadius = 50;
const touchSensitivity = 0.005;
const touchLookZone = { startX: window.innerWidth / 2, startY: 0 };
let isPlaying = false;
let isControllerConnected = false;
let lastBumperPressTime = 0;
const bumperDelay = 200;
const controllerSensitivity = 0.04;
const joystickDeadzone = 0.1;
let ltPressedLastFrame = false;
let rtPressedLastFrame = false;
let xPressedLastFrame = false;
let ePressedLastFrame = false;
const doorInteractionDelay = 200;
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}
const debouncedToggleInventory = debounce(toggleInventory, 200);
const debouncedToggleDoor = debounce(toggleDoor, doorInteractionDelay);
document.getElementById('inventory-btn-menu').addEventListener('click', debouncedToggleInventory);
document.getElementById('inventory-btn-game').addEventListener('click', debouncedToggleInventory);
if (isTouchDevice) {
    document.getElementById('inventory-btn-menu').addEventListener('touchstart', (event) => { event.stopPropagation(); debouncedToggleInventory(); });
    document.getElementById('inventory-btn-game').addEventListener('touchstart', (event) => { event.stopPropagation(); debouncedToggleInventory(); });
    document.getElementById('esc-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); onEscTouch(event); });
}
document.getElementById('esc-btn').addEventListener('click', () => { controls.unlock(); });
init();
animate();
function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
}
function getSlotBackgroundStyle(blockId) {
    const canvas = blockCanvases[blockId];
    if (canvas) {
        return { backgroundImage: `url(${canvas.toDataURL()})` };
    }
    const material = blockTypes[blockId];
    if (material && material.color) {
        return { backgroundColor: material.color.getStyle(), opacity: material.opacity || 1 };
    }
    return {};
}
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 750);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = playerHeight;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);
    isTouchDevice = isMobile();
    const infoElement = document.getElementById('info');
    const inGameUIElement = document.getElementById('in-game-ui');
    const touchControlsElement = document.getElementById('touch-controls');
    const hotbarElement = document.getElementById('hotbar');
    const inventoryGrid = document.getElementById('inventory-grid');
    hotbarSlots.forEach(slot => {
        const blockId = slot.dataset.blockId;
        const styles = getSlotBackgroundStyle(blockId);
        for (const style in styles) {
            slot.style[style] = styles[style];
        }
    });
    if (inventoryGrid) {
        Object.keys(blockTypes).forEach(blockId => {
            if (blockId === 'bedrock') return;
            const slot = document.createElement('div');
            slot.classList.add('slot');
            slot.dataset.blockId = blockId;
            const styles = getSlotBackgroundStyle(blockId);
            for (const style in styles) {
                slot.style[style] = styles[style];
            }
            slot.draggable = true;
            inventoryGrid.appendChild(slot);
        });
    }
    initDragAndDrop();
    if (isTouchDevice) {
        infoElement.style.display = 'block';
        hotbarElement.style.display = 'flex';
        touchControlsElement.style.display = 'none';
        inGameUIElement.style.display = 'none';
        document.getElementById('mouse-info').style.display = 'none';
        document.getElementById('touch-info').style.display = 'block';
        initTouchControls();
    } else {
        document.getElementById('mouse-info').style.display = 'block';
        document.getElementById('touch-info').style.display = 'none';
        inGameUIElement.style.display = 'none';
        controls = new THREE.PointerLockControls(camera, document.body);
        controls.addEventListener('lock', () => {
            infoElement.style.display = 'none';
            if (isTouchDevice) inGameUIElement.style.display = 'flex';
            canJump = true;
            isPlaying = true;
        });
        controls.addEventListener('unlock', () => {
            infoElement.style.display = 'block';
            if (isTouchDevice) inGameUIElement.style.display = 'none';
            isPlaying = false;
        });
        document.addEventListener('click', () => { if (!controls.isLocked) controls.lock(); }, false);
    }
    raycaster = new THREE.Raycaster();
    const ambientLight = new THREE.AmbientLight(0xcccccc);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);
    createFloor();
    createPlayerArm();
    if (!isTouchDevice) {
        document.addEventListener('keydown', onKeyDown, false);
        document.addEventListener('keyup', onKeyUp, false);
        document.addEventListener('mousedown', onMouseDown, false);
    }
    window.addEventListener('gamepadconnected', (event) => {
        isControllerConnected = true;
        if (!isPlaying) {
            infoElement.style.display = 'none';
            isPlaying = true;
        }
    });
    window.addEventListener('gamepaddisconnected', (event) => {
        isControllerConnected = false;
        if (!controls || !controls.isLocked) {
            infoElement.style.display = 'block';
            inGameUIElement.style.display = 'none';
            isPlaying = false;
        }
    });
    document.getElementById('save-world-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); saveWorld(); });
    document.getElementById('load-world-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); loadWorld(); });
    document.getElementById('esc-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); onEscTouch(event); });
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('contextmenu', (event) => event.preventDefault(), false);
    if (isTouchDevice) {
        document.getElementById('game-container').addEventListener('touchstart', function(e) {
            const isTapOnUI = e.target.closest('#info') || e.target.closest('#hotbar') || e.target.closest('#touch-controls') || e.target.closest('#in-game-ui') || e.target.closest('#inventory-ui');
            if (!isPlaying && !isTapOnUI) {
                e.preventDefault();
                isPlaying = true;
                document.getElementById('info').style.display = 'none';
                document.getElementById('in-game-ui').style.display = 'flex';
                document.getElementById('touch-controls').style.display = 'flex';
                document.getElementById('hotbar').style.display = 'flex';
            }
        });
        document.getElementById('inventory-ui').addEventListener('touchstart', function(e) {
            e.stopPropagation();
        });
    }
}
function toggleInventory() {
    isInventoryOpen = !isInventoryOpen;
    document.getElementById('inventory-ui').style.display = isInventoryOpen ? 'block' : 'none';
    if (isInventoryOpen) {
        isPlaying = false;
        if (controls && controls.isLocked) { controls.unlock(); }
        if (isTouchDevice) {
            document.getElementById('touch-controls').style.display = 'none';
        }
    } else {
        isPlaying = true;
        if (controls && !controls.isLocked) { controls.lock(); }
        if (isTouchDevice) {
            document.getElementById('touch-controls').style.display = 'flex';
        }
    }
}
function createGrassBlock(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x * blockSize, y * blockSize, z * blockSize);
    const dirtMaterial = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#8b4513', ['#9c5726', '#6b3510'])) });
    const dirtGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const dirtMesh = new THREE.Mesh(dirtGeometry, dirtMaterial);
    dirtMesh.userData.isCollisionBlock = true;
    group.add(dirtMesh);
    const grassTopMaterial = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#38761d', ['#4a8e32', '#2e6315'])) });
    const grassTopGeometry = new THREE.BoxGeometry(blockSize + 0.01, blockSize * 0.1, blockSize + 0.01);
    const grassTopMesh = new THREE.Mesh(grassTopGeometry, grassTopMaterial);
    grassTopMesh.position.y = blockSize * 0.505;
    grassTopMesh.userData.isCollisionBlock = false;
    group.add(grassTopMesh);
    group.userData.blockId = 'grass_dirt';
    group.userData.isCollisionBlock = true;
    scene.add(group);
    blocks.set(`${x},${y},${z}`, group);
    allBlocks.push(group);
}
function addBlock(x, y, z, blockId, isInitialLoad = false, doorState = 'closed', doorHinge = null) {
    const bedrockLevel = -3;
    if (blockId === 'water' && y <= bedrockLevel) {
        console.log('Cannot place water at or below bedrock level.');
        return;
    }
    const key = `${x},${y},${z}`;
    const existingBlock = blocks.get(key);
    if (existingBlock && existingBlock.userData.blockId === 'water' && blockId === 'water') {
        if (existingBlock.userData.fluidVolume < 1.0) {
            existingBlock.userData.fluidVolume = 1.0;
            existingBlock.scale.y = existingBlock.userData.fluidVolume;
            existingBlock.position.y = (y * blockSize) + (blockSize * existingBlock.userData.fluidVolume) / 2 - blockSize * 0.5;
            existingBlock.material.opacity = 0.7 + existingBlock.userData.fluidVolume * 0.3;
            existingBlock.userData.isWaterSource = true;
            if (!isInitialLoad) blockUpdateQueue.push({ x, y, z });
        }
        return;
    }
    if (blocks.has(key)) {
        if (blockId !== 'water' && existingBlock.userData.blockId === 'water') {
            removeBlock(x, y, z);
            addBlock(x, y, z, blockId, isInitialLoad);
        }
        return;
    }
    if (blockId === 'grass_dirt') {
        createGrassBlock(x, y, z);
        return;
    }
    if (blockId === 'door') {
        const topBlockKey = `${x},${y + 1},${z}`;
        if (blocks.has(topBlockKey)) {
            console.warn(`Cannot place door: space above (${x},${y+1},${z}) is occupied.`);
            return;
        }
        const doorGroup = new THREE.Group();
        doorGroup.position.set(x * blockSize, y * blockSize, z * blockSize);
        const doorMaterial = materials.door_wood.clone();
        const doorGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize * 0.1);
        let initialRotationY = 0;
        let hingeOffset = -blockSize / 2;
        if (!isInitialLoad) {
            const playerDirection = new THREE.Vector3();
            camera.getWorldDirection(playerDirection);
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(allBlocks, true);
            let normal;
            if (intersects.length > 0) {
                normal = intersects[0].face.normal;
                if (Math.abs(normal.x) > Math.abs(normal.z)) {
                    doorHinge = (normal.x > 0) ? 'east' : 'west';
                    initialRotationY = (normal.x > 0) ? -Math.PI / 2 : Math.PI / 2;
                } else {
                    doorHinge = (normal.z > 0) ? 'south' : 'north';
                    initialRotationY = (normal.z > 0) ? 0 : Math.PI;
                }
            }
        } else {
            if (doorHinge) {
                if (doorHinge === 'north') initialRotationY = Math.PI;
                if (doorHinge === 'south') initialRotationY = 0;
                if (doorHinge === 'east') initialRotationY = -Math.PI / 2;
                if (doorHinge === 'west') initialRotationY = Math.PI / 2;
            }
        }
        doorGroup.rotation.y = initialRotationY;
        const bottomDoorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
        bottomDoorMesh.position.set(0, 0, hingeOffset + (blockSize * 0.1));
        bottomDoorMesh.userData.isCollisionBlockPart = true;
        doorGroup.add(bottomDoorMesh);
        const topDoorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
        topDoorMesh.position.set(0, blockSize, hingeOffset + (blockSize * 0.1));
        topDoorMesh.userData.isCollisionBlockPart = true;
        doorGroup.add(topDoorMesh);
        doorGroup.userData.blockId = 'door';
        doorGroup.userData.isCollisionBlock = true;
        doorGroup.userData.doorState = 'closed';
        doorGroup.userData.originalX = x;
        doorGroup.userData.originalY = y;
        doorGroup.userData.originalZ = z;
        doorGroup.userData.hinge = doorHinge;
        scene.add(doorGroup);
        blocks.set(key, doorGroup);
        blocks.set(topBlockKey, doorGroup);
        allBlocks.push(doorGroup);
        return;
    }
    let materialToUse = null;
    if (blockId === 'dirt') {
        materialToUse = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#8b4513', ['#9c5726', '#6b3510'])) });
    } else if (blockId === 'wood') {
        materialToUse = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createWoodGrainTexture('#5c4033', '#4a332a')) });
    } else if (blockId === 'glass') {
        materialToUse = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#87ceeb', ['#8ed1ef', '#83c9e6'])), transparent: true, opacity: 0.75 });
    } else if (blockId === 'leaves') {
        // Updated to use the correct canvas texture
        materialToUse = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#228b22', ['#1e781e', '#29a029'])), transparent: true, opacity: 0.8 });
    } else if (blockId === 'leaves_all_sides') {
        // New blockId to handle leaves
        materialToUse = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#228b22', ['#1e781e', '#29a029'])), transparent: true, opacity: 0.8 });
    } else if (blockId === 'sponge') {
        materialToUse = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#FFEC8B', ['#FFD700', '#B8860B'])) });
    } else if (blockId === 'door') {
        materialToUse = materials.door_wood;
    } else {
        materialToUse = materials[blockId];
    }
    if (!materialToUse) {
        console.warn(`Unknown block ID: ${blockId}`);
        return;
    }
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const mesh = new THREE.Mesh(geometry, materialToUse);
    mesh.position.set(x * blockSize, y * blockSize, z * blockSize);
    mesh.userData.blockId = blockId;
    mesh.userData.isCollisionBlock = true;
    if (blockId === 'water') {
        mesh.userData.fluidVolume = 1.0;
        mesh.userData.isWaterSource = true;
        mesh.userData.waterSpreadLimit = 1;
        mesh.material = new THREE.MeshBasicMaterial({ color: 0x4682b4, transparent: true, opacity: 0.8 });
        if (!isInitialLoad) blockUpdateQueue.push({ x, y, z });
    }
    if (blockId === 'sponge') {
        if (!isInitialLoad) blockUpdateQueue.push({ x, y, z });
    }
    scene.add(mesh);
    blocks.set(key, mesh);
    allBlocks.push(mesh);
}
function removeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    const block = blocks.get(key);
    if (block) {
        if (block.userData.blockId === 'bedrock') return;
        if (block.userData.blockId && (block.userData.blockId === 'door')) {
            const originalY = block.userData.originalY;
            const bottomKey = `${block.userData.originalX},${originalY},${block.userData.originalZ}`;
            const topKey = `${block.userData.originalX},${originalY + 1},${block.userData.originalZ}`;
            scene.remove(block);
            blocks.delete(bottomKey);
            blocks.delete(topKey);
            const index = allBlocks.indexOf(block);
            if (index > -1) {
                allBlocks.splice(index, 1);
            }
            const neighbors = [{ x: x + 1, y: y, z: z }, { x: x - 1, y: y, z: z }, { x: x, y: y + 1, z: z }, { x: x, y: y - 1, z: z }, { x: x, y: y, z: z + 1 }, { x: x, y: y, z: z - 1 }];
            neighbors.forEach(n => blockUpdateQueue.push(n));
            return;
        }
        scene.remove(block);
        blocks.delete(key);
        const index = allBlocks.indexOf(block);
        if (index > -1) {
            allBlocks.splice(index, 1);
        }
        const neighbors = [{ x: x + 1, y: y, z: z }, { x: x - 1, y: y, z: z }, { x: x, y: y + 1, z: z }, { x: x, y: y - 1, z: z }, { x: x, y: y, z: z + 1 }, { x: x, y: y, z: z - 1 }];
        neighbors.forEach(n => blockUpdateQueue.push(n));
    }
}
function toggleDoor(x, y, z) {
    const key = `${x},${y},${z}`;
    const doorGroup = blocks.get(key);
    if (doorGroup && doorGroup.userData.blockId === 'door') {
        const currentState = doorGroup.userData.doorState;
        const targetState = currentState === 'closed' ? 'open' : 'closed';
        let targetRotationY = 0;
        let hingeSide = doorGroup.userData.hinge;
        if (targetState === 'open') {
            const playerPos = camera.position;
            const doorPos = doorGroup.position;
            const dx = playerPos.x - doorPos.x;
            const dz = playerPos.z - doorPos.z;
            if (hingeSide === 'north') {
                targetRotationY = (dx > 0) ? doorGroup.rotation.y - Math.PI / 2 : doorGroup.rotation.y + Math.PI / 2;
            } else if (hingeSide === 'south') {
                targetRotationY = (dx > 0) ? doorGroup.rotation.y + Math.PI / 2 : doorGroup.rotation.y - Math.PI / 2;
            } else if (hingeSide === 'east') {
                targetRotationY = (dz > 0) ? doorGroup.rotation.y + Math.PI / 2 : doorGroup.rotation.y - Math.PI / 2;
            } else if (hingeSide === 'west') {
                targetRotationY = (dz > 0) ? doorGroup.rotation.y - Math.PI / 2 : doorGroup.rotation.y + Math.PI / 2;
            }
        } else {
             if (hingeSide === 'north') {
                targetRotationY = Math.PI;
            } else if (hingeSide === 'south') {
                targetRotationY = 0;
            } else if (hingeSide === 'east') {
                targetRotationY = -Math.PI / 2;
            } else { // 'west'
                targetRotationY = Math.PI / 2;
            }
        }
        const duration = 150;
        const startTime = performance.now();
        const initialRotationY = doorGroup.rotation.y;
        function animateDoor() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            doorGroup.rotation.y = initialRotationY + (targetRotationY - initialRotationY) * progress;
            if (progress < 1) {
                requestAnimationFrame(animateDoor);
            } else {
                doorGroup.userData.doorState = targetState;
            }
        }
        animateDoor();
    }
}
function processBlockUpdates() {
    if (blockUpdateQueue.length === 0) return;
    const { x, y, z } = blockUpdateQueue.shift();
    const key = `${x},${y},${z}`;
    const block = blocks.get(key);
    if (!block || (block.userData.blockId !== 'water' && block.userData.blockId !== 'sponge')) return;
    if (block.userData.blockId === 'water') {
        let fluidVolume = block.userData.fluidVolume;
        const isWaterSource = block.userData.isWaterSource;
        let waterSpreadLimit = block.userData.waterSpreadLimit;
        const keyBelow = `${x},${y - 1},${z}`;
        const blockBelow = blocks.get(keyBelow);
        if (blockBelow && blockBelow.userData.blockId === 'bedrock') {
            return;
        }
        if (blockBelow && blockBelow.userData.blockId === 'water' && blockBelow.userData.fluidVolume < 1.0) {
            const combinedVolume = blockBelow.userData.fluidVolume + fluidVolume;
            blockBelow.userData.fluidVolume = Math.min(1.0, combinedVolume);
            if (blockBelow.userData.isWaterSource === false) {
                blockBelow.userData.isWaterSource = isWaterSource || blockBelow.userData.isWaterSource;
            }
            if (!isWaterSource) {
                removeBlock(x, y, z);
                blockUpdateQueue.push({ x, y: y - 1, z });
            }
            return;
        }
        if (!blockBelow) {
            if (isWaterSource) {
                addBlock(x, y - 1, z, 'water');
                const newWater = blocks.get(keyBelow);
                if (newWater) {
                    newWater.userData.fluidVolume = 0.5;
                    newWater.userData.isWaterSource = false;
                    newWater.userData.waterSpreadLimit = waterSpreadLimit;
                    blockUpdateQueue.push({ x, y: y - 1, z });
                }
            } else {
                const nextVolume = fluidVolume;
                const nextSpread = waterSpreadLimit;
                removeBlock(x, y, z);
                addBlock(x, y - 1, z, 'water');
                const newWater = blocks.get(keyBelow);
                if (newWater) {
                    newWater.userData.fluidVolume = nextVolume;
                    newWater.userData.isWaterSource = false;
                    newWater.userData.waterSpreadLimit = nextSpread;
                    blockUpdateQueue.push({ x, y: y - 1, z });
                }
            }
        } else {
            const neighbors = [{ x: x + 1, y: y, z: z }, { x: x - 1, y: y, z: z }, { x: x, y: y, z: z + 1 }, { x: x, y: y, z: z - 1 }];
            if (waterSpreadLimit > 0 && blockBelow.userData.blockId !== 'water') {
                neighbors.forEach(n => {
                    const neighborBlock = blocks.get(`${n.x},${n.y},${n.z}`);
                    if (!neighborBlock) {
                        addBlock(n.x, n.y, n.z, 'water');
                        const newWater = blocks.get(`${n.x},${n.y},${n.z}`);
                        if (newWater) {
                            newWater.userData.fluidVolume = 0.5;
                            newWater.userData.isWaterSource = false;
                            newWater.userData.waterSpreadLimit = 0;
                            blockUpdateQueue.push(n);
                        }
                    }
                });
            }
        }
        if (fluidVolume <= 0.1 && !isWaterSource) {
            removeBlock(x, y, z);
        } else {
            block.scale.y = fluidVolume;
            block.position.y = (y * blockSize) + (blockSize * fluidVolume) / 2 - blockSize * 0.5;
            block.material.opacity = 0.7 + fluidVolume * 0.3;
            if (isWaterSource) {
                blockUpdateQueue.push({ x, y, z });
            }
        }
    }
    if (block.userData.blockId === 'sponge') {
        const toCheck = [{ x, y, z }];
        const checked = new Set([key]);
        const spongeLimit = 65;
        let waterAbsorbed = false;
        while (toCheck.length > 0 && checked.size < spongeLimit) {
            const currentPos = toCheck.shift();
            const neighbors = [
                { x: currentPos.x + 1, y: currentPos.y, z: currentPos.z },
                { x: currentPos.x - 1, y: currentPos.y, z: currentPos.z },
                { x: currentPos.x, y: currentPos.y + 1, z: currentPos.z },
                { x: currentPos.x, y: currentPos.y - 1, z: currentPos.z },
                { x: currentPos.x, y: currentPos.y, z: currentPos.z + 1 },
                { x: currentPos.x, y: currentPos.y, z: currentPos.z - 1 },
            ];
            for (const n of neighbors) {
                const nKey = `${n.x},${n.y},${n.z}`;
                if (checked.has(nKey)) continue;
                checked.add(nKey);
                const neighborBlock = blocks.get(nKey);
                if (neighborBlock && neighborBlock.userData.blockId === 'water') {
                    removeBlock(n.x, n.y, n.z);
                    waterAbsorbed = true;
                    blockUpdateQueue.push(n);
                    toCheck.push(n);
                }
            }
        }
    }
}
function createFloor() {
    const floorSize = 20;
    const bedrockLevel = -3;
    for (let x = -floorSize; x <= floorSize; x++) {
        for (let z = -floorSize; z <= floorSize; z++) {
            addBlock(x, 0, z, 'grass_dirt');
            addBlock(x, -1, z, 'dirt');
            addBlock(x, -2, z, 'stone');
            addBlock(x, bedrockLevel, z, 'bedrock');
        }
    }
}
function animate() {
    requestAnimationFrame(animate);
    if (!isInventoryOpen) {
        processBlockUpdates();
    }
    if (isControllerConnected) {
        handleGamepadInput();
    }
    const delta = clock.getDelta();
    if (isPlaying) {
        let isInWater = false;
        let playerWaterBox = new THREE.Box3().setFromCenterAndSize(
            camera.position,
            new THREE.Vector3(playerRadius, playerHeight, playerRadius)
        );
        for (const b of allBlocks) {
            if (b.userData.blockId === 'water') {
                const blockBox = new THREE.Box3().setFromObject(b);
                if (playerWaterBox.intersectsBox(blockBox)) {
                    isInWater = true;
                    break;
                }
            }
        }
        let currentGravity = gravity;
        let currentMoveSpeed = moveSpeed;
        if (isInWater) {
            currentGravity = -0.002;
            currentMoveSpeed = moveSpeed * 0.5;
            if (canJump || velocity.y > 0) {
                velocity.y = 0.05;
            } else {
                velocity.y += 0.005;
            }
        }
        const horizontalMovement = new THREE.Vector3();
        if (moveForward) horizontalMovement.z -= 1;
        if (moveBackward) horizontalMovement.z += 1;
        if (moveLeft) horizontalMovement.x -= 1;
        if (moveRight) horizontalMovement.x += 1;
        if (horizontalMovement.length() > 0) {
            horizontalMovement.normalize().multiplyScalar(currentMoveSpeed * delta);
            const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const desiredDeltaX = (forwardVector.x * -horizontalMovement.z) + (rightVector.x * horizontalMovement.x);
            const desiredDeltaZ = (forwardVector.z * -horizontalMovement.z) + (rightVector.z * horizontalMovement.x);
            const newPositionX = camera.position.x + desiredDeltaX;
            const newPositionZ = camera.position.z + desiredDeltaZ;
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(newPositionX, camera.position.y, newPositionZ),
                new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
            );
            let canMoveX = true;
            let canMoveZ = true;
            for (const b of allBlocks) {
                const collisionMesh = b instanceof THREE.Group ? b.children.find(c => c.userData.isCollisionBlockPart) || b.children[0] : b;
                if (!collisionMesh || !b.userData.isCollisionBlock || b.userData.blockId === 'water') continue;
                const blockBox = new THREE.Box3().setFromObject(collisionMesh).expandByScalar(-0.01);
                if (blockBox.max.y > camera.position.y - playerHeight / 2 + 0.1) {
                     if (playerBox.intersectsBox(blockBox)) {
                         canMoveX = false;
                         canMoveZ = false;
                         break;
                     }
                }
            }
            if (canMoveX) camera.position.x = newPositionX;
            if (canMoveZ) camera.position.z = newPositionZ;
        }
        velocity.y += currentGravity;
        let futurePositionY = camera.position.y + velocity.y;
        let verticalCollision = false;
        let lowestCollisionY = -Infinity;
        let isSponge = false;
        const playerVerticalBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(camera.position.x, futurePositionY, camera.position.z), new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2));
        for (const b of allBlocks) {
            const isBlockCollision = b.userData.isCollisionBlock;
            if (!isBlockCollision || b.userData.blockId === 'water') continue;
            const collisionMesh = b instanceof THREE.Group ? b.children.find(c => c.userData.isCollisionBlockPart) || b.children[0] : b;
            if (!collisionMesh) continue;
            const blockBox = new THREE.Box3().setFromObject(collisionMesh).expandByScalar(-0.01);
            if (playerVerticalBox.intersectsBox(blockBox)) {
                if (velocity.y < 0 && blockBox.max.y > lowestCollisionY) {
                    lowestCollisionY = blockBox.max.y;
                    isSponge = b.userData.blockId === 'sponge';
                }
                verticalCollision = true;
            }
        }
        if (verticalCollision) {
            if (velocity.y < 0) {
                camera.position.y = lowestCollisionY + playerHeight / 2;
                velocity.y = 0;
                canJump = true;
                if(isSponge) {
                    velocity.y = jumpPower * 1.5;
                    canJump = false;
                }
            } else if (velocity.y > 0) {
                velocity.y = 0;
            }
        } else {
            camera.position.y = futurePositionY;
            canJump = false;
        }
        if (camera.position.y < playerHeight / 2) {
            camera.position.y = playerHeight / 2;
            velocity.y = 0;
            canJump = true;
        }
    }
    renderer.render(scene, camera);
}
function initDragAndDrop() {
    const allSlots = document.querySelectorAll('.slot');
    let draggedItem = null;
    let ghostSlot = null;
    let touchStartSlot = null;
    allSlots.forEach(slot => {
        slot.addEventListener('dragstart', (e) => {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        });
        slot.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });
        slot.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            if (e.touches.length === 1) {
                touchStartSlot = e.target.closest('.slot');
                if (!touchStartSlot) return;
                ghostSlot = document.createElement('div');
                ghostSlot.id = 'ghost-slot';
                const styles = getSlotBackgroundStyle(touchStartSlot.dataset.blockId);
                for (const style in styles) { ghostSlot.style[style] = styles[style]; }
                document.body.appendChild(ghostSlot);
                const touch = e.touches[0];
                ghostSlot.style.left = `${touch.clientX}px`;
                ghostSlot.style.top = `${touch.clientY}px`;
                touchStartSlot.classList.add('dragging');
            }
        }, { passive: true });
    });
    document.addEventListener('touchmove', (e) => {
        if (ghostSlot && e.touches.length === 1) {
            const touch = e.touches[0];
            ghostSlot.style.left = `${touch.clientX}px`;
            ghostSlot.style.top = `${touch.clientY}px`;
        }
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
        if (ghostSlot) {
            ghostSlot.style.display = 'none';
            const endTouch = e.changedTouches[0];
            const dropTarget = document.elementFromPoint(endTouch.clientX, endTouch.clientY);
            if (dropTarget && dropTarget.classList.contains('slot')) {
                handleDrop(touchStartSlot, dropTarget);
            }
            document.body.removeChild(ghostSlot);
            ghostSlot = null;
            if (touchStartSlot) touchStartSlot.classList.remove('dragging');
            touchStartSlot = null;
        }
    });
    const handleDrop = (source, target) => {
        if (!source || !target) return;
        const sourceBlockId = source.dataset.blockId;
        const targetBlockId = target.dataset.blockId;
        source.dataset.blockId = targetBlockId;
        let styles = getSlotBackgroundStyle(targetBlockId);
        for (const s in source.style) source.style[s] = '';
        for (const style in styles) source.style[style] = styles[style];
        target.dataset.blockId = sourceBlockId;
        styles = getSlotBackgroundStyle(sourceBlockId);
        for (const s in target.style) target.style[s] = '';
        for (const style in styles) target.style[style] = styles[style];
        updateActiveHotbarBlock();
    };
    allSlots.forEach(slot => {
        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            handleDrop(draggedItem, e.target.closest('.slot'));
            draggedItem = null;
        });
    });
}
function updateActiveHotbarBlock() {
    const activeSlot = document.querySelector('#hotbar .slot.active');
    if (activeSlot) { selectBlock(activeSlot); }
}
function handleGamepadInput() {
    if (!isControllerConnected) return;
    const gamepad = navigator.getGamepads()[0];
    if (!gamepad) return;
    if (isPlaying) {
        const rightStickX = gamepad.axes[2], rightStickY = gamepad.axes[3];
        if (Math.abs(rightStickX) > joystickDeadzone) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= rightStickX * controllerSensitivity;
            camera.quaternion.setFromEuler(euler);
        }
        if (Math.abs(rightStickY) > joystickDeadzone) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);
            euler.x -= rightStickY * controllerSensitivity;
            const pi_half = Math.PI / 2 - 0.001;
            euler.x = Math.max(-pi_half, Math.min(pi_half, euler.x));
            camera.quaternion.setFromEuler(euler);
        }
        const leftStickX = gamepad.axes[0], leftStickY = gamepad.axes[1];
        moveForward = leftStickY < -joystickDeadzone;
        moveBackward = leftStickY > joystickDeadzone;
        moveLeft = leftStickX < -joystickDeadzone;
        moveRight = leftStickX > joystickDeadzone;
        if (gamepad.buttons[0].pressed && canJump) { velocity.y = jumpPower; canJump = false; }
        const now = Date.now();
        if (now - lastBumperPressTime > bumperDelay) {
            let currentIndex = hotbarSlots.findIndex(slot => slot.classList.contains('active'));
            if (gamepad.buttons[5].pressed) {
                currentIndex = (currentIndex + 1) % hotbarSlots.length;
                selectBlock(hotbarSlots[currentIndex]);
                lastBumperPressTime = now;
            } else if (gamepad.buttons[4].pressed) {
                currentIndex = (currentIndex - 1 + hotbarSlots.length) % hotbarSlots.length;
                selectBlock(hotbarSlots[currentIndex]);
                lastBumperPressTime = now;
            }
        }
        const rtPressed = gamepad.buttons[7].pressed;
        if (rtPressed && !rtPressedLastFrame) { destroyBlock(); }
        rtPressedLastFrame = rtPressed;
        const ltPressed = gamepad.buttons[6].pressed;
        if (ltPressed && !ltPressedLastFrame) { 
            interactOrPlaceBlock();
        }
        ltPressedLastFrame = ltPressed;
    }
    const xButtonPressed = gamepad.buttons[2].pressed;
    if (xButtonPressed && !xPressedLastFrame) {
        debouncedToggleInventory();
    }
    xPressedLastFrame = xButtonPressed;
}
function interactOrPlaceBlock() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(allBlocks, true);
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const blockObject = intersection.object.parent instanceof THREE.Group ? intersection.object.parent : intersection.object;
        
        if (blockObject.userData.blockId === 'door') {
            debouncedToggleDoor(blockObject.userData.originalX, blockObject.userData.originalY, blockObject.userData.originalZ);
        } else {
            placeBlock();
        }
    } else {
        placeBlock();
    }
}
function placeBlock() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(allBlocks, true);
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const blockObject = intersection.object.parent instanceof THREE.Group && intersection.object.parent.userData.blockId ? intersection.object.parent : intersection.object;
        const blockPosition = blockObject.position;
        const normal = intersection.face.normal;
        let newBlockId = selectedBlockId;
        const newBlockX = blockPosition.x / blockSize + normal.x;
        const newBlockY = blockPosition.y / blockSize + normal.y;
        const newBlockZ = blockPosition.z / blockSize + normal.z;
        const playerBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2));
        const potentialBlockBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(newBlockX, newBlockY, newBlockZ), new THREE.Vector3(blockSize, blockSize, blockSize));
        if (!playerBox.intersectsBox(potentialBlockBox)) {
            if (newBlockId === 'door') {
                const topBlockKey = `${newBlockX},${newBlockY + 1},${newBlockZ}`;
                if (blocks.has(topBlockKey)) {
                    console.warn(`Cannot place door: space above (${newBlockX},${newBlockY+1},${newBlockZ}) is occupied.`);
                    return;
                }
            }
            addBlock(newBlockX, newBlockY, newBlockZ, newBlockId);
        }
    }
}
function destroyBlock() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(allBlocks, true);
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const blockObject = intersection.object.parent instanceof THREE.Group && intersection.object.parent.userData.blockId ? intersection.object.parent : intersection.object;
        const blockPosition = blockObject.position;
        removeBlock(blockPosition.x / blockSize, blockPosition.y / blockSize, blockPosition.z / blockSize);
    }
}
function initTouchControls() {
    const gameContainer = document.getElementById('game-container');
    joystick = document.getElementById('joystick');
    gameContainer.addEventListener('touchstart', onMasterTouchStart, { passive: false });
    gameContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    gameContainer.addEventListener('touchend', onTouchEnd, { passive: false });
    document.getElementById('jump-btn').addEventListener('touchstart', (e) => { e.stopPropagation(); onJumpTouch(e); });
    document.getElementById('destroy-btn').addEventListener('touchstart', (e) => { e.stopPropagation(); onMouseDownTouch(e); });
    document.getElementById('build-btn').addEventListener('touchstart', (e) => { e.stopPropagation(); onBuildTouch(e); });
    document.getElementById('esc-btn').addEventListener('touchstart', (e) => { e.stopPropagation(); onEscTouch(e); });
}
let joystickTouchID = -1;
let cameraTouchID = -1;
function onMasterTouchStart(event) {
    const isTapOnUI = event.target.closest('#info') || event.target.closest('#hotbar') || event.target.closest('#touch-controls') || event.target.closest('#in-game-ui') || event.target.closest('#inventory-ui');
    if (!isPlaying && !isTapOnUI) {
        event.preventDefault();
        isPlaying = true;
        document.getElementById('info').style.display = 'none';
        document.getElementById('in-game-ui').style.display = 'flex';
        document.getElementById('touch-controls').style.display = 'flex';
        document.getElementById('hotbar').style.display = 'flex';
    }
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.clientX < window.innerWidth / 2 && joystickTouchID === -1) {
            joystickX = touch.clientX;
            joystickY = touch.clientY;
            joystickTouchID = touch.identifier;
        } else if (touch.clientX >= window.innerWidth / 2 && cameraTouchID === -1) {
            touchCameraX = touch.clientX;
            touchCameraY = touch.clientY;
            cameraTouchID = touch.identifier;
        }
    }
}
function onTouchMove(event) {
    if (!isPlaying) return;
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === joystickTouchID) {
            const dx = touch.clientX - joystickX;
            const dy = touch.clientY - joystickY;
            const len = Math.hypot(dx, dy);
            if (len > joystickRadius) {
                const angle = Math.atan2(dy, dx);
                joystick.style.transform = `translate(${Math.cos(angle) * joystickRadius}px, ${Math.sin(angle) * joystickRadius}px)`;
            } else {
                joystick.style.transform = `translate(${dx}px, ${dy}px)`;
            }
            const threshold = 0.2;
            moveForward = dy < -threshold * joystickRadius;
            moveBackward = dy > threshold * joystickRadius;
            moveLeft = dx < -threshold * joystickRadius;
            moveRight = dx > threshold * joystickRadius;
        } else if (touch.identifier === cameraTouchID) {
            const dx = touch.clientX - touchCameraX;
            const dy = touch.clientY - touchCameraY;
            const yaw = dx * touchSensitivity;
            const pitch = dy * touchSensitivity;
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= yaw;
            euler.x -= pitch;
            const pi_half = Math.PI / 2 - 0.001;
            euler.x = Math.max(-pi_half, Math.min(pi_half, euler.x));
            camera.quaternion.setFromEuler(euler);
            touchCameraX = touch.clientX;
            touchCameraY = touch.clientY;
        }
    }
}
function onTouchEnd(event) {
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === joystickTouchID) {
            joystick.style.transform = 'translate(0, 0)';
            moveForward = moveBackward = moveLeft = moveRight = false;
            joystickTouchID = -1;
        } else if (touch.identifier === cameraTouchID) {
            cameraTouchID = -1;
        }
    }
}
function onJumpTouch(event) { if (canJump && isPlaying) { velocity.y = jumpPower; canJump = false; } }
function onBuildTouch(event) { if (isPlaying) { placeBlock(); } }
function onMouseDownTouch(event) { if (isPlaying) { destroyBlock(); } }
function onEscTouch(event) {
    document.getElementById('in-game-ui').style.display = 'none';
    document.getElementById('info').style.display = 'block';
    document.getElementById('touch-controls').style.display = 'none';
    document.getElementById('hotbar').style.display = 'none';
    isPlaying = false;
}
function createPlayerArm() {
    const armGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.6);
    const armMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    playerArm = new THREE.Mesh(armGeometry, armMaterial);
    playerArm.position.set(0.4, -0.6, -0.6);
    const heldBlockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    let initialMaterial = materials[selectedBlockId] || materials.dirt;
    if (selectedBlockId === 'door') {
        initialMaterial = materials.door_wood;
    } else if (selectedBlockId === 'leaves' || selectedBlockId === 'leaves_all_sides') {
        initialMaterial = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#228b22', ['#1e781e', '#29a029'])), transparent: true, opacity: 0.8 });
    }
    if (heldBlock) { heldBlock.material = initialMaterial; }
    if (!heldBlock) {
      heldBlock = new THREE.Mesh(heldBlockGeometry, initialMaterial);
      heldBlock.position.set(0, 0.4, -0.8);
      playerArm.add(heldBlock);
    }
    camera.add(playerArm);
}
function removeAllBlocks() {
    for (const block of allBlocks) { scene.remove(block); }
    blocks.clear();
    allBlocks.length = 0;
}
function saveWorld() {
    const savedBlocks = [];
    for (const [key, block] of blocks.entries()) {
        if (block.userData.blockId && !savedBlocks.some(b => b.x === block.userData.originalX && b.y === block.userData.originalY && b.z === block.userData.originalZ && b.blockId === 'door' && block.userData.blockId === 'door')) {
            const blockToSave = block instanceof THREE.Group ? block : block;
            const blockData = {
                x: blockToSave.userData.originalX !== undefined ? blockToSave.userData.originalX : blockToSave.position.x / blockSize,
                y: blockToSave.userData.originalY !== undefined ? blockToSave.userData.originalY : blockToSave.position.y / blockSize,
                z: blockToSave.userData.originalZ !== undefined ? blockToSave.userData.originalZ : blockToSave.position.z / blockSize,
                blockId: blockToSave.userData.blockId
            };
            if (blockToSave.userData.blockId === 'water') {
                blockData.fluidVolume = blockToSave.userData.fluidVolume;
                blockData.isWaterSource = blockToSave.userData.isWaterSource;
                blockData.waterSpreadLimit = blockToSave.userData.waterSpreadLimit;
            }
            if (blockToSave.userData.blockId === 'door') {
                blockData.doorState = blockToSave.userData.doorState;
                blockData.hinge = blockToSave.userData.hinge;
                blockData.rotation = blockToSave.rotation.y;
            }
            savedBlocks.push(blockData);
        }
    }
    localStorage.setItem('savedWorld', JSON.stringify(savedBlocks));
    showMessageBox('World saved!', 'Success');
}
function loadWorld() {
    const savedWorld = localStorage.getItem('savedWorld');
    if (savedWorld) {
        removeAllBlocks();
        const blocksToLoad = JSON.parse(savedWorld);
        for (const blockData of blocksToLoad) {
            addBlock(blockData.x, blockData.y, blockData.z, blockData.blockId, true, blockData.doorState, blockData.hinge);
            const loadedBlock = blocks.get(`${blockData.x},${blockData.y},${blockData.z}`);
            if (loadedBlock) {
                if (blockData.blockId === 'water') {
                    loadedBlock.userData.fluidVolume = blockData.fluidVolume;
                    loadedBlock.userData.isWaterSource = blockData.isWaterSource;
                    loadedBlock.userData.waterSpreadLimit = blockData.waterSpreadLimit;
                    loadedBlock.scale.y = loadedBlock.userData.fluidVolume;
                    loadedBlock.position.y = (blockData.y * blockSize) + (blockSize * loadedBlock.userData.fluidVolume) / 2 - blockSize * 0.5;
                    loadedBlock.material.opacity = 0.7 + loadedBlock.userData.fluidVolume * 0.3;
                }
                if (blockData.blockId === 'door') {
                    loadedBlock.userData.doorState = blockData.doorState;
                    loadedBlock.userData.isCollisionBlock = true;
                    if (blockData.rotation !== undefined) {
                         loadedBlock.rotation.y = blockData.rotation;
                    }
                }
            }
        }
        showMessageBox('World loaded!', 'Success');
    } else {
        showMessageBox('No saved world found!', 'Info');
    }
}
function showMessageBox(message, type) {
    const messageBox = document.createElement('div');
    messageBox.id = 'custom-message-box';
    messageBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 1000;
        font-size: 1.5em;
        text-align: center;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        border: 2px solid ${type === 'Success' ? '#32cd32' : type === 'Info' ? '#1e90ff' : '#ff4500'};
    `;
    messageBox.textContent = message;
    document.body.appendChild(messageBox);
    setTimeout(() => {
        messageBox.remove();
    }, 2000);
}
function onMouseDown(event) {
    if (controls.isLocked) {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(allBlocks, true);
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const blockObject = intersection.object.parent instanceof THREE.Group && intersection.object.parent.userData.blockId ? intersection.object.parent : intersection.object;
            const blockPosition = blockObject.position;
            const blockX = blockPosition.x / blockSize;
            const blockY = blockPosition.y / blockSize;
            const blockZ = blockPosition.z / blockSize;
            if (event.button === 0) {
                destroyBlock();
            } else if (event.button === 2) {
                if (blockObject.userData.blockId === 'door') {
                    debouncedToggleDoor(blockObject.userData.originalX, blockObject.userData.originalY, blockObject.userData.originalZ);
                } else {
                    placeBlock();
                }
            }
        } else {
            if (event.button === 2) {
                placeBlock();
            }
        }
    }
}
function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'escape':
            if (isInventoryOpen) {
                toggleInventory();
            } else if (controls.isLocked) {
                controls.unlock();
            }
            break;
        case 'w': moveForward = true; break;
        case 's': moveBackward = true; break;
        case 'a': moveLeft = true; break;
        case 'd': moveRight = true; break;
        case ' ': if (canJump) { velocity.y = jumpPower; canJump = false; } break;
        case 'e':
            if (isPlaying && !ePressedLastFrame) {
                debouncedToggleInventory();
            }
            ePressedLastFrame = true;
            break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
        case '0':
            const index = event.key === '0' ? 9 : parseInt(event.key) - 1;
            if (hotbarSlots[index]) { selectBlock(hotbarSlots[index]); }
            break;
    }
}
function onKeyUp(event) {
    switch (event.key.toLowerCase()) {
        case 'w': moveForward = false; break;
        case 's': moveBackward = false; break;
        case 'a': moveLeft = false; break;
        case 'd': moveRight = false; break;
        case 'e': ePressedLastFrame = false; break;
    }
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        crosshair.style.left = `${window.innerWidth / 2}px`;
        crosshair.style.top = `${window.innerHeight / 2}px`;
    }
}
function selectBlock(slotElement) {
    document.querySelectorAll('#hotbar .slot').forEach(slot => slot.classList.remove('active'));
    slotElement.classList.add('active');
    selectedBlockId = slotElement.dataset.blockId;
    let previewMaterial;
    if (selectedBlockId === 'wood') {
        previewMaterial = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createWoodGrainTexture('#5c4033', '#4a332a')) });
    } else if (selectedBlockId === 'dirt') {
        previewMaterial = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#8b4513', ['#9c5726', '#6b3510'])) });
    } else if (selectedBlockId === 'glass') {
        previewMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#87ceeb', ['#8ed1ef', '#83c9e6'])), transparent: true, opacity: 0.75 });
    } else if (selectedBlockId === 'leaves') {
        // Updated to use the correct canvas texture for preview
        previewMaterial = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#228b22', ['#1e781e', '#29a029'])), transparent: true, opacity: 0.8 });
    } else if (selectedBlockId === 'leaves_all_sides') {
        // New blockId to handle leaves
        previewMaterial = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createCanvasTexture('#228b22', ['#1e781e', '#29a029'])), transparent: true, opacity: 0.8 });
    } else if (selectedBlockId === 'door') {
        previewMaterial = materials.door_wood;
    } else {
        previewMaterial = materials[selectedBlockId] || materials.dirt;
    }
    if (heldBlock) { heldBlock.material = previewMaterial; }
}
hotbarSlots.forEach(slot => {
    slot.addEventListener('click', () => { selectBlock(slot); });
});