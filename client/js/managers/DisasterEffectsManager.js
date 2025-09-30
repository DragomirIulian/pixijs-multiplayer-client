import { Graphics, Container } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
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
  }

  /**
   * Start a disaster effect
   * @param {string} disasterType - Type of disaster (e.g., 'freezing_snow')
   * @param {number} duration - Duration in milliseconds
   */
  startDisaster(disasterType, duration) {
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
    this.app.stage.addChild(this.disasterContainer);

    // Create blue tint overlay using PixiJS v8 API
    this.blueTintOverlay = new Graphics();
    this.blueTintOverlay.rect(0, 0, ClientConfig.CANVAS.WIDTH, ClientConfig.CANVAS.HEIGHT);
    this.blueTintOverlay.fill({ color: config.BLUE_TINT, alpha: config.BLUE_TINT_INTENSITY });
    this.disasterContainer.addChild(this.blueTintOverlay);

    // Create snowflakes AFTER overlay so they appear on top
    for (let i = 0; i < config.SNOW_PARTICLE_COUNT; i++) {
      this.createSnowflake();
    }
  }


  /**
   * Create a single snowflake particle
   */
  createSnowflake() {
    const config = ClientConfig.DISASTER_EFFECTS.FREEZING_SNOW;

    const snowflake = new Graphics();
    const size = config.SNOWFLAKE_SIZE_MIN + Math.random() * (config.SNOWFLAKE_SIZE_MAX - config.SNOWFLAKE_SIZE_MIN);
    
    // Draw a snowflake using filled rectangles for visibility
    snowflake.rect(-size/2, -size/2, size, size);
    snowflake.fill({ color: 0xFFFFFF, alpha: config.SNOWFLAKE_ALPHA });

    // Random starting position
    snowflake.x = Math.random() * ClientConfig.CANVAS.WIDTH;
    snowflake.y = Math.random() * ClientConfig.CANVAS.HEIGHT;

    // Random fall speed
    snowflake.fallSpeed = config.SNOWFLAKE_SPEED_MIN + Math.random() * (config.SNOWFLAKE_SPEED_MAX - config.SNOWFLAKE_SPEED_MIN);
    
    // Random sway properties
    snowflake.swayOffset = Math.random() * Math.PI * 2;
    snowflake.swaySpeed = 0.02 + Math.random() * 0.03;

    this.disasterContainer.addChild(snowflake);
    this.snowParticles.push(snowflake);
  }

  /**
   * End freezing snow effect
   */
  endFreezingSnow() {
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
   * Update disaster effects (called every frame)
   * @param {number} time - Current time
   */
  update(time) {
    if (!this.activeDisaster) return;

    // Update snowflakes if freezing snow is active
    if (this.activeDisaster.type === 'freezing_snow') {
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

      // Add horizontal sway
      snowflake.x += Math.sin(time * snowflake.swaySpeed + snowflake.swayOffset) * config.SNOWFLAKE_SWAY_AMOUNT;

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
