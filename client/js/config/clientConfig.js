/**
 * Client-side configuration
 * Centralized configuration for the client game
 */

export const ClientConfig = {
  // Canvas configuration
  CANVAS: {
    WIDTH: 1500,
    HEIGHT: 900,
    BACKGROUND_COLOR: '#2c3e50',
    ANTIALIAS: true
  },

  // Network configuration
  NETWORK: {
    SERVER_URL: 'ws://localhost:3000',
    RECONNECT_DELAY: 3000
  },

  // Character configuration
  CHARACTER: {
    SCALE: 0.06,
    INTERPOLATION_SPEED: 0.1,
    FLOATING_AMPLITUDE: 5,
    FLOATING_SPEED: 0.02,
    
    // Shadow configuration
    SHADOW_ENABLED: true,
    SHADOW_SCALE: 0.8,          // Shadow is 80% the size of character
    SHADOW_ALPHA: 0.3,          // Shadow transparency
    SHADOW_OFFSET_X: 2,         // Horizontal shadow offset
    SHADOW_OFFSET_Y: 30,        // Vertical shadow offset (below character)
    SHADOW_COLOR: 0x000000,     // Black shadow
    
    // Casting progress bar configuration
    CASTING_BAR_WIDTH: 60,      // Progress bar width
    CASTING_BAR_HEIGHT: 8,      // Progress bar height
    CASTING_BAR_OFFSET_Y: -45,  // Offset above character
    CASTING_BAR_BACKGROUND_COLOR: 0x333333,  // Dark gray background
    CASTING_BAR_BORDER_COLOR: 0x000000,     // Black border
    CASTING_BAR_PROGRESS_COLOR: 0x00FF00,   // Green progress (will be overridden by team color)
    CASTING_BAR_BORDER_WIDTH: 1            // Border thickness
  },

  // UI configuration
  UI: {
    CHARACTER_CARD_WIDTH: 260,
    CHARACTER_CARD_HEIGHT: 180,
    CHARACTER_CARD_OFFSET_X: 280,
    CHARACTER_CARD_OFFSET_Y: 20,
    CARD_BORDER_WIDTH: 3,
    CARD_PADDING: 15,
    TEXT_LINE_HEIGHT: 25,
    ENERGY_BAR_Y: 115,
    ENERGY_BAR_WIDTH: 230,
    ENERGY_BAR_HEIGHT: 25,
    ENERGY_PERCENT_Y: 127,
    ENERGY_PERCENT_X: 130,
    CLOSE_BUTTON_SIZE: 30,
    CLOSE_BUTTON_X: 220,
    CLOSE_BUTTON_Y: 10,
    CLOSE_BUTTON_TEXT_X: 235,
    CLOSE_BUTTON_TEXT_Y: 25,
    CLOSE_BUTTON_BORDER: 2,
    TEXT_FONT_SIZE: 16,
    PERCENT_FONT_SIZE: 14,
    CLOSE_FONT_SIZE: 18,
    TEXT_STROKE_THICKNESS: 2
  },

  // Animation configuration
  ANIMATION: {
    DEATH_DURATION: 2000,
    ATTACK_DURATION: 250,
    ATTACK_FLASH_DURATION: 200,    // Magic number extracted
    CHARACTER_REMOVE_DELAY: 100,   // Magic number extracted
    ENERGIZER_DURATION: 1000,
    ABSORPTION_DURATION: 500
  },

  // Visual effects
  EFFECTS: {
    SPELL_TETHER_WIDTH: 3,
    SPELL_PARTICLE_COUNT: 5,
    SPELL_PROGRESS_RADIUS: 15,
    PULSE_SCALE_VARIATION: 0.2,
    
    // Attack projectile
    PROJECTILE_SIZE: 6,
    PROJECTILE_CENTER_SIZE: 6,
    PROJECTILE_CENTER_OFFSET: 3,
    PROJECTILE_RANGE: 1,
    PROJECTILE_ALPHA: 0.8,
    
    // Energy effects
    ENERGY_GLOW_RINGS: 4,
    ENERGY_GLOW_RING_BASE: 2,
    ENERGY_GLOW_RING_SIZE: 8,
    ENERGY_GLOW_FADE: 0.15,
    ENERGY_GLOW_BLOCK_SIZE: 8,
    ENERGY_GLOW_SCALE: 0.8,
    ENERGY_GLOW_PULSE: 0.2,
    
    // Absorption effects
    ABSORPTION_RINGS: 4,
    ABSORPTION_RING_SIZE: 3,
    ABSORPTION_BLOCK_SIZE: 4,
    ABSORPTION_CENTER_SIZE: 4,
    ABSORPTION_CENTER_OFFSET: 2,
    ABSORPTION_SCALE_MULTIPLIER: 2,
    
    // Orb effects
    ORB_PIXEL_BLOCKS: 4,           // Reduced from 6 to make orbs smaller
    ORB_CORE_RANGE: 1.5,           // Reduced from 2.5
    ORB_GLOW_RANGE_MIN: 1.5,       // Reduced from 2.5
    ORB_GLOW_RANGE_MAX: 2.5,       // Reduced from 3.5
    ORB_CORE_GRID_MIN: -1,         // Core grid bounds
    ORB_CORE_GRID_MAX: 1,          // Core grid bounds (3x3 instead of 5x5)
    ORB_GLOW_GRID_MIN: -2,         // Glow grid bounds
    ORB_GLOW_GRID_MAX: 2,          // Glow grid bounds (5x5 instead of 7x7)
    ORB_GLOW_ALPHA: 0.3,           // Magic number extracted
    ORB_PULSE_SCALE: 0.2,          // Magic number extracted
    ORB_PULSE_SPEED: 0.05,         // Magic number extracted
    
    // Spell effects
    SPELL_PARTICLE_SIZE: 3,
    SPELL_TETHER_THICKNESS: 2,
    SPELL_ALPHA_BASE: 0.7,
    SPELL_ALPHA_VARIATION: 0.3,
    SPELL_PULSE_SPEED: 0.01,
    SPELL_PARTICLE_SPEED: 0.002,
    SPELL_BORDER_ALPHA: 0.5
  },

  // Colors
  COLORS: {
    // Soul casting colors
    DARK_SOUL_CASTING: 0x9C27B0,
    LIGHT_SOUL_CASTING: 0xFFD700,
    DARK_SOUL_PREPARING: 0xB855D6,
    LIGHT_SOUL_PREPARING: 0xFFE066,
    
    // Orb colors
    LIGHT_ORB_COLORS: [0xFFD700, 0xE6C200, 0xCCAA00, 0xB39200],
    DARK_ORB_COLORS: [0x9C27B0, 0x8A23A0, 0x781F90, 0x661B80],
    LIGHT_ORB_GLOW: 0xFFD700,
    DARK_ORB_GLOW: 0x9C27B0,
    
    // Attack effects
    ATTACK_PROJECTILE: [0xFF0000, 0xDD0000, 0xBB0000, 0x990000],
    ATTACK_CENTER: 0xFFFFFF,
    ATTACK_FLASH: 0xFF0000,
    
    // Energy effects
    ENERGY_GLOW: [0x0099FF, 0x0077DD, 0x0055BB, 0x003399],
    ABSORPTION_COLORS: [0x0099FF, 0x0077DD, 0x0055BB, 0x003399],
    
    // UI colors
    UI_BACKGROUND: 0x000000,
    UI_BORDER: 0xFFFFFF,
    UI_TEXT: 0xFFFFFF,
    UI_CLOSE_BUTTON: 0xFF0000,
    
    // Energy bar colors
    ENERGY_HIGH: 0x00FF00,
    ENERGY_MEDIUM: 0xFFFF00,
    ENERGY_LOW: 0xFF0000,
    ENERGY_BACKGROUND: 0x333333
  },

  // Tile transformation
  TILE_TRANSFORM: {
    GRAY_TARGET_COLOR: 0x555555,
    GREEN_TARGET_COLOR: 0x88FF88,
    PULSE_SPEED: 0.01,
    BASE_ALPHA: 0.3,
    ALPHA_VARIATION: 0.2,
    CRACKLE_LINES: 5,
    BORDER_GLOW_BASE: 2,
    BORDER_GLOW_VARIATION: 1
  },

  // Map/Tile configuration
  MAP: {
    TILE_TEXTURE_WIDTH: 64,     // New tile texture width
    TILE_TEXTURE_HEIGHT: 64,    // New tile texture height
    TILE_DISPLAY_WIDTH: 64,     // Square tiles: 64x64 pixels
    TILE_DISPLAY_HEIGHT: 64,    // Square tiles: 64x64 pixels
    
    // Calculated tile counts for 1500x900 resolution
    TILES_WIDTH: 23,            // 1500 / 64 = 23.4 -> 23 tiles wide
    TILES_HEIGHT: 14            // 900 / 64 = 14.06 -> 14 tiles high
  },

  // Day/Night cycle configuration
  DAY_NIGHT: {
    // Visual indicator settings
    SUN_MOON_SIZE: 80,          // Size of sun/moon icons (made slightly bigger)
    SUN_MOON_POSITION_X: 710,   // X position - center of 1500px wide screen
    SUN_MOON_POSITION_Y: 50,    // Y position from top
    
    // Time display settings
    TIME_DISPLAY_X: 50,         // X position for time text
    TIME_DISPLAY_Y: 120,        // Y position for time text
    TIME_FONT_SIZE: 16,
    TIME_TEXT_COLOR: 0xFFFFFF,
    
    // Visual effects
    DAY_BACKGROUND_TINT: 0xFFFFFF,    // Normal white tint for day
    NIGHT_BACKGROUND_TINT: 0x8888CC,  // Lighter blue tint for night
    DAWN_BACKGROUND_TINT: 0xFFCC88,   // Orange tint for dawn
    DUSK_BACKGROUND_TINT: 0xFF8844,   // Deeper orange for dusk
    
    TRANSITION_SPEED: 0.1,     // How fast visual transitions occur
  }
};
