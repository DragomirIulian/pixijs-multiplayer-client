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
        
        // Happy state tracking (for 5 seconds after mating)
        this.happyStateEndTime = 0;
        
        // Combat cooldown tracking (for 5 seconds after combat)
        this.combatCooldownEndTime = 0;
        
        // Interpolation
        this.interpolationSpeed = ClientConfig.CHARACTER.INTERPOLATION_SPEED;
        
        // Floating animation properties
        this.floatOffset = Math.random() * Math.PI * 2; // Random start
        this.floatSpeed = ClientConfig.CHARACTER.FLOATING_SPEED;
        this.floatAmplitude = ClientConfig.CHARACTER.FLOATING_AMPLITUDE;
        
        
        this.sprite = null;
    }

    async init() {
        // Load the kryon texture based on current state
        const kryonImagePath = this.getKryonImagePath();
        const texture = await Assets.load(kryonImagePath);
        
        // Create a sprite
        this.sprite = new Sprite(texture);
        this.sprite.anchor.set(0.5);
        this.sprite.x = this.x;
        this.sprite.y = this.y;
        this.sprite.zIndex = 10; // Ensure characters render above nexus platforms
        
        // Set initial scale based on maturity
        this.updateScale();
        
        // Store the current kryon image for tracking changes
        this.currentKryonImage = kryonImagePath;
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
            const previousState = this.currentState;
            this.currentState = characterData.currentState;
            
            // Track when exiting combat states - start combat cooldown
            if (this.isCombatState(previousState) && !this.isCombatState(this.currentState)) {
                this.startCombatCooldown();
            }
        }
        
        // Check if just finished mating (only trigger happy state for mating)
        if (this.isMating && characterData.isMating === false) {
            this.triggerHappyState();
        }
        
        // Update kryon image based on new state
        this.updateKryonImage();
        
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

        // Check if happy state has expired
        if (this.happyStateEndTime > 0 && Date.now() > this.happyStateEndTime) {
            this.happyStateEndTime = 0;
            this.updateKryonImage(); // Update image when happy state ends
        }
        
        // Check if combat cooldown has expired
        if (this.combatCooldownEndTime > 0 && Date.now() > this.combatCooldownEndTime) {
            this.combatCooldownEndTime = 0;
            this.updateKryonImage(); // Update image when combat cooldown ends
        }

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
        
        // Apply visual tints for combat states (when using original soul images)
        if (!this.isDying) {
            // Combat states use original soul images with color tints
            if (this.isMating && (this.currentState !== 'attacking' && this.currentState !== 'seeking' && 
                                 this.currentState !== 'defending' && this.currentState !== 'preparing' && 
                                 this.currentState !== 'casting' && this.currentState !== 'seeking_nexus' && 
                                 this.currentState !== 'attacking_nexus')) {
                // Pink tint when mating (only if using kryon image)
                this.sprite.tint = 0xFF69B4; // Hot pink for mating
            } else if (this.isCasting) {
                // Color tint when casting (using original soul image)
                const castingColor = this.type === 'dark-soul' ? 
                    ClientConfig.COLORS.DARK_SOUL_CASTING : 
                    ClientConfig.COLORS.LIGHT_SOUL_CASTING;
                this.sprite.tint = castingColor;
            } else if (this.isPreparing) {
                // Different color when preparing to cast (using original soul image)
                const preparingColor = this.type === 'dark-soul' ? 
                    ClientConfig.COLORS.DARK_SOUL_PREPARING : 
                    ClientConfig.COLORS.LIGHT_SOUL_PREPARING;
                this.sprite.tint = preparingColor;
            } else {
                // Normal appearance - kryon images handle most visual states
                this.sprite.tint = this.isChild ? 0xFFFFFF : 0xFFFFFF;
            }
        }
        // If dying, don't change tint (death animation controls it)
        
        // Add slight rotation for floating effect (but not when dying)
        if (!this.isDying) {
            this.sprite.rotation = Math.sin(this.floatOffset * 2) * 0.1;
        }
    }

    // Kryon image management methods
    getKryonImagePath() {
        const teamColor = this.type === 'dark-soul' ? 'black' : 'white';
        
        // Check for death first (highest priority)
        if (this.isDying || this.energy <= 0) {
            return `./resources/kryons/dead_${teamColor}_kryon.png`;
        }
        // Check for combat states OR combat cooldown - use existing soul images
        else if (this.isCombatState(this.currentState) || this.isInCombatCooldown()) {
            return `./resources/${this.type}.png`;
        }
        // Check for happy state (after eating/mating)
        else if (this.happyStateEndTime > 0 && Date.now() < this.happyStateEndTime) {
            return `./resources/kryons/happy_${teamColor}_kryon.png`;
        }
        // Check for mating state
        else if (this.isMating) {
            return `./resources/kryons/love_${teamColor}_kryon.png`;
        }
        // Check for specific peaceful states
        else if (this.currentState === 'roaming' || this.currentState === 'resting' || this.currentState === 'socialising') {
            return `./resources/kryons/happy_${teamColor}_kryon.png`;
        }
        else if (this.currentState === 'hungry') {
            return `./resources/kryons/neutral_${teamColor}_kryon.png`;
        }
        // Check for sleep state (could be added later)
        // else if (this.currentState === 'sleeping') {
        //     return `./resources/kryons/sleep_${teamColor}_kryon.png`;
        // }
        // Default to neutral for any other unknown states
        else {
            return `./resources/kryons/neutral_${teamColor}_kryon.png`;
        }
    }

    triggerHappyState() {
        // Set happy state for 5 seconds
        this.happyStateEndTime = Date.now() + 5000;
        this.updateKryonImage();
    }

    isCombatState(state) {
        return state === 'attacking' || 
               state === 'seeking' || 
               state === 'defending' ||
               state === 'preparing' ||
               state === 'casting' ||
               state === 'seeking_nexus' ||
               state === 'attacking_nexus';
    }

    startCombatCooldown() {
        // Set combat cooldown for 5 seconds
        this.combatCooldownEndTime = Date.now() + 5000;
        this.updateKryonImage();
    }

    isInCombatCooldown() {
        return this.combatCooldownEndTime > 0 && Date.now() < this.combatCooldownEndTime;
    }

    async updateKryonImage() {
        if (!this.sprite) return;
        
        const newKryonImagePath = this.getKryonImagePath();
        
        // Only update if the image actually changed
        if (newKryonImagePath !== this.currentKryonImage) {
            try {
                const newTexture = await Assets.load(newKryonImagePath);
                this.sprite.texture = newTexture;
                this.currentKryonImage = newKryonImagePath;
            } catch (error) {
                console.warn(`Failed to load kryon image: ${newKryonImagePath}`, error);
                // Keep using current texture if load fails
            }
        }
    }
}
