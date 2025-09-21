import { Application, Assets, Sprite, Graphics, Container } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { Character } from './character.js';
import { CharacterCard } from './characterCard.js';

class Game {
    constructor() {
        this.app = null;
        this.characters = new Map(); // Store all characters by ID
        this.energyOrbs = new Map(); // Store energy orbs from server
        this.gameMap = null;
        this.socket = null;
        this.characterCard = null;
        this.init();
    }

    async init() {
        // Create a new application
        this.app = new Application();

        // Initialize the application
        await this.app.init({ 
            width: 1600,
            height: 1200,
            background: '#2c3e50',
            antialias: true
        });

        // Append the application canvas to the document body
        document.getElementById('game-container').appendChild(this.app.canvas);

        // Initialize game components
        await this.setupMap();
        this.setupUI();
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
                this.updateWorldState(data.characters, data.energyOrbs);
                break;
            case 'orb_spawned':
                this.spawnEnergyOrb(data.orb);
                break;
            case 'orb_collected':
                this.handleOrbCollection(data.orbId, data.collectorId);
                break;
            case 'attack':
                this.handleAttack(data.attackerId, data.targetId, data.attackerPos, data.targetPos);
                break;
        }
    }

    async spawnCharacter(characterData) {
        const character = new Character(this.app, characterData);
        await character.init();
        
        // Set up click detection for this character
        character.sprite.interactive = true;
        character.sprite.buttonMode = true;
        character.sprite.on('pointerdown', () => {
            this.characterCard.show(character);
        });
        
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

    updateWorldState(charactersData, energyOrbsData) {
        // Remove characters that are no longer in the server state
        const serverCharacterIds = new Set(charactersData.map(char => char.id));
        
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

        // Update energy orbs from server state
        if (energyOrbsData) {
            // Clear existing orbs
            this.energyOrbs.forEach(orb => {
                this.app.stage.removeChild(orb);
            });
            this.energyOrbs.clear();
            
            // Add new orbs from server
            energyOrbsData.forEach(orbData => {
                this.spawnEnergyOrb(orbData);
            });
        }
    }

    spawnEnergyOrb(orbData) {
        const orb = new Graphics();
        
        // Create 8-bit style energy orb with chunky pixels
        const colors = [0x0099FF, 0x0077DD, 0x0055BB, 0x003399]; // Blue gradient
        
        // Draw pixelated orb using small rectangles
        for (let x = -2; x <= 2; x++) {
            for (let y = -2; y <= 2; y++) {
                const distance = Math.sqrt(x * x + y * y);
                if (distance <= 2.5) {
                    const colorIndex = Math.min(Math.floor(distance), colors.length - 1);
                    orb.beginFill(colors[colorIndex], 1.0);
                    orb.drawRect(x * 6, y * 6, 6, 6); // 6x6 pixel blocks
                    orb.endFill();
                }
            }
        }
        
        // Add outer glow with pixelated effect
        orb.beginFill(0x0099FF, 0.3);
        for (let x = -3; x <= 3; x++) {
            for (let y = -3; y <= 3; y++) {
                const distance = Math.sqrt(x * x + y * y);
                if (distance > 2.5 && distance <= 3.5) {
                    orb.drawRect(x * 6, y * 6, 6, 6);
                }
            }
        }
        orb.endFill();
        
        // Position from server data
        orb.x = orbData.x;
        orb.y = orbData.y;
        
        // Add pulsing animation properties
        orb.pulseOffset = Math.random() * Math.PI * 2;
        orb.pulseSpeed = 0.05;
        orb.originalScale = 1;
        
        this.energyOrbs.set(orbData.id, orb);
        this.app.stage.addChild(orb);
    }

    removeEnergyOrb(orbId) {
        const orb = this.energyOrbs.get(orbId);
        if (orb) {
            this.app.stage.removeChild(orb);
            this.energyOrbs.delete(orbId);
        }
    }

    handleOrbCollection(orbId, collectorId) {
        const orb = this.energyOrbs.get(orbId);
        const collector = this.characters.get(collectorId);
        
        if (orb) {
            // Remove the orb
            this.removeEnergyOrb(orbId);
        }
        
        if (collector) {
            // Create energizer effect on the collector
            this.createEnergizerEffect(collector);
        }
    }

    createAbsorptionEffect(x, y) {
        // Create a blue particle effect for orb absorption
        const effect = new Graphics();
        
        // Create 8-bit style blue absorption effect
        const blueColors = [0x0099FF, 0x0077DD, 0x0055BB, 0x003399]; // Blue gradient
        
        // Draw pixelated absorption rings
        for (let ring = 0; ring < 4; ring++) {
            const radius = (ring + 1) * 3;
            const color = blueColors[ring];
            
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                const px = Math.cos(angle) * radius;
                const py = Math.sin(angle) * radius;
                
                effect.beginFill(color, 1.0);
                effect.drawRect(px * 2, py * 2, 4, 4); // 4x4 pixel blocks
                effect.endFill();
            }
        }
        
        // Add bright blue center
        effect.beginFill(0x00CCFF, 1.0);
        effect.drawRect(-2, -2, 4, 4);
        effect.endFill();
        
        effect.x = x;
        effect.y = y;
        effect.scale.set(1);
        
        this.app.stage.addChild(effect);
        
        // Animate the effect
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 500; // 500ms duration
            
            if (progress < 1) {
                effect.scale.set(1 + progress * 2);
                effect.alpha = 1 - progress;
                requestAnimationFrame(animate);
            } else {
                this.app.stage.removeChild(effect);
            }
        };
        
        animate();
    }

    createEnergizerEffect(character) {
        if (!character || !character.sprite) return;
        
        // Create a temporary blue glow effect around the soul with 8-bit style
        const glow = new Graphics();
        
        // Create pixelated glow rings using rectangles
        const glowColors = [0x0099FF, 0x0077DD, 0x0055BB, 0x003399]; // Blue gradient
        
        // Draw pixelated glow rings
        for (let ring = 0; ring < 4; ring++) {
            const radius = (ring + 2) * 8; // Larger rings
            const color = glowColors[ring];
            const alpha = 0.6 - (ring * 0.15); // Fade outward
            
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
                const px = Math.cos(angle) * radius;
                const py = Math.sin(angle) * radius;
                
                glow.beginFill(color, alpha);
                glow.drawRect(px - 4, py - 4, 8, 8); // 8x8 pixel blocks
                glow.endFill();
            }
        }
        
        glow.x = character.sprite.x;
        glow.y = character.sprite.y;
        glow.scale.set(0.8);
        
        this.app.stage.addChild(glow);
        
        // Animate the glow effect
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 1000; // 1000ms duration
            
            if (progress < 1) {
                // Update position to follow soul
                glow.x = character.sprite.x;
                glow.y = character.sprite.y;
                
                // Pulsing scale
                const pulseScale = 0.8 + Math.sin(elapsed * 0.01) * 0.2;
                glow.scale.set(pulseScale);
                
                // Fade out
                glow.alpha = 1 - progress;
                requestAnimationFrame(animate);
            } else {
                this.app.stage.removeChild(glow);
            }
        };
        
        animate();
    }

    handleAttack(attackerId, targetId, attackerPos, targetPos) {
        // Create attack animation from attacker to target
        this.createAttackEffect(attackerPos, targetPos);
        
        // Flash the target character red briefly
        const target = this.characters.get(targetId);
        if (target && target.sprite) {
            target.sprite.tint = 0xFF0000; // Red flash
            setTimeout(() => {
                target.sprite.tint = 0xFFFFFF; // Reset color
            }, 200);
        }
    }

    createAttackEffect(startPos, endPos) {
        // Create 8-bit style energy projectile that travels from attacker to target
        const projectile = new Graphics();
        
        // Create pixelated projectile using small rectangles
        const projectileColors = [0xFF0000, 0xDD0000, 0xBB0000, 0x990000]; // Red gradient
        
        // Draw pixelated projectile
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                const distance = Math.abs(x) + Math.abs(y); // Diamond shape
                if (distance <= 1) {
                    const colorIndex = Math.min(distance, projectileColors.length - 1);
                    projectile.beginFill(projectileColors[colorIndex], 1.0);
                    projectile.drawRect(x * 6, y * 6, 6, 6); // 6x6 pixel blocks
                    projectile.endFill();
                }
            }
        }
        
        // Add bright center
        projectile.beginFill(0xFFFFFF, 0.8);
        projectile.drawRect(-3, -3, 6, 6); // White center pixel
        projectile.endFill();
        
        projectile.x = startPos.x;
        projectile.y = startPos.y;
        
        this.app.stage.addChild(projectile);
        
        // Animate projectile to target
        const duration = 250;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress < 1) {
                // Linear interpolation
                projectile.x = startPos.x + (endPos.x - startPos.x) * progress;
                projectile.y = startPos.y + (endPos.y - startPos.y) * progress;
                
                // Flicker effect
                projectile.alpha = 0.7 + Math.random() * 0.3;
                
                requestAnimationFrame(animate);
            } else {
                // Remove projectile when animation is done
                this.app.stage.removeChild(projectile);
            }
        };
        
        animate();
    }

    async setupMap() {
        this.gameMap = new GameMap(this.app);
        await this.gameMap.createMap();
        this.app.stage.addChild(this.gameMap.container);
    }

    setupUI() {
        this.characterCard = new CharacterCard(this.app);
        this.setupClickDetection();
    }

    setupClickDetection() {
        // Don't make the stage interactive globally
        // Instead, make each character sprite interactive
        this.characters.forEach(character => {
            if (character.sprite) {
                character.sprite.interactive = true;
                character.sprite.buttonMode = true;
                character.sprite.on('pointerdown', () => {
                    this.characterCard.show(character);
                });
            }
        });
    }

















    gameLoop(time) {
        // Update all characters with smooth interpolation
        this.characters.forEach(character => {
            character.update(time);
        });

        // Update energy orbs with pulsing animation
        this.energyOrbs.forEach(orb => {
            if (orb && orb.pulseOffset !== undefined) {
                orb.pulseOffset += orb.pulseSpeed * time.deltaTime;
                const pulseScale = orb.originalScale + Math.sin(orb.pulseOffset) * 0.2;
                orb.scale.set(pulseScale);
            }
        });

        // Update character card if visible
        if (this.characterCard) {
            this.characterCard.update();
        }
    }
}

class GameMap {
    constructor(app) {
        this.app = app;
        this.container = new Container();
    }

    async createMap() {
        await this.createBackground();
    }

    async createBackground() {
        // Load the background image
        const texture = await Assets.load('./resources/background-2.png');
        
        // Create a sprite from the background texture
        const backgroundSprite = new Sprite(texture);
        
        // Scale the background to fit the screen
        backgroundSprite.width = this.app.screen.width;
        backgroundSprite.height = this.app.screen.height;
        
        // Add the background sprite to the container
        this.container.addChild(backgroundSprite);
    }

}

// Start the game when the page loads
window.addEventListener('load', async () => {
    new Game();
});