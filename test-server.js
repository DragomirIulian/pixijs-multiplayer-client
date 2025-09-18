const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

let characters = new Map();

// Create some test characters that all clients will see
characters.set('ghost1', {
  id: 'ghost1',
  type: 'ghost',
  x: 400,
  y: 300,
  vx: 2,
  vy: 1.5
});

characters.set('ghost2', {
  id: 'ghost2',
  type: 'ghost',
  x: 200,
  y: 150,
  vx: -1.5,
  vy: 2.5
});

function broadcastToAll(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function gameLoop() {
  // Update all characters
  characters.forEach(character => {
    character.x += character.vx;
    character.y += character.vy;
    
    // Bounce off walls
    if (character.x < 50 || character.x > 750) character.vx *= -1;
    if (character.y < 50 || character.y > 550) character.vy *= -1;
    
    // Keep in bounds
    character.x = Math.max(50, Math.min(750, character.x));
    character.y = Math.max(50, Math.min(550, character.y));
    
    // Broadcast update
    broadcastToAll({
      type: 'character_update',
      character: {
        id: character.id,
        type: character.type,
        x: character.x,
        y: character.y
      }
    });
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send current world state to new client
  ws.send(JSON.stringify({
    type: 'world_state',
    characters: Array.from(characters.values()).map(char => ({
      id: char.id,
      type: char.type,
      x: char.x,
      y: char.y
    }))
  }));
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Start game loop (30 FPS)
setInterval(gameLoop, 33);

console.log('Test server running on ws://localhost:3000');
console.log('Open multiple browser windows to see synchronized movement!');
