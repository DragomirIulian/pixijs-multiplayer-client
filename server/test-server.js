const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

let characters = new Map();
let energyOrbs = new Map();

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
    attackRange: 60 // How close they need to be to attack
  };
}

// Spawn multiple souls
characters.set('dark-soul1', createSoul('dark-soul1', 'dark-soul', 200, 300));
characters.set('dark-soul2', createSoul('dark-soul2', 'dark-soul', 400, 200));
characters.set('light-soul1', createSoul('light-soul1', 'light-soul', 600, 400));
characters.set('light-soul2', createSoul('light-soul2', 'light-soul', 800, 300));

// Create energy orbs
function createEnergyOrb(id) {
  return {
    id: id,
    x: 100 + Math.random() * 600, // Random position
    y: 100 + Math.random() * 400,
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
    
    // Find nearest energy orb for movement AI
    let nearestOrb = null;
    let nearestDistance = Infinity;
    
    energyOrbs.forEach(orb => {
      if (orb.respawnTime <= Date.now()) { // Only consider available orbs
        const dx = orb.x - character.x;
        const dy = orb.y - character.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < character.searchRadius && distance < nearestDistance) {
          nearestDistance = distance;
          nearestOrb = orb;
        }
      }
    });
    
    // Move towards nearest energy orb if found, otherwise wander
    if (nearestOrb) {
      const dx = nearestOrb.x - character.x;
      const dy = nearestOrb.y - character.y;
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
    
    // Move character
    character.x += character.vx;
    character.y += character.vy;
    
    // Check boundary collisions with world edges
    const worldWidth = 1600;
    const worldHeight = 1200;
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
        maxEnergy: character.maxEnergy
      }
    });
  });
  
  // Handle energy orb respawning
  energyOrbs.forEach(orb => {
    if (orb.respawnTime > 0 && orb.respawnTime <= Date.now()) {
      // Respawn orb at new location
      orb.x = 100 + Math.random() * 1400;
      orb.y = 100 + Math.random() * 1000;
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
      maxEnergy: char.maxEnergy
    })),
    energyOrbs: Array.from(energyOrbs.values())
      .filter(orb => orb.respawnTime <= Date.now()) // Only send available orbs
      .map(orb => ({
        id: orb.id,
        x: orb.x,
        y: orb.y,
        energy: orb.energy
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
