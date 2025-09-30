import { Graphics, Container, Sprite, Assets } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from '../config/clientConfig.js';

/**
 * Disaster Effects Manager
 * Manages visual effects for global disaster events
 */
export class DisasterEffectsManager {
  constructor(app) {
    this.app = app;
    this.activeDisaster = null;
    this.snowParticles = [];
    this.disasterContainer = null;
    this.blueTintOverlay = null;
    this.originalTints = new Map(); // Store original tints of objects
    this.snowflakeTexture = null;
    this.textureLoaded = false;
    this.pendingDisaster = null; // Store disaster to start after texture loads
    
    // Transition properties
    this.isTransitioning = false;
    this.transitionStartTime = 0;
    this.transitionDuration = 0; // Will be set from config when starting transitions
    this.targetAlpha = 0;
    this.currentAlpha = 0;
    
    this.initializeTextures();
  }

  /**
   * Initialize textures for particles
   */
  async initializeTextures() {
    try {
      this.snowflakeTexture = await Assets.load('./resources/snowflake-2.png');
      this.textureLoaded = true;
      console.log('[DisasterEffectsManager] Snowflake texture loaded');
      
      // Start pending disaster if there was one waiting
      if (this.pendingDisaster) {
        console.log('[DisasterEffectsManager] Starting pending disaster after texture load');
        this.startDisaster(this.pendingDisaster.type, this.pendingDisaster.duration);
        this.pendingDisaster = null;
      }
    } catch (error) {
      console.warn('[DisasterEffectsManager] Failed to load snowflake texture, using fallback:', error);
      this.textureLoaded = true; // Mark as loaded even if failed, so we can use fallback
      
      // Start pending disaster with fallback
      if (this.pendingDisaster) {
        console.log('[DisasterEffectsManager] Starting pending disaster with fallback graphics');
        this.startDisaster(this.pendingDisaster.type, this.pendingDisaster.duration);
        this.pendingDisaster = null;
      }
    }
  }

  /**
   * Start a disaster effect
   * @param {string} disasterType - Type of disaster (e.g., 'freezing_snow')
   * @param {number} duration - Duration in milliseconds
   */
  startDisaster(disasterType, duration) {
    // If texture isn't loaded yet, store the disaster to start later
    if (!this.textureLoaded) {
      console.log('[DisasterEffectsManager] Texture not loaded yet, storing pending disaster');
      this.pendingDisaster = { type: disasterType, duration: duration };
      return;
    }

    if (this.activeDisaster) {
      this.endDisaster();
    }

    this.activeDisaster = {
      type: disasterType,
      startTime: Date.now(),
      duration: duration
    };

    switch (disasterType) {
      case 'freezing_snow':
        this.startFreezingSnow();
        break;
      default:
        console.warn(`Unknown disaster type: ${disasterType}`);
    }
  }

  /**
   * End the current disaster effect
   */
  endDisaster() {
    if (!this.activeDisaster) return;

    switch (this.activeDisaster.type) {
      case 'freezing_snow':
        this.endFreezingSnow();
        break;
    }

    this.activeDisaster = null;
  }

  /**
   * Start freezing snow visual effect
   */
  startFreezingSnow() {
    const config = ClientConfig.DISASTER_EFFECTS.FREEZING_SNOW;

    // Create container for disaster effects
    this.disasterContainer = new Container();
    this.disasterContainer.zIndex = 1000; // Ensure it's on top of everything
    
    // Make disaster container non-interactive so clicks pass through to characters
    this.disasterContainer.interactive = false;
    this.disasterContainer.interactiveChildren = false;
    
    // Start with zero alpha for fade-in effect
    this.disasterContainer.alpha = 0;
    
    this.app.stage.addChild(this.disasterContainer);

    // Create blue tint overlay using PixiJS v8 API
    this.blueTintOverlay = new Graphics();
    this.blueTintOverlay.rect(0, 0, ClientConfig.CANVAS.WIDTH, ClientConfig.CANVAS.HEIGHT);
    this.blueTintOverlay.fill({ color: config.BLUE_TINT, alpha: config.BLUE_TINT_INTENSITY });
    
    // Make overlay non-interactive so clicks pass through to characters below
    this.blueTintOverlay.interactive = false;
    this.blueTintOverlay.interactiveChildren = false;
    
    this.disasterContainer.addChild(this.blueTintOverlay);

    // Create snowflakes AFTER overlay so they appear on top
    for (let i = 0; i < config.SNOW_PARTICLE_COUNT; i++) {
      this.createSnowflake();
    }

    // Start fade-in transition
    this.startTransition(1.0, config.FADE_IN_DURATION); // Fade to full opacity
  }


