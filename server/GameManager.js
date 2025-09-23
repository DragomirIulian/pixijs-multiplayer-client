const GameConfig = require('./config/gameConfig');
const Soul = require('./entities/Soul');
const Nexus = require('./entities/Nexus');
const MovementSystem = require('./systems/MovementSystem');
const CombatSystem = require('./systems/CombatSystem');
const SpellSystem = require('./systems/SpellSystem');
const MatingSystem = require('./systems/MatingSystem');
const DayNightSystem = require('./systems/DayNightSystem');
const StatisticsManager = require('./systems/StatisticsManager');

/**
 * Main Game Manager
 * Orchestrates all game systems and maintains game state
 */
class GameManager {
  constructor() {
    this.souls = new Map();
    this.energyOrbs = new Map();
    this.nexuses = new Map(); // Store nexus entities
    this.tileMap = null;
    // Initialize systems
    this.movementSystem = null; // Will be initialized after tileMap
    this.combatSystem = null; // Will be initialized after spellSystem
    this.spellSystem = null; // Will be initialized after tileMap
    this.matingSystem = null; // Will be initialized after all other systems
    this.dayNightSystem = null; // Day/night cycle system
    this.statisticsManager = null; // Statistics tracking system
    
    // Game state
    this.gameEvents = [];
    
    this.initializeTileMap();
    this.initializeNexuses();
    this.initializeSystems();
    this.spawnInitialSouls();
    this.spawnInitialOrbs();
  }

  initializeTileMap() {
    const tilesWidth = GameConfig.TILEMAP.WIDTH;
    const tilesHeight = GameConfig.TILEMAP.HEIGHT;
    const tileWidth = GameConfig.TILEMAP.TILE_WIDTH;
    const tileHeight = GameConfig.TILEMAP.TILE_HEIGHT;
    
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
    
    this.tileMap = {
      width: tilesWidth,
      height: tilesHeight,
      tileWidth: tileWidth,
      tileHeight: tileHeight,
      tiles: tiles
    };
  }

  initializeNexuses() {
    // Create light nexus (bottom left)
    const lightNexus = new Nexus('light', this.tileMap);
    this.nexuses.set('light', lightNexus);
    
    // Create dark nexus (top right)
    const darkNexus = new Nexus('dark', this.tileMap);
    this.nexuses.set('dark', darkNexus);
  }

  initializeSystems() {
    this.dayNightSystem = new DayNightSystem();
    this.movementSystem = new MovementSystem(this.tileMap);
    this.spellSystem = new SpellSystem(this.tileMap, this.dayNightSystem);
    this.combatSystem = new CombatSystem(this.spellSystem, this);
    this.matingSystem = new MatingSystem(this);
    this.statisticsManager = new StatisticsManager();
    this.statisticsManager.initialize(this);
  }

  spawnInitialSouls() {
    // Spawn souls for each team at their respective nexuses
    for (let i = 0; i < GameConfig.SPAWN.SOULS_PER_TEAM; i++) {
      // Dark souls spawn at dark nexus
      const darkNexus = this.nexuses.get('dark');
      const darkPos = darkNexus.getSpawnPosition();
      const darkSoulId = `dark-soul${i + 1}`;
        const darkSoul = new Soul(darkSoulId, 'dark-soul', darkPos.x, darkPos.y, this.tileMap, false, this.movementSystem);
      this.souls.set(darkSoulId, darkSoul);

      // Light souls spawn at light nexus
      const lightNexus = this.nexuses.get('light');
      const lightPos = lightNexus.getSpawnPosition();
      const lightSoulId = `light-soul${i + 1}`;
        const lightSoul = new Soul(lightSoulId, 'light-soul', lightPos.x, lightPos.y, this.tileMap, false, this.movementSystem);
      this.souls.set(lightSoulId, lightSoul);
    }
  }

  spawnInitialOrbs() {
    // Spawn energy orbs for each team
    for (let i = 0; i < GameConfig.ORB.ORBS_PER_TEAM; i++) {
      // Light soul orbs (green territory)
      const lightOrbId = `light-orb-${i}`;
      this.energyOrbs.set(lightOrbId, this.createEnergyOrb(lightOrbId, 'green'));

      // Dark soul orbs (gray territory)
      const darkOrbId = `dark-orb-${i}`;
      this.energyOrbs.set(darkOrbId, this.createEnergyOrb(darkOrbId, 'gray'));
    }

  }

