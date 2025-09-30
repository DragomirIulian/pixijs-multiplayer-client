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
    // Base tile types (used by server logic)
    GRAY: 'gray',
    GREEN: 'green',
    
    // Gray tile variants (used by client)
    GRAY_01: 'gray-tile-01',
    GRAY_02: 'gray-tile-02', 
    GRAY_03: 'gray-tile-03',
    GRAY_04: 'gray-tile-04',
    GRAY_05: 'gray-tile-05',
    GRAY_06: 'gray-tile-06',
    
    // Green tile variants (used by client)
    GREEN_01: 'green-tile-01',
    GREEN_02: 'green-tile-02',
    GREEN_03: 'green-tile-03', 
    GREEN_04: 'green-tile-04',
    GREEN_05: 'green-tile-05',
    GREEN_06: 'green-tile-06'
  },
  
  // Tile collections for random selection
  TILE_COLLECTIONS: {
    GRAY_TILES: ['gray-tile-01', 'gray-tile-02', 'gray-tile-03', 'gray-tile-04', 'gray-tile-05', 'gray-tile-06'],
    GREEN_TILES: ['green-tile-01', 'green-tile-02', 'green-tile-03', 'green-tile-04', 'green-tile-05', 'green-tile-06']
  },
  
  TEAM_TYPES: {
    DARK: 'gray',  // Dark souls use gray tiles
    LIGHT: 'green' // Light souls use green tiles
  },

  // World dimensions
  WORLD: {
    WIDTH: 1500,
    HEIGHT: 900,
    BOUNDARY_BUFFER: 30
  },

  // Tile map configuration
  TILEMAP: {
    WIDTH: 23,      // Updated to match 1500px / 64px = 23.4 -> 23 tiles
    HEIGHT: 14,     // Updated to match 900px / 64px = 14.06 -> 14 tiles
    TILE_WIDTH: 64, // Square tiles: 64x64 pixels
    TILE_HEIGHT: 64 // Square tiles: 64x64 pixels
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
     ATTACK_COOLDOWN: 1000,      // 2 seconds
     ATTACK_DAMAGE_MIN: 15,
     ATTACK_DAMAGE_MAX: 25,
    
    // Spell configuration
    SPELL_COOLDOWN: 20000,      // 20 seconds
    SPELL_COOLDOWN_VARIANCE: 0.5, // 25% variance in initial seeking cooldown (±25% of cooldown)
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
    SOULS_PER_TEAM: 10,
    MIN_SOULS_PER_TEAM: 2,
    SAFE_DISTANCE_FROM_BORDER: 3, // tiles
    EDGE_BUFFER: 3                // tiles from map edge
  },

  // Game loop
  GAME_LOOP: {
    FPS: 30,
    FRAME_TIME: 33,             // 1000/30
    WORLD_STATE_SYNC_INTERVAL: 10000  // 10 seconds
  },

  // UI configuration
  UI: {
    SHOW_SCORING: false          // Enable/disable scoring display in UI
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
  },

  // Sleep configuration
  SLEEP: {
    SLEEP_DURATION: 20000,      // 20 seconds for full sleep cycle
    ENERGY_RECOVERY: 50,        // Same as energy orb value (configurable)
    COOLDOWN: 60000,            // 1 minute cooldown between sleep cycles
    MIN_ENERGY_TO_SLEEP: 0,     // 0% energy minimum to initiate sleep
    MAX_ENERGY_TO_SLEEP: 0.5,   // 50% energy maximum to initiate sleep (low priority)
    AREA_RADIUS_MULTIPLIER: 3, // Sleep area radius as multiplier of nexus spawn range
    TARGET_DISTANCE_THRESHOLD: 30 // Distance threshold to consider sleep target reached
  },

  // Day/Night cycle configuration
  DAY_NIGHT: {
    CYCLE_DURATION: 120000,     // 2 minutes for full day/night cycle (120000ms)
    DAY_DURATION: 0.4,          // 40% of cycle is day
    NIGHT_DURATION: 0.4,        // 40% of cycle is night
    TRANSITION_DURATION: 0.1,   // 10% for dawn/dusk transitions (total 20%)
    
    // Team-specific bonuses
    LIGHT_TEAM_DAY_SPEED_MULTIPLIER: 2,     // Light team gets 50% speed boost during day
    LIGHT_TEAM_DAY_CAST_TIME_MULTIPLIER: 0.5, // Light team gets 30% faster spell CASTING TIME during day
    
    DARK_TEAM_NIGHT_SPEED_MULTIPLIER: 2,    // Dark team gets 50% speed boost during night  
    DARK_TEAM_NIGHT_CAST_TIME_MULTIPLIER: 0.5, // Dark team gets 30% faster spell CASTING TIME during night
    
    // General effects
    ENERGY_MULTIPLIER: 1.5,  // Energy orbs give 50% more at night
    
    // Visual settings
    DAY_AMBIENT_LIGHT: 1.0,     // Full brightness during day
    NIGHT_AMBIENT_LIGHT: 0.3    // 30% brightness during night
  },

  // Nexus configuration
  NEXUS: {
    MAX_HEALTH: 1000,           // Maximum health for each nexus
    HEALTH_REGENERATION: 5,     // Health points regenerated per second
    REGENERATION_INTERVAL: 1000, // How often to regenerate health (ms)
    DESTRUCTION_DAMAGE: 100,     // Damage dealt when nexus is destroyed
    SPAWN_OFFSET_RANGE: 25,     // Random offset range for spawning around nexus
    SIZE_TILES: 2,              // Nexus size in tiles (2x2)
    VISUAL_MULTIPLIER: 2,     // Visual size multiplier for client rendering
    
    // Positions (in tile coordinates) - Updated for 23x14 grid
    LIGHT_NEXUS: {
      TILE_X: 3,                // Left side, more centered
      TILE_Y: 11                 // Bottom area, within border bounds
    },
    DARK_NEXUS: {
      TILE_X: 20,               // Right side, more centered  
      TILE_Y: 3                 // Top area, within border bounds
    },

    // Combat and pathfinding
    TUNNEL_WIDTH: 2,           // 10 tiles wide as requested (soul height limit)
    TUNNEL_PRIORITY_MULTIPLIER: 2.0,  // How much to prioritize tunnel tiles
    
    // Border scoring system - tiles-based configuration
    BORDER_WIDTH_TILES: 3     // Border width in tiles (will be multiplied by tile size)
  },

  // Disaster Event System
  DISASTER_EVENTS: {
    // Global settings
    CHECK_INTERVAL: 5000,           // Check for disaster every 5 seconds (cycle interval)
    
    // Freezing Snow Event
    FREEZING_SNOW: {
      ENABLED: true,
      TRIGGER_CHANCE: 1,          // 10% chance per check cycle
      DURATION: 10000,              // 1 minute (60 seconds)
      DEATH_PERCENTAGE: 0.3,       // 15% of characters die
      COOLDOWN: 20000              // 2 minutes cooldown before next event can occur
    }
  }
};

module.exports = GameConfig;
