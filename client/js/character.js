import { Assets, Sprite } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';

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
        this.sprite.scale.set(0.1);
    }

    updateFromServer(characterData) {
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
        
        // Visual feedback for casting and preparing (but not if dying)
        if (this.isCasting && !this.isDying) {
            // Color tint when casting
            const castingColor = this.type === 'dark-soul' ? 0x8B0000 : 0xFFD700;
            this.sprite.tint = castingColor;
        } else if (this.isPreparing && !this.isDying) {
            // Different color when preparing to cast (lighter tint)
            const preparingColor = this.type === 'dark-soul' ? 0xFF6B6B : 0xFFE066;
            this.sprite.tint = preparingColor;
        } else if (!this.isDying) {
            // Normal appearance (only if not dying)
            this.sprite.tint = 0xFFFFFF;
        }
        // If dying, don't change tint (death animation controls it)
        
        // Add slight rotation for floating effect (but not when dying)
        if (!this.isDying) {
            this.sprite.rotation = Math.sin(this.floatOffset * 2) * 0.1;
        }
    }
}