  createEnergyOrb(id, teamType) {
    const position = this.findOrbSpawnPosition(teamType);
    return {
      id: id,
      x: position.x,
      y: position.y,
      energy: GameConfig.ORB.ENERGY_VALUE,
      respawnTime: 0, // 0 = available
      teamType: teamType,
      color: teamType === 'green' ? 'yellow' : 'red'
    };
  }

  findSpawnPosition(teamType) {
    if (!this.tileMap) return { x: GameConfig.WORLD.WIDTH / 2, y: GameConfig.WORLD.HEIGHT / 2 };
    
    const validTiles = [];
    const bufferZone = GameConfig.SPAWN.SAFE_DISTANCE_FROM_BORDER;
    
    // Find all tiles belonging to the team that are away from borders
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[y][x];
        if (tile.type === teamType) {
          // Check if this tile is far enough from enemy territory
          let farFromBorder = true;
          
          if (teamType === 'green') {
            // Green tiles: stay away from right side
            if (x >= (this.tileMap.width / 2) - bufferZone) {
              farFromBorder = false;
            }
          } else { // gray tiles
            // Gray tiles: stay away from left side
            if (x <= (this.tileMap.width / 2) + bufferZone) {
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
      return { x: GameConfig.WORLD.WIDTH / 2, y: GameConfig.WORLD.HEIGHT / 2 };
    }
    
    // Pick a random tile from valid safe tiles
    const randomTile = validTiles[Math.floor(Math.random() * validTiles.length)];
    
    // Return center of the tile
    return {
      x: randomTile.worldX + this.tileMap.tileWidth / 2,
      y: randomTile.worldY + this.tileMap.tileHeight / 2
    };
  }

  findOrbSpawnPosition(teamType) {
    if (!this.tileMap) return { x: GameConfig.WORLD.WIDTH / 2, y: GameConfig.WORLD.HEIGHT / 2 };
    
    const validTiles = [];
    const buffer = GameConfig.SPAWN.SAFE_DISTANCE_FROM_BORDER;
    const opponentType = teamType === 'green' ? 'gray' : 'green';
    
    // Get all team tiles, then filter out unsafe ones
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[y][x];
        
        if (tile.type === teamType) {
          let isSafe = true;
          
          // Check if tile is far enough from map edges
          if (x < buffer || x >= this.tileMap.width - buffer || 
              y < buffer || y >= this.tileMap.height - buffer) {
            isSafe = false;
          }
          
          // Check if tile is far enough from any enemy tile
          if (isSafe) {
            for (let checkY = Math.max(0, y - buffer); checkY <= Math.min(this.tileMap.height - 1, y + buffer) && isSafe; checkY++) {
              for (let checkX = Math.max(0, x - buffer); checkX <= Math.min(this.tileMap.width - 1, x + buffer) && isSafe; checkX++) {
                const checkTile = this.tileMap.tiles[checkY][checkX];
                if (checkTile.type === opponentType) {
                  isSafe = false;
                }
              }
            }
          }
          
          if (isSafe) {
            validTiles.push(tile);
          }
        }
      }
    }
    
    if (validTiles.length === 0) {
      return { x: GameConfig.WORLD.WIDTH / 2, y: GameConfig.WORLD.HEIGHT / 2 };
    }
    
    // Pick a random tile from valid safe tiles
    const randomTile = validTiles[Math.floor(Math.random() * validTiles.length)];
    
    // Return center of the tile with minimal random offset
    return {
      x: randomTile.worldX + this.tileMap.tileWidth / 2 + (Math.random() - 0.5) * GameConfig.ORB.SPAWN_OFFSET_X,
      y: randomTile.worldY + this.tileMap.tileHeight / 2 + (Math.random() - 0.5) * GameConfig.ORB.SPAWN_OFFSET_Y
    };
  }

