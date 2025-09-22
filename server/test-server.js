const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

let characters = new Map();
let energyOrbs = new Map();
let tileMap = null;
let activeSpells = new Map(); // Track ongoing spells

// Track for periodic world state sync
let lastWorldStateSync = Date.now();

// Create roaming souls that search for energy
function createSoul(id, type, x, y) {
  return {
    id: id,
    name: `${type === 'dark-soul' ? 'Dark' : 'Light'} Soul`,
    type: type,
    x: x,
    y: y,
    vx: (Math.random() - 0.5) * 2, // Random velocity
    vy: (Math.random() - 0.5) * 2,
    energy: 50 + Math.floor(Math.random() * 30), // Random starting energy 50-80
    maxEnergy: 100,
    searchRadius: 150, // How far they can detect energy orbs
    movementSpeed: 5,
    lastAttackTime: 0, // When they last attacked
    attackCooldown: 3000, // 3 seconds between attacks
    attackRange: 60, // How close they need to be to attack
    defenseRange: 400, // How far they can detect threats for defense
    lastSpellTime: Date.now(), // When they last cast a spell (start with current time)
    spellCooldown: 20000, // 20 seconds between spells
    spellRange: 100, // How far they can cast spells (2-3 tiles: 25*3=75)
    isCasting: false, // Whether currently casting a spell
    isPreparing: false, // Whether preparing to cast (stopped for 1s before casting)
    prepareStartTime: 0, // When preparation started
    lastAttackedTime: 0, // When this soul was last attacked
    isRetreating: false, // Whether currently retreating
    retreatDuration: 5000, // How long to retreat (5 seconds)
    defendingTarget: null, // Which enemy soul this soul is defending against
    isDefending: false // Whether currently in defensive mode
  };
}

// Function to find a valid spawn position within a team's territory (away from borders)
function findSpawnPosition(teamType) {
  if (!tileMap) return { x: 750, y: 450 }; // Fallback to center
  
  const validTiles = [];
  const bufferZone = 3; // Stay 3 tiles away from enemy territory
  
  // Find all tiles belonging to the team that are away from borders
  for (let y = 0; y < tileMap.height; y++) {
    for (let x = 0; x < tileMap.width; x++) {
      const tile = tileMap.tiles[y][x];
      if (tile.type === teamType) {
        // Check if this tile is far enough from enemy territory
        let farFromBorder = true;
        
        if (teamType === 'green') {
          // Green tiles: stay away from right side (x >= 30 - bufferZone)
          if (x >= (tileMap.width / 2) - bufferZone) {
            farFromBorder = false;
          }
        } else { // gray tiles
          // Gray tiles: stay away from left side (x <= 30 + bufferZone)
          if (x <= (tileMap.width / 2) + bufferZone) {
            farFromBorder = false;
          }
        }
        
        if (farFromBorder) {
          validTiles.push(tile);
        }
      }
    }
  }
  
  if (validTiles.length === 0) {
    return { x: 750, y: 450 }; // Fallback to center if no safe tiles found
  }
  
  // Pick a random tile from valid safe tiles
  const randomTile = validTiles[Math.floor(Math.random() * validTiles.length)];
  
  
  // Return center of the tile
  return {
    x: randomTile.worldX + tileMap.tileWidth / 2,
    y: randomTile.worldY + tileMap.tileHeight / 2
  };
}

// Create tile map with vertical split
function createTileMap() {
  const tilesWidth = 60;
  const tilesHeight = 60;
  const tileWidth = 25; // Each tile is 25x15 pixels (60x60 grid in 1500x900)
  const tileHeight = 15;
  
  const tiles = [];
  
  for (let y = 0; y < tilesHeight; y++) {
    const row = [];
    for (let x = 0; x < tilesWidth; x++) {
      // Vertical split: left half green, right half gray
      const tileType = x < tilesWidth / 2 ? 'green' : 'gray';
      row.push({
        x: x,
        y: y,
        type: tileType,
        worldX: x * tileWidth,
        worldY: y * tileHeight
      });
    }
    tiles.push(row);
  }
  
  return {
    width: tilesWidth,
    height: tilesHeight,
    tileWidth: tileWidth,
    tileHeight: tileHeight,
    tiles: tiles
  };
}

// Initialize tile map first
tileMap = createTileMap();

// Spawn multiple souls in their proper territories
const darkPos1 = findSpawnPosition('gray');
const darkPos2 = findSpawnPosition('gray');
const lightPos1 = findSpawnPosition('green');
const lightPos2 = findSpawnPosition('green');

