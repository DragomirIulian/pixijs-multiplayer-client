import { Assets, Sprite } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from './config/clientConfig.js';

export class Character {
    constructor(app, characterData) {
        this.app = app;
        this.id = characterData.id;
        this.name = characterData.name;
        this.type = characterData.type;
        
        // Energy attributes - all from server
        this.energy = characterData.energy;
        this.maxEnergy = characterData.maxEnergy;
        this.isCasting = characterData.isCasting || false;
        
        // Current position - all from server
        this.x = characterData.x;
        this.y = characterData.y;
        
        // Target position from server
        this.targetX = this.x;
        this.targetY = this.y;
        
        // Spell preparation state
        this.isPreparing = characterData.isPreparing || false;
        
        // Mating state
        this.isMating = characterData.isMating || false;
        this.isChild = characterData.isChild || false;
        this.maturityPercentage = characterData.maturityPercentage || 1.0;
        
        // Current state for tracking
        this.currentState = characterData.currentState || 'unknown';
        
        // Interpolation
        this.interpolationSpeed = ClientConfig.CHARACTER.INTERPOLATION_SPEED;
        
        // Floating animation properties
        this.floatOffset = Math.random() * Math.PI * 2; // Random start
        this.floatSpeed = ClientConfig.CHARACTER.FLOATING_SPEED;
        this.floatAmplitude = ClientConfig.CHARACTER.FLOATING_AMPLITUDE;
        
        
        this.sprite = null;
    }

    async init() {
        // Load the texture based on character type and age
        let texturePath;
        if (this.isChild) {
            // Use the same texture as parent type for children - will tint white
            texturePath = `./resources/${this.type}.png`;
        } else {
            texturePath = `./resources/${this.type}.png`;
        }
        const texture = await Assets.load(texturePath);
        
        // Create a sprite
        this.sprite = new Sprite(texture);
        this.sprite.anchor.set(0.5);
        this.sprite.x = this.x;
        this.sprite.y = this.y;
        
        // Set initial scale based on maturity
        this.updateScale();
        
        // Children have white tint initially
        if (this.isChild) {
            this.sprite.tint = 0xFFFFFF;
        }
    }

    updateFromServer(characterData) {
        // Don't update if character is dying
        if (this.isDying) {
            return;
        }
        
        // Update target position from server
        if (characterData.x !== undefined) {
            this.targetX = characterData.x;
        }
        if (characterData.y !== undefined) {
            this.targetY = characterData.y;
        }
        
        // Update energy from server
        if (characterData.energy !== undefined) {
            this.energy = Math.floor(characterData.energy);
        }
        if (characterData.maxEnergy !== undefined) {
            this.maxEnergy = Math.floor(characterData.maxEnergy);
        }
        if (characterData.name !== undefined) {
            this.name = characterData.name;
        }
        if (characterData.isCasting !== undefined) {
            this.isCasting = characterData.isCasting;
        }
        if (characterData.isPreparing !== undefined) {
            this.isPreparing = characterData.isPreparing;
        }
        if (characterData.isMating !== undefined) {
            this.isMating = characterData.isMating;
        }
        if (characterData.isChild !== undefined) {
            const wasChild = this.isChild;
            this.isChild = characterData.isChild;
            
            // If soul just matured from child to adult, update sprite
            if (wasChild && !this.isChild) {
                this.updateSpriteForMaturation();
            }
        }
        if (characterData.maturityPercentage !== undefined) {
            this.maturityPercentage = characterData.maturityPercentage;
            this.updateScale(); // Update scale based on new maturity
        }
        if (characterData.currentState !== undefined) {
            this.currentState = characterData.currentState;
        }
        
        // Update any other properties from server
        if (characterData.rotation !== undefined) {
            this.targetRotation = characterData.rotation;
        }
    }

    // Energy management methods
    setEnergy(value) {
        this.energy = Math.floor(Math.max(0, Math.min(this.maxEnergy, value)));
    }

    getEnergy() {
        return Math.floor(this.energy);
    }

    getEnergyPercentage() {
        return (this.energy / this.maxEnergy) * 100;
    }

    addEnergy(amount) {
        this.setEnergy(this.energy + amount);
    }

    removeEnergy(amount) {
        this.setEnergy(this.energy - amount);
    }


    updateScale() {
        if (!this.sprite) return;
        
        // Calculate scale based on maturity percentage
        // Children start at 50% size and grow to 100% as they mature
        const minScale = ClientConfig.CHARACTER.SCALE * 0.5; // 50% size for newborns
        const maxScale = ClientConfig.CHARACTER.SCALE; // 100% size for adults
        const currentScale = minScale + (maxScale - minScale) * this.maturityPercentage;
        
        this.sprite.scale.set(currentScale);
    }

    async updateSpriteForMaturation() {
        if (!this.sprite) return;
        
        // Load adult texture and update sprite
        const adultTexturePath = `./resources/${this.type}.png`;
        try {
            const adultTexture = await Assets.load(adultTexturePath);
            this.sprite.texture = adultTexture;
            this.updateScale(); // Use gradual scale instead of instant full size
            this.sprite.tint = 0xFFFFFF; // Normal color
        } catch (error) {
            // Keep using current texture if load fails
        }
    }

    update(time) {
        if (!this.sprite) return;

        // Don't move if dying
        if (!this.isDying) {
            // Movement interpolation
            this.x += (this.targetX - this.x) * this.interpolationSpeed;
            this.y += (this.targetY - this.y) * this.interpolationSpeed;
        }
        
        // Apply floating animation (but not when dying)
        if (!this.isDying) {
            this.floatOffset += this.floatSpeed * time.deltaTime;
        }
        const floatY = this.isDying ? 0 : Math.sin(this.floatOffset) * this.floatAmplitude;
        
        // Update sprite position
        this.sprite.x = this.x;
        this.sprite.y = this.y + floatY;
        
        // Visual feedback for mating, casting and preparing (but not if dying)
        if (this.isMating && !this.isDying) {
            // Pink tint when mating
            this.sprite.tint = 0xFF69B4; // Hot pink for mating
        } else if (this.isCasting && !this.isDying) {
            // Color tint when casting
            const castingColor = this.type === 'dark-soul' ? 
                ClientConfig.COLORS.DARK_SOUL_CASTING : 
                ClientConfig.COLORS.LIGHT_SOUL_CASTING;
            this.sprite.tint = castingColor;
        } else if (this.isPreparing && !this.isDying) {
            // Different color when preparing to cast (lighter tint)
            const preparingColor = this.type === 'dark-soul' ? 
                ClientConfig.COLORS.DARK_SOUL_PREPARING : 
                ClientConfig.COLORS.LIGHT_SOUL_PREPARING;
            this.sprite.tint = preparingColor;
        } else if (!this.isDying) {
            // Normal appearance (only if not dying)
            // Children stay white, adults get normal color
            this.sprite.tint = this.isChild ? 0xFFFFFF : 0xFFFFFF;
        }
        // If dying, don't change tint (death animation controls it)
        
        // Add slight rotation for floating effect (but not when dying)
        if (!this.isDying) {
            this.sprite.rotation = Math.sin(this.floatOffset * 2) * 0.1;
        }
    }
}
