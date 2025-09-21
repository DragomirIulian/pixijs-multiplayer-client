const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

let characters = new Map();
let energyOrbs = new Map();
let tileMap = null;
let activeSpells = new Map(); // Track ongoing spells

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
    lastSpellTime: Date.now(), // When they last cast a spell (start with current time)
    spellCooldown: 20000, // 20 seconds between spells
    spellRange: 200, // How far they can cast spells
    isCasting: false, // Whether currently casting a spell
    isPreparing: false, // Whether preparing to cast (stopped for 1s before casting)
    prepareStartTime: 0 // When preparation started
  };
}

// Function to find a valid spawn position within a team's territory
function findSpawnPosition(teamType) {
  if (!tileMap) return { x: 750, y: 450 }; // Fallback to center
  
  const validTiles = [];
  
  // Find all tiles belonging to the team
  for (let y = 0; y < tileMap.height; y++) {
    for (let x = 0; x < tileMap.width; x++) {
      const tile = tileMap.tiles[y][x];
      if (tile.type === teamType) {
        validTiles.push(tile);
      }
    }
  }
  
  if (validTiles.length === 0) {
    return { x: 750, y: 450 }; // Fallback to center if no tiles found
  }
  
  // Pick a random tile from valid tiles
  const randomTile = validTiles[Math.floor(Math.random() * validTiles.length)];
  
  // Return center of the tile
  return {
    x: randomTile.worldX + tileMap.tileWidth / 2,
    y: randomTile.worldY + tileMap.tileHeight / 2
  };
}

// Create tile map with diagonal split
function createTileMap() {
  const tilesWidth = 60;
  const tilesHeight = 60;
  const tileWidth = 25; // Each tile is 25x15 pixels (60x60 grid in 1500x900)
  const tileHeight = 15;
  
  const tiles = [];
  
  for (let y = 0; y < tilesHeight; y++) {
    const row = [];
    for (let x = 0; x < tilesWidth; x++) {
      // Diagonal split: if y > x, use green tiles (below diagonal)
      // Otherwise use gray tiles (above diagonal)
      const tileType = y > x ? 'green' : 'gray';
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

// Create energy orbs
function createEnergyOrb(id) {
  return {
    id: id,
    x: 100 + Math.random() * 1300, // Random position
    y: 100 + Math.random() * 700,
    energy: 25, // Energy value of the orb
    respawnTime: 0 // When it will respawn (0 = available)
  };
}


// Spawn initial energy orbs
for (let i = 0; i < 8; i++) {
  energyOrbs.set(`orb-${i}`, createEnergyOrb(`orb-${i}`));
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
    
    // Find nearest energy orb for movement AI (ONLY in own territory)
    let nearestOwnTerritoryOrb = null;
    let nearestOwnTerritoryDistance = Infinity;
    
    const characterTeamType = character.type === 'dark-soul' ? 'gray' : 'green';
    
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
    
    // Only target orbs in own territory
    const targetOrb = nearestOwnTerritoryOrb;
    
    // Only move if not casting or preparing to cast a spell
    if (!character.isCasting && !character.isPreparing) {
      // Move towards target energy orb if found, otherwise wander
      if (targetOrb) {
        const dx = targetOrb.x - character.x;
        const dy = targetOrb.y - character.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          // Move towards the orb
          character.vx = (dx / distance) * character.movementSpeed;
          character.vy = (dy / distance) * character.movementSpeed;
        }
      } else {
        // Wander randomly if no orb in range
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
      
      // Check if the new position is within character's territory
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
      }
      
      // Only move if the new position is valid
      if (canMove) {
        character.x = newX;
        character.y = newY;
      } else {
        // Stop movement if trying to enter enemy territory
        character.vx *= -0.8; // Reverse and reduce velocity
        character.vy *= -0.8;
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

    
    // Check energy orb collection
    energyOrbs.forEach(orb => {
      if (orb.respawnTime <= Date.now()) { // Only check available orbs
        const dx = orb.x - character.x;
        const dy = orb.y - character.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 30) { // Collection radius
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
    });
    
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
        
        // Attack logic - occasionally attack when in range
        if (distance <= character.attackRange && 
            Date.now() - character.lastAttackTime > character.attackCooldown) {
          
          // 20% chance to attack when in range and off cooldown
          if (Math.random() < 0.2) {
            // Perform attack
            const damage = 15 + Math.random() * 10; // 15-25 damage
            otherCharacter.energy = Math.max(0, otherCharacter.energy - damage);
            
            character.lastAttackTime = Date.now();
            
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
        
        // Collision avoidance (avoid overlapping)
        const minDistance = 40;
        if (distance < minDistance && distance > 0) {
          const overlap = minDistance - distance;
          const separationX = (dx / distance) * overlap * 0.5;
          const separationY = (dy / distance) * overlap * 0.5;
          
          character.x += separationX;
          character.y += separationY;
          otherCharacter.x -= separationX;
          otherCharacter.y -= separationY;
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
        isPreparing: character.isPreparing
      }
    });
  });
  
  // Handle energy orb respawning
  energyOrbs.forEach(orb => {
    if (orb.respawnTime > 0 && orb.respawnTime <= Date.now()) {
      // Respawn orb at new location
      orb.x = 100 + Math.random() * 1300;
      orb.y = 100 + Math.random() * 700;
      orb.respawnTime = 0;
      
      // Broadcast orb respawn
      broadcastToAll({
        type: 'orb_spawned',
        orb: {
          id: orb.id,
          x: orb.x,
          y: orb.y,
          energy: orb.energy
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
  const minDistance = 60; // Minimum distance to target tile (about 2 tiles away)
  
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
  
  // Broadcast spell start
  broadcastToAll({
    type: 'spell_started',
    spell: {
      id: spell.id,
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
  console.log('Client connected');
  
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
        energy: orb.energy
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
    console.log('Client disconnected');
  });
});

// Start game loop (30 FPS)
setInterval(gameLoop, 33);

console.log('Soul Energy Server running on ws://localhost:3000');
console.log('Spawning souls that search for energy...');
console.log('Souls will roam the map looking for energy orbs while their energy slowly drains');
console.log('Open browser to see souls in action!');
