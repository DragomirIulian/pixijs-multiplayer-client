/**
 * Disaster Event System
 * Manages global disaster events that affect all souls
 */

const GameConfig = require('../config/gameConfig');

class DisasterEventSystem {
  constructor() {
    this.activeDisaster = null;
    this.lastCheckTime = 0;
    this.lastDisasterTime = 0;
    this.disasterEvents = [];
    this.permanentCraters = []; // Store all craters permanently
  }

  /**
   * Update disaster event system
   * @returns {Array} Array of disaster-related events
   */
  update() {
    this.disasterEvents = [];
    const now = Date.now();

    // Check if we should evaluate for new disaster
    if (now - this.lastCheckTime >= GameConfig.DISASTER_EVENTS.CHECK_INTERVAL) {
      this.lastCheckTime = now;
      
      // Only check if no active disaster and cooldown has passed
      if (!this.activeDisaster) {
        const timeSinceLastDisaster = now - this.lastDisasterTime;
        
        // Check for freezing snow
        const snowConfig = GameConfig.DISASTER_EVENTS.FREEZING_SNOW;
        if (snowConfig.ENABLED && timeSinceLastDisaster >= snowConfig.COOLDOWN) {
          if (Math.random() < snowConfig.TRIGGER_CHANCE) {
            this.triggerFreezingSnow();
          }
        }
        
        // Check for meteorite storm (if snow didn't trigger)
        if (!this.activeDisaster) {
          const meteoriteConfig = GameConfig.DISASTER_EVENTS.METEORITE_STORM;
          if (meteoriteConfig.ENABLED && timeSinceLastDisaster >= meteoriteConfig.COOLDOWN) {
            if (Math.random() < meteoriteConfig.TRIGGER_CHANCE) {
              this.triggerMeteoriteStorm();
            }
          }
        }
      }
    }

    // Check if active disaster should end
    if (this.activeDisaster) {
      const elapsed = now - this.activeDisaster.startTime;
      
      if (elapsed >= this.activeDisaster.duration) {
        this.endDisaster();
      }
      
      // Handle meteorite storm wave impacts
      if (this.activeDisaster && this.activeDisaster.type === 'meteorite_storm') {
        this.updateMeteoriteStorm();
      }
    }

    return this.disasterEvents;
  }

  /**
   * Trigger freezing snow disaster
   */
  triggerFreezingSnow() {
    const config = GameConfig.DISASTER_EVENTS.FREEZING_SNOW;
    
    this.activeDisaster = {
      type: 'freezing_snow',
      startTime: Date.now(),
      duration: config.DURATION,
      deathPercentage: config.DEATH_PERCENTAGE
    };

    this.lastDisasterTime = Date.now();

    // Broadcast disaster start event
    this.disasterEvents.push({
      type: 'disaster_start',
      disasterType: 'freezing_snow',
      duration: config.DURATION,
      timestamp: Date.now()
    });

    console.log(`[Disaster] Freezing Snow triggered! Duration: ${config.DURATION}ms, Death rate: ${config.DEATH_PERCENTAGE * 100}%`);
  }

  /**
   * Trigger meteorite storm disaster
   */
  triggerMeteoriteStorm() {
    const config = GameConfig.DISASTER_EVENTS.METEORITE_STORM;
    
    // Calculate meteorite trajectories on server
    const meteorites = [];
    for (let i = 0; i < 5; i++) {
      const startX = 1500 + 100 + (i * 150) + Math.random() * 100;
      const startY = -100 - (i * 80) - Math.random() * 100;
      
      let targetX, targetY;
      const willHitMap = (i === 0);
      
      if (willHitMap) {
        // Pick random target avoiding nexuses
        do {
          targetX = 100 + Math.random() * 1300;
          targetY = 100 + Math.random() * 700;
          
          const lightNexusX = 3 * 64;
          const lightNexusY = 11 * 64;
          const darkNexusX = 20 * 64;
          const darkNexusY = 3 * 64;
          
          const distToLight = Math.sqrt(Math.pow(targetX - lightNexusX, 2) + Math.pow(targetY - lightNexusY, 2));
          const distToDark = Math.sqrt(Math.pow(targetX - darkNexusX, 2) + Math.pow(targetY - darkNexusY, 2));
          
          if (distToLight > 100 && distToDark > 100) break;
        } while (true);
      } else {
        targetX = -500;
        targetY = 1400;
      }
      
      meteorites.push({
        id: i,
        startX,
        startY,
        targetX,
        targetY,
        willHitMap,
        startTime: Date.now()
      });
    }
    
    this.activeDisaster = {
      type: 'meteorite_storm',
      startTime: Date.now(),
      duration: config.DURATION,
      deathPercentage: config.DEATH_PERCENTAGE,
      impactWaves: config.IMPACT_WAVES,
      waveInterval: config.WAVE_INTERVAL,
      currentWave: 0,
      lastWaveTime: 0,
      meteorites: meteorites,
      craters: [] // Will store permanent craters
    };

    this.lastDisasterTime = Date.now();

    // Broadcast disaster start event with meteorite data
    this.disasterEvents.push({
      type: 'disaster_start',
      disasterType: 'meteorite_storm',
      duration: config.DURATION,
      meteorites: meteorites,
      timestamp: Date.now()
    });

    console.log(`[Disaster] Meteorite Storm triggered! Duration: ${config.DURATION}ms, Meteorites: ${meteorites.length}`);
  }

