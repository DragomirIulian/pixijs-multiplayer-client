const GameConfig = require('../config/gameConfig');

/**
 * Buff Manager System
 * Centralized system for managing all team-based buffs and debuffs
 * Supports multiple sources like day/night cycles, spells, special events, etc.
 */
class BuffManager {
  constructor() {
    // Active buffs for each team
    this.teamBuffs = {
      'light': new Map(), // Map of buff IDs to buff objects
      'dark': new Map()
    };
    
    // Buff sources registry
    this.buffSources = new Set();
    
    // Events to broadcast to clients
    this.buffEvents = [];
    
    // Initialize default buff sources
    this.registerBuffSource('daynight');
    this.registerBuffSource('spells');
    this.registerBuffSource('special_events');
  }

  /**
   * Register a new buff source
   * @param {string} sourceId - Unique identifier for the buff source
   */
  registerBuffSource(sourceId) {
    this.buffSources.add(sourceId);
  }

  /**
   * Apply a buff to a team from a specific source
   * @param {string} sourceId - The source applying this buff
   * @param {string} teamType - 'light' or 'dark'
   * @param {Object} buffData - Buff configuration
   */
  applyBuff(sourceId, teamType, buffData) {
    if (!this.buffSources.has(sourceId)) {
      console.warn(`Unknown buff source: ${sourceId}`);
      return;
    }

    const team = teamType === 'light-soul' ? 'light' : 'dark';
    
    // Create buff object with metadata
    const buff = {
      id: `${sourceId}_${buffData.type}_${Date.now()}`,
      sourceId,
      type: buffData.type,
      name: buffData.name,
      description: buffData.description,
      icon: buffData.icon || 'default',
      effects: buffData.effects || {},
      duration: buffData.duration || -1, // -1 = permanent until removed
      startTime: Date.now(),
      priority: buffData.priority || 0 // Higher priority buffs display first
    };

    // Store buff using unique ID
    this.teamBuffs[team].set(buff.id, buff);

    // Broadcast buff applied event
    this.buffEvents.push({
      type: 'buff_applied',
      team: team,
      buff: this.sanitizeBuffForClient(buff)
    });
  }

  /**
   * Remove a buff from a team by source
   * @param {string} sourceId - The source removing this buff
   * @param {string} teamType - 'light' or 'dark'
   */
  removeBuff(buffId, teamType) {
    const team = teamType === 'light-soul' ? 'light' : 'dark';
    
    if (this.teamBuffs[team].has(buffId)) {
      const buff = this.teamBuffs[team].get(buffId);
      this.teamBuffs[team].delete(buffId);

      // Broadcast buff removed event
      this.buffEvents.push({
        type: 'buff_removed',
        team: team,
        buffId: buff.id,
        sourceId: buff.sourceId
      });
    }
  }

  /**
   * Clear all buffs from a specific source
   * @param {string} sourceId - The source to clear buffs from
   */
  clearBuffsBySource(sourceId) {
    ['light', 'dark'].forEach(team => {
      const buffsToRemove = [];
      this.teamBuffs[team].forEach((buff, buffId) => {
        if (buff.sourceId === sourceId) {
          buffsToRemove.push(buffId);
        }
      });
      
      buffsToRemove.forEach(buffId => {
        this.removeBuff(buffId, team === 'light' ? 'light-soul' : 'dark-soul');
      });
    });
  }

  /**
   * Update buffs (remove expired ones)
   * @returns {Array} Array of events to broadcast
   */
  update() {
    this.buffEvents = [];
    const currentTime = Date.now();

    ['light', 'dark'].forEach(team => {
      const buffs = Array.from(this.teamBuffs[team].entries());
      buffs.forEach(([buffId, buff]) => {
        if (buff.duration > 0 && currentTime - buff.startTime >= buff.duration) {
          this.removeBuff(buffId, team === 'light' ? 'light-soul' : 'dark-soul');
        }
      });
    });

    return this.buffEvents;
  }

  /**
   * Get movement speed multiplier for a team considering all active buffs
   * @param {string} teamType - 'light-soul' or 'dark-soul'
   * @returns {number} Combined movement speed multiplier
   */
  getMovementMultiplier(teamType) {
    const team = teamType === 'light-soul' ? 'light' : 'dark';
    let multiplier = 1.0;

    this.teamBuffs[team].forEach(buff => {
      if (buff.effects.speedMultiplier) {
        multiplier *= buff.effects.speedMultiplier;
      }
    });

    return multiplier;
  }

