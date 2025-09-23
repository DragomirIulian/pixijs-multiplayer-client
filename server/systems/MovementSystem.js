const GameConfig = require('../config/gameConfig');
const { SoulStates } = require('../entities/SoulStateMachine');

/**
 * Movement System
 * Handles movement logic for souls based on their current state
 */
class MovementSystem {
  constructor(tileMap) {
    this.tileMap = tileMap;
    
    // Border scoring matrices for team-specific path finding
    this.borderScores = {
      green: [], // Light team scores (top+left border)
      gray: []   // Dark team scores (right+bottom border)
    };
    
    // Border rectangle coordinates
    this.borderRect = {
      left: 0,
      top: 0, 
      right: 0,
      bottom: 0
    };
    
    this.calculateBorderScoring();
  }

  updateSoul(soul, allSouls, energyOrbs, movementMultiplier = 1.0) {
    if (!soul) return;

    const soulState = soul.getCurrentState();
    
    // Handle special states first
    if (soulState === SoulStates.MATING) {
      // Mating souls should move toward their partner if too far apart
      this.handleMatingMovement(soul, allSouls, movementMultiplier);
      this.applyMovement(soul);
      return;
    }

    // Only allow movement for specific states
    const movementAllowedStates = [
      SoulStates.ROAMING,
      SoulStates.HUNGRY, 
      SoulStates.SEEKING,
      SoulStates.DEFENDING  // Moving toward enemy to attack
      // ATTACKING state not included - souls should stop moving when attacking
    ];
    
    if (!movementAllowedStates.includes(soulState)) {
      // Stop movement for all other states (PREPARING, CASTING, etc.)
      soul.setVelocity(0, 0);
      return;
    }

    let moveTarget = null;
    let movementType = 'wander';
    let speed = GameConfig.SOUL.MOVEMENT_SPEED * movementMultiplier;

    switch (soulState) {
      case SoulStates.DEFENDING:
        moveTarget = this.getDefenseTarget(soul, allSouls);
        movementType = 'defend';
        speed = GameConfig.SOUL.MOVEMENT_SPEED * GameConfig.SOUL.DEFEND_SPEED_MULTIPLIER * movementMultiplier;
        // Check if close enough to stop and attack
        if (moveTarget && this.isCloseEnoughToAttack(soul, moveTarget)) {
          soul.setVelocity(0, 0);
          return;
        }
        // Use smarter movement for defending
        if (moveTarget) {
          this.moveTowardsTargetSmart(soul, moveTarget, speed);
          this.applyMovement(soul);
          return; // Skip normal movement logic
        }
        break;

      case SoulStates.HUNGRY:
        moveTarget = this.findNearestEnergyOrb(soul, energyOrbs);
        movementType = 'energy';
        break;

      case SoulStates.SEEKING:
        moveTarget = this.getMovementTarget(soul);
        if (!moveTarget) {
          // If no movement target, move toward enemy nexus
          moveTarget = this.getNexusTarget(soul);
        }
        movementType = 'seek';
        break;

      case SoulStates.ATTACKING_NEXUS:
        moveTarget = this.getNexusTarget(soul);
        movementType = 'nexus_attack';
        break;

      case SoulStates.ROAMING:
        if (soul.isRetreating) {
          moveTarget = this.getRetreatTarget(soul, allSouls);
          movementType = 'retreat';
        }
        break;
    }

    // Apply movement based on target
    if (moveTarget) {
      this.moveTowardsTarget(soul, moveTarget, speed);
    } else {
      this.wanderRandomly(soul);
    }

    // Apply movement with collision and boundary checks
    this.applyMovement(soul);
  }

  handleCollisions(allSouls) {
    const processedPairs = new Set();

    allSouls.forEach(soul => {
      allSouls.forEach(otherSoul => {
        if (soul.id === otherSoul.id) return;
        
        // Avoid processing the same pair twice
        const pairKey = [soul.id, otherSoul.id].sort().join('-');
        if (processedPairs.has(pairKey)) return;
        processedPairs.add(pairKey);

        const distance = soul.getDistanceTo(otherSoul);
        
        if (distance < GameConfig.SOUL.COLLISION_RADIUS && distance > 0) {
          this.separateSouls(soul, otherSoul, distance);
        }
      });
    });
  }

