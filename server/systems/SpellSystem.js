const GameConfig = require('../config/gameConfig');
const { SoulStates } = require('../entities/SoulStateMachine');

/**
 * Spell System
 * Handles spell casting, preparation, and effects
 */
class SpellSystem {
  constructor(tileMap, dayNightSystem = null) {
    this.tileMap = tileMap;
    this.dayNightSystem = dayNightSystem;
    this.activeSpells = new Map();
    this.spellEvents = [];
  }

  update(allSouls) {
    this.spellEvents = [];
    
    // Process spell preparation and casting
    allSouls.forEach(soul => {
      this.processSoulSpellCasting(soul, allSouls);
    });

    // Note: Spell completion is now handled separately to allow interruption

    return this.spellEvents;
  }

  // Separate method for completing spells (called after combat)
  processSpellCompletion(allSouls) {
    // Reset spell events array for completion events
    const completionEvents = [];
    
    // Create array to avoid modifying map while iterating
    const spellsToProcess = Array.from(this.activeSpells.entries());
    
    spellsToProcess.forEach(([spellId, spell]) => {
      // Double-check spell still exists (might have been interrupted)
      if (!this.activeSpells.has(spellId)) {
        return;
      }
      
      if (Date.now() >= spell.completionTime) {
        // Clear enemy casting flags for all souls
        this.clearEnemyCastingFlags(spell.casterId, allSouls);
        
        // Convert the tile
        const newTileType = spell.casterType === 'dark-soul' ? 'gray' : 'green';
        spell.targetTile.type = newTileType;

        // Mark the caster as dead and start death process immediately
        const caster = allSouls.get(spell.casterId);
        if (caster) {
          caster.isDead = true;
          caster.deathStarted = true;
          caster.deathStartTime = Date.now();
          
          // Broadcast death animation start event immediately
          completionEvents.push({
            type: 'character_death',
            characterId: caster.id,
            characterData: caster.toClientData()
          });
        }

        // Broadcast spell completion (without killing - death system will handle it)
        completionEvents.push({
          type: 'spell_completed',
          spellId: spell.id,
          tileX: spell.targetTile.x,
          tileY: spell.targetTile.y,
          newTileType: newTileType
        });

        // Broadcast tile update
        completionEvents.push({
          type: 'tile_updated',
          tileX: spell.targetTile.x,
          tileY: spell.targetTile.y,
          newType: newTileType
        });
        
        this.activeSpells.delete(spellId);
      }
    });
    
    // Add completion events to main spell events
    this.spellEvents.push(...completionEvents);
    return this.spellEvents;
  }

  processSoulSpellCasting(soul, allSouls) {
    // Check if soul just entered PREPARING state and needs to find target
    if (soul.isInState(SoulStates.PREPARING) && !soul.prepareTarget) {
      const targetTile = this.findNearestOpponentTile(soul, allSouls);
      if (targetTile) {
        soul.prepareTarget = targetTile;
      } else {
      }
    }

    // Check if soul just entered CASTING state and needs to start spell
    // CRITICAL: Only start spell if soul doesn't already have an active spell
    if (soul.isInState(SoulStates.CASTING) && soul.prepareTarget) {
      // Check if this soul already has an active spell
      const hasActiveSpell = Array.from(this.activeSpells.values()).some(spell => spell.casterId === soul.id);
      
      if (!hasActiveSpell) {
        this.startSpellCasting(soul, soul.prepareTarget, allSouls);
      }
    }
  }


  startSpellCasting(soul, targetTile, allSouls) {
    const spellId = `spell-${soul.id}-${Date.now()}`;
    
    // Get team-specific cast time multiplier
    const castTimeMultiplier = this.dayNightSystem ? 
      this.dayNightSystem.getSpellCastTimeMultiplier(soul.type) : 1.0;
    const adjustedCastTime = GameConfig.SOUL.SPELL_CAST_TIME * castTimeMultiplier;
    
    const spell = {
      id: spellId,
      casterId: soul.id,
      casterType: soul.type,
      targetTile: targetTile,
      startTime: Date.now(),
      completionTime: Date.now() + adjustedCastTime,
      casterX: soul.x,
      casterY: soul.y,
      targetX: targetTile.worldX + this.tileMap.tileWidth / 2,
      targetY: targetTile.worldY + this.tileMap.tileHeight / 2
    };

    this.activeSpells.set(spellId, spell);
    soul.startCasting();

    // Notify all potential defender souls that an enemy is casting
    allSouls.forEach(otherSoul => {
      if (otherSoul.type !== soul.type) {
        otherSoul.enemyCastingDetected = true;
        otherSoul.castingEnemyId = soul.id;
      }
    });

    // Broadcast spell start event
    this.spellEvents.push({
      type: 'spell_started',
      spell: {
        spellId: spell.id,
        casterId: spell.casterId,
        casterType: spell.casterType,
        casterX: spell.casterX,
        casterY: spell.casterY,
        targetX: spell.targetX,
        targetY: spell.targetY,
        targetTileX: targetTile.x,
        targetTileY: targetTile.y,
        duration: adjustedCastTime
      }
    });

  }



