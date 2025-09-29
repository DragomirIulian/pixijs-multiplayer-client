import { Graphics } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';

/**
 * SpellManager - Single Responsibility: Spell effect management
 * Handles spell animations, tethers, and tile transformations
 */
export class SpellManager {
    constructor(app) {
        this.app = app;
        this.activeSpells = new Map();
        this.tileTransformEffects = new Map();
    }

    createTileTransformationEffect(spellData, gameMap) {
        if (!gameMap || !gameMap.tileMap) return;
        
        const tileMap = gameMap.tileMap;
        const targetTile = tileMap.tiles[spellData.targetTileY][spellData.targetTileX];
        
        // Calculate tile world position
        const tileWorldX = targetTile.worldX;
        const tileWorldY = targetTile.worldY;
        const tileWidth = tileMap.tileWidth;
        const tileHeight = tileMap.tileHeight;
        
        // Create transformation effect container
        const transformEffect = new Graphics();
        transformEffect.spellId = spellData.spellId;
        transformEffect.casterId = spellData.casterId; // Add missing casterId property
        transformEffect.startTime = Date.now();
        transformEffect.duration = spellData.duration;
        transformEffect.casterType = spellData.casterType;
        transformEffect.tileX = tileWorldX;
        transformEffect.tileY = tileWorldY;
        transformEffect.tileWidth = tileWidth;
        transformEffect.tileHeight = tileHeight;
        
        // Store the effect for updates
        this.tileTransformEffects.set(spellData.spellId, transformEffect);
        this.app.stage.addChild(transformEffect);
    }

    handleSpellStarted(spellData, gameMap) {
        if (!spellData.spellId) {
            console.error('[SpellManager] Received spell with undefined spellId:', spellData);
            return;
        }
        
        // Prevent duplicate spell creation
        if (this.activeSpells.has(spellData.spellId)) {
            return;
        }
        
        // Create tether animation between caster and target tile
        const tether = new Graphics();
        
        // Store spell data for updates
        tether.spellData = spellData;
        tether.startTime = Date.now();
        
        this.activeSpells.set(spellData.spellId, tether);
        this.app.stage.addChild(tether);
        
        
        // Create tile transformation effect
        if (spellData.targetTileX !== undefined && spellData.targetTileY !== undefined) {
            this.createTileTransformationEffect(spellData, gameMap);
        }
    }

    handleSpellCompleted(data) {
        // Remove the tether animation
        const tether = this.activeSpells.get(data.spellId);
        if (tether) {
            // Immediately stop rendering and remove from stage FIRST
            tether.forceCompleted = true;
            this.app.stage.removeChild(tether);
            tether.clear();
            this.activeSpells.delete(data.spellId);
        }
        
        // Remove the tile transformation effect
        const transformEffect = this.tileTransformEffects.get(data.spellId);
        if (transformEffect) {
            // Immediately stop rendering and remove from stage FIRST
            transformEffect.forceCompleted = true;
            this.app.stage.removeChild(transformEffect);
            transformEffect.clear();
            this.tileTransformEffects.delete(data.spellId);
        }
        
    }

    handleSpellInterrupted(data) {
        
        // Remove the specific tether animation if it exists
        const tether = this.activeSpells.get(data.spellId);
        if (tether) {
            this.app.stage.removeChild(tether);
            this.activeSpells.delete(data.spellId);
        } else {
        }
        
        // FALLBACK: Remove ALL spells by this caster in case of ID mismatch
        let removedFallback = false;
        this.activeSpells.forEach((spell, spellId) => {
            if (spell.spellData && spell.spellData.casterId === data.casterId) {
                this.app.stage.removeChild(spell);
                this.activeSpells.delete(spellId);
                removedFallback = true;
            }
        });
        
        if (removedFallback) {
        }
        
        // Remove the tile transformation effect if it exists
        const transformEffect = this.tileTransformEffects.get(data.spellId);
        if (transformEffect) {
            this.app.stage.removeChild(transformEffect);
            this.tileTransformEffects.delete(data.spellId);
        } else {
        }
        
        // FALLBACK: Remove ALL transform effects by this caster
        this.tileTransformEffects.forEach((effect, effectId) => {
            if (effect.casterId === data.casterId) {
                this.app.stage.removeChild(effect);
                this.tileTransformEffects.delete(effectId);
            }
        });
        
    }

