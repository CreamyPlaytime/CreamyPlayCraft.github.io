// This file defines all the materials and types for blocks in the game.
// --- Create Canvas Textures ---
// Helper function to create a randomized texture on a canvas
function createCanvasTexture(baseColor, shades) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    context.fillStyle = baseColor;
    context.fillRect(0, 0, 16, 16);
    // Add random lighter/darker patches for texture
    for (let i = 0; i < 80; i++) {
        const x = Math.floor(Math.random() * 16);
        const y = Math.floor(Math.random() * 16);
        const shade = shades[Math.floor(Math.random() * shades.length)];
        context.fillStyle = shade;
        context.fillRect(x, y, 2, 2);
    }
    return canvas;
}
// Helper function to create a wood-grain texture
function createWoodGrainTexture(baseColor, lineShade) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    context.fillStyle = baseColor;
    context.fillRect(0, 0, 16, 16);
    // Draw vertical lines to simulate wood grain
    for (let i = 0; i < 16; i += 2) {
        context.fillStyle = lineShade;
        context.fillRect(i, 0, 1, 16);
    }
    // Add some random noise for more texture
    for (let i = 0; i < 50; i++) {
        const x = Math.floor(Math.random() * 16);
        const y = Math.floor(Math.random() * 16);
        context.fillStyle = lineShade;
        context.fillRect(x, y, 1, 1);
    }
    return canvas;
}
// --- Define Materials ---
const materials = {
    stone: new THREE.MeshLambertMaterial({ color: 0x777777 }),
    sand: new THREE.MeshLambertMaterial({ color: 0xf4a460 }),
    brick: new THREE.MeshLambertMaterial({ color: 0x8b0000 }),
    cobblestone: new THREE.MeshLambertMaterial({ color: 0xa9a9a9 }),
    obsidian: new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    water: new THREE.MeshBasicMaterial({ color: 0x4682b4, transparent: true, opacity: 0.7 }),
    log: new THREE.MeshLambertMaterial({ color: 0x6f4e37 }),
    leaves: new THREE.MeshLambertMaterial({ color: 0x228b22, transparent: true, opacity: 0.8 }),
    planks: new THREE.MeshLambertMaterial({ color: 0xdeb887 }),
    sandstone: new THREE.MeshLambertMaterial({ color: 0xfade9e }),
    lapis_lazuli_block: new THREE.MeshLambertMaterial({ color: 0x0047ab }),
    gold_block: new THREE.MeshLambertMaterial({ color: 0xffd700 }),
    iron_block: new THREE.MeshLambertMaterial({ color: 0xd3d3d3 }),
    diamond_block: new THREE.MeshLambertMaterial({ color: 0x00ffff }),
    glowstone: new THREE.MeshBasicMaterial({ color: 0xfffacd, emissive: 0xffff00, emissiveIntensity: 1 }),
    bedrock: new THREE.MeshLambertMaterial({ color: 0x3b3b3b }),
    sponge: new THREE.MeshLambertMaterial({ color: 0xFFEC8B }),
    door_wood: new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(createWoodGrainTexture('#7a5230', ['#8c6442', '#6b4526'])) }),
};
// Defines the full material set for blocks that have different sides
const multiMaterialBlocks = {
    grass_dirt: [
        materials.dirt, materials.dirt, materials.grass,
        materials.dirt, materials.dirt, materials.dirt
    ]
};
// Maps a block ID to its material or material array. This is the main object the game uses.
const blockTypes = {
    dirt: 'textured',
    stone: materials.stone,
    wood: 'textured',
    sand: materials.sand,
    glass: 'textured',
    brick: materials.brick,
    cobblestone: materials.cobblestone,
    obsidian: materials.obsidian,
    water: materials.water,
    grass_dirt: 'multi-textured',
    log: materials.log,
    leaves: materials.leaves,
    planks: materials.planks,
    sandstone: materials.sandstone,
    lapis_lazuli_block: materials.lapis_lazuli_block,
    gold_block: materials.gold_block,
    iron_block: materials.iron_block,
    diamond_block: materials.diamond_block,
    glowstone: materials.glowstone,
    bedrock: materials.bedrock,
    sponge: materials.sponge,
    solid_green: materials.solid_green,
    leaves_all_sides: materials.leaves,
    door: materials.door_wood,
};
// Maps block IDs to their display canvases for the UI
const blockCanvases = {
    grass_dirt: createCanvasTexture('#38761d', ['#4a8e32', '#2e6315']),
    dirt: createCanvasTexture('#8b4513', ['#9c5726', '#6b3510']),
    sponge: createCanvasTexture('#FFEC8B', ['#FFD700', '#B8860B']),
    leaves_all_sides: createCanvasTexture('#228b22', ['#1e781e', '#29a029']),
    door: createWoodGrainTexture('#7a5230', ['#8c6442', '#6b4526']),
    glass: createCanvasTexture('#87ceeb', ['#8ed1ef', '#83c9e6']),
    wood: createWoodGrainTexture('#5c4033', '#4a332a'),
};