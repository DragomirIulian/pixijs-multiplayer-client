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
let lastStatisticsSync = Date.now();

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

  // Broadcast statistics every 5 seconds
  if (now - lastStatisticsSync >= 5000) {
    broadcastToAll({
      type: 'statistics_update',
      statistics: gameManager.getStatistics()
    });
    lastStatisticsSync = now;
  }
}

function broadcastWorldState() {
  broadcastToAll({
    type: 'world_state',
    characters: gameManager.getSouls(),
    energyOrbs: gameManager.getEnergyOrbs(),
    nexuses: gameManager.getNexuses(),
    tileMap: gameManager.getTileMap(),
    activeSpells: gameManager.getActiveSpells(),
    dayNightState: gameManager.getDayNightState(),
    statistics: gameManager.getStatistics(),
    borderScores: gameManager.getBorderScores(),
    config: {
      ui: GameConfig.UI
    }
  });
}

wss.on('connection', (ws) => {
  
  // Send current world state to new client
  ws.send(JSON.stringify({
    type: 'world_state',
    characters: gameManager.getSouls(),
    energyOrbs: gameManager.getEnergyOrbs(),
    nexuses: gameManager.getNexuses(),
    tileMap: gameManager.getTileMap(),
    activeSpells: gameManager.getActiveSpells(),
    dayNightState: gameManager.getDayNightState(),
    statistics: gameManager.getStatistics(),
    borderScores: gameManager.getBorderScores(),
    config: {
      ui: GameConfig.UI
    }
  }));
  
  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'request_statistics') {
        ws.send(JSON.stringify({
          type: 'statistics_response',
          statistics: gameManager.getStatistics()
        }));
      }
    } catch (error) {
      console.error('Error handling client message:', error);
    }
  });

  ws.on('close', () => {
  });
});

// Start game loop
setInterval(gameLoop, GameConfig.GAME_LOOP.FRAME_TIME);

