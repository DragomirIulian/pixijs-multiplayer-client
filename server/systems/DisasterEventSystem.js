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