  update() {
    this.gameEvents = [];

    // Update day/night cycle FIRST (affects other systems)
    const dayNightEvents = this.dayNightSystem.update();
    this.gameEvents.push(...dayNightEvents);

    // Update nexuses (health regeneration, etc.)
    this.nexuses.forEach(nexus => {
      nexus.update();
    });

    // Update all souls
    this.souls.forEach(soul => {
      soul.update(this.souls);
    });

    // Remove dead souls
    this.handleSoulDeaths();

    // Update movement system (with team-specific day/night speed modifier)
    this.souls.forEach(soul => {
      const movementMultiplier = this.dayNightSystem.getMovementMultiplier(soul.type);
      this.movementSystem.updateSoul(soul, this.souls, this.energyOrbs, movementMultiplier);
    });

    // Update spell system FIRST (but don't complete spells yet)
    const spellEvents = this.spellSystem.update(this.souls);
    this.gameEvents.push(...spellEvents);

    // Update combat system (can interrupt spells before they complete)
    const attackEvents = this.combatSystem.update(this.souls);
    this.gameEvents.push(...attackEvents);

    // Handle collision detection
    this.movementSystem.handleCollisions(this.souls);

    // Process spell completion AFTER combat (so spells can be interrupted)
    const spellCompletionEvents = this.spellSystem.processSpellCompletion(this.souls);
    this.gameEvents.push(...spellCompletionEvents);

    // Process mating system (reproduction, child maturation)
    const matingEvents = this.matingSystem.update(this.souls);
    this.gameEvents.push(...matingEvents);

    // Process energy orb collection (with day/night energy modifier)
    this.processOrbCollection();

    // Handle energy orb respawning
    this.processOrbRespawning();

    // Handle soul respawning (emergency only)
    this.handleSoulRespawning();

    // Update statistics with current game state and events
    this.statisticsManager.processGameEvents(this.gameEvents);
    this.statisticsManager.updateFromGameState(this);

    // Return events for broadcasting
    const eventsToReturn = [...this.gameEvents];
    this.gameEvents = [];
    return eventsToReturn;
  }

  processOrbCollection() {
    this.souls.forEach(soul => {
      if (!soul.shouldSeekEnergy()) return;

      this.energyOrbs.forEach(orb => {
        if (orb.respawnTime <= Date.now()) {
          const distance = soul.getDistanceTo(orb);
          
          if (distance < GameConfig.ORB.COLLECTION_RADIUS && orb.teamType === soul.getTeamType()) {
            // Soul collects energy (with day/night multiplier)
            const energyValue = orb.energy * this.dayNightSystem.getEnergyMultiplier();
            soul.addEnergy(energyValue);
            
            // Set orb to respawn
            orb.respawnTime = Date.now() + 
              GameConfig.ORB.RESPAWN_TIME_MIN + 
              Math.random() * (GameConfig.ORB.RESPAWN_TIME_MAX - GameConfig.ORB.RESPAWN_TIME_MIN);
            
            // Broadcast orb collection
            this.gameEvents.push({
              type: 'orb_collected',
              orbId: orb.id,
              collectorId: soul.id,
              respawnTime: orb.respawnTime,
              energyValue: energyValue
            });

          }
        }
      });
    });
  }

