import { Application, Assets, Sprite, Graphics, Container } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';

class Game {
    constructor() {
        this.app = null;
        this.characters = new Map(); // Store all characters by ID
        this.gameMap = null;
        this.socket = null;
        this.init();
    }

    async init() {
        // Create a new application
        this.app = new Application();

        // Initialize the application
        await this.app.init({ 
            width: 800,
            height: 600,
            background: '#2c3e50',
            antialias: true
        });

        // Append the application canvas to the document body
        document.getElementById('game-container').appendChild(this.app.canvas);

        // Initialize game components
        await this.setupMap();
        this.connectToServer();

        // Start the game loop
        this.app.ticker.add((time) => this.gameLoop(time));
    }

    connectToServer() {
        // Connect to WebSocket server
        this.socket = new WebSocket('ws://localhost:3000');
        
        this.socket.onopen = () => {
            console.log('Connected to server');
        };
        
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from server');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.connectToServer(), 3000);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleServerMessage(data) {
        console.log('Received message from server:', data);
        switch(data.type) {
            case 'character_update':
                this.updateCharacter(data.character);
                break;
            case 'character_spawn':
                this.spawnCharacter(data.character);
                break;
            case 'character_remove':
                this.removeCharacter(data.characterId);
                break;
            case 'world_state':
                this.updateWorldState(data.characters);
                break;
        }
    }

    async spawnCharacter(characterData) {
        console.log('Spawning character:', characterData);
        const character = new Character(this.app, characterData);
        await character.init();
        this.characters.set(characterData.id, character);
        this.app.stage.addChild(character.sprite);
    }

    updateCharacter(characterData) {
        const character = this.characters.get(characterData.id);
        if (character) {
            character.updateFromServer(characterData);
        }
    }

    removeCharacter(characterId) {
        const character = this.characters.get(characterId);
        if (character) {
            this.app.stage.removeChild(character.sprite);
            this.characters.delete(characterId);
        }
    }

    updateWorldState(charactersData) {
        // Remove characters that are no longer in the server state
        const serverCharacterIds = new Set(charactersData.map(char => char.id));
        // const clientCharacterIds = new Set(this.characters.map(char => char.id));
        

        console.log('Server character IDs:', serverCharacterIds);
        // console.log('Client character IDs:', clientCharacterIds);
        console.log('Characters before:', this.characters);
        this.characters.forEach((character, id) => {
            if (!serverCharacterIds.has(id)) {
                // Character no longer exists on server, remove it
                this.app.stage.removeChild(character.sprite);
                this.characters.delete(id);
            }
        });
        
        // Update/add characters from server state
        charactersData.forEach(characterData => {
            this.spawnCharacter(characterData);
        });

        console.log('Characters after:', this.characters);
    }

    async setupMap() {
        this.gameMap = new GameMap(this.app);
        await this.gameMap.createMap();
        this.app.stage.addChild(this.gameMap.container);
    }

    gameLoop(time) {
        // Update all characters with smooth interpolation
        this.characters.forEach(character => {
            character.update(time);
        });
    }
}

class Character {
    constructor(app, characterData) {
        this.app = app;
        this.id = characterData.id;
        this.type = characterData.type || 'ghost';
        
        // Current position
        this.x = characterData.x || 0;
        this.y = characterData.y || 0;
        
        // Target position from server
        this.targetX = this.x;
        this.targetY = this.y;
        
        // Interpolation
        this.interpolationSpeed = 0.1;
        
        // Floating animation properties
        this.floatOffset = Math.random() * Math.PI * 2; // Random start
        this.floatSpeed = 0.05;
        this.floatAmplitude = 3;
        
        this.sprite = null;
    }

    async init() {
        // Load the texture based on character type
        const texturePath = `./resources/${this.type}.png`;
        const texture = await Assets.load(texturePath);
        
        // Create a sprite
        this.sprite = new Sprite(texture);
        this.sprite.anchor.set(0.5);
        this.sprite.x = this.x;
        this.sprite.y = this.y;
        this.sprite.scale.set(0.05);
    }

    updateFromServer(characterData) {
        // Update target position from server
        this.targetX = characterData.x;
        this.targetY = characterData.y;
        
        // Update any other properties from server
        if (characterData.rotation !== undefined) {
            this.targetRotation = characterData.rotation;
        }
    }

