const WebSocket = require('ws');
const GameManager = require('./GameManager');
const GameConfig = require('./config/gameConfig');

/**
 * Refactored Server using SOLID principles
 * Clean separation of concerns with GameManager orchestrating all systems
 */

const wss = new WebSocket.Server({ port: 3000 });
const gameManager = new GameManager();

// Track for periodic world state sync
let lastWorldStateSync = Date.now();

function broadcastToAll(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function gameLoop() {
  // Update game manager (handles all systems)
  const events = gameManager.update();
  
  // Broadcast all events
  events.forEach(event => {
    // Handle spell completion specially (removes caster)
    if (event.type === 'spell_completed') {
      gameManager.handleSpellCompletion(event);
    }
    
    broadcastToAll(event);
  });
  
  // Broadcast character updates
  gameManager.getSouls().forEach(soulData => {
    broadcastToAll({
      type: 'character_update',
      character: soulData
    });
  });

  // Periodic world state sync every 10 seconds
  const now = Date.now();
  if (now - lastWorldStateSync >= GameConfig.GAME_LOOP.WORLD_STATE_SYNC_INTERVAL) {
    broadcastWorldState();
    lastWorldStateSync = now;
  }
}

function broadcastWorldState() {
  broadcastToAll({
    type: 'world_state',
    characters: gameManager.getSouls(),
    energyOrbs: gameManager.getEnergyOrbs(),
    tileMap: gameManager.getTileMap(),
    activeSpells: gameManager.getActiveSpells()
  });
}

wss.on('connection', (ws) => {
  
  // Send current world state to new client
  ws.send(JSON.stringify({
    type: 'world_state',
    characters: gameManager.getSouls(),
    energyOrbs: gameManager.getEnergyOrbs(),
    tileMap: gameManager.getTileMap(),
    activeSpells: gameManager.getActiveSpells()
  }));
  
  ws.on('close', () => {
  });
});

// Start game loop
setInterval(gameLoop, GameConfig.GAME_LOOP.FRAME_TIME);

