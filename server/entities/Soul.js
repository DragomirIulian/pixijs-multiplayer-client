const GameConfig = require('../config/gameConfig');
const { SoulStateMachine, SoulStates } = require('./SoulStateMachine');

/**
 * Soul entity class
 * Encapsulates all soul behavior and properties
 */
class Soul {
  constructor(id, type, x, y, tileMap = null, isChild = false, movementSystem = null, spellSystem = null, dayNightSystem = null) {
    this.id = id;
    this.name = `${type === 'dark-soul' ? 'Dark' : 'Light'} Soul`;
    this.type = type;
    this.teamType = type === 'dark-soul' ? 'gray' : 'green';
    
    // Position and movement
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    
    // Fallback casting system for stuck souls
    this.seekingStartTime = null;
    this.shouldUseFallbackCasting = false;
    
    // Energy system
    this.energy = GameConfig.SOUL.STARTING_ENERGY_MIN + 
                  Math.floor(Math.random() * (GameConfig.SOUL.STARTING_ENERGY_MAX - GameConfig.SOUL.STARTING_ENERGY_MIN));
    this.maxEnergy = GameConfig.SOUL.MAX_ENERGY;
    
    // Combat and interaction
    this.lastAttackTime = 0;
    this.lastAttackedTime = 0;
    this.isRetreating = false;
    
    // Spell casting - removed boolean flags, now handled by state machine
    this.prepareTarget = null;
    
    // Defense
    this.isDefending = false;
    this.defendingTarget = null;
    this.enemyCastingDetected = false;
    this.castingEnemyId = null;
    
    // Mating and reproduction
    this.isChild = isChild;
    this.birthTime = isChild ? Date.now() : null;
    this.matingPartner = null;
    this.matingStartTime = null;
    this.isMating = false;
    this.lastMatingTime = 0;
    this.readyToCompleteMating = false;
    
    // Sleep system
    this.isSleeping = false;
    this.sleepStartTime = null;
    this.lastSleepTime = 0;
    this.sleepCyclesUsedToday = 0;
    this.lastSleepResetTime = Date.now();
    
    // State machine
    this.stateMachine = new SoulStateMachine(this, tileMap, movementSystem, spellSystem, dayNightSystem);
  }

  update(allSouls, activeDisaster = null) {
    this.stateMachine.update(allSouls, activeDisaster);
    this.updateEnergy();
    this.updateRetreat();
    this.updateSleepCycle(this.stateMachine.dayNightSystem);
    this.checkDeath();
  }

  checkDeath() {
    if (this.energy <= 0) {
      this.isDead = true;
    }
  }

  updateEnergy() {
    // Energy draining - souls slowly lose energy over time (but not while sleeping)
    if (!this.isSleeping && Math.random() < GameConfig.SOUL.ENERGY_DRAIN_CHANCE) {
      this.energy = Math.max(0, this.energy - GameConfig.SOUL.ENERGY_DRAIN_AMOUNT);
    }
  }

  updateRetreat() {
    // Check retreat behavior
    if (this.isRetreating && 
        Date.now() - this.lastAttackedTime > GameConfig.SOUL.RETREAT_DURATION) {
      this.isRetreating = false;
    }
  }

  // Energy management
  addEnergy(amount) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  removeEnergy(amount) {
    this.energy = Math.max(0, this.energy - amount);
  }

  getEnergyPercentage() {
    return this.energy / this.maxEnergy;
  }

  // Combat methods
  canAttack() {
    return this.isAdult() &&  // Children cannot attack
           Date.now() - this.lastAttackTime > GameConfig.SOUL.ATTACK_COOLDOWN;
  }

  performAttack(target) {
    if (!this.canAttack()) return null;

    const damage = GameConfig.SOUL.ATTACK_DAMAGE_MIN + 
                   Math.random() * (GameConfig.SOUL.ATTACK_DAMAGE_MAX - GameConfig.SOUL.ATTACK_DAMAGE_MIN);
    
    target.takeDamage(damage);
    this.lastAttackTime = Date.now();
    
    return {
      damage: damage,
      attackerPos: { x: this.x, y: this.y },
      targetPos: { x: target.x, y: target.y }
    };
  }

  takeDamage(damage) {
    this.removeEnergy(damage);
    this.lastAttackedTime = Date.now();
    this.isRetreating = true;
    
    // Spell interruption is handled by CombatSystem calling SpellSystem
    // to ensure proper cleanup and broadcasting
    if (this.isCasting || this.isPreparing) {
      this.stateMachine.onAttacked();
    }
  }