    clearAllSpells() {
        // Clear all active spells
        this.activeSpells.forEach(spell => {
            if (spell.parent) {
                spell.parent.removeChild(spell);
            }
        });
        this.activeSpells.clear();
        
        // Clear tile transformation effects
        if (this.tileTransformEffects) {
            this.tileTransformEffects.forEach(effect => {
                if (effect.parent) {
                    effect.parent.removeChild(effect);
                }
            });
            this.tileTransformEffects.clear();
        }
    }

    // Force cleanup of any orphaned spell effects
    forceCleanupHangingSpells() {
        // Find all spell-related graphics on stage and remove them
        const stage = this.app.stage;
        const childrenToRemove = [];
        
        // Look for orphaned spell effects by checking if they have spell-related properties
        stage.children.forEach(child => {
            if (child.spellData || child.spellId || child.casterId || 
                (child.constructor.name === 'Graphics' && 
                 (child.x !== undefined && child.y !== undefined) &&
                 !this.activeSpells.has(child.spellId) &&
                 !this.tileTransformEffects?.has(child.spellId))) {
                
                // Check if this graphics object might be a hanging spell effect
                if (child.spellData || child.spellId) {
                    childrenToRemove.push(child);
                }
            }
        });
        
        // Remove identified hanging spell effects
        childrenToRemove.forEach(child => {
            if (child.parent) {
                child.parent.removeChild(child);
            }
        });
        
        // Also clear any transform effects that might be hanging
        if (this.tileTransformEffects) {
            this.tileTransformEffects.forEach((effect, effectId) => {
                if (!effect.parent) {
                    this.tileTransformEffects.delete(effectId);
                }
            });
        }
    }

    clearSpellsByCaster(casterId) {
        // Clear all spells cast by this caster immediately
        const spellsToRemove = [];
        this.activeSpells.forEach((tether, spellId) => {
            if (tether.spellData && tether.spellData.casterId === casterId) {
                spellsToRemove.push(spellId);
                // Force the tether to stop rendering immediately by marking it as completed
                tether.forceCompleted = true;
                tether.clear(); // Clear graphics immediately
            }
        });
        
        spellsToRemove.forEach(spellId => {
            const tether = this.activeSpells.get(spellId);
            if (tether && tether.parent) {
                tether.parent.removeChild(tether);
            }
            this.activeSpells.delete(spellId);
        });

        // Also clear tile effects by this caster
        const effectsToRemove = [];
        this.tileTransformEffects.forEach((effect, spellId) => {
            if (effect.casterId === casterId) {
                effectsToRemove.push(spellId);
                // Force the effect to stop rendering immediately
                effect.forceCompleted = true;
                effect.clear(); // Clear graphics immediately
            }
        });
        
        effectsToRemove.forEach(spellId => {
            const effect = this.tileTransformEffects.get(spellId);
            if (effect && effect.parent) {
                effect.parent.removeChild(effect);
            }
            this.tileTransformEffects.delete(spellId);
        });
    }

    updateSpells(time, effectsSystem) {
        // Update spell tethers - use Array.from to avoid stale iterations
        Array.from(this.activeSpells.entries()).forEach(([spellId, tether]) => {
            // Double-check the spell still exists before updating
            if (this.activeSpells.has(spellId)) {
                effectsSystem.updateSpellTether(tether, time);
            }
        });

        // Update tile transformation effects
        Array.from(this.tileTransformEffects.entries()).forEach(([spellId, effect]) => {
            // Double-check the effect still exists before updating
            if (this.tileTransformEffects.has(spellId)) {
                effectsSystem.updateTileTransformEffect(effect, time);
            }
        });
    }
}
