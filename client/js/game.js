import { Application, Assets, Sprite, Graphics, Container } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { Character } from './character.js';
import { CharacterCard } from './characterCard.js';

class Game {
    constructor() {
        this.app = null;
        this.characters = new Map(); // Store all characters by ID
        this.energyOrbs = new Map(); // Store energy orbs from server
        this.activeSpells = new Map(); // Store active spell effects
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
            width: 1500,
            height: 900,
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
                // Don't immediately remove if it might be part of a spell death
                setTimeout(() => {
                    this.removeCharacter(data.characterId);
                }, 100); // Small delay to allow death animation to start
                break;
            case 'world_state':
                this.updateWorldState(data.characters, data.energyOrbs, data.tileMap, data.activeSpells);
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
            case 'spell_started':
                this.handleSpellStarted(data.spell);
                break;
            case 'spell_completed':
                this.handleSpellCompleted(data);
                break;
            case 'tile_updated':
                this.handleTileUpdated(data);
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
        if (character && !character.isBeingRemoved) {
            character.isBeingRemoved = true; // Prevent double removal
            this.app.stage.removeChild(character.sprite);
            this.characters.delete(characterId);
        }
    }

    updateWorldState(charactersData, energyOrbsData, tileMapData, activeSpellsData) {
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

        // Update tile map from server state
        if (tileMapData && this.gameMap) {
            this.gameMap.updateTileMap(tileMapData);
        }

        // Restore active spells
        if (activeSpellsData) {
            activeSpellsData.forEach(spellData => {
                this.handleSpellStarted(spellData);
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

    createTileTransformationEffect(spellData) {
        if (!this.gameMap || !this.gameMap.tileMap) return;
        
        const tileMap = this.gameMap.tileMap;
        const targetTile = tileMap.tiles[spellData.targetTileY][spellData.targetTileX];
        
        // Calculate tile world position
        const tileWorldX = targetTile.worldX;
        const tileWorldY = targetTile.worldY;
        const tileWidth = tileMap.tileWidth;
        const tileHeight = tileMap.tileHeight;
        
        // Create transformation effect container
        const transformEffect = new Graphics();
        transformEffect.spellId = spellData.id;
        transformEffect.startTime = Date.now();
        transformEffect.duration = spellData.duration;
        transformEffect.casterType = spellData.casterType;
        transformEffect.tileX = tileWorldX;
        transformEffect.tileY = tileWorldY;
        transformEffect.tileWidth = tileWidth;
        transformEffect.tileHeight = tileHeight;
        
        // Store the effect for updates
        if (!this.tileTransformEffects) {
            this.tileTransformEffects = new Map();
        }
        this.tileTransformEffects.set(spellData.id, transformEffect);
        this.app.stage.addChild(transformEffect);
    }

    handleSpellStarted(spellData) {
        // Create tether animation between caster and target tile
        const tether = new Graphics();
        
        // Store spell data for updates
        tether.spellData = spellData;
        tether.startTime = Date.now();
        
        this.activeSpells.set(spellData.id, tether);
        this.app.stage.addChild(tether);
        
        // Create tile transformation effect
        if (spellData.targetTileX !== undefined && spellData.targetTileY !== undefined) {
            this.createTileTransformationEffect(spellData);
        }
    }

    handleSpellCompleted(data) {
        // Remove the tether animation
        const tether = this.activeSpells.get(data.spellId);
        if (tether) {
            this.app.stage.removeChild(tether);
            this.activeSpells.delete(data.spellId);
        }
        
        // Remove the tile transformation effect
        if (this.tileTransformEffects) {
            const transformEffect = this.tileTransformEffects.get(data.spellId);
            if (transformEffect) {
                this.app.stage.removeChild(transformEffect);
                this.tileTransformEffects.delete(data.spellId);
            }
        }
        
        // Create death animation for the killed caster
        const dyingCharacter = this.characters.get(data.killedCasterId);
        if (dyingCharacter) {
            console.log('Creating death animation for:', data.killedCasterId);
            dyingCharacter.isBeingRemoved = true; // Prevent other removal attempts
            this.createDeathAnimation(dyingCharacter);
            
            // Remove the killed caster after death animation completes
            setTimeout(() => {
                this.removeCharacter(data.killedCasterId);
            }, 3100); // 2.1 seconds to ensure animation completes
        } else {
            console.log('No character found for death animation:', data.killedCasterId);
        }
    }

    handleTileUpdated(data) {
        // Update tile in the game map
        if (this.gameMap && this.gameMap.tileMap) {
            const tile = this.gameMap.tileMap.tiles[data.tileY][data.tileX];
            tile.type = data.newType;
            
            // Update the visual tile
            this.gameMap.updateSingleTile(data.tileX, data.tileY, data.newType);
        }
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

        // Update spell tethers
        this.activeSpells.forEach(tether => {
            this.updateSpellTether(tether, time);
        });

        // Update tile transformation effects
        if (this.tileTransformEffects) {
            this.tileTransformEffects.forEach(effect => {
                this.updateTileTransformEffect(effect, time);
            });
        }
    }

    updateSpellTether(tether, time) {
        const spellData = tether.spellData;
        const elapsed = Date.now() - tether.startTime;
        const progress = elapsed / spellData.duration;
        
        // Clear and redraw tether
        tether.clear();
        
        // Animated tether color based on caster type
        const color = spellData.casterType === 'dark-soul' ? 0x8B0000 : 0xFFD700; // Dark red or gold
        const alpha = 0.7 + Math.sin(elapsed * 0.01) * 0.3; // Pulsing effect
        
        // Draw animated line with energy particles
        tether.lineStyle(3, color, alpha);
        tether.moveTo(spellData.casterX, spellData.casterY);
        tether.lineTo(spellData.targetX, spellData.targetY);
        
        // Add glowing particles along the line
        const particleCount = 5;
        for (let i = 0; i < particleCount; i++) {
            const t = (i / particleCount + elapsed * 0.002) % 1;
            const particleX = spellData.casterX + (spellData.targetX - spellData.casterX) * t;
            const particleY = spellData.casterY + (spellData.targetY - spellData.casterY) * t;
            
            tether.beginFill(color, alpha);
            tether.drawCircle(particleX, particleY, 3);
            tether.endFill();
        }
        
        // Progress indicator at target
        const progressRadius = 15 * (1 + progress);
        tether.lineStyle(2, color, 0.5);
        tether.drawCircle(spellData.targetX, spellData.targetY, progressRadius);
    }

    updateTileTransformEffect(effect, time) {
        const elapsed = Date.now() - effect.startTime;
        const progress = elapsed / effect.duration;
        
        // Clear and redraw transformation effect
        effect.clear();
        
        if (progress >= 1) return; // Effect completed
        
        // Create pulsing/crackling effect on the tile
        const targetColor = effect.casterType === 'dark-soul' ? 0x555555 : 0x88FF88; // Gray or green
        const baseAlpha = 0.3 + Math.sin(elapsed * 0.01) * 0.2; // Pulsing alpha
        
        // Draw transformation glow overlay on tile
        effect.beginFill(targetColor, baseAlpha);
        effect.drawRect(effect.tileX, effect.tileY, effect.tileWidth, effect.tileHeight);
        effect.endFill();
        
        // Add crackling energy lines
        const numLines = 5;
        for (let i = 0; i < numLines; i++) {
            const lineProgress = (elapsed * 0.005 + i * 0.5) % 1;
            const startX = effect.tileX + Math.random() * effect.tileWidth;
            const startY = effect.tileY + Math.random() * effect.tileHeight;
            const endX = startX + (Math.random() - 0.5) * 20;
            const endY = startY + (Math.random() - 0.5) * 20;
            
            effect.lineStyle(1, targetColor, 0.8);
            effect.moveTo(startX, startY);
            effect.lineTo(endX, endY);
        }
        
        // Add border glow effect
        const borderGlow = 2 + Math.sin(elapsed * 0.008) * 1;
        effect.lineStyle(borderGlow, targetColor, 0.6);
        effect.drawRect(effect.tileX - borderGlow/2, effect.tileY - borderGlow/2, 
                       effect.tileWidth + borderGlow, effect.tileHeight + borderGlow);
    }

    createDeathAnimation(character) {
        if (!character || !character.sprite) return;
        
        console.log('Starting death animation for character:', character.id);
        
        // Simple death animation: turn gray and fade out
        character.isDying = true;
        
        // Make soul gray and stop moving
        character.sprite.tint = 0x808080; // Gray color
        console.log('Set character tint to gray');
        
        // Animate the death effect
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 2000; // 2000ms duration
            
            if (progress < 1) {
                // Gradually reduce transparency
                character.sprite.alpha = 1 - progress;
                
                if (elapsed % 500 < 50) { // Log every 500ms
                    console.log(`Death animation progress: ${Math.round(progress * 100)}%, alpha: ${character.sprite.alpha}`);
                }
                
                requestAnimationFrame(animate);
            } else {
                // Cleanup - make completely invisible
                if (character.sprite) {
                    character.sprite.alpha = 0;
                    console.log('Death animation completed');
                }
            }
        };
        
        animate();
    }
}

class GameMap {
    constructor(app) {
        this.app = app;
        this.container = new Container();
        this.tileContainer = new Container();
        this.tileMap = null;
        this.grayTileTexture = null;
        this.greenTileTexture = null;
    }

    async createMap() {
        await this.loadTileTextures();
        this.container.addChild(this.tileContainer);
    }

    async loadTileTextures() {
        // Load tile textures
        this.grayTileTexture = await Assets.load('./resources/background_gray_100x60.png');
        this.greenTileTexture = await Assets.load('./resources/background_green_100x60.png');
    }

    updateTileMap(tileMapData) {
        if (!tileMapData || !this.grayTileTexture || !this.greenTileTexture) return;
        
        // Clear existing tiles
        this.tileContainer.removeChildren();
        
        // Store tile map data
        this.tileMap = tileMapData;
        
        // Render tiles based on server data
        for (let y = 0; y < tileMapData.height; y++) {
            for (let x = 0; x < tileMapData.width; x++) {
                const tileData = tileMapData.tiles[y][x];
                const texture = tileData.type === 'gray' ? this.grayTileTexture : this.greenTileTexture;
                
                const tileSprite = new Sprite(texture);
                tileSprite.x = tileData.worldX;
                tileSprite.y = tileData.worldY;
                // Scale the 100x60 tiles down to 25x15
                tileSprite.width = 25;
                tileSprite.height = 15;
                
                this.tileContainer.addChild(tileSprite);
            }
        }
    }

    updateSingleTile(tileX, tileY, newType) {
        if (!this.tileMap || !this.grayTileTexture || !this.greenTileTexture) return;
        
        // Find and update the specific tile sprite
        const tileIndex = tileY * this.tileMap.width + tileX;
        const tileSprite = this.tileContainer.getChildAt(tileIndex);
        
        if (tileSprite) {
            const texture = newType === 'gray' ? this.grayTileTexture : this.greenTileTexture;
            tileSprite.texture = texture;
        }
    }

}

// Start the game when the page loads
window.addEventListener('load', async () => {
    new Game();
});