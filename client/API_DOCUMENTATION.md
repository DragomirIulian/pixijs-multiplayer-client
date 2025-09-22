# PixiJS Multiplayer Client - Server API Documentation

## Overview

This document describes the WebSocket API that the PixiJS multiplayer client expects from the authoritative server. The client connects to the server and receives real-time updates about character positions and game state.

## Connection Details

- **Protocol**: WebSocket
- **Default URL**: `ws://localhost:3000`
- **Auto-reconnect**: Client automatically reconnects after 3 seconds if connection is lost

## Message Format

All messages are JSON objects sent over the WebSocket connection.

### General Message Structure
```json
{
  "type": "message_type",
  "data": { /* message-specific data */ }
}
```

## Server → Client Messages

### 1. Character Update

Updates the position of an existing character.

```json
{
  "type": "character_update",
  "character": {
    "id": "unique_character_id",
    "type": "character_type",
    "x": 400,
    "y": 300,
    "rotation": 0.5
  }
}
```

**Fields:**
- `id` (string, required): Unique identifier for the character
- `type` (string, required): Character type (used to load texture: `./resources/{type}.png`)
- `x` (number, required): X coordinate position
- `y` (number, required): Y coordinate position
- `rotation` (number, optional): Character rotation in radians

### 2. Character Spawn

Creates a new character in the game world.

```json
{
  "type": "character_spawn",
  "character": {
    "id": "ghost_001",
    "type": "ghost",
    "x": 400,
    "y": 300,
    "rotation": 0
  }
}
```

**Fields:** Same as character_update

### 3. Character Remove

Removes a character from the game world.

```json
{
  "type": "character_remove",
  "characterId": "ghost_001"
}
```

**Fields:**
- `characterId` (string, required): ID of the character to remove

### 4. World State

Sends the complete state of all characters (useful for initial sync or recovery).

```json
{
  "type": "world_state",
  "characters": [
    {
      "id": "ghost_001",
      "type": "ghost",
      "x": 400,
      "y": 300,
      "rotation": 0
    },
    {
      "id": "ghost_002",
      "type": "ghost",
      "x": 500,
      "y": 250,
      "rotation": 1.5
    }
  ]
}
```

**Fields:**
- `characters` (array, required): Array of character objects

## Character Types

The client supports any character type. The texture file must exist at `./resources/{type}.png`.

**Built-in Support:**
- `ghost` - Expects `./resources/ghost.png`

**Adding New Types:**
Simply ensure the corresponding PNG file exists in the resources folder.

## Implementation Guidelines

### 1. Game Loop Structure

```javascript
// Pseudo-code for server game loop
setInterval(() => {
  // Update game logic
  updateCharacterPositions();
  
  // Send updates to all connected clients
  broadcastCharacterUpdates();
}, 16); // ~60 FPS
```

### 2. Connection Handling

```javascript
// Pseudo-code for WebSocket server
wss.on('connection', (ws) => {
  
  // Send initial world state
  ws.send(JSON.stringify({
    type: 'world_state',
    characters: getAllCharacters()
  }));
  
  ws.on('close', () => {
  });
});
```

### 3. Broadcast Pattern

```javascript
// Broadcast to all connected clients
function broadcastToAll(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}
```

## Performance Considerations

### Update Frequency
- **Recommended**: 20-60 updates per second
- **Minimum**: 10 updates per second for smooth movement
- **Client Interpolation**: Client smoothly interpolates between server updates

### Bandwidth Optimization
- Only send `character_update` for characters that have moved
- Use `world_state` sparingly (connection start, major sync events)
- Consider delta compression for position updates

### Client-Side Interpolation
The client uses smooth interpolation with a default speed of `0.1`. This means:
- Characters smoothly move toward their target position
- Higher update rates = smoother movement
- Lower update rates = more obvious interpolation

## Example Server Implementation (Node.js)

```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

let characters = new Map();
let gameLoopId;

// Game state
function createCharacter(id, type, x, y) {
  return {
    id,
    type,
    x,
    y,
    rotation: 0,
    velocityX: (Math.random() - 0.5) * 2,
    velocityY: (Math.random() - 0.5) * 2
  };
}

// Game loop
function gameLoop() {
  // Update character positions
  characters.forEach(character => {
    character.x += character.velocityX;
    character.y += character.velocityY;
    
    // Bounce off walls
    if (character.x < 0 || character.x > 800) character.velocityX *= -1;
    if (character.y < 0 || character.y > 600) character.velocityY *= -1;
    
    // Keep in bounds
    character.x = Math.max(0, Math.min(800, character.x));
    character.y = Math.max(0, Math.min(600, character.y));
  });
  
  // Broadcast updates
  characters.forEach(character => {
    broadcastToAll({
      type: 'character_update',
      character: {
        id: character.id,
        type: character.type,
        x: character.x,
        y: character.y,
        rotation: character.rotation
      }
    });
  });
}

function broadcastToAll(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// WebSocket handling
wss.on('connection', (ws) => {
  
  // Send current world state
  ws.send(JSON.stringify({
    type: 'world_state',
    characters: Array.from(characters.values()).map(char => ({
      id: char.id,
      type: char.type,
      x: char.x,
      y: char.y,
      rotation: char.rotation
    }))
  }));
  
  ws.on('close', () => {
  });
});

// Start game
function startGame() {
  // Create some initial characters
  characters.set('ghost1', createCharacter('ghost1', 'ghost', 400, 300));
  characters.set('ghost2', createCharacter('ghost2', 'ghost', 200, 150));
  
  // Start game loop (60 FPS)
  gameLoopId = setInterval(gameLoop, 16);
}

startGame();
```

## Testing

### Manual Testing
1. Start your WebSocket server on `ws://localhost:3000`
2. Open the client in a browser
3. Check browser console for connection status
4. Verify characters appear and move according to server updates

### Message Testing
You can test individual messages using a WebSocket client:

```javascript
// Test character spawn
ws.send(JSON.stringify({
  type: 'character_spawn',
  character: {
    id: 'test_ghost',
    type: 'ghost',
    x: 400,
    y: 300
  }
}));

// Test character update
ws.send(JSON.stringify({
  type: 'character_update',
  character: {
    id: 'test_ghost',
    type: 'ghost',
    x: 450,
    y: 320
  }
}));
```

## Error Handling

### Client Disconnection
- Client automatically attempts to reconnect every 3 seconds
- Server should handle client disconnections gracefully
- Consider removing player-controlled characters when clients disconnect

### Invalid Messages
- Server should validate all incoming message formats
- Ignore malformed messages rather than crashing
- Log errors for debugging

### Network Issues
- Client handles connection failures with auto-reconnect
- Server should implement heartbeat/ping-pong for connection health
- Consider message queuing for reliable delivery