  separateSouls(soul1, soul2, distance) {
    const overlap = GameConfig.SOUL.COLLISION_RADIUS - distance;
    const separationForce = overlap * GameConfig.SOUL.SEPARATION_FORCE;
    
    const dx = soul1.x - soul2.x;
    const dy = soul1.y - soul2.y;
    const separationX = (dx / distance) * separationForce;
    const separationY = (dy / distance) * separationForce;

    // Calculate potential new positions
    const newSoul1X = soul1.x + separationX;
    const newSoul1Y = soul1.y + separationY;
    const newSoul2X = soul2.x - separationX;
    const newSoul2Y = soul2.y - separationY;

    // Apply separation with position validation
    if (this.isValidPosition(newSoul1X, newSoul1Y, soul1.getTeamType())) {
      soul1.x = newSoul1X;
      soul1.y = newSoul1Y;
    } else {
      // Add random movement to break stuck state
      soul1.vx += (Math.random() - 0.5) * GameConfig.SOUL.RANDOM_MOVEMENT_FORCE;
      soul1.vy += (Math.random() - 0.5) * GameConfig.SOUL.RANDOM_MOVEMENT_FORCE;
    }

    if (this.isValidPosition(newSoul2X, newSoul2Y, soul2.getTeamType())) {
      soul2.x = newSoul2X;
      soul2.y = newSoul2Y;
    } else {
      // Add random movement to break stuck state
      soul2.vx += (Math.random() - 0.5) * GameConfig.SOUL.RANDOM_MOVEMENT_FORCE;
      soul2.vy += (Math.random() - 0.5) * GameConfig.SOUL.RANDOM_MOVEMENT_FORCE;
    }
  }

  getDefenseTarget(soul, allSouls) {
    if (!soul.defendingTarget) return null;

    const enemy = allSouls.get(soul.defendingTarget);
    if (!enemy || (!enemy.isCasting && !enemy.isPreparing)) {
      // Enemy no longer casting, stop defending
      soul.stopDefending();
      return null;
    }

    return { x: enemy.x, y: enemy.y };
  }

  findNearestEnergyOrb(soul, energyOrbs) {
    let nearestOrb = null;
    let nearestDistance = GameConfig.SOUL.SEARCH_RADIUS;

    energyOrbs.forEach(orb => {
      if (orb.respawnTime <= Date.now() && orb.teamType === soul.getTeamType()) {
        const distance = soul.getDistanceTo(orb);
        
        if (distance < nearestDistance && this.isOrbInTerritory(orb, soul.getTeamType())) {
          nearestDistance = distance;
          nearestOrb = orb;
        }
      }
    });

    return nearestOrb;
  }

  findNearestEnemyTile(soul) {
    if (!this.tileMap || !soul) return null;

    const teamType = soul.teamType;
    
    // Find the HIGHEST scoring tile on the entire map
    let highestScoringTile = this.findHighestScoringTileOnMap(teamType);
    if (!highestScoringTile) {
      return null;
    }
    
    // Check if soul can cast on the highest scoring tile (within spell range)
    const distanceToHighestTile = Math.sqrt(
      Math.pow(soul.x - highestScoringTile.worldX, 2) + 
      Math.pow(soul.y - highestScoringTile.worldY, 2)
    );
    
    if (distanceToHighestTile <= GameConfig.SOUL.SPELL_RANGE) {
      // Can cast on highest scoring tile - return it as CAST target
      return {
        x: highestScoringTile.worldX,
        y: highestScoringTile.worldY,
        isCastTarget: true
      };
    }
    
    // Cannot cast yet - return NULL so soul doesn't think it can cast
    // Movement will be handled separately by getMovementTarget()
    return null;
  }
  