  interruptSpell(soul, allSouls) {
    // Clear enemy casting flags for this caster
    this.clearEnemyCastingFlags(soul.id, allSouls);
    
    // Find and remove any active spells by this caster
    let interrupted = false;
    
    this.activeSpells.forEach((spell, spellId) => {
      if (spell.casterId === soul.id) {
        this.activeSpells.delete(spellId);
        interrupted = true;

        // Stop any souls defending against this spell
        allSouls.forEach(defender => {
          if (defender.isDefending && defender.defendingTarget === soul.id) {
            defender.stopDefending();
          }
        });

        // Broadcast spell interruption to stop client animations
        this.spellEvents.push({
          type: 'spell_interrupted',
          spellId: spellId,
          casterId: soul.id
        });
      }
    });

    if (interrupted) {
      soul.interruptSpell();
    }
  }

  findNearestOpponentTile(soul, allSouls = new Map()) {
    if (!this.tileMap) return null;

    const opponentTileType = soul.type === 'dark-soul' ? 'green' : 'gray';
    
    let nearestTile = null;
    let nearestDistance = GameConfig.SOUL.SPELL_RANGE;
    const minDistance = GameConfig.SOUL.SPELL_MIN_DISTANCE;

    // Check tiles within spell range but not too close
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[y][x];

        // Only target opponent tiles
        if (tile.type === opponentTileType) {
          // Check if this tile is already being targeted by another spell
          const isAlreadyTargeted = Array.from(this.activeSpells.values()).some(spell => 
            spell.targetTile.x === tile.x && spell.targetTile.y === tile.y
          );
          
          if (isAlreadyTargeted) continue; // Skip tiles already being targeted
          
          // Also check if any other soul is preparing to target this tile
          const isBeingPreparedFor = Array.from(allSouls.values()).some(otherSoul => 
            otherSoul.id !== soul.id && 
            otherSoul.prepareTarget && 
            otherSoul.prepareTarget.x === tile.x && 
            otherSoul.prepareTarget.y === tile.y
          );
          
          if (isBeingPreparedFor) continue; // Skip tiles being prepared for by other souls
          
          const dx = (tile.worldX + this.tileMap.tileWidth / 2) - soul.x;
          const dy = (tile.worldY + this.tileMap.tileHeight / 2) - soul.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Must be within range but not too close
          if (distance < nearestDistance && distance >= minDistance) {
            nearestDistance = distance;
            nearestTile = tile;
          }
        }
      }
    }

    return nearestTile;
  }

  // Handle spell interruption when soul is attacked
  handleSoulAttacked(attackedSoul, allSouls) {
    if (attackedSoul.isCasting || attackedSoul.isPreparing) {
      this.interruptSpell(attackedSoul, allSouls);
    }
  }

  // Remove spell and stop defenders when caster dies
  handleSoulDeath(deadSoul, allSouls) {
    // Remove any active spells by this soul
    this.activeSpells.forEach((spell, spellId) => {
      if (spell.casterId === deadSoul.id) {
        this.activeSpells.delete(spellId);
        
        // Stop any souls defending against this spell
        allSouls.forEach(defender => {
          if (defender.isDefending && defender.defendingTarget === deadSoul.id) {
            defender.stopDefending();
          }
        });
      }
    });
  }

  getActiveSpells() {
    return this.activeSpells;
  }

  clearEnemyCastingFlags(casterId, allSouls) {
    allSouls.forEach(soul => {
      if (soul.castingEnemyId === casterId) {
        soul.enemyCastingDetected = false;
        soul.castingEnemyId = null;
      }
    });
  }

  getSpellEvents() {
    return this.spellEvents;
  }

  clearEvents() {
    this.spellEvents = [];
  }
}

module.exports = SpellSystem;