  /**
   * Create a single snowflake particle
   */
  createSnowflake() {
    const config = ClientConfig.DISASTER_EFFECTS.FREEZING_SNOW;
    let snowflake;

      // Use the actual snowflake sprite
      snowflake = new Sprite(this.snowflakeTexture);
      snowflake.anchor.set(0.5); // Center the sprite
      
      // Random scale based on size config
      const scale = (config.SNOWFLAKE_SIZE_MIN + Math.random() * (config.SNOWFLAKE_SIZE_MAX - config.SNOWFLAKE_SIZE_MIN)) / 32; // Assuming snowflake.png is ~32px
      snowflake.scale.set(scale);
      
      // Apply alpha
      snowflake.alpha = config.SNOWFLAKE_ALPHA;

    // Random starting position
    snowflake.x = Math.random() * ClientConfig.CANVAS.WIDTH;
    snowflake.y = Math.random() * ClientConfig.CANVAS.HEIGHT;

    // Random fall speed
    snowflake.fallSpeed = config.SNOWFLAKE_SPEED_MIN + Math.random() * (config.SNOWFLAKE_SPEED_MAX - config.SNOWFLAKE_SPEED_MIN);
    
    // Wind formula properties: x = x + wind * t + amp * Math.sin(freq * t + phase)
    snowflake.wind = (Math.random() - 0.5) * 0.02; // Random wind drift
    snowflake.amplitude = 0.5 + Math.random() * 1.0; // Sway amplitude
    snowflake.frequency = 0.001 + Math.random() * 0.002; // Sway frequency
    snowflake.phase = Math.random() * Math.PI * 2; // Phase offset
    snowflake.startTime = Date.now(); // Track when this snowflake was created

    // Add rotation for sprites
    if (this.snowflakeTexture) {
      snowflake.rotationSpeed = (Math.random() - 0.5); // Random rotation speed
    }

    this.disasterContainer.addChild(snowflake);
    this.snowParticles.push(snowflake);
  }

  /**
   * End freezing snow effect
   */
  endFreezingSnow() {
    const config = ClientConfig.DISASTER_EFFECTS.FREEZING_SNOW;
    // Start fade-out transition instead of immediate removal
    this.startTransition(0.0, config.FADE_OUT_DURATION); // Fade to zero opacity
  }

  /**
   * Actually remove the disaster effects (called after fade-out completes)
   */
  removeDisasterEffects() {
    // Remove all snowflakes
    this.snowParticles.forEach(snowflake => {
      if (snowflake.parent) {
        this.disasterContainer.removeChild(snowflake);
      }
    });
    this.snowParticles = [];

    // Remove overlays
    if (this.blueTintOverlay && this.blueTintOverlay.parent) {
      this.disasterContainer.removeChild(this.blueTintOverlay);
      this.blueTintOverlay = null;
    }

    // Remove disaster container
    if (this.disasterContainer && this.disasterContainer.parent) {
      this.app.stage.removeChild(this.disasterContainer);
      this.disasterContainer = null;
    }
  }

  /**
   * Start a transition (fade in or fade out)
   * @param {number} targetAlpha - Target alpha value (0.0 to 1.0)
   * @param {number} duration - Transition duration in milliseconds
   */
  startTransition(targetAlpha, duration) {
    this.isTransitioning = true;
    this.transitionStartTime = Date.now();
    this.transitionDuration = duration;
    this.targetAlpha = targetAlpha;
    this.currentAlpha = this.disasterContainer ? this.disasterContainer.alpha : 0;
  }

  /**
   * Update transition animation
   */
  updateTransition() {
    if (!this.isTransitioning || !this.disasterContainer) return;

    const elapsed = Date.now() - this.transitionStartTime;
    const progress = Math.min(elapsed / this.transitionDuration, 1.0);
    
    // Smooth easing function (ease-in-out)
    const easeProgress = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Interpolate alpha
    this.disasterContainer.alpha = this.currentAlpha + (this.targetAlpha - this.currentAlpha) * easeProgress;

    // Check if transition is complete
    if (progress >= 1.0) {
      this.isTransitioning = false;
      this.disasterContainer.alpha = this.targetAlpha;
      
      // If we faded out completely, remove the effects
      if (this.targetAlpha === 0) {
        this.removeDisasterEffects();
      }
    }
  }

  /**
   * Update disaster effects (called every frame)
   * @param {number} time - Current time
   */
  update(time) {
    // Always update transitions first
    this.updateTransition();

    // Update snowflakes if they exist (even during fade-out)
    if (this.snowParticles.length > 0) {
      this.updateSnowflakes(time);
    }
  }

  /**
   * Update snowflake positions
   * @param {number} time - Current time
   */
  updateSnowflakes(time) {
    const config = ClientConfig.DISASTER_EFFECTS.FREEZING_SNOW;

    this.snowParticles.forEach(snowflake => {
      // Move snowflake down
      snowflake.y += snowflake.fallSpeed;

      // Apply wind formula: x = x + wind * t + amp * Math.sin(freq * t + phase)
      const t = (Date.now() - snowflake.startTime) * 0.001; // Time in seconds since creation
      const windDrift = snowflake.wind * t;
      const sway = snowflake.amplitude * Math.sin(snowflake.frequency * Date.now() + snowflake.phase);
      snowflake.x += windDrift + sway;

      // Reset to top if it goes off screen
      if (snowflake.y > ClientConfig.CANVAS.HEIGHT) {
        snowflake.y = -10;
        snowflake.x = Math.random() * ClientConfig.CANVAS.WIDTH;
      }

      // Wrap horizontally
      if (snowflake.x < 0) {
        snowflake.x = ClientConfig.CANVAS.WIDTH;
      } else if (snowflake.x > ClientConfig.CANVAS.WIDTH) {
        snowflake.x = 0;
      }
    });
  }

  /**
   * Check if a disaster is currently active
   * @returns {boolean}
   */
  isDisasterActive() {
    return this.activeDisaster !== null;
  }

  /**
   * Get current disaster type
   * @returns {string|null}
   */
  getCurrentDisasterType() {
    return this.activeDisaster ? this.activeDisaster.type : null;
  }
}
