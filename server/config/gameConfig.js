/**
 * Centralized game configuration
 * All game constants and tunable parameters in one place
 */

const GameConfig = {
  // Entity types
  SOUL_TYPES: {
    DARK: 'dark-soul',
    LIGHT: 'light-soul'
  },
  
  TILE_TYPES: {
    GRAY: 'gray',
    GREEN: 'green'
  },
  
  TEAM_TYPES: {
    DARK: 'gray',  // Dark souls use gray tiles
    LIGHT: 'green' // Light souls use green tiles
  },

  // World dimensions
  WORLD: {
    WIDTH: 1500,
    HEIGHT: 900,
    BOUNDARY_BUFFER: 10
  },

  // Tile map configuration
  TILEMAP: {
    WIDTH: 75,      // Updated to match 1500px / 20px = 75 tiles
    HEIGHT: 45,     // Updated to match 900px / 20px = 45 tiles
    TILE_WIDTH: 20, // Square tiles: 20x20 pixels
    TILE_HEIGHT: 20 // Square tiles: 20x20 pixels
  },

  // Soul configuration
  SOUL: {
    STARTING_ENERGY_MIN: 80,
    STARTING_ENERGY_MAX: 100,
    MAX_ENERGY: 100,
    MOVEMENT_SPEED: 5,
    
    // Energy thresholds
    HUNGRY_THRESHOLD: 0.5,      // 50%
    CASTING_ENERGY_COST: 0.25,  // 25%
    MIN_ENERGY_TO_CAST: 50,

    // State timeouts (in milliseconds)
    STATE_TIMEOUT: 15000,       
    SEEKING_TIMEOUT: 15000,
    SEEKING_TRAVEL_TIME: 1500,  // Time to assume soul reached enemy tile     
    
     // Attack configuration
     ATTACK_RANGE: 250,           // Increased from 60
     ATTACK_COOLDOWN: 2000,      // 2 seconds
     ATTACK_DAMAGE_MIN: 15,
     ATTACK_DAMAGE_MAX: 25,
    
    // Spell configuration
    SPELL_COOLDOWN: 5000,      // 20 seconds
    SPELL_RANGE: 150,
    SPELL_CAST_TIME: 3000,      // 5 seconds
    SPELL_PREPARATION_TIME: 1000, // 1 second
    SPELL_MIN_DISTANCE: 0,     // Minimum distance to target tile
    
     // Movement and collision
     COLLISION_RADIUS: 40,
     SEPARATION_FORCE: 0.3,       // Force multiplier for collision separation
     SEARCH_RADIUS: 1500,
     FLOATING_AMPLITUDE: 3,
     DEFEND_SPEED_MULTIPLIER: 1,// Speed multiplier when defending
     RANDOM_MOVEMENT_FORCE: 2,    // Force for random collision resolution
     WANDER_FORCE: 0.2,          // Force for random wandering
     RETREAT_DISTANCE_THRESHOLD: 200, // Distance to consider for retreat
     RETREAT_FORCE_DISTANCE: 100, // Distance to move when retreating
    
    // Retreat behavior
    RETREAT_DURATION: 1000,     // 5 seconds
    
    // Energy drain
    ENERGY_DRAIN_CHANCE: 0.05,  
    ENERGY_DRAIN_AMOUNT: 1
  },

  // Energy orb configuration
  ORB: {
    ENERGY_VALUE: 25,
    RESPAWN_TIME_MIN: 10000,    // 10 seconds
    RESPAWN_TIME_MAX: 15000,    // 15 seconds
    COLLECTION_RADIUS: 30,
    ORBS_PER_TEAM: 8,
    SPAWN_OFFSET_X: 10,         // Random offset range for orb spawn X
    SPAWN_OFFSET_Y: 8           // Random offset range for orb spawn Y
  },

  // Spawn configuration
  SPAWN: {
    SOULS_PER_TEAM: 20,
    SAFE_DISTANCE_FROM_BORDER: 3, // tiles
    EDGE_BUFFER: 3                // tiles from map edge
  },

  // Game loop
  GAME_LOOP: {
    FPS: 30,
    FRAME_TIME: 33,             // 1000/30
    WORLD_STATE_SYNC_INTERVAL: 10000  // 10 seconds
  },

  // Territory configuration
  TERRITORY: {
    BARRIER_DISTANCE: 50,
    CHECK_RADIUS: 3             // tiles to check around position
  },

  // Mating and reproduction configuration
  MATING: {
    MIN_RESTING_SOULS: 0,       // Minimum souls per team to avoid extinction
    MAX_SOULS_PER_TEAM: 10,      // Maximum souls per team
    MIN_ENERGY_FOR_MATING: 0.5, // 30% energy required to mate (reduced for testing)
    MATING_RANGE: 120,          // Distance souls need to be for mating (increased)
    MATING_TIME: 10000,         // 10 seconds to complete mating
    CHILD_MATURITY_TIME: 30000, // 30 seconds for child to become adult
    HEARTS_DISPLAY_TIME: 12000  // 12 seconds to show hearts
  },

  // Day/Night cycle configuration
  DAY_NIGHT: {
    CYCLE_DURATION: 120000,     // 2 minutes for full day/night cycle (120000ms)
    DAY_DURATION: 0.6,          // 60% of cycle is day
    NIGHT_DURATION: 0.4,        // 40% of cycle is night
    TRANSITION_DURATION: 0.1,   // 10% for dawn/dusk transitions
    
    // Team-specific bonuses
    LIGHT_TEAM_DAY_SPEED_MULTIPLIER: 2,     // Light team gets 50% speed boost during day
    LIGHT_TEAM_DAY_CAST_TIME_MULTIPLIER: 0.5, // Light team gets 30% faster spell CASTING TIME during day
    
    DARK_TEAM_NIGHT_SPEED_MULTIPLIER: 2,    // Dark team gets 50% speed boost during night  
    DARK_TEAM_NIGHT_CAST_TIME_MULTIPLIER: 0.5, // Dark team gets 30% faster spell CASTING TIME during night
    
    // General effects
    NIGHT_ENERGY_MULTIPLIER: 1,  // Energy orbs give 50% more at night
    
    // Visual settings
    DAY_AMBIENT_LIGHT: 1.0,     // Full brightness during day
    NIGHT_AMBIENT_LIGHT: 0.3,   // 30% brightness during night
    TRANSITION_SPEED: 0.05      // How fast lighting transitions
  },

  // Nexus configuration
  NEXUS: {
    MAX_HEALTH: 1000,           // Maximum health for each nexus
    HEALTH_REGENERATION: 5,     // Health points regenerated per second
    REGENERATION_INTERVAL: 1000, // How often to regenerate health (ms)
    DESTRUCTION_DAMAGE: 100,     // Damage dealt when nexus is destroyed
    SPAWN_OFFSET_RANGE: 25,     // Random offset range for spawning around nexus
    
    // Positions (in tile coordinates) - Updated for 75x45 grid
    LIGHT_NEXUS: {
      TILE_X: 6,                // Left bottom corner (proportionally adjusted)
      TILE_Y: 33                // Bottom area (proportionally adjusted: 45*0.75 ≈ 33)
    },
    DARK_NEXUS: {
      TILE_X: 68,               // Right top corner (proportionally adjusted: 75*0.9 ≈ 68)
      TILE_Y: 11                // Top area (proportionally adjusted: 45*0.25 ≈ 11)
    },

    // Combat and pathfinding
    TUNNEL_WIDTH: 10,           // 10 tiles wide as requested (soul height limit)
    TUNNEL_PRIORITY_MULTIPLIER: 2.0,  // How much to prioritize tunnel tiles
    MAX_ATTACK_DISTANCE: 10,    // Maximum distance to consider for nexus attack
    
    // Border scoring system
    BORDER_WIDTH: 4             // 100 pixels = ~4 tiles (25px each)
  }
};

module.exports = GameConfig;