  /**
   * Get spell cast time multiplier for a team considering all active buffs
   * @param {string} teamType - 'light-soul' or 'dark-soul'
   * @returns {number} Combined spell cast time multiplier
   */
  getSpellCastTimeMultiplier(teamType) {
    const team = teamType === 'light-soul' ? 'light' : 'dark';
    let multiplier = 1.0;

    this.teamBuffs[team].forEach(buff => {
      if (buff.effects.castTimeMultiplier) {
        multiplier *= buff.effects.castTimeMultiplier;
      }
    });

    return multiplier;
  }

  /**
   * Get energy collection multiplier for a team considering all active buffs
   * @param {string} teamType - 'light-soul' or 'dark-soul'
   * @returns {number} Combined energy multiplier
   */
  getEnergyMultiplier(teamType) {
    const team = teamType === 'light-soul' ? 'light' : 'dark';
    let multiplier = 1.0;

    this.teamBuffs[team].forEach(buff => {
      if (buff.effects.energyMultiplier) {
        multiplier *= buff.effects.energyMultiplier;
      }
    });

    return multiplier;
  }

  /**
   * Get mating success multiplier for a team considering all active buffs
   * @param {string} teamType - 'light-soul' or 'dark-soul'
   * @returns {number} Combined mating multiplier
   */
  getMatingMultiplier(teamType) {
    const team = teamType === 'light-soul' ? 'light' : 'dark';
    let multiplier = 1.0;

    this.teamBuffs[team].forEach(buff => {
      if (buff.effects.matingMultiplier) {
        multiplier *= buff.effects.matingMultiplier;
      }
    });

    return multiplier;
  }

  /**
   * Get damage multiplier for a team considering all active buffs
   * @param {string} teamType - 'light-soul' or 'dark-soul'
   * @returns {number} Combined damage multiplier
   */
  getDamageMultiplier(teamType) {
    const team = teamType === 'light-soul' ? 'light' : 'dark';
    let multiplier = 1.0;

    this.teamBuffs[team].forEach(buff => {
      if (buff.effects.damageMultiplier) {
        multiplier *= buff.effects.damageMultiplier;
      }
    });

    return multiplier;
  }

  /**
   * Get all active buffs for both teams (for client display)
   * @returns {Object} Object with light and dark team buffs
   */
  getAllBuffs() {
    const result = {
      light: [],
      dark: []
    };

    ['light', 'dark'].forEach(team => {
      const buffs = Array.from(this.teamBuffs[team].values())
        .map(buff => this.sanitizeBuffForClient(buff))
        .sort((a, b) => b.priority - a.priority); // Sort by priority descending
      
      result[team] = buffs;
    });

    return result;
  }

  /**
   * Remove sensitive data from buff before sending to client
   * @param {Object} buff - Server buff object
   * @returns {Object} Client-safe buff object
   */
  sanitizeBuffForClient(buff) {
    return {
      id: buff.id,
      sourceId: buff.sourceId,
      type: buff.type,
      name: buff.name,
      description: buff.description,
      icon: buff.icon,
      effects: buff.effects,
      duration: buff.duration,
      startTime: buff.startTime,
      priority: buff.priority
    };
  }

  /**
   * Get current buff events
   * @returns {Array} Array of buff events
   */
  getBuffEvents() {
    return this.buffEvents;
  }

  /**
   * Clear buff events
   */
  clearEvents() {
    this.buffEvents = [];
  }

  /**
   * Helper method to create standard buff configurations
   */
  static createBuffConfig(type, name, description, effects, options = {}) {
    return {
      type,
      name,
      description,
      icon: options.icon || type,
      effects,
      duration: options.duration || -1,
      priority: options.priority || 0
    };
  }

  /**
   * Example method to demonstrate spell-based buffs
   * This could be called by special events, achievements, or spell effects
   */
  applyExampleSpellBuffs() {
    // Example: Apply a temporary speed curse to the light team
    this.applyBuff('spells', 'light-soul', {
      type: 'speed_curse',
      name: 'Slowness Curse',
      description: '-25% Movement Speed',
      icon: 'curse',
      effects: {
        speedMultiplier: 0.75
      },
      duration: 30000, // 30 seconds
      priority: 8
    });

    // Example: Apply a temporary damage boost to the dark team
    this.applyBuff('spells', 'dark-soul', {
      type: 'damage_blessing',
      name: 'Power Surge',
      description: '+50% Damage',
      icon: 'power',
      effects: {
        damageMultiplier: 1.5
      },
      duration: 20000, // 20 seconds
      priority: 9
    });
  }

  /**
   * Example method to demonstrate mating buffs
   */
  applyMatingBuffs() {
    // High population could give mating bonuses
    this.applyBuff('special_events', 'light-soul', {
      type: 'fertility_blessing',
      name: 'Fertility Boost',
      description: '+100% Mating Success',
      icon: 'heart',
      effects: {
        matingMultiplier: 2.0
      },
      duration: 60000, // 1 minute
      priority: 7
    });
  }
}

module.exports = BuffManager;
