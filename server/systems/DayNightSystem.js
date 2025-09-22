const GameConfig = require('../config/gameConfig');

/**
 * Day/Night Cycle System
 * Manages the game's day/night cycle and related effects
 */
class DayNightSystem {
  constructor() {
    this.cycleStartTime = Date.now();
    this.currentPhase = 'day'; // 'day', 'night', 'dawn', 'dusk'
    this.currentProgress = 0; // 0-1 representing progress through current phase
    this.ambientLight = GameConfig.DAY_NIGHT.DAY_AMBIENT_LIGHT;
  }

  /**
   * Update the day/night cycle
   * @returns {Array} Array of events to broadcast
   */
  update() {
    const events = [];
    const currentTime = Date.now();
    const elapsed = currentTime - this.cycleStartTime;
    const cycleDuration = GameConfig.DAY_NIGHT.CYCLE_DURATION;
    
    // Calculate cycle progress (0-1)
    const cycleProgress = (elapsed % cycleDuration) / cycleDuration;
    
    // Determine current phase and progress within that phase
    const previousPhase = this.currentPhase;
    const { phase, progress } = this.calculatePhaseAndProgress(cycleProgress);
    
    this.currentPhase = phase;
    this.currentProgress = progress;
    
    // Update ambient light based on phase
    this.updateAmbientLight();
    
    // If phase changed, broadcast the change
    if (previousPhase !== this.currentPhase) {
      events.push({
        type: 'day_night_phase_change',
        phase: this.currentPhase,
        progress: this.currentProgress,
        ambientLight: this.ambientLight,
        cycleProgress: cycleProgress
      });
    }
    
    return events;
  }

  /**
   * Calculate the current phase and progress within that phase
   * @param {number} cycleProgress - Overall cycle progress (0-1)
   * @returns {Object} Object with phase and progress
   */
  calculatePhaseAndProgress(cycleProgress) {
    const dayDuration = GameConfig.DAY_NIGHT.DAY_DURATION;
    const nightDuration = GameConfig.DAY_NIGHT.NIGHT_DURATION;
    const transitionDuration = GameConfig.DAY_NIGHT.TRANSITION_DURATION;
    
    if (cycleProgress < dayDuration) {
      // Day phase
      return {
        phase: 'day',
        progress: cycleProgress / dayDuration
      };
    } else if (cycleProgress < dayDuration + transitionDuration) {
      // Dusk transition
      const transitionProgress = (cycleProgress - dayDuration) / transitionDuration;
      return {
        phase: 'dusk',
        progress: transitionProgress
      };
    } else if (cycleProgress < dayDuration + transitionDuration + nightDuration) {
      // Night phase
      const nightStart = dayDuration + transitionDuration;
      const nightProgress = (cycleProgress - nightStart) / nightDuration;
      return {
        phase: 'night',
        progress: nightProgress
      };
    } else {
      // Dawn transition
      const dawnStart = dayDuration + transitionDuration + nightDuration;
      const dawnProgress = (cycleProgress - dawnStart) / transitionDuration;
      return {
        phase: 'dawn',
        progress: dawnProgress
      };
    }
  }

  /**
   * Update ambient light based on current phase
   */
  updateAmbientLight() {
    const dayLight = GameConfig.DAY_NIGHT.DAY_AMBIENT_LIGHT;
    const nightLight = GameConfig.DAY_NIGHT.NIGHT_AMBIENT_LIGHT;
    
    switch (this.currentPhase) {
      case 'day':
        this.ambientLight = dayLight;
        break;
      case 'night':
        this.ambientLight = nightLight;
        break;
      case 'dawn':
        // Transition from night to day
        this.ambientLight = nightLight + (dayLight - nightLight) * this.currentProgress;
        break;
      case 'dusk':
        // Transition from day to night
        this.ambientLight = dayLight - (dayLight - nightLight) * this.currentProgress;
        break;
    }
  }

  /**
   * Get the current movement speed multiplier for a specific team
   * @param {string} teamType - 'light-soul' or 'dark-soul'
   * @returns {number} Movement speed multiplier
   */
  getMovementMultiplier(teamType) {
    if (this.currentPhase === 'day' && teamType === 'light-soul') {
      return GameConfig.DAY_NIGHT.LIGHT_TEAM_DAY_SPEED_MULTIPLIER;
    }
    if (this.currentPhase === 'night' && teamType === 'dark-soul') {
      return GameConfig.DAY_NIGHT.DARK_TEAM_NIGHT_SPEED_MULTIPLIER;
    }
    return 1.0; // Normal speed for other combinations
  }

  /**
   * Get the current energy multiplier for orb collection
   * @returns {number} Energy multiplier
   */
  getEnergyMultiplier() {
    if (this.currentPhase === 'night') {
      return GameConfig.DAY_NIGHT.NIGHT_ENERGY_MULTIPLIER;
    }
    return 1.0; // Normal energy during day
  }

  /**
   * Get the current spell CAST TIME multiplier for a specific team
   * @param {string} teamType - 'light-soul' or 'dark-soul'
   * @returns {number} Spell cast time multiplier (lower = faster casting)
   */
  getSpellCastTimeMultiplier(teamType) {
    if (this.currentPhase === 'day' && teamType === 'light-soul') {
      return GameConfig.DAY_NIGHT.LIGHT_TEAM_DAY_CAST_TIME_MULTIPLIER;
    }
    if (this.currentPhase === 'night' && teamType === 'dark-soul') {
      return GameConfig.DAY_NIGHT.DARK_TEAM_NIGHT_CAST_TIME_MULTIPLIER;
    }
    return 1.0; // Normal cast time for other combinations
  }

  /**
   * Get current day/night state for client synchronization
   * @returns {Object} Current day/night state
   */
  getState() {
    const currentTime = Date.now();
    const elapsed = currentTime - this.cycleStartTime;
    const cycleDuration = GameConfig.DAY_NIGHT.CYCLE_DURATION;
    const cycleProgress = (elapsed % cycleDuration) / cycleDuration;
    
    return {
      phase: this.currentPhase,
      progress: this.currentProgress,
      ambientLight: this.ambientLight,
      cycleProgress: cycleProgress,
      energyMultiplier: this.getEnergyMultiplier()
    };
  }

  /**
   * Check if it's currently day time
   * @returns {boolean} True if it's day
   */
  isDay() {
    return this.currentPhase === 'day' || this.currentPhase === 'dawn';
  }

  /**
   * Check if it's currently night time
   * @returns {boolean} True if it's night
   */
  isNight() {
    return this.currentPhase === 'night' || this.currentPhase === 'dusk';
  }
}

module.exports = DayNightSystem;
