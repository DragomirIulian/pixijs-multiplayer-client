# PixiJS Multiplayer Server

A WebSocket server that provides real-time character updates for a PixiJS multiplayer client.

## Features

- **Ghost Characters**: Only `ghost` character type (as per API documentation)
  - Random wandering movement
  - Circular movement around center
  - Patrol between waypoints

- **Real-time Updates**: 60 FPS game loop with smooth character movement
- **Auto-spawn**: New ghost characters automatically spawn every 30 seconds
- **Dynamic Behaviors**: Different ghost AI behaviors for variety

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **For development (auto-restart):**
   ```bash
   npm run dev
   ```

The server will start on `ws://localhost:3000`

## Current Characters

The server starts with 9 ghost characters with randomly assigned behaviors:
- Some ghosts wander randomly
- Some ghosts circle around the center
- Some ghosts patrol between waypoints

## API

See `api_documentation.md` for complete WebSocket API details.

### Key Message Types
- `character_spawn` - New character appears
- `character_update` - Character position/rotation update
- `character_remove` - Character disappears
- `world_state` - Full world sync (sent on client connect)

## Architecture

This is a **server-only** implementation. The client handles:
- Rendering characters with PixiJS
- Loading character textures from local resources
- Smooth interpolation between server updates
- WebSocket connection management

## Testing

Connect any WebSocket client to `ws://localhost:3000` to see the live character data stream.

## Performance

- 60 FPS update rate
- Optimized position rounding
- Efficient broadcast to all connected clients
- Graceful client connection handling