characters.set('dark-soul1', createSoul('dark-soul1', 'dark-soul', darkPos1.x, darkPos1.y));
characters.set('dark-soul2', createSoul('dark-soul2', 'dark-soul', darkPos2.x, darkPos2.y));
characters.set('light-soul1', createSoul('light-soul1', 'light-soul', lightPos1.x, lightPos1.y));
characters.set('light-soul2', createSoul('light-soul2', 'light-soul', lightPos2.x, lightPos2.y));

// Create team-specific energy orbs
function createEnergyOrb(id, teamType) {
  const position = findOrbSpawnPosition(teamType);
  return {
    id: id,
    x: position.x,
    y: position.y,
    energy: 25, // Energy value of the orb
    respawnTime: 0, // When it will respawn (0 = available)
    teamType: teamType, // 'green' for light souls, 'gray' for dark souls
    color: teamType === 'green' ? 'yellow' : 'red' // Visual color
  };
}

// Helper function to check if a position is valid for a character's team
function isValidPosition(x, y, teamType) {
  if (!tileMap) return true; // If no tilemap, allow movement
  
  // Check world bounds
  const worldWidth = 1500;
  const worldHeight = 900;
  if (x < 50 || x > worldWidth - 50 || y < 50 || y > worldHeight - 50) {
    return false;
  }
  
  // Check tile bounds
  const tileX = Math.floor(x / tileMap.tileWidth);
  const tileY = Math.floor(y / tileMap.tileHeight);
  
  if (tileX < 0 || tileX >= tileMap.width || tileY < 0 || tileY >= tileMap.height) {
    return false;
  }
  
  // Check if tile belongs to character's team
  const tile = tileMap.tiles[tileY][tileX];
  if (tile.type !== teamType) {
    return false;
  }
  
  // Check barrier distance from enemy territory
  const barrierDistance = 50;
  const opponentTileType = teamType === 'green' ? 'gray' : 'green';
  
  // Check surrounding area for enemy tiles
  const checkRadius = 3;
  for (let checkY = Math.max(0, tileY - checkRadius); checkY <= Math.min(tileMap.height - 1, tileY + checkRadius); checkY++) {
    for (let checkX = Math.max(0, tileX - checkRadius); checkX <= Math.min(tileMap.width - 1, tileX + checkRadius); checkX++) {
      const checkTile = tileMap.tiles[checkY][checkX];
      if (checkTile.type === opponentTileType) {
        const tileWorldX = checkTile.worldX + tileMap.tileWidth / 2;
        const tileWorldY = checkTile.worldY + tileMap.tileHeight / 2;
        const distanceToEnemyTile = Math.sqrt((x - tileWorldX) ** 2 + (y - tileWorldY) ** 2);
        
        if (distanceToEnemyTile < barrierDistance) {
          return false;
        }
      }
    }
  }
  
  return true;
}

// Function to find valid orb spawn position in team territory (away from edges)
function findOrbSpawnPosition(teamType) {
  if (!tileMap) return { x: 750, y: 450 }; // Fallback to center
  
  const validTiles = [];
  const edgeBuffer = 3; // Stay 3 tiles away from map edges
  
  // Find all tiles belonging to the team that are away from edges
  for (let y = edgeBuffer; y < tileMap.height - edgeBuffer; y++) {
    for (let x = edgeBuffer; x < tileMap.width - edgeBuffer; x++) {
      const tile = tileMap.tiles[y][x];
      if (tile.type === teamType) {
        // Additional check: ensure souls can actually reach this position
        const tileWorldX = tile.worldX + tileMap.tileWidth / 2;
        const tileWorldY = tile.worldY + tileMap.tileHeight / 2;
        
        if (isValidPosition(tileWorldX, tileWorldY, teamType)) {
          validTiles.push(tile);
        }
      }
    }
  }
  
  // Pick a random tile from valid safe tiles
  const randomTile = validTiles[Math.floor(Math.random() * validTiles.length)];
  
  // Return center of the tile with minimal random offset
  return {
    x: randomTile.worldX + tileMap.tileWidth / 2 + (Math.random() - 0.5) * 10,
    y: randomTile.worldY + tileMap.tileHeight / 2 + (Math.random() - 0.5) * 8
  };
}

