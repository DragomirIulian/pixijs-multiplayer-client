import { Container, Sprite, Graphics, Text, Assets } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from '../config/clientConfig.js';

/**
 * NexusManager handles rendering and updating nexus platforms
 */
export class NexusManager {
    constructor(app) {
        this.app = app;
        this.nexuses = new Map();
        this.container = new Container();
        this.container.zIndex = 2; // Make sure nexuses render above tiles but below characters
        
        // Load textures (will be set when nexuses are first created)
        this.lightTexture = null;
        this.darkTexture = null;
    }

    async loadTextures() {
        if (!this.lightTexture || !this.darkTexture) {
            this.lightTexture = await Assets.load('resources/nexus-light.png');
            this.darkTexture = await Assets.load('resources/nexus-dark.png');
        }
    }

    async updateNexuses(nexusesData) {
        if (!nexusesData) return;

        // Load textures if not already loaded
        await this.loadTextures();

        // Update existing nexuses or create new ones
        nexusesData.forEach(nexusData => {
            if (this.nexuses.has(nexusData.id)) {
                this.updateNexus(nexusData);
            } else {
                this.createNexus(nexusData);
            }
        });

        // Remove nexuses that no longer exist
        const serverNexusIds = new Set(nexusesData.map(n => n.id));
        this.nexuses.forEach((nexus, id) => {
            if (!serverNexusIds.has(id)) {
                this.removeNexus(id);
            }
        });
    }

    createNexus(nexusData) {
        const nexusContainer = new Container();
        
        // Choose texture based on type
        const texture = nexusData.type === 'light' ? this.lightTexture : this.darkTexture;
        
        // Create main nexus sprite - 2x2 tiles size for small map
        const nexusSprite = new Sprite(texture);
        nexusSprite.anchor.set(0.5);
        nexusSprite.x = 0;
        nexusSprite.y = 0;
        // Scale to nexus size from server data ONLY
        if (!nexusData.size) {
            console.error('No nexus size provided by server');
            return null;
        }
        
        if (!nexusData.visualMultiplier) {
            console.error('No visual multiplier provided by server');
            return null;
        }
        
        const visualSize = nexusData.size * nexusData.visualMultiplier;
        const TILE_WIDTH = ClientConfig.MAP.TILE_DISPLAY_WIDTH;
        const finalWidth = visualSize * TILE_WIDTH;
        const finalHeight = visualSize * TILE_WIDTH;
        
        console.log(`Nexus ${nexusData.type}: size=${nexusData.size}, multiplier=${nexusData.visualMultiplier}, visualSize=${visualSize}, finalSize=${finalWidth}x${finalHeight}`);
        console.log(`Original texture size: ${texture.width}x${texture.height}`);
        
        nexusSprite.width = finalWidth;
        nexusSprite.height = finalHeight;
        
        // Create health bar container
        const healthBarContainer = new Container();
        healthBarContainer.y = -80; // Position above the nexus
        
        // Create health bar background
        const healthBarBg = new Graphics();
        healthBarBg.rect(-50, -8, 100, 16);
        healthBarBg.fill(0x333333);
        healthBarBg.stroke({ color: 0x000000, width: 2 });
        
        // Create health bar fill
        const healthBarFill = new Graphics();
        const healthColor = nexusData.type === 'light' ? 0xFFD700 : 0x9C27B0; // Yellow for light, purple for dark
        healthBarFill.rect(-48, -6, 96, 12);
        healthBarFill.fill(healthColor);
        
        // Create health text
        const healthText = new Text({
            text: `${nexusData.currentHealth}/${nexusData.maxHealth}`,
            style: {
                fontSize: 12,
                fill: 0xFFFFFF,
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }
        });
        healthText.anchor.set(0.5);
        healthText.y = 12;
        
        // Add components to health bar container
        healthBarContainer.addChild(healthBarBg, healthBarFill, healthText);
        
        // Add components to main container
        nexusContainer.addChild(nexusSprite, healthBarContainer);
        
        // Position the nexus
        nexusContainer.x = nexusData.x;
        nexusContainer.y = nexusData.y;
        
        // Store references for updates
        const nexusObject = {
            container: nexusContainer,
            sprite: nexusSprite,
            healthBarFill: healthBarFill,
            healthText: healthText,
            data: nexusData
        };
        
        this.nexuses.set(nexusData.id, nexusObject);
        this.container.addChild(nexusContainer);
    }

    updateNexus(nexusData) {
        const nexus = this.nexuses.get(nexusData.id);
        if (!nexus) return;

        // Update position (in case nexus moves)
        nexus.container.x = nexusData.x;
        nexus.container.y = nexusData.y;

        // Update health bar
        const healthPercentage = nexusData.healthPercentage;
        nexus.healthBarFill.clear();
        const healthColor = nexusData.type === 'light' ? 0xFFD700 : 0x9C27B0;
        
        // Scale health bar based on percentage
        const barWidth = 96 * healthPercentage;
        nexus.healthBarFill.rect(-48, -6, barWidth, 12);
        nexus.healthBarFill.fill(healthColor);

        // Update health text
        nexus.healthText.text = `${nexusData.currentHealth}/${nexusData.maxHealth}`;

        // Update visual state if destroyed
        if (nexusData.isDestroyed) {
            nexus.sprite.alpha = 0.5;
            nexus.sprite.tint = 0x666666; // Gray out destroyed nexus
        } else {
            nexus.sprite.alpha = 1.0;
            nexus.sprite.tint = 0xFFFFFF;
        }

        // Store updated data
        nexus.data = nexusData;
    }

    removeNexus(nexusId) {
        const nexus = this.nexuses.get(nexusId);
        if (nexus) {
            this.container.removeChild(nexus.container);
            this.nexuses.delete(nexusId);
        }
    }

    getAllNexuses() {
        return this.nexuses;
    }

    getNexus(nexusId) {
        return this.nexuses.get(nexusId);
    }

    // Update nexuses - keep them completely static (no movement or effects)
    update(time) {
        // Nexuses should remain completely stationary
        // No floating animation, no glow effects, no movement whatsoever
    }
}