  // Spell casting methods
  canCast() {
    return !this.isDead &&     // Dead souls cannot cast spells
           this.isAdult() &&    // Children cannot cast spells
           this.energy >= GameConfig.SOUL.MIN_ENERGY_TO_CAST &&
           Date.now() - this.stateMachine.lastCastTime > GameConfig.SOUL.SPELL_COOLDOWN;
  }

  // These methods are no longer needed - state machine handles preparation timing
  startPreparation(targetTile) {
    return false;
  }

  isPreparationComplete() {
    return false;
  }

  startCasting() {
    // Energy cost is handled when starting to cast
    this.removeEnergy(this.maxEnergy * GameConfig.SOUL.CASTING_ENERGY_COST);
    this.stateMachine.lastCastTime = Date.now();
  }

  interruptSpell() {
    // Clear target and force back to roaming
    this.prepareTarget = null;
    this.stateMachine.transitionTo(SoulStates.ROAMING);
    
    // Broadcast interruption to client to stop animation
    return {
      type: 'spell_interrupted',
      soulId: this.id
    };
  }

  // Defense methods
  startDefending(targetId) {
    this.stateMachine.setDefending(targetId);
  }

  stopDefending() {
    this.stateMachine.stopDefending();
  }

  // Movement methods
  setVelocity(vx, vy) {
    this.vx = vx;
    this.vy = vy;
  }

  move(deltaTime = 1) {
    if (this.isCasting || this.isPreparing) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }

