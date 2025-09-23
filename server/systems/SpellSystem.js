const GameConfig = require('../config/gameConfig');
const { SoulStates } = require('../entities/SoulStateMachine');

/**
 * Spell System
 * Handles spell casting, preparation, and effects
 */
class SpellSystem {
  constructor(tileMap, dayNightSystem = null, movementSystem = null) {
    this.tileMap = tileMap;
    this.dayNightSystem = dayNightSystem;
    this.movementSystem = movementSystem;
    this.activeSpells = new Map();
    this.spellEvents = [];
    
    // Manhattan distance from each tile to enemy nexus
    this.manhattanScores = {
      green: [], // Distance from each tile to dark nexus (green team's target)
      gray: []   // Distance from each tile to light nexus (gray team's target)
    };
    
    this.calculateManhattanDistances();
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
        
        // Convert tiles in tunnel shape
        const newTileType = spell.casterType === 'dark-soul' ? 'gray' : 'green';
        const capturedTiles = this.captureTunnel(spell.targetTile, newTileType);
        
        // Update border scores when tiles are captured
        if (this.movementSystem && this.movementSystem.updateBorderScores) {
          this.movementSystem.updateBorderScores();
        }

        // Broadcast spell completion FIRST to stop animations
        completionEvents.push({
          type: 'spell_completed',
          spellId: spell.spellId,
          tileX: spell.targetTile.x,
          tileY: spell.targetTile.y,
          newTileType: newTileType,
          capturedTiles: capturedTiles // Include all captured tiles
        });

        // Mark the caster as dead - let GameManager handle the death event
        const caster = allSouls.get(spell.casterId);
        if (caster) {
          caster.isDead = true;
          // DON'T set deathStarted - let GameManager.handleSoulDeaths() handle the death event
          // This prevents duplicate death events
        }

        // Broadcast tile updates for all captured tiles
        capturedTiles.forEach(tile => {
          completionEvents.push({
            type: 'tile_updated',
            tileX: tile.x,
            tileY: tile.y,
            newType: newTileType
          });
        });
        
        // Don't send death event here - let GameManager.handleSoulDeaths() send it
        // This prevents duplicate death events
        
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
        // Clear the prepare target to prevent duplicate spell creation
        soul.prepareTarget = null;
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
      spellId: spellId,
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
        spellId: spell.spellId,
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
    
    // Clear the prepare target to prevent spell recreation
    soul.prepareTarget = null;
    
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

    const teamType = soul.teamType;
    const opponentType = soul.type === 'dark-soul' ? 'green' : 'gray';
    const minDistance = GameConfig.SOUL.SPELL_MIN_DISTANCE;
    const maxDistance = GameConfig.SOUL.SPELL_RANGE;

    // Find the enemy tile with LOWEST Manhattan score that can be reached by spell
    let bestTile = null;
    let bestManhattanScore = Infinity;

    // Check ALL tiles on the map
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[y][x];
        
        // Only consider enemy tiles
        if (tile && tile.type === opponentType) {
          // Check distance to soul
          const dx = (tile.worldX + this.tileMap.tileWidth / 2) - soul.x;
          const dy = (tile.worldY + this.tileMap.tileHeight / 2) - soul.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Must be within spell range
          if (distance <= maxDistance && distance >= minDistance) {
            // Check if already being targeted
            const isAlreadyTargeted = Array.from(this.activeSpells.values()).some(spell => 
              spell.targetTile.x === tile.x && spell.targetTile.y === tile.y
            );
            if (isAlreadyTargeted) continue;

            // Get Manhattan score for this tile
            const manhattanScore = this.manhattanScores[teamType][y][x];
            
            // Pick the tile with lowest Manhattan score (closest to enemy nexus)
            if (manhattanScore < bestManhattanScore) {
              bestManhattanScore = manhattanScore;
              bestTile = tile;
            }
          }
        }
      }
    }

    return bestTile;
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

  /**
   * Capture tiles in a cross shape (5 tiles total)
   * @param {Object} centerTile - The target tile of the spell
   * @param {string} newTileType - The team type to convert tiles to
   * @returns {Array} Array of captured tiles
   */
  captureTunnel(centerTile, newTileType) {
    const capturedTiles = [];
    
    // Cross pattern: center + 4 adjacent tiles (up, down, left, right)
    const crossPattern = [
      { x: 0, y: 0 },   // Center
      { x: -1, y: 0 },  // Left
      { x: 1, y: 0 },   // Right
      { x: 0, y: -1 },  // Up
      { x: 0, y: 1 }    // Down
    ];
    
    crossPattern.forEach(offset => {
      const tileX = centerTile.x + offset.x;
      const tileY = centerTile.y + offset.y;
      
      // Check bounds
      if (tileX >= 0 && tileX < this.tileMap.width && 
          tileY >= 0 && tileY < this.tileMap.height) {
        
        const tile = this.tileMap.tiles[tileY][tileX];
        if (tile && tile.type !== newTileType) {
          tile.type = newTileType;
          capturedTiles.push({
            x: tileX,
            y: tileY,
            worldX: tile.worldX,
            worldY: tile.worldY
          });
        }
      }
    });
    
    return capturedTiles;
  }

  /**
   * Calculate Manhattan distances from ALL tiles to enemy nexuses
   */
  calculateManhattanDistances() {
    const width = this.tileMap.width;
    const height = this.tileMap.height;
    
    // Initialize arrays
    this.manhattanScores.green = Array(height).fill(null).map(() => Array(width).fill(0));
    this.manhattanScores.gray = Array(height).fill(null).map(() => Array(width).fill(0));
    
    // Calculate Manhattan distance from every tile to enemy nexus
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Green team targets dark nexus
        this.manhattanScores.green[y][x] = Math.abs(x - GameConfig.NEXUS.DARK_NEXUS.TILE_X) + 
                                          Math.abs(y - GameConfig.NEXUS.DARK_NEXUS.TILE_Y);
        
        // Gray team targets light nexus  
        this.manhattanScores.gray[y][x] = Math.abs(x - GameConfig.NEXUS.LIGHT_NEXUS.TILE_X) + 
                                         Math.abs(y - GameConfig.NEXUS.LIGHT_NEXUS.TILE_Y);
      }
    }
  }


  /**
   * Calculate the L-shaped tunnel path 
   * Dark souls: DOWN then LEFT
   * Light souls: UP then RIGHT
   */
  calculateTunnelPath(startX, startY, endX, endY) {
    const tunnelTiles = new Set();
    const tunnelWidth = GameConfig.NEXUS.TUNNEL_WIDTH;
    const halfWidth = Math.floor(tunnelWidth / 2);
    
    // Create L-shaped path: vertical first, then horizontal
    
    // 1. VERTICAL PATH (DOWN for dark, UP for light)
    const verticalStart = Math.min(startY, endY);
    const verticalEnd = Math.max(startY, endY);
    
    for (let y = verticalStart; y <= verticalEnd; y++) {
      for (let offsetX = -halfWidth; offsetX <= halfWidth; offsetX++) {
        const tileX = startX + offsetX;
        const tileY = y;
        if (tileX >= 0 && tileX < this.tileMap.width && 
            tileY >= 0 && tileY < this.tileMap.height) {
          tunnelTiles.add(`${tileX},${tileY}`);
        }
      }
    }
    
    // 2. HORIZONTAL PATH (LEFT for dark, RIGHT for light)
    const horizontalStart = Math.min(startX, endX);
    const horizontalEnd = Math.max(startX, endX);
    
    for (let x = horizontalStart; x <= horizontalEnd; x++) {
      for (let offsetY = -halfWidth; offsetY <= halfWidth; offsetY++) {
        const tileX = x;
        const tileY = endY + offsetY;
        if (tileX >= 0 && tileX < this.tileMap.width && 
            tileY >= 0 && tileY < this.tileMap.height) {
          tunnelTiles.add(`${tileX},${tileY}`);
        }
      }
    }
    
    return tunnelTiles;
  }

  /**
   * Check if a tile is on the tunnel path
   */
  isTileOnTunnelPath(x, y, tunnelTiles) {
    return tunnelTiles.has(`${x},${y}`);
  }

  /**
   * Get pre-calculated tile score
   */


}

module.exports = SpellSystem;
