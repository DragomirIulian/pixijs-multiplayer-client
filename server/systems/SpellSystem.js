const GameConfig = require('../config/gameConfig');
const { SoulStates } = require('../entities/SoulStateMachine');

/**
 * Spell System
 * Handles spell casting, preparation, and effects
 */
class SpellSystem {
  constructor(tileMap, dayNightSystem = null, movementSystem = null, scoringSystem = null) {
    this.tileMap = tileMap;
    this.dayNightSystem = dayNightSystem;
    this.movementSystem = movementSystem;
    this.scoringSystem = scoringSystem;
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
    
    // DOUBLE CHECK that tile isn't already targeted (race condition protection)
    const isAlreadyTargeted = Array.from(this.activeSpells.values()).some(spell => 
      spell.targetTile.x === targetTile.x && spell.targetTile.y === targetTile.y
    );
    if (isAlreadyTargeted) {
      return; // Abort - someone else already targeting this tile
    }
    
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
    const opponentType = soul.type === GameConfig.SOUL_TYPES.DARK ? GameConfig.TILE_TYPES.GREEN : GameConfig.TILE_TYPES.GRAY;
    const minDistance = GameConfig.SOUL.SPELL_MIN_DISTANCE;
    const maxDistance = GameConfig.SOUL.SPELL_RANGE;

    // Use fallback casting if soul has been seeking too long
    if (soul.shouldUseFallbackCasting) {
      return this.findAnyValidTarget(soul, opponentType, minDistance, maxDistance);
    }

    // First pass: Find available tiles (not already targeted) and prioritize them
    let availableTiles = [];
    let bestUnavailableTile = null;
    let bestUnavailableScore = 0;

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
            // Get Manhattan score for this tile
            const manhattanScore = this.scoringSystem.getManhattanScore(x, y, teamType);
            
            // Only consider tiles within the border rectangle (score > 0)
            if (manhattanScore > 0) {
              // Check if already being targeted
              const isAlreadyTargeted = Array.from(this.activeSpells.values()).some(spell => 
                spell.targetTile.x === tile.x && spell.targetTile.y === tile.y
              );
              
              if (!isAlreadyTargeted) {
                // This tile is available - add to available tiles list
                availableTiles.push({
                  tile: tile,
                  score: manhattanScore,
                  distance: distance
                });
              } else {
                // Track best unavailable tile as fallback
                if (manhattanScore > bestUnavailableScore) {
                  bestUnavailableScore = manhattanScore;
                  bestUnavailableTile = tile;
                }
              }
            }
          }
        }
      }
    }

    // If we have available tiles, select the best one
    if (availableTiles.length > 0) {
      // Sort by score (descending), then by distance (ascending) as tiebreaker
      availableTiles.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score; // Higher score wins
        }
        return a.distance - b.distance; // Closer distance wins for same score
      });
      
      return availableTiles[0].tile;
    }

    // No available tiles found - return the best unavailable tile (original behavior)
    // This allows souls to wait for high-value targets when all tiles are contested
    return bestUnavailableTile;
  }

  /**
   * Fallback method: find ANY valid target within range (not necessarily the best scoring)
   * Prioritizes available tiles over occupied ones, but is less picky about scores
   */
  findAnyValidTarget(soul, opponentType, minDistance, maxDistance) {
    const teamType = soul.teamType;
    let firstAvailableTile = null;
    let firstOccupiedTile = null;
    
    // Check ALL tiles on the map, but prioritize available tiles
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
            // Get score to ensure it's a valid target (score > 0)
            const score = this.scoringSystem.getManhattanScore(x, y, teamType);
            
            if (score > 0) {
              // Check if already being targeted
              const isAlreadyTargeted = Array.from(this.activeSpells.values()).some(spell => 
                spell.targetTile.x === tile.x && spell.targetTile.y === tile.y
              );
              
              if (!isAlreadyTargeted) {
                // Found an available tile - return immediately
                return tile;
              } else if (!firstOccupiedTile) {
                // Track first occupied tile as fallback
                firstOccupiedTile = tile;
              }
            }
          }
        }
      }
    }
    
    // Return occupied tile as last resort if no available tiles found
    return firstOccupiedTile;
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
   * Capture tiles in a 3x3 square (9 tiles total)
   * @param {Object} centerTile - The target tile of the spell
   * @param {string} newTileType - The team type to convert tiles to
   * @returns {Array} Array of captured tiles
   */
  captureTunnel(centerTile, newTileType) {
    const capturedTiles = [];
    
    // 3x3 square pattern: center + all 8 surrounding tiles
    const squarePattern = [
      { x: -1, y: -1 }, // Top-left
      { x: 0, y: -1 },  // Top-center
      { x: 1, y: -1 },  // Top-right
      { x: -1, y: 0 },  // Middle-left
      { x: 0, y: 0 },   // Center
      { x: 1, y: 0 },   // Middle-right
      { x: -1, y: 1 },  // Bottom-left
      { x: 0, y: 1 },   // Bottom-center
      { x: 1, y: 1 }    // Bottom-right
    ];
    
    squarePattern.forEach(offset => {
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