// Spawn initial energy orbs - equal amounts for each team
const orbsPerTeam = 4;
for (let i = 0; i < orbsPerTeam; i++) {
  // Create yellow orbs for light souls (green territory)
  energyOrbs.set(`light-orb-${i}`, createEnergyOrb(`light-orb-${i}`, 'green'));
  // Create red orbs for dark souls (gray territory)
  energyOrbs.set(`dark-orb-${i}`, createEnergyOrb(`dark-orb-${i}`, 'gray'));
}

function broadcastToAll(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function gameLoop() {
  // Update all souls
  characters.forEach(character => {
    // Energy draining - souls slowly lose energy over time
    if (Math.random() < 0.05) { // 5% chance per frame to lose energy
      character.energy = Math.max(0, character.energy - 1);
    }
    
    // Find nearest energy orb for movement AI (ONLY in own territory and if energy < 50%)
    let nearestOwnTerritoryOrb = null;
    let nearestOwnTerritoryDistance = Infinity;
    
    const characterTeamType = character.type === 'dark-soul' ? 'gray' : 'green';
    const energyPercentage = character.energy / character.maxEnergy;
    
    // Only seek orbs if energy is below 50%
    if (energyPercentage < 0.5) {
      energyOrbs.forEach(orb => {
        if (orb.respawnTime <= Date.now()) { // Only consider available orbs
          const dx = orb.x - character.x;
          const dy = orb.y - character.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < character.searchRadius) {
            // Check if orb is in character's territory
            if (tileMap) {
              const orbTileX = Math.floor(orb.x / tileMap.tileWidth);
              const orbTileY = Math.floor(orb.y / tileMap.tileHeight);
              
              if (orbTileX >= 0 && orbTileX < tileMap.width && orbTileY >= 0 && orbTileY < tileMap.height) {
                const orbTile = tileMap.tiles[orbTileY][orbTileX];
                
                // Only target orbs in own territory
                if (orbTile.type === characterTeamType && distance < nearestOwnTerritoryDistance) {
                  nearestOwnTerritoryDistance = distance;
                  nearestOwnTerritoryOrb = orb;
                }
              }
            }
          }
        }
      });
    }
    
    // Only target orbs in own territory and if energy is low
    const targetOrb = nearestOwnTerritoryOrb;
    
    // Check retreat behavior first
    if (character.isRetreating && 
        Date.now() - character.lastAttackedTime > character.retreatDuration) {
      // Stop retreating and resume normal behavior
      character.isRetreating = false;
    }
    
    // Only move if not casting or preparing to cast a spell
    if (!character.isCasting && !character.isPreparing) {
      let moveTarget = null;
      let movementType = 'wander';
      
      // Priority 1: Defending against enemy spell caster (HIGHEST PRIORITY)
      if (character.isDefending && character.defendingTarget) {
        const enemy = characters.get(character.defendingTarget);
        if (enemy && (enemy.isCasting || enemy.isPreparing)) {
          // Move towards enemy with high urgency
          moveTarget = { x: enemy.x, y: enemy.y };
          movementType = 'defend';
          
          // Check if close enough to attack immediately
          const dx = character.x - enemy.x;
          const dy = character.y - enemy.y;
          const distanceToEnemy = Math.sqrt(dx * dx + dy * dy);
          
          if (distanceToEnemy <= character.attackRange && 
              Date.now() - character.lastAttackTime > character.attackCooldown) {
            // Attack immediately when in range during defense
            const damage = 15 + Math.random() * 10;
            enemy.energy = Math.max(0, enemy.energy - damage);
            character.lastAttackTime = Date.now();
            
            // Interrupt the enemy's spell
            if (enemy.isCasting || enemy.isPreparing) {
              interruptSpell(enemy);
            }
            
            // Mark enemy as attacked
            enemy.lastAttackedTime = Date.now();
            enemy.isRetreating = true;
            
            
            // Stop defending - mission accomplished
            character.isDefending = false;
            character.defendingTarget = null;
            
            // Broadcast defensive attack
            broadcastToAll({
              type: 'attack',
              attackerId: character.id,
              targetId: enemy.id,
              damage: damage,
              attackerPos: { x: character.x, y: character.y },
              targetPos: { x: enemy.x, y: enemy.y },
              isDefensiveAttack: true
            });
          }
        } else {
          // Enemy no longer casting, stop defending
          character.isDefending = false;
          character.defendingTarget = null;
        }
      }
      
      // Priority 2: Retreating (move away from recent attackers)
      else if (character.isRetreating) {
        // Find a safe area to retreat to (away from enemies)
        const enemies = Array.from(characters.values()).filter(char => 
          char.type !== character.type
        );
        
        if (enemies.length > 0) {
          // Calculate direction away from nearest enemies
          let avoidX = 0;
          let avoidY = 0;
          enemies.forEach(enemy => {
            const dx = character.x - enemy.x;
            const dy = character.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0 && distance < 200) {
              avoidX += dx / distance;
              avoidY += dy / distance;
            }
          });
          
          if (avoidX !== 0 || avoidY !== 0) {
            const magnitude = Math.sqrt(avoidX * avoidX + avoidY * avoidY);
            moveTarget = {
              x: character.x + (avoidX / magnitude) * 100,
              y: character.y + (avoidY / magnitude) * 100
            };
            movementType = 'retreat';
          }
        }
      }
      
      // Priority 3: Move towards energy orb
      else if (targetOrb) {
        moveTarget = targetOrb;
        movementType = 'energy';
      }
      
      // Apply movement based on target
      if (moveTarget) {
        const dx = moveTarget.x - character.x;
        const dy = moveTarget.y - character.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          // Much faster movement for defending (urgent situation)
          const speed = movementType === 'defend' ? character.movementSpeed * 2.5 : character.movementSpeed;
          character.vx = (dx / distance) * speed;
          character.vy = (dy / distance) * speed;
        }
      } else {
        // Wander randomly if no specific target
        character.vx += (Math.random() - 0.5) * 0.2;
        character.vy += (Math.random() - 0.5) * 0.2;
        
        // Limit velocity
        const maxSpeed = character.movementSpeed;
        const currentSpeed = Math.sqrt(character.vx * character.vx + character.vy * character.vy);
        if (currentSpeed > maxSpeed) {
          character.vx = (character.vx / currentSpeed) * maxSpeed;
          character.vy = (character.vy / currentSpeed) * maxSpeed;
        }
      }
      
      // Calculate potential new position
      const newX = character.x + character.vx;
      const newY = character.y + character.vy;
      
      // Check if the new position is within character's territory with barrier
      let canMove = true;
      if (tileMap) {
        const newTileX = Math.floor(newX / tileMap.tileWidth);
        const newTileY = Math.floor(newY / tileMap.tileHeight);
        const characterTeamType = character.type === 'dark-soul' ? 'gray' : 'green';
        
        // Check if new position is within bounds and in owned territory
        if (newTileX >= 0 && newTileX < tileMap.width && newTileY >= 0 && newTileY < tileMap.height) {
          const newTile = tileMap.tiles[newTileY][newTileX];
          if (newTile.type !== characterTeamType) {
            canMove = false;
          }
        } else {
          canMove = false; // Don't allow movement outside map bounds
        }
        
        // Additional barrier check: prevent souls from getting too close to enemy territory
        if (canMove) {
          const barrierDistance = 50; // About 2 tile distance from enemy territory (increased)
          const opponentTileType = character.type === 'dark-soul' ? 'green' : 'gray';
          
          // Check a larger area around the new position for enemy tiles
          const checkRadius = 3; // Check 3 tiles in each direction
          for (let checkY = Math.max(0, newTileY - checkRadius); checkY <= Math.min(tileMap.height - 1, newTileY + checkRadius); checkY++) {
            for (let checkX = Math.max(0, newTileX - checkRadius); checkX <= Math.min(tileMap.width - 1, newTileX + checkRadius); checkX++) {
              const checkTile = tileMap.tiles[checkY][checkX];
              if (checkTile.type === opponentTileType) {
                const tileWorldX = checkTile.worldX + tileMap.tileWidth / 2;
                const tileWorldY = checkTile.worldY + tileMap.tileHeight / 2;
                const distanceToEnemyTile = Math.sqrt((newX - tileWorldX) ** 2 + (newY - tileWorldY) ** 2);
                
                if (distanceToEnemyTile < barrierDistance) {
                  canMove = false;
                  break;
                }
              }
            }
            if (!canMove) break;
          }
        }
      }
      
      // Only move if the new position is valid
      if (canMove) {
        character.x = newX;
        character.y = newY;
      } else {
        // Push soul away from enemy territory when hitting barrier
        if (tileMap) {
          const currentTileX = Math.floor(character.x / tileMap.tileWidth);
          const currentTileY = Math.floor(character.y / tileMap.tileHeight);
          const opponentTileType = character.type === 'dark-soul' ? 'green' : 'gray';
          
          // Find direction away from nearest enemy territory
          let pushX = 0;
          let pushY = 0;
          let enemyTileCount = 0;
          
          // Check surrounding area for enemy tiles and calculate repulsion vector
          for (let checkY = Math.max(0, currentTileY - 2); checkY <= Math.min(tileMap.height - 1, currentTileY + 2); checkY++) {
            for (let checkX = Math.max(0, currentTileX - 2); checkX <= Math.min(tileMap.width - 1, currentTileX + 2); checkX++) {
              const checkTile = tileMap.tiles[checkY][checkX];
              if (checkTile.type === opponentTileType) {
                const tileWorldX = checkTile.worldX + tileMap.tileWidth / 2;
                const tileWorldY = checkTile.worldY + tileMap.tileHeight / 2;
                const dx = character.x - tileWorldX;
                const dy = character.y - tileWorldY;
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
              character.vx = (pushX / pushMagnitude) * character.movementSpeed * 0.8;
              character.vy = (pushY / pushMagnitude) * character.movementSpeed * 0.8;
            }
          } else {
            // Fallback: reverse and reduce velocity
            character.vx *= -0.8;
            character.vy *= -0.8;
          }
        } else {
          // Fallback: reverse and reduce velocity
          character.vx *= -0.8;
          character.vy *= -0.8;
        }
      }
    } else {
      // Stop moving when casting or preparing to cast
      character.vx = 0;
      character.vy = 0;
    }
    
    // Check boundary collisions with world edges
    const worldWidth = 1500;
    const worldHeight = 900;
    if (character.x < 50 || character.x > worldWidth - 50) {
      character.vx *= -1;
      character.x = Math.max(50, Math.min(worldWidth - 50, character.x));
    }
    if (character.y < 50 || character.y > worldHeight - 50) {
      character.vy *= -1;
      character.y = Math.max(50, Math.min(worldHeight - 50, character.y));
    }

    
    // Check energy orb collection (only if energy is below 50%)
    const currentEnergyPercentage = character.energy / character.maxEnergy;
    if (currentEnergyPercentage < 0.5) {
      energyOrbs.forEach(orb => {
        if (orb.respawnTime <= Date.now()) { // Only check available orbs
          const dx = orb.x - character.x;
          const dy = orb.y - character.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 30) { // Collection radius
            // Check if orb belongs to character's team
            const orbTeamType = orb.teamType;
            if (orbTeamType === characterTeamType) {
              // Soul collects energy
              character.energy = Math.min(character.maxEnergy, character.energy + orb.energy);
              
              // Set orb to respawn in 10-15 seconds
              orb.respawnTime = Date.now() + 10000 + Math.random() * 5000;
              
              // Broadcast orb collection
              broadcastToAll({
                type: 'orb_collected',
                orbId: orb.id,
                collectorId: character.id,
                respawnTime: orb.respawnTime
              });
            }
          }
        }
      });
    }
    
    // Spell preparation and casting logic
    if (!character.isCasting && !character.isPreparing && 
        Date.now() - character.lastSpellTime > character.spellCooldown &&
        character.energy > 50 && // Need more energy to cast spells
        Math.random() < 0.1) { // Only 10% chance per frame to attempt spell casting
      
      // Find nearby opponent tiles to target
      const targetTile = findNearestOpponentTile(character);
      if (targetTile) {
        // Start preparation phase - character stops moving for 1 second
        character.isPreparing = true;
        character.prepareStartTime = Date.now();
        character.prepareTarget = targetTile; // Store target for later casting
      }
    }
    
    // Check if preparation phase is complete and ready to cast
    if (character.isPreparing && 
        Date.now() - character.prepareStartTime >= 1000) { // 1 second preparation
      
      // End preparation and start actual spell casting
      character.isPreparing = false;
      const targetTile = character.prepareTarget;
      character.prepareTarget = null;
      
      if (targetTile) {
        castSpell(character, targetTile);
      }
    }

    // Check character-to-character interactions
    characters.forEach(otherCharacter => {
      if (character.id !== otherCharacter.id) {
        const dx = character.x - otherCharacter.x;
        const dy = character.y - otherCharacter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Attack logic - only attack enemies, not team members
        const isEnemy = character.type !== otherCharacter.type;
        
        if (isEnemy && distance <= character.attackRange && 
            Date.now() - character.lastAttackTime > character.attackCooldown) {
          
          // 20% chance to attack when in range and off cooldown
          if (Math.random() < 0.2) {
            // Perform attack
            const damage = 15 + Math.random() * 10; // 15-25 damage
            otherCharacter.energy = Math.max(0, otherCharacter.energy - damage);
            
            character.lastAttackTime = Date.now();
            
            // If target was casting, interrupt the spell
            if (otherCharacter.isCasting || otherCharacter.isPreparing) {
              interruptSpell(otherCharacter);
            }
            
            // Mark target as recently attacked (for retreat behavior)
            otherCharacter.lastAttackedTime = Date.now();
            otherCharacter.isRetreating = true;
            
            // Broadcast attack event
            broadcastToAll({
              type: 'attack',
              attackerId: character.id,
              targetId: otherCharacter.id,
              damage: damage,
              attackerPos: { x: character.x, y: character.y },
              targetPos: { x: otherCharacter.x, y: otherCharacter.y }
            });
          }
        }
        
        // Improved collision avoidance (avoid overlapping with territory validation)
        const minDistance = 40;
        if (distance < minDistance && distance > 0) {
          const overlap = minDistance - distance;
          const separationForce = overlap * 0.3; // Reduced force to prevent violent separation
          const separationX = (dx / distance) * separationForce;
          const separationY = (dy / distance) * separationForce;
          
          // Calculate potential new positions
          const newCharacterX = character.x + separationX;
          const newCharacterY = character.y + separationY;
          const newOtherX = otherCharacter.x - separationX;
          const newOtherY = otherCharacter.y - separationY;
          
          // Check if new positions are valid for each character
          const characterTeamType = character.type === 'dark-soul' ? 'gray' : 'green';
          const otherTeamType = otherCharacter.type === 'dark-soul' ? 'gray' : 'green';
          
          // Validate and apply position for first character
          if (isValidPosition(newCharacterX, newCharacterY, characterTeamType)) {
            character.x = newCharacterX;
            character.y = newCharacterY;
          } else {
            // If can't separate normally, add random movement to break stuck state
            character.vx += (Math.random() - 0.5) * 2;
            character.vy += (Math.random() - 0.5) * 2;
          }
          
          // Validate and apply position for second character
          if (isValidPosition(newOtherX, newOtherY, otherTeamType)) {
            otherCharacter.x = newOtherX;
            otherCharacter.y = newOtherY;
          } else {
            // If can't separate normally, add random movement to break stuck state
            otherCharacter.vx += (Math.random() - 0.5) * 2;
            otherCharacter.vy += (Math.random() - 0.5) * 2;
          }
        }
      }
    });
    
    // Broadcast character update
    broadcastToAll({
      type: 'character_update',
      character: {
        id: character.id,
        name: character.name,
        type: character.type,
        x: character.x,
        y: character.y,
        energy: character.energy,
        maxEnergy: character.maxEnergy,
        isCasting: character.isCasting,
        isPreparing: character.isPreparing,
        isRetreating: character.isRetreating,
        isDefending: character.isDefending
      }
    });
  });
  
  // Handle energy orb respawning
  energyOrbs.forEach(orb => {
    if (orb.respawnTime > 0 && orb.respawnTime <= Date.now()) {
      // Respawn orb at new location in same team territory
      const newPosition = findOrbSpawnPosition(orb.teamType);
      orb.x = newPosition.x;
      orb.y = newPosition.y;
      orb.respawnTime = 0;
      
      // Broadcast orb respawn
      broadcastToAll({
        type: 'orb_spawned',
        orb: {
          id: orb.id,
          x: orb.x,
          y: orb.y,
          energy: orb.energy,
          teamType: orb.teamType,
          color: orb.color
        }
      });
    }
  });
  
  // Process active spells - check for completion
  activeSpells.forEach((spell, spellId) => {
    if (Date.now() >= spell.completionTime) {
      completeSpell(spell);
      activeSpells.delete(spellId);
    }
  });
  
  // Respawn characters if too few remain
  if (characters.size < 4) {
    const missingDarkSouls = 2 - Array.from(characters.values()).filter(c => c.type === 'dark-soul').length;
    const missingLightSouls = 2 - Array.from(characters.values()).filter(c => c.type === 'light-soul').length;
    
    for (let i = 0; i < missingDarkSouls; i++) {
      const id = `dark-soul${Date.now()}-${i}`;
      const spawnPos = findSpawnPosition('gray');
      characters.set(id, createSoul(id, 'dark-soul', spawnPos.x, spawnPos.y));
      
      broadcastToAll({
        type: 'character_spawn',
        character: {
          id: id,
          name: `Dark Soul`,
          type: 'dark-soul',
          x: spawnPos.x,
          y: spawnPos.y,
          energy: characters.get(id).energy,
          maxEnergy: characters.get(id).maxEnergy
        }
      });
    }
    
    for (let i = 0; i < missingLightSouls; i++) {
      const id = `light-soul${Date.now()}-${i}`;
      const spawnPos = findSpawnPosition('green');
      characters.set(id, createSoul(id, 'light-soul', spawnPos.x, spawnPos.y));
      
      broadcastToAll({
        type: 'character_spawn',
        character: {
          id: id,
          name: `Light Soul`,
          type: 'light-soul',
          x: spawnPos.x,
          y: spawnPos.y,
          energy: characters.get(id).energy,
          maxEnergy: characters.get(id).maxEnergy
        }
      });
    }
  }
}

