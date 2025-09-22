/**
 * Centralized game configuration
 * All game constants and tunable parameters in one place
 */

const GameConfig = {
  // World dimensions
  WORLD: {
    WIDTH: 1500,
    HEIGHT: 900,
    BOUNDARY_BUFFER: 50
  },

  // Tile map configuration
  TILEMAP: {
    WIDTH: 60,
    HEIGHT: 60,
    TILE_WIDTH: 25,
    TILE_HEIGHT: 15
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
     ATTACK_RANGE: 200,           // Increased from 60
     ATTACK_COOLDOWN: 2000,      // 2 seconds
     ATTACK_DAMAGE_MIN: 15,
     ATTACK_DAMAGE_MAX: 25,
    
    // Spell configuration
    SPELL_COOLDOWN: 20000,      // 20 seconds
    SPELL_RANGE: 100,
    SPELL_CAST_TIME: 3000,      // 5 seconds
    SPELL_PREPARATION_TIME: 1000, // 1 second
    SPELL_MIN_DISTANCE: 50,     // Minimum distance to target tile
    
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
    RETREAT_DURATION: 5000,     // 5 seconds
    
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
    SOULS_PER_TEAM: 8,
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
    MIN_RESTING_SOULS: 5,       // Minimum souls per team to avoid extinction
    MAX_SOULS_PER_TEAM: 10,      // Maximum souls per team
    MIN_ENERGY_FOR_MATING: 0.5, // 30% energy required to mate (reduced for testing)
    MATING_RANGE: 120,          // Distance souls need to be for mating (increased)
    MATING_TIME: 10000,         // 10 seconds to complete mating
    CHILD_MATURITY_TIME: 30000, // 30 seconds for child to become adult
    HEARTS_DISPLAY_TIME: 12000  // 12 seconds to show hearts
  }
};

module.exports = GameConfig;
