const GameConfig = require('../config/gameConfig');
const { SoulStates } = require('../entities/SoulStateMachine');

/**
 * Movement System
 * Handles movement logic for souls based on their current state
 */
class MovementSystem {
  constructor(tileMap, scoringSystem) {
    this.tileMap = tileMap;
    this.scoringSystem = scoringSystem;
    // Track soul positions for stuck detection
    this.soulPositionHistory = new Map();
    this.stuckThreshold = 3; // How many updates to track for stuck detection
    this.stuckDistance = 20; // Distance threshold to consider soul stuck
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
    
    // Now that we have corner avoidance, move directly toward the highest scoring tile
    // The corner avoidance system will handle navigation around obstacles
    return {
      x: highestScoringTile.worldX,
      y: highestScoringTile.worldY
    };
  }
  
  
  /**
   * Find the highest scoring tile on the entire map for a team
   */
  findHighestScoringTileOnMap(teamType) {
    let bestTile = null;
    let bestScore = 0;
    
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const score = this.scoringSystem.getBorderScore(x, y, teamType);
        if (score > bestScore) {
          bestScore = score;
          bestTile = {
            tileX: x,
            tileY: teamType === GameConfig.TEAM_TYPES.LIGHT ? GameConfig.NEXUS.DARK_NEXUS.TILE_Y : GameConfig.NEXUS.LIGHT_NEXUS.TILE_Y,
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
    // Check if soul is stuck and use corner avoidance if needed
    if (this.isSoulStuck(soul)) {
      this.moveAroundCorner(soul, target, speed);
      return;
    }

    const dx = target.x - soul.x;
    const dy = target.y - soul.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Check if direct path is blocked
      if (this.isDirectPathBlocked(soul, target)) {
        this.moveAroundCorner(soul, target, speed);
      } else {
        soul.setVelocity(
          (dx / distance) * speed,
          (dy / distance) * speed
        );
      }
    }
  }

  moveTowardsTargetSmart(soul, target, speed) {
    // Check if soul is stuck and use corner avoidance if needed
    if (this.isSoulStuck(soul)) {
      this.moveAroundCorner(soul, target, speed);
      return;
    }

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
      // Check if direct path is blocked and use corner avoidance
      if (this.isDirectPathBlocked(soul, {x: targetX, y: targetY})) {
        this.moveAroundCorner(soul, {x: targetX, y: targetY}, speed);
      } else {
        // Move directly towards target, normalized
        soul.setVelocity(
          (finalDx / finalDistance) * speed,
          (finalDy / finalDistance) * speed
        );
      }
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
        if (tile.type === GameConfig.TILE_TYPES.GREEN) {
          return tile.worldX + this.tileMap.tileWidth; // Right edge of rightmost green tile
        }
      }
    } else {
      // For gray team, find the leftmost gray tile
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[centerY][x];
        if (tile.type === GameConfig.TILE_TYPES.GRAY) {
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

  /**
   * Corner Avoidance and Stuck Detection Methods
   */

  /**
   * Check if a soul is stuck by tracking its movement history
   */
  isSoulStuck(soul) {
    const soulId = soul.id;
    const currentTime = Date.now();
    const currentPos = { x: soul.x, y: soul.y, time: currentTime };

    // Initialize position history for this soul
    if (!this.soulPositionHistory.has(soulId)) {
      this.soulPositionHistory.set(soulId, []);
    }

    const history = this.soulPositionHistory.get(soulId);
    history.push(currentPos);

    // Keep only recent history
    const maxAge = 2000; // 2 seconds
    while (history.length > 0 && currentTime - history[0].time > maxAge) {
      history.shift();
    }

    // Need at least a few position samples to determine if stuck
    if (history.length < this.stuckThreshold) {
      return false;
    }

    // Check if soul has moved very little over the tracking period
    const oldestPos = history[0];
    const distance = Math.sqrt(
      Math.pow(currentPos.x - oldestPos.x, 2) + 
      Math.pow(currentPos.y - oldestPos.y, 2)
    );

    return distance < this.stuckDistance;
  }

  /**
   * Check if the direct path to target is blocked by invalid positions
   */
  isDirectPathBlocked(soul, target) {
    const steps = 5; // Number of points to check along the path
    const dx = target.x - soul.x;
    const dy = target.y - soul.y;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const checkX = soul.x + dx * t;
      const checkY = soul.y + dy * t;

      if (!this.isValidPosition(checkX, checkY, soul.getTeamType())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Navigate around corners using a wall-following algorithm
   */
  moveAroundCorner(soul, target, speed) {
    // First try tunnel-specific navigation if we're in a tunnel
    if (this.isSoulInTunnel(soul)) {
      if (this.navigateTunnel(soul, target, speed)) {
        return; // Successfully navigating tunnel
      }
    }

    // Try to find a valid direction that gets closer to target
    const directions = [
      { x: 1, y: 0, name: 'right' },   // East
      { x: 0, y: 1, name: 'down' },    // South  
      { x: -1, y: 0, name: 'left' },   // West
      { x: 0, y: -1, name: 'up' },     // North
      { x: 1, y: 1, name: 'southeast' },    // Southeast
      { x: -1, y: 1, name: 'southwest' },   // Southwest
      { x: 1, y: -1, name: 'northeast' },   // Northeast
      { x: -1, y: -1, name: 'northwest' }   // Northwest
    ];

    let bestDirection = null;
    let bestScore = -Infinity;

    const stepSize = 30; // How far to check in each direction

    for (const dir of directions) {
      const testX = soul.x + dir.x * stepSize;
      const testY = soul.y + dir.y * stepSize;

      // Check if this direction is valid
      if (this.isValidPosition(testX, testY, soul.getTeamType())) {
        // Calculate how much closer this gets us to target
        const currentDist = Math.sqrt(
          Math.pow(target.x - soul.x, 2) + 
          Math.pow(target.y - soul.y, 2)
        );
        const newDist = Math.sqrt(
          Math.pow(target.x - testX, 2) + 
          Math.pow(target.y - testY, 2)
        );
        
        // Score based on progress toward target
        const progress = currentDist - newDist;
        
        // Bonus for cardinal directions in tunnels (they're usually more effective)
        const cardinalBonus = (Math.abs(dir.x) + Math.abs(dir.y) === 1) ? 5 : 0;
        
        // Add some randomness to prevent infinite loops
        const randomBonus = (Math.random() - 0.5) * 5;
        const score = progress + cardinalBonus + randomBonus;

        if (score > bestScore) {
          bestScore = score;
          bestDirection = dir;
        }
      }
    }

    if (bestDirection) {
      // Move in the best direction found
      soul.setVelocity(
        bestDirection.x * speed,
        bestDirection.y * speed
      );
    } else {
      // All directions blocked - try random movement to escape
      this.escapeStuckPosition(soul, speed);
    }
  }

  /**
   * Check if soul is currently in a tunnel
   */
  isSoulInTunnel(soul) {
    const soulTileX = Math.floor(soul.x / this.tileMap.tileWidth);
    const soulTileY = Math.floor(soul.y / this.tileMap.tileHeight);
    
    // Check if we're in a narrow corridor (tunnel-like area)
    let openDirections = 0;
    const directions = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
    ];
    
    for (const dir of directions) {
      const checkX = soulTileX + dir.x;
      const checkY = soulTileY + dir.y;
      
      if (checkX >= 0 && checkX < this.tileMap.width && 
          checkY >= 0 && checkY < this.tileMap.height) {
        const tile = this.tileMap.tiles[checkY][checkX];
        if (tile && tile.type === soul.getTeamType()) {
          openDirections++;
        }
      }
    }
    
    // If only 2 or fewer directions are open, we're likely in a tunnel
    return openDirections <= 2;
  }

  /**
   * Special navigation logic for tunnel systems
   */
  navigateTunnel(soul, target, speed) {
    const soulTileX = Math.floor(soul.x / this.tileMap.tileWidth);
    const soulTileY = Math.floor(soul.y / this.tileMap.tileHeight);
    const targetTileX = Math.floor(target.x / this.tileMap.tileWidth);
    const targetTileY = Math.floor(target.y / this.tileMap.tileHeight);
    
    // In tunnels, prioritize movement along the main axis toward target
    const dx = targetTileX - soulTileX;
    const dy = targetTileY - soulTileY;
    
    let preferredDirection = null;
    
    // Choose primary direction based on which has larger distance
    if (Math.abs(dx) > Math.abs(dy)) {
      // Move horizontally first
      preferredDirection = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    } else {
      // Move vertically first  
      preferredDirection = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
    
    // Test if preferred direction is valid
    const testX = soul.x + preferredDirection.x * 30;
    const testY = soul.y + preferredDirection.y * 30;
    
    if (this.isValidPosition(testX, testY, soul.getTeamType())) {
      soul.setVelocity(
        preferredDirection.x * speed,
        preferredDirection.y * speed
      );
      return true;
    }
    
    // If preferred direction blocked, try the perpendicular direction
    const altDirection = Math.abs(dx) > Math.abs(dy) ? 
      (dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 }) :
      (dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    
    const altTestX = soul.x + altDirection.x * 30;
    const altTestY = soul.y + altDirection.y * 30;
    
    if (this.isValidPosition(altTestX, altTestY, soul.getTeamType())) {
      soul.setVelocity(
        altDirection.x * speed,
        altDirection.y * speed
      );
      return true;
    }
    
    return false; // Let general corner navigation handle it
  }

  /**
   * Emergency escape when completely stuck
   */
  escapeStuckPosition(soul, speed) {
    // Try random directions with increasing step sizes
    for (let stepSize = 20; stepSize <= 60; stepSize += 20) {
      for (let attempts = 0; attempts < 8; attempts++) {
        const angle = (Math.PI * 2 * attempts) / 8;
        const testX = soul.x + Math.cos(angle) * stepSize;
        const testY = soul.y + Math.sin(angle) * stepSize;

        if (this.isValidPosition(testX, testY, soul.getTeamType())) {
          soul.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
          );
          return;
        }
      }
    }

    // Last resort - small random movement
    soul.setVelocity(
      (Math.random() - 0.5) * speed * 0.5,
      (Math.random() - 0.5) * speed * 0.5
    );
  }

  /**
   * Clean up position history for dead or removed souls to prevent memory leaks
   */
  cleanupPositionHistory(aliveSoulIds) {
    const currentSoulIds = new Set(aliveSoulIds);
    
    for (const [soulId] of this.soulPositionHistory) {
      if (!currentSoulIds.has(soulId)) {
        this.soulPositionHistory.delete(soulId);
      }
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
    
    const enemyNexusPos = soul.type === GameConfig.SOUL_TYPES.DARK ? 
      GameConfig.NEXUS.LIGHT_NEXUS : GameConfig.NEXUS.DARK_NEXUS;
    
    const nexusWorldX = enemyNexusPos.TILE_X * this.tileMap.tileWidth + (this.tileMap.tileWidth / 2);
    const nexusWorldY = enemyNexusPos.TILE_Y * this.tileMap.tileHeight + (this.tileMap.tileHeight / 2);
    
    return { x: nexusWorldX, y: nexusWorldY };
  }

  /**
   * Update border scores when a spell is successfully cast
   */
  updateBorderScores() {
    // Delegate to the scoring system
    this.scoringSystem.updateScores();
  }



}

module.exports = MovementSystem;



