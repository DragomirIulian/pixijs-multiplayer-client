import { Graphics } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from '../config/clientConfig.js';

/**
 * EnergyOrbManager - Single Responsibility: Energy orb lifecycle management
 * Handles spawning, updating, removing energy orbs
 */
export class EnergyOrbManager {
    constructor(app) {
        this.app = app;
        this.energyOrbs = new Map();
    }

    spawnEnergyOrb(orbData) {
        const orb = new Graphics();
        
        // Team-specific colors based on orb type
        let colors;
        let glowColor;
        
        if (orbData.color === 'yellow' || orbData.teamType === 'green') {
            // Blue orbs for light souls (more visible than yellow)
            colors = ClientConfig.COLORS.LIGHT_ORB_COLORS;
            glowColor = ClientConfig.COLORS.LIGHT_ORB_GLOW;
        } else {
            // Red orbs for dark souls
            colors = ClientConfig.COLORS.DARK_ORB_COLORS;
            glowColor = ClientConfig.COLORS.DARK_ORB_GLOW;
        }
        
        // Draw pixelated orb using small rectangles
        for (let x = ClientConfig.EFFECTS.ORB_CORE_GRID_MIN; x <= ClientConfig.EFFECTS.ORB_CORE_GRID_MAX; x++) {
            for (let y = ClientConfig.EFFECTS.ORB_CORE_GRID_MIN; y <= ClientConfig.EFFECTS.ORB_CORE_GRID_MAX; y++) {
                const distance = Math.sqrt(x * x + y * y);
                if (distance <= ClientConfig.EFFECTS.ORB_CORE_RANGE) {
                    const colorIndex = Math.min(Math.floor(distance), colors.length - 1);
                    orb.beginFill(colors[colorIndex], 1.0);
                    orb.drawRect(x * ClientConfig.EFFECTS.ORB_PIXEL_BLOCKS, y * ClientConfig.EFFECTS.ORB_PIXEL_BLOCKS, 
                                ClientConfig.EFFECTS.ORB_PIXEL_BLOCKS, ClientConfig.EFFECTS.ORB_PIXEL_BLOCKS);
                    orb.endFill();
                }
            }
        }
        
        // Add outer glow with pixelated effect
        orb.beginFill(glowColor, ClientConfig.EFFECTS.ORB_GLOW_ALPHA);
        for (let x = ClientConfig.EFFECTS.ORB_GLOW_GRID_MIN; x <= ClientConfig.EFFECTS.ORB_GLOW_GRID_MAX; x++) {
            for (let y = ClientConfig.EFFECTS.ORB_GLOW_GRID_MIN; y <= ClientConfig.EFFECTS.ORB_GLOW_GRID_MAX; y++) {
                const distance = Math.sqrt(x * x + y * y);
                if (distance > ClientConfig.EFFECTS.ORB_GLOW_RANGE_MIN && distance <= ClientConfig.EFFECTS.ORB_GLOW_RANGE_MAX) {
                    orb.drawRect(x * ClientConfig.EFFECTS.ORB_PIXEL_BLOCKS, y * ClientConfig.EFFECTS.ORB_PIXEL_BLOCKS, 
                                ClientConfig.EFFECTS.ORB_PIXEL_BLOCKS, ClientConfig.EFFECTS.ORB_PIXEL_BLOCKS);
                }
            }
        }
        orb.endFill();
        
        // Position from server data
        orb.x = orbData.x;
        orb.y = orbData.y;
        
        // Add pulsing animation properties
        orb.pulseOffset = Math.random() * Math.PI * 2;
        orb.pulseSpeed = ClientConfig.EFFECTS.ORB_PULSE_SPEED;
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

    clearAllOrbs() {
        this.energyOrbs.forEach(orb => {
            this.app.stage.removeChild(orb);
        });
        this.energyOrbs.clear();
    }

    updateOrbs(time) {
        this.energyOrbs.forEach(orb => {
            if (orb && orb.pulseOffset !== undefined) {
                orb.pulseOffset += orb.pulseSpeed * time.deltaTime;
                const pulseScale = orb.originalScale + Math.sin(orb.pulseOffset) * ClientConfig.EFFECTS.ORB_PULSE_SCALE;
                orb.scale.set(pulseScale);
            }
        });
    }

    handleOrbCollection(orbId, collectorId, characterManager, effectsSystem) {
        const orb = this.energyOrbs.get(orbId);
        const collector = characterManager.getCharacter(collectorId);
        
        if (orb) {
            // Remove the orb
            this.removeEnergyOrb(orbId);
        }
        
        if (collector && !collector.isDying) {
            // Create energizer effect on the collector (but not if dying)
            effectsSystem.createEnergizerEffect(collector);
        }
    }
}