  /**
   * Update meteorite storm progress and handle impacts
   */
  updateMeteoriteStorm() {
    if (!this.activeDisaster || this.activeDisaster.type !== 'meteorite_storm') return;

    const now = Date.now();
    const config = GameConfig.DISASTER_EVENTS.METEORITE_STORM;
    
    // Check for meteorite impacts using same calculation as client
    this.activeDisaster.meteorites.forEach(meteorite => {
      if (meteorite.hasHit || !meteorite.willHitMap) return;
      
      // Calculate current position using same frame-based method as client
      const elapsed = now - meteorite.startTime;
      const frameTime = config.FRAME_TIME;
      const frames = elapsed / frameTime;
      
      // Calculate velocity like client does
      const deltaX = meteorite.targetX - meteorite.startX;
      const deltaY = meteorite.targetY - meteorite.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const speed = config.METEORITE_SPEED;
      
      const velocityX = (deltaX / distance) * speed;
      const velocityY = (deltaY / distance) * speed;
      
      // Current position after this many frames
      const currentX = meteorite.startX + (velocityX * frames);
      const currentY = meteorite.startY + (velocityY * frames);
      
      // Check if meteorite reached target (same logic as client)
      const distToTarget = Math.sqrt(
        Math.pow(currentX - meteorite.targetX, 2) + 
        Math.pow(currentY - meteorite.targetY, 2)
      );
      
      const impactDistance = config.IMPACT_DETECTION_DISTANCE;
      const targetOffset = config.TARGET_OFFSET_THRESHOLD;
      
      if (distToTarget < impactDistance || currentY >= meteorite.targetY - targetOffset) {
        // Meteorite hit!
        meteorite.hasHit = true;
        
        // Create permanent crater on server
        const crater = {
          x: meteorite.targetX,
          y: meteorite.targetY,
          size: 30 + Math.random() * 20,
          timestamp: now
        };
        
        this.activeDisaster.craters.push(crater);
        this.permanentCraters.push(crater); // Store permanently
        
        // Broadcast crater creation
        this.disasterEvents.push({
          type: 'meteorite_impact',
          crater: crater,
          timestamp: now
        });
        
        console.log(`[Disaster] Meteorite impact at (${Math.round(crater.x)}, ${Math.round(crater.y)})`);
      }
    });
  }

  /**
   * End current disaster
   */
  endDisaster() {
    if (!this.activeDisaster) return;

    // Broadcast disaster end event
    this.disasterEvents.push({
      type: 'disaster_end',
      disasterType: this.activeDisaster.type,
      timestamp: Date.now()
    });

    console.log(`[Disaster] ${this.activeDisaster.type} ended!`);
    this.activeDisaster = null;
  }

  /**
   * Apply disaster effects to souls
   * @param {Map} souls - Map of all souls
   * @returns {Array} Events related to disaster effects (deaths)
   */
  applyDisasterEffects(souls) {
    const events = [];
    
    if (!this.activeDisaster) return events;

    if (this.activeDisaster.type === 'freezing_snow') {
      return this.applyFreezingSnowEffects(souls);
    } else if (this.activeDisaster.type === 'meteorite_storm') {
      return this.applyMeteoriteStormEffects(souls);
    }

    return events;
  }