    update(time) {
        if (!this.sprite) return;

        // Smooth interpolation to target position
        this.x += (this.targetX - this.x) * this.interpolationSpeed;
        this.y += (this.targetY - this.y) * this.interpolationSpeed;
        
        // Apply floating animation
        this.floatOffset += this.floatSpeed * time.deltaTime;
        const floatY = Math.sin(this.floatOffset) * this.floatAmplitude;
        
        // Update sprite position
        this.sprite.x = this.x;
        this.sprite.y = this.y + floatY;
        
        // Add slight rotation for floating effect
        this.sprite.rotation = Math.sin(this.floatOffset * 2) * 0.1;
    }
}

class GameMap {
    constructor(app) {
        this.app = app;
        this.container = new Container();
    }

    async createMap() {
        await this.createBackground();
        this.createTrees();
        this.createRocks();
        this.createFlowers();
    }

    async createBackground() {
        // Load the background image
        const texture = await Assets.load('./resources/background.png');
        
        // Create a sprite from the background texture
        const backgroundSprite = new Sprite(texture);
        
        // Scale the background to fit the screen
        backgroundSprite.width = this.app.screen.width;
        backgroundSprite.height = this.app.screen.height;
        
        // Add the background sprite to the container
        this.container.addChild(backgroundSprite);
    }

    createTrees() {
        const treeCount = 15;
        
        for (let i = 0; i < treeCount; i++) {
            const tree = this.createTree();
            tree.x = 50 + Math.random() * (this.app.screen.width - 100);
            tree.y = 50 + Math.random() * (this.app.screen.height - 100);
            this.container.addChild(tree);
        }
    }

    createTree() {
        const graphics = new Graphics();
        
        // Tree trunk
        graphics.rect(-3, 8, 6, 12);
        graphics.fill(0x8B4513);
        
        // Tree foliage
        const foliageColors = [0x228B22, 0x32CD32, 0x006400];
        
        for (let i = 0; i < 3; i++) {
            const color = foliageColors[Math.floor(Math.random() * foliageColors.length)];
            const offsetX = (Math.random() - 0.5) * 8;
            const offsetY = (Math.random() - 0.5) * 6;
            const radius = 8 + Math.random() * 4;
            
            graphics.circle(offsetX, offsetY - 5, radius);
            graphics.fill(color);
        }
        
        return graphics;
    }

    createRocks() {
        const rockCount = 8;
        
        for (let i = 0; i < rockCount; i++) {
            const rock = this.createRock();
            rock.x = Math.random() * this.app.screen.width;
            rock.y = Math.random() * this.app.screen.height;
            this.container.addChild(rock);
        }
    }

    createRock() {
        const graphics = new Graphics();
        
        const rockColors = [0x696969, 0x808080, 0xA9A9A9];
        const color = rockColors[Math.floor(Math.random() * rockColors.length)];
        
        const points = [];
        const sides = 6 + Math.floor(Math.random() * 3);
        const baseRadius = 8 + Math.random() * 8;
        
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const radius = baseRadius * (0.7 + Math.random() * 0.6);
            points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        
        graphics.poly(points);
        graphics.fill(color);
        
        return graphics;
    }

    createFlowers() {
        const flowerCount = 20;
        
        for (let i = 0; i < flowerCount; i++) {
            const flower = this.createFlower();
            flower.x = Math.random() * this.app.screen.width;
            flower.y = Math.random() * this.app.screen.height;
            this.container.addChild(flower);
        }
    }

    createFlower() {
        const graphics = new Graphics();
        
        const flowerColors = [0xFF69B4, 0xFF1493, 0xFFB6C1, 0xFFC0CB, 0xFF6347];
        const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        
        // Stem
        graphics.moveTo(0, 0);
        graphics.lineTo(0, -8);
        graphics.stroke({ width: 2, color: 0x228B22 });
        
        // Flower petals
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const x = Math.cos(angle) * 3;
            const y = Math.sin(angle) * 3 - 8;
            graphics.circle(x, y, 2);
            graphics.fill(color);
        }
        
        // Center
        graphics.circle(0, -8, 1.5);
        graphics.fill(0xFFFF00);
        
        return graphics;
    }
}

// Start the game when the page loads
window.addEventListener('load', async () => {
    new Game();
});