  /**
   * Get movement target for souls (separate from cast target)
   */
  getMovementTarget(soul) {
    const teamType = soul.teamType;
    
    // Find the HIGHEST scoring tile on the entire map
    let highestScoringTile = this.findHighestScoringTileOnMap(teamType);
    if (!highestScoringTile) {
      return null;
    }
    
    // Move toward highest scoring tile using border path
    return this.findBorderPathTowardsTarget(soul, highestScoringTile);
  }
  
  
  /**
   * Find the highest scoring tile on the entire map for a team
   */
  findHighestScoringTileOnMap(teamType) {
    let bestTile = null;
    let bestScore = 0;
    
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const score = this.borderScores[teamType][y][x];
        if (score > bestScore) {
          bestScore = score;
          bestTile = {
            tileX: x,
            tileY: y,
            worldX: x * this.tileMap.tileWidth + this.tileMap.tileWidth / 2,
            worldY: y * this.tileMap.tileHeight + this.tileMap.tileHeight / 2,
            score: score
          };
        }
      }
    }
    
    return bestTile;
  }

  /**
   * Find border path movement toward specific target tile
   * First get to border, then move toward target
   */
  findBorderPathTowardsTarget(soul, targetTile) {
    const teamType = soul.teamType;
    const soulTileX = Math.floor(soul.x / this.tileMap.tileWidth);
    const soulTileY = Math.floor(soul.y / this.tileMap.tileHeight);
    
    // Step 1: Check if soul is on their assigned border
    if (!this.isOnAssignedBorderPath(soulTileX, soulTileY, teamType)) {
      // Not on border - move to closest border entry
      return this.findClosestBorderEntry(soul);
    }
    
    // Step 2: Soul is on border - move step by step toward target
    // Check all 4 directions and pick the one that gets closer to target while staying on border
    const directions = [
      { x: soulTileX + 1, y: soulTileY, name: 'right' },
      { x: soulTileX - 1, y: soulTileY, name: 'left' },
      { x: soulTileX, y: soulTileY + 1, name: 'down' },
      { x: soulTileX, y: soulTileY - 1, name: 'up' }
    ];
    
    let bestMove = null;
    let bestDistance = Infinity;
    
    for (const dir of directions) {
      // Check if this move stays on assigned border
      if (this.isOnAssignedBorderPath(dir.x, dir.y, teamType)) {
        // Calculate distance to target
        const distanceToTarget = Math.abs(dir.x - targetTile.tileX) + Math.abs(dir.y - targetTile.tileY);
        
        if (distanceToTarget < bestDistance) {
          bestDistance = distanceToTarget;
          bestMove = dir;
        }
      }
    }
    
    if (bestMove) {
      return {
        x: bestMove.x * this.tileMap.tileWidth + this.tileMap.tileWidth / 2,
        y: bestMove.y * this.tileMap.tileHeight + this.tileMap.tileHeight / 2
      };
    }
    
    // Fallback - stay in place
    return {
      x: soul.x,
      y: soul.y
    };
  }


  /**
   * Find movement target that follows the rectangle border path
   */
  findBorderPathMovementTarget(soul) {
    const teamType = soul.teamType;
    const soulTileX = Math.floor(soul.x / this.tileMap.tileWidth);
    const soulTileY = Math.floor(soul.y / this.tileMap.tileHeight);
    
    // Step 1: Check if soul is already on their assigned border path
    const isOnAssignedBorder = this.isOnAssignedBorderPath(soulTileX, soulTileY, teamType);
    
    if (isOnAssignedBorder) {
      // Step 2: Soul is on border - move along it toward highest scoring area
      return this.findNextBorderStepTowardHighestScore(soul);
    } else {
      // Step 3: Soul is not on border - move to closest point on assigned border
      return this.findClosestBorderEntry(soul);
    }
  }
  
  /**
   * Check if soul is on their team's assigned border path
   */
  isOnAssignedBorderPath(x, y, teamType) {
    // Check if within border rectangle at all
    if (x < this.borderRect.left || x > this.borderRect.right ||
        y < this.borderRect.top || y > this.borderRect.bottom) {
      return false;
    }
    
    // Check if on team's assigned border sides
    if (teamType === 'green') {
      const isOnTopBorder = (y <= this.borderRect.top + this.borderWidthY);
      const isOnLeftBorder = (x <= this.borderRect.left + this.borderWidthX);
      return isOnTopBorder || isOnLeftBorder;
    } else {
      const isOnRightBorder = (x >= this.borderRect.right - this.borderWidthX);
      const isOnBottomBorder = (y >= this.borderRect.bottom - this.borderWidthY);
      return isOnRightBorder || isOnBottomBorder;
    }
  }
  
  /**
   * Find next step along border toward highest scoring area
   */
  findNextBorderStepTowardHighestScore(soul) {
    const teamType = soul.teamType;
    
    // Find the highest scoring tile on the whole map for this team
    let bestTileX = null, bestTileY = null, bestScore = 0;
    
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const score = this.borderScores[teamType][y][x];
        if (score > bestScore) {
          bestScore = score;
          bestTileX = x;
          bestTileY = y;
        }
      }
    }
    
    if (!bestTileX || !bestTileY) {
      return this.findClosestBorderEntry(soul); // Fallback
    }
    
    // Move along border toward the highest scoring area
    const soulTileX = Math.floor(soul.x / this.tileMap.tileWidth);
    const soulTileY = Math.floor(soul.y / this.tileMap.tileHeight);
    
    let targetX = soulTileX;
    let targetY = soulTileY;
    
    if (teamType === 'green') {
      // Light team follows top and left borders
      // Move toward the highest scoring tile while staying on assigned borders
      if (bestTileX < soulTileX && this.isOnAssignedBorderPath(soulTileX - 1, soulTileY, teamType)) {
        targetX = soulTileX - 1; // Move left along border
      } else if (bestTileX > soulTileX && this.isOnAssignedBorderPath(soulTileX + 1, soulTileY, teamType)) {
        targetX = soulTileX + 1; // Move right along border
      } else if (bestTileY < soulTileY && this.isOnAssignedBorderPath(soulTileX, soulTileY - 1, teamType)) {
        targetY = soulTileY - 1; // Move up along border
      } else if (bestTileY > soulTileY && this.isOnAssignedBorderPath(soulTileX, soulTileY + 1, teamType)) {
        targetY = soulTileY + 1; // Move down along border
      }
    } else {
      // Dark team follows right and bottom borders
      if (bestTileX < soulTileX && this.isOnAssignedBorderPath(soulTileX - 1, soulTileY, teamType)) {
        targetX = soulTileX - 1; // Move left along border
      } else if (bestTileX > soulTileX && this.isOnAssignedBorderPath(soulTileX + 1, soulTileY, teamType)) {
        targetX = soulTileX + 1; // Move right along border
      } else if (bestTileY < soulTileY && this.isOnAssignedBorderPath(soulTileX, soulTileY - 1, teamType)) {
        targetY = soulTileY - 1; // Move up along border
      } else if (bestTileY > soulTileY && this.isOnAssignedBorderPath(soulTileX, soulTileY + 1, teamType)) {
        targetY = soulTileY + 1; // Move down along border
      }
    }
    
    return {
      x: targetX * this.tileMap.tileWidth + this.tileMap.tileWidth / 2,
      y: targetY * this.tileMap.tileHeight + this.tileMap.tileHeight / 2
    };
  }
  
  /**
   * Find closest entry point to team's assigned border
   */
  findClosestBorderEntry(soul) {
    const teamType = soul.teamType;
    const soulTileX = Math.floor(soul.x / this.tileMap.tileWidth);
    const soulTileY = Math.floor(soul.y / this.tileMap.tileHeight);
    
    let targetX, targetY;
    
    if (teamType === 'green') {
      // Light team: move to closest point on top or left border
      const distToTop = Math.abs(soulTileY - this.borderRect.top);
      const distToLeft = Math.abs(soulTileX - this.borderRect.left);
      
      if (distToTop < distToLeft) {
        // Move to top border
        targetX = soulTileX;
        targetY = this.borderRect.top;
      } else {
        // Move to left border
        targetX = this.borderRect.left;
        targetY = soulTileY;
      }
    } else {
      // Dark team: move to closest point on right or bottom border
      const distToBottom = Math.abs(soulTileY - this.borderRect.bottom);
      const distToRight = Math.abs(soulTileX - this.borderRect.right);
      
      if (distToBottom < distToRight) {
        // Move to bottom border
        targetX = soulTileX;
        targetY = this.borderRect.bottom;
      } else {
        // Move to right border
        targetX = this.borderRect.right;
        targetY = soulTileY;
      }
    }
    
    // Ensure target is within map bounds
    targetX = Math.max(0, Math.min(this.tileMap.width - 1, targetX));
    targetY = Math.max(0, Math.min(this.tileMap.height - 1, targetY));
    
    return {
      x: targetX * this.tileMap.tileWidth + this.tileMap.tileWidth / 2,
      y: targetY * this.tileMap.tileHeight + this.tileMap.tileHeight / 2
    };
  }

  /**
   * Check if a tile has adjacent friendly tiles
   */
  hasAdjacentFriendlyTile(tileX, tileY, teamType) {
    const adjacentOffsets = [
      [-1, 0], [1, 0], [0, -1], [0, 1] // left, right, up, down
    ];
    
    for (const [dx, dy] of adjacentOffsets) {
      const checkX = tileX + dx;
      const checkY = tileY + dy;
      
      if (checkX >= 0 && checkX < this.tileMap.width && 
          checkY >= 0 && checkY < this.tileMap.height) {
        const adjacentTile = this.tileMap.tiles[checkY][checkX];
        if (adjacentTile && adjacentTile.type === teamType) {
          return true;
        }
      }
    }
    return false;
  }

  isCloseEnoughToAttack(soul, target) {
    const dx = target.x - soul.x;
    const dy = target.y - soul.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= GameConfig.SOUL.ATTACK_RANGE;
  }

  getRetreatTarget(soul, allSouls) {
    const enemies = Array.from(allSouls.values()).filter(other => soul.isEnemy(other));
    
    if (enemies.length === 0) return null;

    // Calculate direction away from nearest enemies
    let avoidX = 0;
    let avoidY = 0;
    
    enemies.forEach(enemy => {
      const dx = soul.x - enemy.x;
      const dy = soul.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0 && distance < GameConfig.SOUL.RETREAT_DISTANCE_THRESHOLD) {
        avoidX += dx / distance;
        avoidY += dy / distance;
      }
    });

    if (avoidX !== 0 || avoidY !== 0) {
      const magnitude = Math.sqrt(avoidX * avoidX + avoidY * avoidY);
      return {
        x: soul.x + (avoidX / magnitude) * GameConfig.SOUL.RETREAT_FORCE_DISTANCE,
        y: soul.y + (avoidY / magnitude) * GameConfig.SOUL.RETREAT_FORCE_DISTANCE
      };
    }

    return null;
  }

  moveTowardsTarget(soul, target, speed) {
    const dx = target.x - soul.x;
    const dy = target.y - soul.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      soul.setVelocity(
        (dx / distance) * speed,
        (dy / distance) * speed
      );
    }
  }

  moveTowardsTargetSmart(soul, target, speed) {
    const dx = target.x - soul.x;
    const dy = target.y - soul.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const attackRange = GameConfig.SOUL.ATTACK_RANGE;
    const barrierDistance = GameConfig.TERRITORY.BARRIER_DISTANCE;
    
    // Calculate the closest position to target while staying in our territory
    const borderX = this.getBorderPosition(soul.getTeamType());
    
    // If target is across the border, move to the border edge position
    let targetX = target.x;
    let targetY = target.y;
    
    if (soul.getTeamType() === 'green' && target.x > borderX) {
      // Green soul defending - get as close to border as allowed by barrier distance
      targetX = borderX - barrierDistance;
    } else if (soul.getTeamType() === 'gray' && target.x < borderX) {
      // Gray soul defending - get as close to border as allowed by barrier distance
      targetX = borderX + barrierDistance;
    }
    
    // Recalculate distances to adjusted target
    const finalDx = targetX - soul.x;
    const finalDy = targetY - soul.y;
    const finalAbsDx = Math.abs(finalDx);
    const finalAbsDy = Math.abs(finalDy);
    
    // Use direct movement with collision avoidance instead of axis-by-axis
    const finalDistance = Math.sqrt(finalDx * finalDx + finalDy * finalDy);
    
    if (finalDistance > 10) {
      // Move directly towards target, normalized
      soul.setVelocity(
        (finalDx / finalDistance) * speed,
        (finalDy / finalDistance) * speed
      );
    } else {
      // Close enough - stop
      soul.setVelocity(0, 0);
    }
  }

  getBorderPosition(teamType) {
    if (!this.tileMap) return GameConfig.WORLD.WIDTH / 2;
    
    // Find the actual border by scanning tiles
    const oppositeType = teamType === 'green' ? 'gray' : 'green';
    
    // Scan from the center outward to find the border
    const centerY = Math.floor(this.tileMap.height / 2);
    
    if (teamType === 'green') {
      // For green team, find the rightmost green tile
      for (let x = this.tileMap.width - 1; x >= 0; x--) {
        const tile = this.tileMap.tiles[centerY][x];
        if (tile.type === 'green') {
          return tile.worldX + this.tileMap.tileWidth; // Right edge of rightmost green tile
        }
      }
    } else {
      // For gray team, find the leftmost gray tile
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[centerY][x];
        if (tile.type === 'gray') {
          return tile.worldX; // Left edge of leftmost gray tile
        }
      }
    }
    
    // Fallback to center
    return GameConfig.WORLD.WIDTH / 2;
  }

  wanderRandomly(soul) {
    soul.vx += (Math.random() - 0.5) * GameConfig.SOUL.WANDER_FORCE;
    soul.vy += (Math.random() - 0.5) * GameConfig.SOUL.WANDER_FORCE;

    // Limit velocity
    const maxSpeed = GameConfig.SOUL.MOVEMENT_SPEED;
    const currentSpeed = Math.sqrt(soul.vx * soul.vx + soul.vy * soul.vy);
    if (currentSpeed > maxSpeed) {
      soul.vx = (soul.vx / currentSpeed) * maxSpeed;
      soul.vy = (soul.vy / currentSpeed) * maxSpeed;
    }
  }

  applyMovement(soul) {
    const newX = soul.x + soul.vx;
    const newY = soul.y + soul.vy;

    // Check if the new position is valid
    if (this.isValidPosition(newX, newY, soul.getTeamType())) {
      soul.x = newX;
      soul.y = newY;
    } else {
      // Handle collision by pushing away from barriers
      this.handleCollision(soul);
    }

    // Check world boundary collisions
    this.handleWorldBoundaries(soul);
  }

  isValidPosition(x, y, teamType) {
    if (!this.tileMap) return true;

    // Check world bounds
    if (x < GameConfig.WORLD.BOUNDARY_BUFFER || 
        x > GameConfig.WORLD.WIDTH - GameConfig.WORLD.BOUNDARY_BUFFER ||
        y < GameConfig.WORLD.BOUNDARY_BUFFER || 
        y > GameConfig.WORLD.HEIGHT - GameConfig.WORLD.BOUNDARY_BUFFER) {
      return false;
    }

    // Check tile bounds
    const tileX = Math.floor(x / this.tileMap.tileWidth);
    const tileY = Math.floor(y / this.tileMap.tileHeight);

    if (tileX < 0 || tileX >= this.tileMap.width || tileY < 0 || tileY >= this.tileMap.height) {
      return false;
    }

    // Check if tile belongs to character's team
    const tile = this.tileMap.tiles[tileY][tileX];
    if (tile.type !== teamType) {
      return false;
    }

    // Check barrier distance from enemy territory
    const opponentTileType = teamType === 'green' ? 'gray' : 'green';

    // Check surrounding area for enemy tiles
    for (let checkY = Math.max(0, tileY - GameConfig.TERRITORY.CHECK_RADIUS); 
         checkY <= Math.min(this.tileMap.height - 1, tileY + GameConfig.TERRITORY.CHECK_RADIUS); 
         checkY++) {
      for (let checkX = Math.max(0, tileX - GameConfig.TERRITORY.CHECK_RADIUS); 
           checkX <= Math.min(this.tileMap.width - 1, tileX + GameConfig.TERRITORY.CHECK_RADIUS); 
           checkX++) {
        const checkTile = this.tileMap.tiles[checkY][checkX];
        if (checkTile.type === opponentTileType) {
          const tileWorldX = checkTile.worldX + this.tileMap.tileWidth / 2;
          const tileWorldY = checkTile.worldY + this.tileMap.tileHeight / 2;
          const distanceToEnemyTile = Math.sqrt((x - tileWorldX) ** 2 + (y - tileWorldY) ** 2);

          if (distanceToEnemyTile < GameConfig.TERRITORY.BARRIER_DISTANCE) {
            return false;
          }
        }
      }
    }

    return true;
  }

  isOrbInTerritory(orb, teamType) {
    if (!this.tileMap) return true;

    const orbTileX = Math.floor(orb.x / this.tileMap.tileWidth);
    const orbTileY = Math.floor(orb.y / this.tileMap.tileHeight);

    if (orbTileX >= 0 && orbTileX < this.tileMap.width && 
        orbTileY >= 0 && orbTileY < this.tileMap.height) {
      const orbTile = this.tileMap.tiles[orbTileY][orbTileX];
      return orbTile.type === teamType;
    }

    return false;
  }

  handleCollision(soul) {
    if (!this.tileMap) {
      // Fallback: reverse and reduce velocity
      soul.vx *= -0.8;
      soul.vy *= -0.8;
      return;
    }

    const currentTileX = Math.floor(soul.x / this.tileMap.tileWidth);
    const currentTileY = Math.floor(soul.y / this.tileMap.tileHeight);
    const opponentTileType = soul.getTeamType() === 'green' ? 'gray' : 'green';

    // Find direction away from nearest enemy territory
    let pushX = 0;
    let pushY = 0;
    let enemyTileCount = 0;

    // Check surrounding area for enemy tiles and calculate repulsion vector
    for (let checkY = Math.max(0, currentTileY - 2); 
         checkY <= Math.min(this.tileMap.height - 1, currentTileY + 2); 
         checkY++) {
      for (let checkX = Math.max(0, currentTileX - 2); 
           checkX <= Math.min(this.tileMap.width - 1, currentTileX + 2); 
           checkX++) {
        const checkTile = this.tileMap.tiles[checkY][checkX];
        if (checkTile.type === opponentTileType) {
          const tileWorldX = checkTile.worldX + this.tileMap.tileWidth / 2;
          const tileWorldY = checkTile.worldY + this.tileMap.tileHeight / 2;
          const dx = soul.x - tileWorldX;
          const dy = soul.y - tileWorldY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0) {
            // Add repulsion force (stronger when closer)
            const force = 100 / (distance + 10);
            pushX += (dx / distance) * force;
            pushY += (dy / distance) * force;
            enemyTileCount++;
          }
        }
      }
    }

    if (enemyTileCount > 0) {
      // Normalize and apply push force
      const pushMagnitude = Math.sqrt(pushX * pushX + pushY * pushY);
      if (pushMagnitude > 0) {
        soul.setVelocity(
          (pushX / pushMagnitude) * GameConfig.SOUL.MOVEMENT_SPEED * 0.8,
          (pushY / pushMagnitude) * GameConfig.SOUL.MOVEMENT_SPEED * 0.8
        );
      }
    } else {
      // Fallback: reverse and reduce velocity
      soul.vx *= -0.8;
      soul.vy *= -0.8;
    }
  }

  handleWorldBoundaries(soul) {
    if (soul.x < GameConfig.WORLD.BOUNDARY_BUFFER || 
        soul.x > GameConfig.WORLD.WIDTH - GameConfig.WORLD.BOUNDARY_BUFFER) {
      soul.vx *= -1;
      soul.x = Math.max(GameConfig.WORLD.BOUNDARY_BUFFER, 
                       Math.min(GameConfig.WORLD.WIDTH - GameConfig.WORLD.BOUNDARY_BUFFER, soul.x));
    }

    if (soul.y < GameConfig.WORLD.BOUNDARY_BUFFER || 
        soul.y > GameConfig.WORLD.HEIGHT - GameConfig.WORLD.BOUNDARY_BUFFER) {
      soul.vy *= -1;
      soul.y = Math.max(GameConfig.WORLD.BOUNDARY_BUFFER, 
                       Math.min(GameConfig.WORLD.HEIGHT - GameConfig.WORLD.BOUNDARY_BUFFER, soul.y));
    }
  }

  handleMatingMovement(soul, allSouls, movementMultiplier = 1.0) {
    // If soul is mating and has a partner, move toward the partner if too far apart
    if (!soul.matingPartner) {
      // No partner, stop moving
      soul.setVelocity(0, 0);
      return;
    }

    const partner = soul.matingPartner;
    const distance = soul.getDistanceTo(partner);
    const matingRange = GameConfig.MATING.MATING_RANGE;

    if (distance > matingRange * 0.7) {
      // Too far from partner - move closer
      const dx = partner.x - soul.x;
      const dy = partner.y - soul.y;
      const speed = GameConfig.SOUL.MOVEMENT_SPEED * 0.5 * movementMultiplier; // Slower speed for mating
      
      // Normalize and apply movement
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;
      
      soul.setVelocity(
        normalizedDx * speed,
        normalizedDy * speed
      );
    } else if (distance < matingRange * 0.3) {
      // Too close - move away slightly
      const dx = soul.x - partner.x;
      const dy = soul.y - partner.y;
      const speed = GameConfig.SOUL.MOVEMENT_SPEED * 0.2 * movementMultiplier; // Very slow
      
      // Normalize and apply movement
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;
      
      soul.setVelocity(
        normalizedDx * speed,
        normalizedDy * speed
      );
    } else {
      // Perfect distance - stay still with small floating movement
      soul.setVelocity(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      );
    }
  }

  /**
   * Get enemy nexus position as movement target
   */
  getNexusTarget(soul) {
    if (!this.tileMap) return null;
    
    const enemyNexusPos = soul.type === 'dark-soul' ? 
      GameConfig.NEXUS.LIGHT_NEXUS : GameConfig.NEXUS.DARK_NEXUS;
    
    const nexusWorldX = enemyNexusPos.TILE_X * this.tileMap.tileWidth + (this.tileMap.tileWidth / 2);
    const nexusWorldY = enemyNexusPos.TILE_Y * this.tileMap.tileHeight + (this.tileMap.tileHeight / 2);
    
    return { x: nexusWorldX, y: nexusWorldY };
  }

  /**
   * Calculate border-based scoring system for team-specific pathfinding
   */
  calculateBorderScoring() {
    const width = this.tileMap.width;
    const height = this.tileMap.height;
    const borderWidth = GameConfig.NEXUS.BORDER_WIDTH;
    
    // Define border rectangle with nexuses on opposite corners
    const lightNexus = GameConfig.NEXUS.LIGHT_NEXUS;  // Bottom-left nexus
    const darkNexus = GameConfig.NEXUS.DARK_NEXUS;    // Top-right nexus
    
    // Calculate border width based on 100 pixels divided by tile dimensions
    const borderWidthX = Math.ceil(100 / this.tileMap.tileWidth);  // Horizontal border width in tiles
    const borderWidthY = Math.ceil(100 / this.tileMap.tileHeight); // Vertical border width in tiles
    
    // Create rectangle with nexuses sitting in the MIDDLE of the border width
    const halfBorderX = Math.floor(borderWidthX / 2);
    const halfBorderY = Math.floor(borderWidthY / 2);
    
    this.borderRect = {
      left: lightNexus.TILE_X - halfBorderX,     // Light nexus in middle of left border
      top: darkNexus.TILE_Y - halfBorderY,      // Dark nexus in middle of top border
      right: darkNexus.TILE_X + halfBorderX,    // Dark nexus in middle of right border
      bottom: lightNexus.TILE_Y + halfBorderY   // Light nexus in middle of bottom border
    };
    
    // Store border dimensions for later use
    this.borderWidthX = borderWidthX;
    this.borderWidthY = borderWidthY;
    
    // Initialize arrays
    this.borderScores.green = Array(height).fill(null).map(() => Array(width).fill(0));
    this.borderScores.gray = Array(height).fill(null).map(() => Array(width).fill(0));
    
    // Calculate scores for each tile
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.borderScores.green[y][x] = this.calculateTileScore(x, y, 'green');
        this.borderScores.gray[y][x] = this.calculateTileScore(x, y, 'gray');
      }
    }
  }
  
  /**
   * Calculate score for a specific tile based on team rules
   */
  calculateTileScore(x, y, teamType) {
    // Outside border rectangle = 0 score
    if (x < this.borderRect.left || x > this.borderRect.right ||
        y < this.borderRect.top || y > this.borderRect.bottom) {
      return 0;
    }
    
    // Check if tile is owned by this team (0 score if owned)
    const tile = this.tileMap.tiles[y] && this.tileMap.tiles[y][x];
    if (tile && tile.type === teamType) {
      return 0;
    }
    
    // Team-specific border restrictions
    if (teamType === 'green') {
      // Light team: ONLY top and left sides of rectangle
      const isOnTopSide = (y <= this.borderRect.top + this.borderWidthY);
      const isOnLeftSide = (x <= this.borderRect.left + this.borderWidthX);
      
      if (!isOnTopSide && !isOnLeftSide) {
        return 0; // Not on light team's assigned sides
      }
    } else {
      // Dark team: ONLY right and bottom sides of rectangle  
      const isOnRightSide = (x >= this.borderRect.right - this.borderWidthX);
      const isOnBottomSide = (y >= this.borderRect.bottom - this.borderWidthY);
      
      if (!isOnRightSide && !isOnBottomSide) {
        return 0; // Not on dark team's assigned sides
      }
    }
    
    // Calculate Manhattan distance to enemy nexus
    const enemyNexus = teamType === 'green' ? GameConfig.NEXUS.DARK_NEXUS : GameConfig.NEXUS.LIGHT_NEXUS;
    const manhattanDistance = Math.abs(x - enemyNexus.TILE_X) + Math.abs(y - enemyNexus.TILE_Y);
    
    // Return Manhattan distance directly as score
    // Tiles NEAR enemy nexus have LOW scores, tiles FAR from enemy nexus have HIGH scores
    // Souls seek HIGHEST scores, so they'll prioritize tiles far from enemy nexus (closer to their own base)
    return manhattanDistance;
  }
  
  /**
   * Update border scores when a spell is successfully cast
   */
  updateBorderScores() {
    // Recalculate all scores since tile ownership changed
    const width = this.tileMap.width;
    const height = this.tileMap.height;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.borderScores.green[y][x] = this.calculateTileScore(x, y, 'green');
        this.borderScores.gray[y][x] = this.calculateTileScore(x, y, 'gray');
      }
    }
  }



}

module.exports = MovementSystem;



