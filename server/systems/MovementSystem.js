const GameConfig = require('../config/gameConfig');
const { SoulStates } = require('../entities/SoulStateMachine');

/**
 * Movement System
 * Handles movement logic for souls based on their current state
 */
class MovementSystem {
  constructor(tileMap) {
    this.tileMap = tileMap;
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
        moveTarget = this.findNearestEnemyTile(soul);
        movementType = 'seek';
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
    if (!this.tileMap) return null;

    const opponentTileType = soul.type === 'dark-soul' ? 'green' : 'gray';
    
    let nearestTile = null;
    let nearestDistance = GameConfig.SOUL.SEARCH_RADIUS;

    // Check all tiles to find nearest enemy tile
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[y][x];

        // Only target opponent tiles
        if (tile.type === opponentTileType) {
          const tileWorldX = tile.worldX + this.tileMap.tileWidth / 2;
          const tileWorldY = tile.worldY + this.tileMap.tileHeight / 2;
          
          const dx = tileWorldX - soul.x;
          const dy = tileWorldY - soul.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestTile = { x: tileWorldX, y: tileWorldY };
          }
        }
      }
    }

    return nearestTile;
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
}

module.exports = MovementSystem;