  // Utility methods
  getDistanceTo(target) {
    const dx = this.x - target.x;
    const dy = this.y - target.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getTeamType() {
    return this.teamType;
  }

  isEnemy(otherSoul) {
    return this.type !== otherSoul.type;
  }

  // State queries
  getCurrentState() {
    return this.stateMachine.getCurrentState();
  }

  isInState(state) {
    return this.stateMachine.isInState(state);
  }

  shouldSeekEnergy() {
    return this.stateMachine.isInState(SoulStates.HUNGRY);
  }

  canBeInterrupted() {
    return this.stateMachine.canInterrupt();
  }

  // Replacement for boolean flags - now uses state machine
  get isCasting() {
    return this.isInState(SoulStates.CASTING);
  }

  get isPreparing() {
    return this.isInState(SoulStates.PREPARING);
  }

  // Mating and reproduction methods
  canMate() {
    return this.isAdult() &&  // Must be adult (not child)
           !this.isMating && 
           this.getEnergyPercentage() >= GameConfig.MATING.MIN_ENERGY_FOR_MATING &&
           Date.now() - this.lastMatingTime > GameConfig.MATING.MATING_TIME * 3; // 30 second cooldown between matings
  }

  isAdult() {
    return !this.isChild || 
           (this.birthTime && Date.now() - this.birthTime >= GameConfig.MATING.CHILD_MATURITY_TIME);
  }

  getMaturityPercentage() {
    if (!this.isChild || !this.birthTime) return 1.0; // Adult = 100%
    
    const age = Date.now() - this.birthTime;
    const maturityPercentage = Math.min(1.0, age / GameConfig.MATING.CHILD_MATURITY_TIME);
    return maturityPercentage;
  }

  matureChild() {
    if (this.isChild && this.birthTime && 
        Date.now() - this.birthTime >= GameConfig.MATING.CHILD_MATURITY_TIME) {
      this.isChild = false;
      this.birthTime = null;
      return true;
    }
    return false;
  }

  startMating(partner) {
    this.matingPartner = partner;
    this.matingStartTime = Date.now();
    this.isMating = true;
  }

  completeMating() {
    this.lastMatingTime = Date.now();
    this.matingPartner = null;
    this.matingStartTime = null;
    this.isMating = false;
    this.readyToCompleteMating = false;
  }

  cancelMating() {
    this.matingPartner = null;
    this.matingStartTime = null;
    this.isMating = false;
    this.readyToCompleteMating = false;
  }

  // Sleep methods
  canSleep(dayNightSystem) {
    if (!dayNightSystem) return false;
    
    // Check if it's the opposite cycle for this soul type
    const isOppositeCycle = this.isOppositeCycle(dayNightSystem);
    if (!isOppositeCycle) return false;
    
    // Check minimum energy requirement
    if (this.getEnergyPercentage() < GameConfig.SLEEP.MIN_ENERGY_TO_SLEEP) return false;
    if (this.getEnergyPercentage() > GameConfig.SLEEP.MAX_ENERGY_TO_SLEEP) return false;
    
    // Check if already sleeping
    if (this.isSleeping) return false;
    
    // Check if sleep cooldown has passed
    const timeSinceLastSleep = Date.now() - this.lastSleepTime;
    if (timeSinceLastSleep < GameConfig.SLEEP.COOLDOWN) return false;
    
    // Check if already used sleep cycle for this day/night period
    return this.sleepCyclesUsedToday === 0;
  }

  isOppositeCycle(dayNightSystem) {
    const currentPhase = dayNightSystem.getCurrentPhase();
    
    // Light souls sleep during night, dark souls sleep during day
    if (this.type === 'light-soul') {
      return currentPhase === 'night';
    } else if (this.type === 'dark-soul') {
      return currentPhase === 'day';
    }
    
    return false;
  }

  startSleep() {
    if (this.isSleeping) return false;
    
    this.isSleeping = true;
    this.sleepStartTime = Date.now();
    this.sleepCyclesUsedToday = 1;
    
    return true;
  }

  completeSleep() {
    if (!this.isSleeping) return false;
    
    // Recover energy (same as energy orb)
    this.addEnergy(GameConfig.SLEEP.ENERGY_RECOVERY);
    
    this.isSleeping = false;
    this.lastSleepTime = Date.now();
    this.sleepStartTime = null;
    
    return true;
  }

  wakeUp() {
    if (!this.isSleeping) return false;
    
    // Wake up without energy recovery (interrupted sleep)
    this.isSleeping = false;
    this.sleepStartTime = null;
    
    return true;
  }

  updateSleepCycle(dayNightSystem) {
    if (!dayNightSystem) return;
    
    // Reset sleep cycles when phase changes to the soul's beneficial cycle
    const currentPhase = dayNightSystem.getCurrentPhase();
    const isBeneficialCycle = this.isBeneficialCycle(dayNightSystem);
    
    // Reset sleep count when entering beneficial cycle
    if (isBeneficialCycle && this.sleepCyclesUsedToday > 0) {
      const timeSinceLastReset = Date.now() - this.lastSleepResetTime;
      const halfCycleDuration = GameConfig.DAY_NIGHT.CYCLE_DURATION * 0.5;
      
      if (timeSinceLastReset >= halfCycleDuration) {
        this.sleepCyclesUsedToday = 0;
        this.lastSleepResetTime = Date.now();
      }
    }
  }

  isBeneficialCycle(dayNightSystem) {
    const currentPhase = dayNightSystem.getCurrentPhase();
    
    // Light souls benefit during day, dark souls benefit during night
    if (this.type === 'light-soul') {
      return currentPhase === 'day';
    } else if (this.type === 'dark-soul') {
      return currentPhase === 'night';
    }
    
    return false;
  }

  getSleepProgress() {
    if (!this.isSleeping || !this.sleepStartTime) return 0;
    
    const timeSlept = Date.now() - this.sleepStartTime;
    return Math.min(1, timeSlept / GameConfig.SLEEP.SLEEP_DURATION);
  }

  isSleepComplete() {
    if (!this.isSleeping || !this.sleepStartTime) return false;
    
    return Date.now() - this.sleepStartTime >= GameConfig.SLEEP.SLEEP_DURATION;
  }

  /**
   * Update fallback casting system - track how long soul has been seeking
   */
  updateFallbackCasting() {
    const currentState = this.getCurrentState();
    const now = Date.now();
    
    if (currentState === SoulStates.SEEKING) {
      // Start tracking seeking time
      if (!this.seekingStartTime) {
        this.seekingStartTime = now;
        this.shouldUseFallbackCasting = false;
      }
      
      // Enable fallback after 70% of seeking timeout
      const seekingDuration = now - this.seekingStartTime;
      const fallbackThreshold = GameConfig.SOUL.SEEKING_TIMEOUT * 0.5; // 70% of seeking timeout
      if (seekingDuration > fallbackThreshold && !this.shouldUseFallbackCasting) {
        this.shouldUseFallbackCasting = true;
      }
    } else {
      // Reset when not seeking
      this.seekingStartTime = null;
      this.shouldUseFallbackCasting = false;
    }
  }

  // Serialization for client
  toClientData() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      x: this.x,
      y: this.y,
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      isCasting: this.isCasting,
      isPreparing: this.isPreparing,
      isRetreating: this.isRetreating,
      isDefending: this.isDefending,
      currentState: this.getCurrentState(),
      isChild: this.isChild,
      isMating: this.isMating,
      maturityPercentage: this.getMaturityPercentage(),
      isSleeping: this.isSleeping,
      sleepProgress: this.getSleepProgress()
    };
  }
}

module.exports = Soul;
