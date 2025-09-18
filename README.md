# Pixelated Ghost Game

A simple top-down pixelated game built with PixiJS v8.13.0 featuring an autonomous ghost character that moves freely around a map.

## Features

- **Autonomous Ghost Movement**: The ghost moves freely around the map with intelligent direction changes
- **Top-down View**: Classic top-down perspective for optimal gameplay visibility
- **Pixelated Art Style**: Crisp, pixelated graphics with disabled texture smoothing
- **Dynamic Environment**: Generated map with trees, rocks, flowers, and grass tiles
- **Floating Animation**: Ghost has a subtle floating animation with rotation effects

## Getting Started

### Prerequisites

You'll need Node.js installed to run the development server.

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:8080`

### Alternative (Simple Setup)

You can also run the game by simply opening `index.html` in your browser, as it uses CDN links for PixiJS.

## Game Mechanics

- The ghost automatically moves around the map
- It changes direction periodically or when approaching boundaries
- The ghost bounces off walls and stays within the game area
- Smooth floating animation with subtle rotation effects
- Pixelated rendering for retro aesthetics

## Project Structure

```
├── index.html          # Main HTML file
├── package.json        # Project dependencies
├── js/
│   ├── game.js         # Main game loop and initialization
│   ├── ghost.js        # Ghost character class
│   └── map.js          # Map generation and environment
└── README.md           # This file
```

## Future Enhancements

- Add player controls
- Implement multiplayer functionality
- Add more character types
- Enhanced map generation
- Sound effects and music
- Particle effects
