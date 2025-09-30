const GameConfig = require('../config/gameConfig');

/**
 * Day/Night Cycle System
 * Manages the game's day/night cycle and related effects
 */
class DayNightSystem {
  constructor(buffManager = null) {
    this.buffManager = buffManager;
    this.cycleStartTime = Date.now();
    this.currentPhase = 'day'; // 'day', 'night', 'dawn', 'dusk'
    this.currentProgress = 0; // 0-1 representing progress through current phase
    this.ambientLight = GameConfig.DAY_NIGHT.DAY_AMBIENT_LIGHT;
    this.lastAppliedPhase = null; // Track which phase buffs were last applied for
    
    // Apply initial buffs for the starting phase
    if (this.buffManager) {
      this.updateDayNightBuffs();
    }
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
    
    // If phase changed, broadcast the change and update buffs
    if (previousPhase !== this.currentPhase) {
      this.updateDayNightBuffs();
      
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
   * Update team buffs based on current day/night phase
   */
  updateDayNightBuffs() {
    if (!this.buffManager || this.lastAppliedPhase === this.currentPhase) {
      return; // No buff manager or phase hasn't changed
    }

    // Clear existing day/night buffs
    this.buffManager.clearBuffsBySource('daynight');

    // Apply new buffs based on current phase
    if (this.currentPhase === 'day') {
      // Light team gets day buffs
      this.buffManager.applyBuff('daynight', 'light-soul', {
        type: 'day_blessing',
        name: 'Day Blessing',
        description: `+${Math.round((GameConfig.DAY_NIGHT.LIGHT_TEAM_DAY_SPEED_MULTIPLIER - 1) * 100)}% Speed, +${Math.round((1 - GameConfig.DAY_NIGHT.LIGHT_TEAM_DAY_CAST_TIME_MULTIPLIER) * 100)}% Cast Speed`,
        icon: 'sun',
        effects: {
          speedMultiplier: GameConfig.DAY_NIGHT.LIGHT_TEAM_DAY_SPEED_MULTIPLIER,
          castTimeMultiplier: GameConfig.DAY_NIGHT.LIGHT_TEAM_DAY_CAST_TIME_MULTIPLIER
        },
        priority: 10
      });

      // Light team gets day energy bonus
      this.buffManager.applyBuff('daynight', 'light-soul', {
        type: 'day_energy',
        name: 'Day Energy',
        description: `+${Math.round((GameConfig.DAY_NIGHT.ENERGY_MULTIPLIER - 1) * 100)}% Energy Collection`,
        icon: 'energy',
        effects: {
          energyMultiplier: GameConfig.DAY_NIGHT.ENERGY_MULTIPLIER
        },
        priority: 5
      });
    } else if (this.currentPhase === 'night') {
      // Dark team gets night buffs
      this.buffManager.applyBuff('daynight', 'dark-soul', {
        type: 'night_blessing',
        name: 'Night Blessing',
        description: `+${Math.round((GameConfig.DAY_NIGHT.DARK_TEAM_NIGHT_SPEED_MULTIPLIER - 1) * 100)}% Speed, +${Math.round((1 - GameConfig.DAY_NIGHT.DARK_TEAM_NIGHT_CAST_TIME_MULTIPLIER) * 100)}% Cast Speed`,
        icon: 'moon',
        effects: {
          speedMultiplier: GameConfig.DAY_NIGHT.DARK_TEAM_NIGHT_SPEED_MULTIPLIER,
          castTimeMultiplier: GameConfig.DAY_NIGHT.DARK_TEAM_NIGHT_CAST_TIME_MULTIPLIER
        },
        priority: 10
      });

      // Dark team gets night energy bonus
      this.buffManager.applyBuff('daynight', 'dark-soul', {
        type: 'night_energy',
        name: 'Night Energy',
        description: `+${Math.round((GameConfig.DAY_NIGHT.ENERGY_MULTIPLIER - 1) * 100)}% Energy Collection`,
        icon: 'energy',
        effects: {
          energyMultiplier: GameConfig.DAY_NIGHT.ENERGY_MULTIPLIER
        },
        priority: 5
      });
    }

    this.lastAppliedPhase = this.currentPhase;
  }

  /**
   * Get the current movement speed multiplier for a specific team
   * @param {string} teamType - 'light-soul' or 'dark-soul'
   * @returns {number} Movement speed multiplier
   * @deprecated Use BuffManager.getMovementMultiplier() instead
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
      return GameConfig.DAY_NIGHT.ENERGY_MULTIPLIER;
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
