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
    this.meteoriteParticles = [];
    this.craters = [];
    this.disasterContainer = null;
    this.blueTintOverlay = null;
    this.redTintOverlay = null;
    this.originalTints = new Map(); // Store original tints of objects
    this.snowflakeTexture = null;
    this.meteoriteTexture = null;
    this.craterTexture = null;
    this.textureLoaded = false;
    this.pendingDisaster = null; // Store disaster to start after texture loads
    
    // Transition properties
    this.isTransitioning = false;
    this.transitionStartTime = 0;
    this.transitionDuration = 0; // Will be set from config when starting transitions
    this.targetAlpha = 0;
    this.currentAlpha = 0;
    
    // Screen shake properties
    this.isShaking = false;
    this.shakeStartTime = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.originalStagePosition = { x: 0, y: 0 };
    
    this.initializeTextures();
  }

  /**
   * Initialize textures for particles
   */
  async initializeTextures() {
    try {
      // Load disaster textures
      this.snowflakeTexture = await Assets.load('./resources/snowflake-2.png');
      this.meteoriteTexture = await Assets.load('./resources/meteoryte_2.png');
      this.craterTexture = await Assets.load('./resources/crater.png');
      this.textureLoaded = true;
      console.log('[DisasterEffectsManager] Disaster textures loaded');
      
      // Start pending disaster if there was one waiting
      if (this.pendingDisaster) {
        console.log('[DisasterEffectsManager] Starting pending disaster after texture load');
        this.startDisaster(this.pendingDisaster.type, this.pendingDisaster.duration);
        this.pendingDisaster = null;
      }
    } catch (error) {
      console.warn('[DisasterEffectsManager] Failed to load disaster textures, using fallback:', error);
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
   * @param {Object} data - Additional disaster data from server
   */
  startDisaster(disasterType, duration, data = {}) {
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
      case 'meteorite_storm':
        this.startMeteoriteStorm(data.meteorites || []);
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
      case 'meteorite_storm':
        this.endMeteoriteStorm();
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
   * Start meteorite storm visual effect with server data
   */
  startMeteoriteStorm(serverMeteoriteData) {
    const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;

    // Create container for disaster effects
    this.disasterContainer = new Container();
    this.disasterContainer.zIndex = 1000; // Ensure it's on top of everything
    
    // Make disaster container non-interactive so clicks pass through to characters
    this.disasterContainer.interactive = false;
    this.disasterContainer.interactiveChildren = false;
    
    // Start with zero alpha for fade-in effect
    this.disasterContainer.alpha = 0;
    
    this.app.stage.addChild(this.disasterContainer);

    // Create red/orange tint overlay for apocalyptic feel
    this.redTintOverlay = new Graphics();
    this.redTintOverlay.rect(0, 0, ClientConfig.CANVAS.WIDTH, ClientConfig.CANVAS.HEIGHT);
    this.redTintOverlay.fill({ color: config.RED_TINT, alpha: config.RED_TINT_INTENSITY });
    
    // Make overlay non-interactive so clicks pass through to characters below
    this.redTintOverlay.interactive = false;
    this.redTintOverlay.interactiveChildren = false;
    
    this.disasterContainer.addChild(this.redTintOverlay);

    // Create meteorites from server data
    this.createMeteoritesFromServer(serverMeteoriteData);

    // Store original stage position for screen shake
    this.originalStagePosition.x = this.app.stage.x;
    this.originalStagePosition.y = this.app.stage.y;

    // Start fade-in transition
    this.startTransition(1.0, config.FADE_IN_DURATION); // Fade to full opacity
  }

  /**
   * Create meteorites from server data
   */
  createMeteoritesFromServer(serverMeteoriteData) {
    // Clear any existing meteorites
    this.meteoriteParticles = [];
    
    // Create meteorites using server-calculated data
    serverMeteoriteData.forEach(meteoriteData => {
      this.createMeteoriteFromServerData(meteoriteData);
    });
  }

  /**
   * Create a meteorite from server data
   */
  createMeteoriteFromServerData(meteoriteData) {
    const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;
    let meteorite;

    if (this.meteoriteTexture) {
      meteorite = new Sprite(this.meteoriteTexture);
      meteorite.anchor.set(0.5);
      meteorite.scale.set(config.METEORITE_SCALE);
      meteorite.alpha = config.METEORITE_ALPHA;
    }

    // Use server-calculated trajectory
    const deltaX = meteoriteData.targetX - meteoriteData.startX;
    const deltaY = meteoriteData.targetY - meteoriteData.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    meteorite.velocityX = (deltaX / distance) * config.METEORITE_SPEED;
    meteorite.velocityY = (deltaY / distance) * config.METEORITE_SPEED;

    // Set starting position
    meteorite.x = meteoriteData.startX;
    meteorite.y = meteoriteData.startY;

    // Store server data
    meteorite.hasHit = false;
    meteorite.willHitMap = meteoriteData.willHitMap;
    meteorite.targetX = meteoriteData.targetX;
    meteorite.targetY = meteoriteData.targetY;
    meteorite.meteoriteId = meteoriteData.id;

    this.disasterContainer.addChild(meteorite);
    this.meteoriteParticles.push(meteorite);
  }

  
  /**
   * Create a permanent crater at impact location
   */
  createPermanentCrater(x, y) {
    const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;
    let crater;

    if (this.craterTexture) {
      // Use the actual crater sprite
      crater = new Sprite(this.craterTexture);
      crater.anchor.set(0.5); // Center the sprite
      
      // Random scale based on size config
      const scale = 0.1; // Assuming crater.png is ~64px
      crater.scale.set(scale);
      
      // Apply alpha
      crater.alpha = config.CRATER_ALPHA;
    } 

    crater.x = x;
    crater.y = y;
    crater.isPermanent = true; // Mark as permanent - won't fade

    // Add directly to main stage so it stays permanently on the map
    this.app.stage.addChild(crater);
    crater.zIndex = 100; // Put craters on top so we can see them
    this.craters.push(crater);
    
    console.log(`[DEBUG] Crater created at screen position: (${x}, ${y}), canvas size: ${ClientConfig.CANVAS.WIDTH}x${ClientConfig.CANVAS.HEIGHT}`);

    // Trigger screen shake
    this.startScreenShake(config.SCREEN_SHAKE_INTENSITY, config.SCREEN_SHAKE_DURATION);
    
    console.log(`[Meteorite] Permanent crater created at (${Math.round(x)}, ${Math.round(y)})`);
  }

  /**
   * Start screen shake effect
   */
  startScreenShake(intensity, duration) {
    this.isShaking = true;
    this.shakeStartTime = Date.now();
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  /**
   * End meteorite storm effect
   */
  endMeteoriteStorm() {
    const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;
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

    // Remove all meteorites
    this.meteoriteParticles.forEach(meteorite => {
      if (meteorite.parent) {
        this.disasterContainer.removeChild(meteorite);
      }
    });
    this.meteoriteParticles = [];

    // Permanent craters are already on main stage, so don't remove them
    // Only remove non-permanent craters from disaster container
    this.craters.filter(crater => !crater.isPermanent).forEach(crater => {
      if (crater.parent) {
        this.disasterContainer.removeChild(crater);
      }
    });
    
    // Keep permanent craters in the array but clear non-permanent ones
    this.craters = this.craters.filter(crater => crater.isPermanent);

    // Remove overlays
    if (this.blueTintOverlay && this.blueTintOverlay.parent) {
      this.disasterContainer.removeChild(this.blueTintOverlay);
      this.blueTintOverlay = null;
    }

    if (this.redTintOverlay && this.redTintOverlay.parent) {
      this.disasterContainer.removeChild(this.redTintOverlay);
      this.redTintOverlay = null;
    }

    // Reset screen shake
    this.isShaking = false;
    this.app.stage.x = this.originalStagePosition.x;
    this.app.stage.y = this.originalStagePosition.y;

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

    // Update screen shake
    this.updateScreenShake();

    // Update snowflakes if they exist (even during fade-out)
    if (this.snowParticles.length > 0) {
      this.updateSnowflakes(time);
    }

    // Update meteorites if they exist
    if (this.meteoriteParticles.length > 0) {
      this.updateMeteorites(time);
    }

    // Update craters if they exist
    if (this.craters.length > 0) {
      this.updateCraters(time);
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
   * Update meteorite positions and handle impacts
   * @param {number} time - Current time
   */
  updateMeteorites(time) {
    const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;
    
    for (let i = this.meteoriteParticles.length - 1; i >= 0; i--) {
      const meteorite = this.meteoriteParticles[i];
      
      // Move meteorite along calculated trajectory
      meteorite.x += meteorite.velocityX;
      meteorite.y += meteorite.velocityY;

      // Remove meteorites when they reach target or go off screen
      if (meteorite.willHitMap) {
        const distToTarget = Math.sqrt(
          Math.pow(meteorite.x - meteorite.targetX, 2) + 
          Math.pow(meteorite.y - meteorite.targetY, 2)
        );
        
        if (distToTarget < config.IMPACT_DETECTION_DISTANCE || meteorite.y >= meteorite.targetY - config.TARGET_OFFSET_THRESHOLD) {
          meteorite.hasHit = true;
          
          // Don't create crater here - let server handle it
          console.log(`[DEBUG] Meteorite hit at (${meteorite.targetX}, ${meteorite.targetY}) - waiting for server crater`);
          // The server will send a meteorite_impact event with the crater data
          
          // Trigger screen shake
          const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;
          this.startScreenShake(config.SCREEN_SHAKE_INTENSITY, config.SCREEN_SHAKE_DURATION);
          
          // Remove meteorite
          this.disasterContainer.removeChild(meteorite);
          this.meteoriteParticles.splice(i, 1);
        }
      }
      // Remove non-hitting meteorites when they go off screen
      else if (!meteorite.willHitMap && (meteorite.y > ClientConfig.CANVAS.HEIGHT + 100 || meteorite.x < -100)) {
        this.disasterContainer.removeChild(meteorite);
        this.meteoriteParticles.splice(i, 1);
      }
      // Remove if went way off screen
      else if (meteorite.y > ClientConfig.CANVAS.HEIGHT + 200 || 
               meteorite.x < -200 || 
               meteorite.x > ClientConfig.CANVAS.WIDTH + 200) {
        this.disasterContainer.removeChild(meteorite);
        this.meteoriteParticles.splice(i, 1);
      }
    }
  }

  /**
   * Update crater effects (permanent craters don't fade)
   * @param {number} time - Current time
   */
  updateCraters(time) {
    // Permanent craters don't need any updates - they stay forever
    // This method is kept for compatibility but does nothing for meteorite craters
  }

  /**
   * Update screen shake effect
   */
  updateScreenShake() {
    if (!this.isShaking) return;

    const elapsed = Date.now() - this.shakeStartTime;
    
    if (elapsed >= this.shakeDuration) {
      // End shake
      this.isShaking = false;
      this.app.stage.x = this.originalStagePosition.x;
      this.app.stage.y = this.originalStagePosition.y;
    } else {
      // Apply shake
      const progress = elapsed / this.shakeDuration;
      const intensity = this.shakeIntensity * (1 - progress); // Fade out shake
      
      this.app.stage.x = this.originalStagePosition.x + (Math.random() - 0.5) * intensity * 2;
      this.app.stage.y = this.originalStagePosition.y + (Math.random() - 0.5) * intensity * 2;
    }
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

  /**
   * Update permanent craters from server
   * @param {Array} serverCraters - Array of crater data from server
   */
  updatePermanentCraters(serverCraters) {
    // Remove existing permanent craters that are no longer on server
    const existingCraters = this.app.stage.children.filter(child => child.isPermanentCrater);
    existingCraters.forEach(crater => {
      const stillExists = serverCraters.some(serverCrater => 
        crater.serverId === serverCrater.timestamp
      );
      if (!stillExists) {
        this.app.stage.removeChild(crater);
        console.log(`[Crater] Removed crater with ID ${crater.serverId}`);
      }
    });

    // Add new craters from server
    serverCraters.forEach(serverCrater => {
      const alreadyExists = this.app.stage.children.some(child => 
        child.isPermanentCrater && child.serverId === serverCrater.timestamp
      );

      if (!alreadyExists) {
        this.createPermanentCraterFromServer(serverCrater);
        console.log(`[Crater] Added new crater with ID ${serverCrater.timestamp} at (${serverCrater.x}, ${serverCrater.y})`);
      }
    });
  }

  /**
   * Create a permanent crater from server data
   * @param {Object} craterData - Crater data from server
   */
  createPermanentCraterFromServer(craterData) {
    const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;
    
    // Only create if we have the crater texture loaded
    if (!this.craterTexture) {
      console.warn('[Crater] Crater texture not loaded, skipping crater creation');
      return;
    }

    const crater = new Sprite(this.craterTexture);
    crater.anchor.set(0.5);
    crater.scale.set(config.CRATER_SCALE);
    crater.alpha = config.CRATER_ALPHA;
    
    crater.x = craterData.x;
    crater.y = craterData.y;
    crater.isPermanentCrater = true;
    crater.serverId = craterData.timestamp; // Use timestamp as unique ID
    crater.zIndex = config.CRATER_Z_INDEX;

    this.app.stage.addChild(crater);
    this.app.stage.sortChildren(); // Force z-index sorting
    
    console.log(`[Crater] Server crater created at (${Math.round(craterData.x)}, ${Math.round(craterData.y)})`);
  }

  /**
   * Handle meteorite impact from server
   * @param {Object} craterData - Crater data from server impact
   */
  handleMeteoriteImpact(craterData) {
    // Create the crater immediately when server says impact happened
    this.createPermanentCraterFromServer(craterData);
    
    // Trigger screen shake
    const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;
    this.startScreenShake(config.SCREEN_SHAKE_INTENSITY, config.SCREEN_SHAKE_DURATION);
  }

  /**
   * Create a visible crater that we can definitely see
   */
  createVisibleCrater(x, y) {
    console.log(`[CRATER] Creating visible crater at (${x}, ${y})`);
    
    // Use the crater texture if available
    if (this.craterTexture) {
      const config = ClientConfig.DISASTER_EFFECTS.METEORITE_STORM;
      const crater = new Sprite(this.craterTexture);
      crater.anchor.set(0.5);
      crater.scale.set(config.CRATER_SCALE);
      crater.alpha = config.CRATER_ALPHA;
      crater.x = x;
      crater.y = y;
      crater.isPermanentCrater = true;
      crater.zIndex = config.CRATER_Z_INDEX;
      
      this.app.stage.addChild(crater);
      this.app.stage.sortChildren(); // Force z-index sorting
      
      console.log(`[CRATER] Crater texture created at (${x}, ${y}) with zIndex 500`);
    } else {
      console.warn('[CRATER] No crater texture available');
    }
  }
}
