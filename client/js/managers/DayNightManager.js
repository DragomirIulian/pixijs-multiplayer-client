import { Sprite, Text, Container, Assets, Graphics } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from '../config/clientConfig.js';

/**
 * Day/Night Manager for Client
 * Handles visual indicators and lighting effects for the day/night cycle
 */
export class DayNightManager {
  constructor(app, gameMap) {
    console.log('DayNightManager constructor called!');
    this.app = app;
    this.gameMap = gameMap; // Reference to game map for applying tints
    this.container = new Container();
    this.container.zIndex = 1000; // High z-index to ensure it's on top
    this.container.position.set(0, 0); // Ensure container is positioned correctly
    
    // Sun and moon sprites
    this.sunSprite = null;
    this.moonSprite = null;
    
    // Time display text
    this.timeText = null;
    
    // Current day/night state
    this.currentPhase = 'day';
    this.currentProgress = 0;
    this.ambientLight = 1.0;
    this.cycleProgress = 0;
    
    // Background tint for lighting effects
    this.backgroundTint = ClientConfig.DAY_NIGHT.DAY_BACKGROUND_TINT;
    this.targetTint = ClientConfig.DAY_NIGHT.DAY_BACKGROUND_TINT;
    
    this.initializeUI();
  }

  async initializeUI() {
    console.log('DayNightManager: Starting UI initialization...');
    
    try {
      // Load sun and moon textures
      await this.loadTextures();
      
      // Skip creating time display text (removed per request)
      
      // Initially show sun (day)
      this.updateVisualIndicators();
      
      console.log('DayNightManager UI initialized successfully');
      
    } catch (error) {
      console.error('Error initializing DayNightManager UI:', error);
      console.error('Full error:', error);
    }
    
    // Add container to app stage LAST
    this.app.stage.addChild(this.container);
    this.container.visible = true;
    console.log('Container added to stage with', this.container.children.length, 'children');
  }

  async loadTextures() {
    console.log('Loading sun/moon textures...');
    
    // Create sun sprite
    const sunTexture = await Assets.load('./resources/sun.png');
    this.sunSprite = new Sprite(sunTexture);
    this.sunSprite.width = ClientConfig.DAY_NIGHT.SUN_MOON_SIZE;
    this.sunSprite.height = ClientConfig.DAY_NIGHT.SUN_MOON_SIZE;
    this.sunSprite.x = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_X;
    this.sunSprite.y = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_Y;
    console.log('Sun sprite created at:', this.sunSprite.x, this.sunSprite.y, 'size:', this.sunSprite.width, 'x', this.sunSprite.height);
    
    // Create moon sprite
    const moonTexture = await Assets.load('./resources/moon3.png');
    this.moonSprite = new Sprite(moonTexture);
    this.moonSprite.width = ClientConfig.DAY_NIGHT.SUN_MOON_SIZE;
    this.moonSprite.height = ClientConfig.DAY_NIGHT.SUN_MOON_SIZE;
    this.moonSprite.x = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_X;
    this.moonSprite.y = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_Y;
    this.moonSprite.visible = false; // Initially hidden
    console.log('Moon sprite created at:', this.moonSprite.x, this.moonSprite.y, 'size:', this.moonSprite.width, 'x', this.moonSprite.height);
    
    // Add sprites to container
    this.container.addChild(this.sunSprite);
    this.container.addChild(this.moonSprite);
    
    console.log('Both sprites added to container. Container children count:', this.container.children.length);
  }

  createFallbackSprites() {
    // Create simple colored rectangles as fallbacks
    console.log('Creating fallback sprites...');
    
    // Sun fallback (yellow circle)
    const sunGraphics = new Graphics();
    sunGraphics.circle(0, 0, ClientConfig.DAY_NIGHT.SUN_MOON_SIZE / 2);
    sunGraphics.fill(0xFFDD00);
    sunGraphics.x = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_X;
    sunGraphics.y = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_Y;
    this.sunSprite = sunGraphics;
    console.log('Fallback sun created at:', sunGraphics.x, sunGraphics.y);
    
    // Moon fallback (white circle)
    const moonGraphics = new Graphics();
    moonGraphics.circle(0, 0, ClientConfig.DAY_NIGHT.SUN_MOON_SIZE / 2);
    moonGraphics.fill(0xCCCCCC);
    moonGraphics.x = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_X;
    moonGraphics.y = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_Y;
    moonGraphics.visible = false;
    this.moonSprite = moonGraphics;
    console.log('Fallback moon created at:', moonGraphics.x, moonGraphics.y);
    
    this.container.addChild(this.sunSprite);
    this.container.addChild(this.moonSprite);
    
    console.log('Fallback sprites added to container');
  }

  createTimeDisplay() {
    this.timeText = new Text({
      text: 'Day',
      style: {
        fontSize: ClientConfig.DAY_NIGHT.TIME_FONT_SIZE,
        fill: ClientConfig.DAY_NIGHT.TIME_TEXT_COLOR,
        fontFamily: 'monospace',
        stroke: 0x000000,
        strokeThickness: 2
      }
    });
    
    this.timeText.x = ClientConfig.DAY_NIGHT.TIME_DISPLAY_X;
    this.timeText.y = ClientConfig.DAY_NIGHT.TIME_DISPLAY_Y;
    this.timeText.anchor.set(0.5, 0.5);
    
    this.container.addChild(this.timeText);
  }