  processOrbRespawning() {
    this.energyOrbs.forEach(orb => {
      if (orb.respawnTime > 0 && orb.respawnTime <= Date.now()) {
        // Respawn orb at new location in same team territory
        const newPosition = this.findOrbSpawnPosition(orb.teamType);
        orb.x = newPosition.x;
        orb.y = newPosition.y;
        orb.respawnTime = 0;
        
        // Broadcast orb respawn
        this.gameEvents.push({
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
  }

  handleSoulDeaths() {
    // Check for dead souls and handle death animation
    this.souls.forEach((soul, soulId) => {
      if (soul.isDead && !soul.deathStarted) {
        // Mark death as started to prevent multiple death events
        soul.deathStarted = true;
        soul.deathStartTime = Date.now();
        
        // Remove any active spells by this soul
        if (this.spellSystem) {
          this.spellSystem.handleSoulDeath(soul, this.souls);
        }
        
        // Broadcast death animation start event (only if not already sent by SpellSystem)
        this.gameEvents.push({
          type: 'character_death',
          characterId: soulId,
          characterData: soul.toClientData()
        });
      }
      
      // Remove soul after death animation completes (2 seconds)
      if (soul.isDead && soul.deathStarted && 
          Date.now() - soul.deathStartTime > 2000) {
        
        // Remove the soul
        this.souls.delete(soulId);
        
        // Broadcast removal event (cleanup)
        this.gameEvents.push({
          type: 'character_remove',
          characterId: soulId
        });
      }
    });
  }

  handleSoulRespawning() {
    // Souls no longer respawn automatically - they only reproduce through mating
    // This method is kept for potential future use or emergency respawning
    
    // Check if any team is completely extinct and needs emergency respawn
    const currentDarkSouls = Array.from(this.souls.values()).filter(s => s.type === 'dark-soul' && s.isAdult()).length;
    const currentLightSouls = Array.from(this.souls.values()).filter(s => s.type === 'light-soul' && s.isAdult()).length;
    
    // Emergency respawn if a team is extinct (no adult souls)
    if (currentDarkSouls === 0 && this.souls.size > 0) {
      const id = `dark-soul-emergency-${Date.now()}`;
      const darkNexus = this.nexuses.get('dark');
      const spawnPos = darkNexus.getSpawnPosition();
        const newSoul = new Soul(id, 'dark-soul', spawnPos.x, spawnPos.y, this.tileMap, false, this.movementSystem);
      this.souls.set(id, newSoul);
      
      this.gameEvents.push({
        type: 'character_spawn',
        character: newSoul.toClientData()
      });
      
      this.gameEvents.push({
        type: 'emergency_respawn',
        team: 'dark',
        reason: 'team_extinction'
      });
    }
    
    if (currentLightSouls === 0 && this.souls.size > 0) {
      const id = `light-soul-emergency-${Date.now()}`;
      const lightNexus = this.nexuses.get('light');
      const spawnPos = lightNexus.getSpawnPosition();
        const newSoul = new Soul(id, 'light-soul', spawnPos.x, spawnPos.y, this.tileMap, false, this.movementSystem);
      this.souls.set(id, newSoul);
      
      this.gameEvents.push({
        type: 'character_spawn',
        character: newSoul.toClientData()
      });
      
      this.gameEvents.push({
        type: 'emergency_respawn',
        team: 'light',
        reason: 'team_extinction'
      });
    }
  }

  // Handle spell completion - remove caster
  handleSpellCompletion(spellCompletedEvent) {
    const casterId = spellCompletedEvent.killedCasterId;
    const caster = this.souls.get(casterId);
    
    if (caster) {
      // CRITICAL: Call handleSoulDeath to clean up spells BEFORE removing the soul
      this.spellSystem.handleSoulDeath(caster, this.souls);
      
      // Clear enemy casting flags for all souls
      this.souls.forEach(soul => {
        if (soul.castingEnemyId === casterId) {
          soul.enemyCastingDetected = false;
          soul.castingEnemyId = null;
        }
      });

      // Remove the caster
      this.souls.delete(casterId);

      // Broadcast character removal
      this.gameEvents.push({
        type: 'character_remove',
        characterId: casterId
      });
    }
  }

  // Public methods for server
  getSouls() {
    return Array.from(this.souls.values()).map(soul => soul.toClientData());
  }

  getEnergyOrbs() {
    return Array.from(this.energyOrbs.values())
      .filter(orb => orb.respawnTime <= Date.now())
      .map(orb => ({
        id: orb.id,
        x: orb.x,
        y: orb.y,
        energy: orb.energy,
        teamType: orb.teamType,
        color: orb.color
      }));
  }

  getNexuses() {
    return Array.from(this.nexuses.values()).map(nexus => nexus.serialize());
  }

  getTileMap() {
    return this.tileMap;
  }

  getActiveSpells() {
    return Array.from(this.spellSystem.getActiveSpells().values()).map(spell => ({
      spellId: spell.spellId,
      casterId: spell.casterId,
      casterType: spell.casterType,
      casterX: spell.casterX,
      casterY: spell.casterY,
      targetX: spell.targetX,
      targetY: spell.targetY,
      startTime: spell.startTime,
      duration: spell.completionTime - spell.startTime
    }));
  }

  getDayNightState() {
    return this.dayNightSystem.getState();
  }

  getStatistics() {
    return this.statisticsManager.getClientStats();
  }
}

module.exports = GameManager;
