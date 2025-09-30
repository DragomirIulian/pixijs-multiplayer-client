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
        const config = GameConfig.DISASTER_EVENTS.FREEZING_SNOW;
        
        if (config.ENABLED && timeSinceLastDisaster >= config.COOLDOWN) {
          // Roll for disaster trigger
          if (Math.random() < config.TRIGGER_CHANCE) {
            this.triggerFreezingSnow();
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

    // Only apply effects once at the start of the disaster
    if (!this.activeDisaster.effectsApplied) {
      this.activeDisaster.effectsApplied = true;

      const soulsArray = Array.from(souls.values()).filter(soul => !soul.isDead);
      const deathCount = Math.floor(soulsArray.length * this.activeDisaster.deathPercentage);

      // Randomly select souls to die
      const shuffled = soulsArray.sort(() => Math.random() - 0.5);
      const victimsToKill = shuffled.slice(0, deathCount);

      // Just mark them as dead - let handleSoulDeaths() handle the death animation
      victimsToKill.forEach(soul => {
        soul.isDead = true;
      });

      console.log(`[Disaster] Freezing Snow killed ${deathCount} souls out of ${soulsArray.length}`);
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
}

module.exports = DisasterEventSystem;