  /**
   * Apply freezing snow effects to souls
   * @param {Map} souls - Map of all souls
   * @returns {Array} Events related to disaster effects (deaths)
   */
  applyFreezingSnowEffects(souls) {
    const events = [];
    const now = Date.now();
    const elapsed = now - this.activeDisaster.startTime;
    const progress = elapsed / this.activeDisaster.duration; // 0 to 1

    // Initialize disaster tracking on first call
    if (!this.activeDisaster.effectsInitialized) {
      this.activeDisaster.effectsInitialized = true;
      this.activeDisaster.totalSoulsAtStart = Array.from(souls.values()).filter(soul => !soul.isDead).length;
      this.activeDisaster.soulsKilledSoFar = 0;
      this.activeDisaster.lastKillTime = now;
      
      console.log(`[Disaster] Freezing Snow started - ${this.activeDisaster.totalSoulsAtStart} souls at risk`);
    }

    // Calculate how many souls should be dead by now based on progress
    const targetDeaths = Math.floor(this.activeDisaster.totalSoulsAtStart * this.activeDisaster.deathPercentage * progress);
    const soulsToKillNow = targetDeaths - this.activeDisaster.soulsKilledSoFar;

    // Kill souls gradually (but not too frequently)
    if (soulsToKillNow > 0 && (now - this.activeDisaster.lastKillTime) >= 2000) { // Kill every 2 seconds max
      const aliveSouls = Array.from(souls.values()).filter(soul => !soul.isDead);
      
      if (aliveSouls.length > 0) {
        // Randomly select souls to kill this round
        const shuffled = aliveSouls.sort(() => Math.random() - 0.5);
        const victimsToKill = shuffled.slice(0, Math.min(soulsToKillNow, aliveSouls.length));

        // Mark them as dead
        victimsToKill.forEach(soul => {
          soul.isDead = true;
        });

        this.activeDisaster.soulsKilledSoFar += victimsToKill.length;
        this.activeDisaster.lastKillTime = now;

        console.log(`[Disaster] Freezing Snow killed ${victimsToKill.length} souls (${this.activeDisaster.soulsKilledSoFar} total, ${Math.round(progress * 100)}% through disaster)`);
      }
    }

    return events;
  }

  /**
   * Apply meteorite storm effects to souls
   * @param {Map} souls - Map of all souls
   * @returns {Array} Events related to disaster effects (deaths)
   */
  applyMeteoriteStormEffects(souls) {
    const events = [];
    const now = Date.now();

    // Initialize disaster tracking on first call
    if (!this.activeDisaster.effectsInitialized) {
      this.activeDisaster.effectsInitialized = true;
      this.activeDisaster.totalSoulsAtStart = Array.from(souls.values()).filter(soul => !soul.isDead).length;
      this.activeDisaster.soulsKilledSoFar = 0;
      this.activeDisaster.soulsKilledPerWave = Math.floor(this.activeDisaster.totalSoulsAtStart * this.activeDisaster.deathPercentage / this.activeDisaster.impactWaves);
      
      console.log(`[Disaster] Meteorite Storm started - ${this.activeDisaster.totalSoulsAtStart} souls at risk, ${this.activeDisaster.soulsKilledPerWave} per wave`);
    }

    // Kill souls during wave impacts
    if (this.activeDisaster.currentWave > 0) {
      const targetDeaths = this.activeDisaster.currentWave * this.activeDisaster.soulsKilledPerWave;
      const soulsToKillNow = targetDeaths - this.activeDisaster.soulsKilledSoFar;

      if (soulsToKillNow > 0) {
        const aliveSouls = Array.from(souls.values()).filter(soul => !soul.isDead);
        
        if (aliveSouls.length > 0) {
          // Randomly select souls to kill this wave
          const shuffled = aliveSouls.sort(() => Math.random() - 0.5);
          const victimsToKill = shuffled.slice(0, Math.min(soulsToKillNow, aliveSouls.length));

          // Mark them as dead
          victimsToKill.forEach(soul => {
            soul.isDead = true;
          });

          this.activeDisaster.soulsKilledSoFar += victimsToKill.length;

          console.log(`[Disaster] Meteorite Storm wave ${this.activeDisaster.currentWave} killed ${victimsToKill.length} souls (${this.activeDisaster.soulsKilledSoFar} total)`);
        }
      }
    }

    return events;
  }

  /**
   * Get current disaster state
   * @returns {Object|null} Current disaster or null
   */
  getActiveDisaster() {
    return this.activeDisaster;
  }

  /**
   * Check if a disaster is currently active
   * @returns {boolean}
   */
  isDisasterActive() {
    return this.activeDisaster !== null;
  }

  /**
   * Get all permanent craters for new clients
   * @returns {Array} Array of all craters
   */
  getPermanentCraters() {
    console.log(`[DEBUG] Server has ${this.permanentCraters.length} permanent craters:`, this.permanentCraters);
    return this.permanentCraters;
  }
}

module.exports = DisasterEventSystem;