  /**
   * Update day/night state from server
   * @param {Object} dayNightState - State from server
   */
  updateState(dayNightState) {
    if (!dayNightState) return;
    
    this.currentPhase = dayNightState.phase;
    this.currentProgress = dayNightState.progress;
    this.ambientLight = dayNightState.ambientLight;
    this.cycleProgress = dayNightState.cycleProgress;
    
    this.updateVisualIndicators();
    this.updateBackgroundTint();
  }

  updateVisualIndicators() {
    if (!this.sunSprite || !this.moonSprite) {
      console.warn('updateVisualIndicators: Missing sprites');
      return;
    }
    
    console.log('updateVisualIndicators: Current phase =', this.currentPhase);
    
    // Update visibility based on phase
    switch (this.currentPhase) {
      case 'day':
        this.sunSprite.visible = true;
        this.moonSprite.visible = false;
        console.log('Day phase: Sun visible, Moon hidden');
        break;
      case 'night':
        this.sunSprite.visible = false;
        this.moonSprite.visible = true;
        console.log('Night phase: Sun hidden, Moon visible');
        break;
      case 'dawn':
        // Transition from moon to sun
        this.sunSprite.visible = true;
        this.moonSprite.visible = true;
        this.sunSprite.alpha = this.currentProgress;
        this.moonSprite.alpha = 1 - this.currentProgress;
        console.log('Dawn phase: Both visible, transitioning');
        break;
      case 'dusk':
        // Transition from sun to moon
        this.sunSprite.visible = true;
        this.moonSprite.visible = true;
        this.sunSprite.alpha = 1 - this.currentProgress;
        this.moonSprite.alpha = this.currentProgress;
        console.log('Dusk phase: Both visible, transitioning');
        break;
    }
    
    // Reset alpha for non-transition phases
    if (this.currentPhase === 'day' || this.currentPhase === 'night') {
      this.sunSprite.alpha = 1;
      this.moonSprite.alpha = 1;
    }
  }

  updateBackgroundTint() {
    // Determine target tint based on phase
    switch (this.currentPhase) {
      case 'day':
        this.targetTint = ClientConfig.DAY_NIGHT.DAY_BACKGROUND_TINT;
        break;
      case 'night':
        this.targetTint = ClientConfig.DAY_NIGHT.NIGHT_BACKGROUND_TINT;
        break;
      case 'dawn':
        this.targetTint = this.interpolateColor(
          ClientConfig.DAY_NIGHT.NIGHT_BACKGROUND_TINT,
          ClientConfig.DAY_NIGHT.DAWN_BACKGROUND_TINT,
          this.currentProgress
        );
        break;
      case 'dusk':
        this.targetTint = this.interpolateColor(
          ClientConfig.DAY_NIGHT.DAY_BACKGROUND_TINT,
          ClientConfig.DAY_NIGHT.DUSK_BACKGROUND_TINT,
          this.currentProgress
        );
        break;
    }
  }

  /**
   * Interpolate between two colors
   * @param {number} color1 - First color (hex)
   * @param {number} color2 - Second color (hex)
   * @param {number} factor - Interpolation factor (0-1)
   * @returns {number} Interpolated color
   */
  interpolateColor(color1, color2, factor) {
    const r1 = (color1 >> 16) & 0xFF;
    const g1 = (color1 >> 8) & 0xFF;
    const b1 = color1 & 0xFF;
    
    const r2 = (color2 >> 16) & 0xFF;
    const g2 = (color2 >> 8) & 0xFF;
    const b2 = color2 & 0xFF;
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Update method called each frame
   * @param {Object} time - PIXI ticker time
   */
  update(time) {
    // Smoothly transition background tint
    if (this.backgroundTint !== this.targetTint) {
      const currentR = (this.backgroundTint >> 16) & 0xFF;
      const currentG = (this.backgroundTint >> 8) & 0xFF;
      const currentB = this.backgroundTint & 0xFF;
      
      const targetR = (this.targetTint >> 16) & 0xFF;
      const targetG = (this.targetTint >> 8) & 0xFF;
      const targetB = this.targetTint & 0xFF;
      
      const speed = ClientConfig.DAY_NIGHT.TRANSITION_SPEED;
      const newR = Math.round(currentR + (targetR - currentR) * speed);
      const newG = Math.round(currentG + (targetG - currentG) * speed);
      const newB = Math.round(currentB + (targetB - currentB) * speed);
      
      this.backgroundTint = (newR << 16) | (newG << 8) | newB;
      
      // Apply tint only to the game map background, not characters
      if (this.gameMap && this.gameMap.container) {
        this.gameMap.container.tint = this.backgroundTint;
      }
    }
    
    // Add subtle floating animation to sun/moon
    if (this.sunSprite && this.sunSprite.visible) {
      this.sunSprite.y = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_Y + Math.sin(time.elapsedMS * 0.001) * 3;
    }
    if (this.moonSprite && this.moonSprite.visible) {
      this.moonSprite.y = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_Y + Math.sin(time.elapsedMS * 0.001) * 3;
    }
  }

  /**
   * Get current phase information for other systems
   * @returns {Object} Current phase info
   */
  getCurrentPhaseInfo() {
    return {
      phase: this.currentPhase,
      progress: this.currentProgress,
      ambientLight: this.ambientLight,
      cycleProgress: this.cycleProgress
    };
  }
}