// Find nearest opponent tile for spell casting
function findNearestOpponentTile(character) {
  if (!tileMap) return null;
  
  const characterTileType = character.type === 'dark-soul' ? 'gray' : 'green';
  const opponentTileType = character.type === 'dark-soul' ? 'green' : 'gray';
  
  let nearestTile = null;
  let nearestDistance = character.spellRange;
  const minDistance = 50; // Minimum distance to target tile (about 2 tiles away)
  
  // Check tiles within spell range but not too close
  for (let y = 0; y < tileMap.height; y++) {
    for (let x = 0; x < tileMap.width; x++) {
      const tile = tileMap.tiles[y][x];
      
      // Only target opponent tiles
      if (tile.type === opponentTileType) {
        const dx = (tile.worldX + tileMap.tileWidth/2) - character.x;
        const dy = (tile.worldY + tileMap.tileHeight/2) - character.y;
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

// Interrupt spell casting
function interruptSpell(character) {
  if (character.isCasting || character.isPreparing) {
    // Find and remove any active spells by this character
    activeSpells.forEach((spell, spellId) => {
      if (spell.casterId === character.id) {
        activeSpells.delete(spellId);
        
        // Broadcast spell interruption
        broadcastToAll({
          type: 'spell_interrupted',
          spellId: spellId,
          casterId: character.id
        });
      }
    });
    
    // Reset casting state
    character.isCasting = false;
    character.isPreparing = false;
    character.prepareTarget = null;
    
  }
}

// Find souls that should defend against enemy spell casting
function findDefenders(enemySpell) {
  const defenders = [];
  const targetTileType = enemySpell.casterType === 'dark-soul' ? 'green' : 'gray';
  const defenderType = targetTileType === 'green' ? 'light-soul' : 'dark-soul';
  const maxDefenseRange = 400; // Increased range for defense detection
  
  // Find all souls of the defending team that can potentially defend
  const potentialDefenders = Array.from(characters.values()).filter(char => {
    if (char.type !== defenderType) return false;
    if (char.isRetreating) return false;
    if (char.isCasting || char.isPreparing) return false;
    if (char.isDefending) return false;
    
    // Check if defender is within reasonable range of the threat
    const dx = char.x - enemySpell.casterX;
    const dy = char.y - enemySpell.casterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= maxDefenseRange;
  });
  
  if (potentialDefenders.length === 0) return [];
  
  // Priority scoring: closer defenders and those with more energy get priority
  const scoredDefenders = potentialDefenders.map(defender => {
    const dx = defender.x - enemySpell.casterX;
    const dy = defender.y - enemySpell.casterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Score based on distance (closer is better) and energy (more energy is better)
    const distanceScore = Math.max(0, maxDefenseRange - distance); // Higher score for closer
    const energyScore = defender.energy; // Higher score for more energy
    const totalScore = distanceScore + energyScore * 2; // Weight energy more
    
    return {
      defender: defender,
      distance: distance,
      score: totalScore
    };
  });
  
  // Sort by score (highest first) and take the best defender
  scoredDefenders.sort((a, b) => b.score - a.score);
  
  if (scoredDefenders.length > 0) {
    const bestDefender = scoredDefenders[0].defender;
    return [bestDefender];
  }
  
  return [];
}

// Cast spell on target tile
function castSpell(caster, targetTile) {
  const spellId = `spell-${caster.id}-${Date.now()}`;
  const spell = {
    id: spellId,
    casterId: caster.id,
    casterType: caster.type,
    targetTile: targetTile,
    startTime: Date.now(),
    completionTime: Date.now() + 10000, // 10 seconds
    casterX: caster.x,
    casterY: caster.y,
    targetX: targetTile.worldX + tileMap.tileWidth/2,
    targetY: targetTile.worldY + tileMap.tileHeight/2
  };
  
  activeSpells.set(spellId, spell);
  caster.isCasting = true;
  caster.lastSpellTime = Date.now();
  
  // Trigger defensive behavior - find defenders
  const defenders = findDefenders(spell);
  defenders.forEach(defender => {
    defender.isDefending = true;
    defender.defendingTarget = caster.id;
  });
  
  // Broadcast spell start
  broadcastToAll({
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
      duration: 10000
    }
  });
}

// Complete spell - convert tile and kill caster
function completeSpell(spell) {
  const caster = characters.get(spell.casterId);
  if (!caster) return; // Caster might have died already
  
  // Reset casting state in case character survives for any reason
  caster.isCasting = false;
  caster.isPreparing = false;
  
  // Stop any souls that were defending against this caster
  characters.forEach(character => {
    if (character.isDefending && character.defendingTarget === spell.casterId) {
      character.isDefending = false;
      character.defendingTarget = null;
    }
  });
  
  // Convert the tile
  const newTileType = spell.casterType === 'dark-soul' ? 'gray' : 'green';
  spell.targetTile.type = newTileType;
  
  // Kill the caster
  characters.delete(spell.casterId);
  
  // Broadcast character removal first
  broadcastToAll({
    type: 'character_remove',
    characterId: spell.casterId
  });
  
  // Broadcast spell completion and tile change
  broadcastToAll({
    type: 'spell_completed',
    spellId: spell.id,
    tileX: spell.targetTile.x,
    tileY: spell.targetTile.y,
    newTileType: newTileType,
    killedCasterId: spell.casterId
  });
  
  // Broadcast updated tile map
  broadcastToAll({
    type: 'tile_updated',
    tileX: spell.targetTile.x,
    tileY: spell.targetTile.y,
    newType: newTileType
  });
}

wss.on('connection', (ws) => {
  
  // Send current world state to new client
  ws.send(JSON.stringify({
    type: 'world_state',
    characters: Array.from(characters.values()).map(char => ({
      id: char.id,
      name: char.name,
      type: char.type,
      x: char.x,
      y: char.y,
      energy: char.energy,
      maxEnergy: char.maxEnergy,
      isCasting: char.isCasting
    })),
    energyOrbs: Array.from(energyOrbs.values())
      .filter(orb => orb.respawnTime <= Date.now()) // Only send available orbs
      .map(orb => ({
        id: orb.id,
        x: orb.x,
        y: orb.y,
        energy: orb.energy,
        teamType: orb.teamType,
        color: orb.color
      })),
    tileMap: tileMap,
    activeSpells: Array.from(activeSpells.values()).map(spell => ({
      id: spell.id,
      casterId: spell.casterId,
      casterType: spell.casterType,
      casterX: spell.casterX,
      casterY: spell.casterY,
      targetX: spell.targetX,
      targetY: spell.targetY,
      startTime: spell.startTime,
      duration: 10000
    }))
  }));
  
  ws.on('close', () => {
  });
});

function broadcastWorldState() {
  const charactersArray = Array.from(characters.values()).map(character => ({
    id: character.id,
    name: character.name,
    type: character.type,
    x: character.x,
    y: character.y,
    energy: character.energy,
    maxEnergy: character.maxEnergy,
    isCasting: character.isCasting,
    isPreparing: character.isPreparing,
    isRetreating: character.isRetreating,
    isDefending: character.isDefending,
    isMating: character.isMating || false,
    isChild: character.isChild || false,
    maturityPercentage: character.maturityPercentage || 1.0,
    currentState: character.currentState || 'roaming'
  }));

  const energyOrbsArray = Array.from(energyOrbs.values()).map(orb => ({
    id: orb.id,
    x: orb.x,
    y: orb.y,
    energy: orb.energy,
    teamType: orb.teamType,
    color: orb.color
  }));

  const activeSpellsArray = Array.from(activeSpells.values());

  broadcastToAll({
    type: 'world_state',
    characters: charactersArray,
    energyOrbs: energyOrbsArray,
    tileMap: tileMap,
    activeSpells: activeSpellsArray
  });
}

// Start game loop (30 FPS)
setInterval(() => {
  gameLoop();
  
  // Periodic world state sync every 10 seconds
  const now = Date.now();
  if (now - lastWorldStateSync >= 10000) { // 10 seconds
    broadcastWorldState();
    lastWorldStateSync = now;
  }
}, 33);

