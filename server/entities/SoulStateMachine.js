const GameConfig = require('../config/gameConfig');

/**
 * Soul State Machine
 * Manages the behavior states for souls
 */

const SoulStates = {
  ROAMING: 'roaming',
  HUNGRY: 'hungry', 
  SEEKING: 'seeking',
  PREPARING: 'preparing',
  CASTING: 'casting',
  DEFENDING: 'defending',  // Moving toward enemy to attack
  ATTACKING: 'attacking',  // Stopped and attacking
  SOCIALISING: 'socialising',
  RESTING: 'resting',
  MATING: 'mating'
};

class SoulStateMachine {
  constructor(soul, tileMap = null) {
    this.soul = soul;
    this.tileMap = tileMap;
    this.currentState = SoulStates.ROAMING;
    this.stateStartTime = Date.now();
    this.lastCastTime = Date.now();
    this.defendingTarget = null;
    this.previousState = null;
  }

  getCurrentState() {
    return this.currentState;
  }

  getStateStartTime() {
    return this.stateStartTime;
  }

  getTimeSinceLastCast() {
    return Date.now() - this.lastCastTime;
  }

  update(allSouls = new Map()) {
    this.checkStateTimeouts();
    this.processStateTransitions(allSouls);
  }

  checkStateTimeouts() {
    const timeInCurrentState = Date.now() - this.stateStartTime;
    
    // Force return to roaming after 20 seconds in casting or defending
    if ((this.currentState === SoulStates.CASTING || this.currentState === SoulStates.DEFENDING) &&
        timeInCurrentState > GameConfig.SOUL.STATE_TIMEOUT) {
      this.transitionTo(SoulStates.ROAMING);
    }
  }

  processStateTransitions(allSouls) {
    const energyPercentage = this.soul.energy / this.soul.maxEnergy;
    
    switch (this.currentState) {
      case SoulStates.ROAMING:
        this.handleRoamingState(energyPercentage, allSouls);
        break;
        
      case SoulStates.HUNGRY:
        this.handleHungryState(energyPercentage, allSouls);
        break;
        
      case SoulStates.SEEKING:
        this.handleSeekingState(energyPercentage, allSouls);
        break;
        
      case SoulStates.PREPARING:
        this.handlePreparingState();
        break;
        
      case SoulStates.CASTING:
        this.handleCastingState();
        break;
        
      case SoulStates.DEFENDING:
        this.handleDefendingState();
        break;
        
      case SoulStates.ATTACKING:
        this.handleAttackingState();
        break;
        
      case SoulStates.SOCIALISING:
        // For now, return to roaming
        this.transitionTo(SoulStates.ROAMING);
        break;
        
      case SoulStates.RESTING:
        // Resting is just roaming without seeking/casting
        this.transitionTo(SoulStates.ROAMING);
        break;
        
      case SoulStates.MATING:
        this.handleMatingState(energyPercentage, allSouls);
        break;
    }
  }

  handleRoamingState(energyPercentage, allSouls) {
    if (energyPercentage < GameConfig.SOUL.HUNGRY_THRESHOLD) {
      this.transitionTo(SoulStates.HUNGRY);
      return;
    }

    if (this.soul.isChild) {
        return;
    }

    // Check team population and decide behavior
    const teamCounts = this.getTeamCounts(allSouls);
    const myTeamCount = teamCounts[this.soul.teamType] || 0;
    const shouldFocusOnMating = myTeamCount <= (GameConfig.MATING.MAX_SOULS_PER_TEAM - GameConfig.MATING.MIN_RESTING_SOULS);

    // If team is at critical level, prioritize mating over combat
    // But DON'T automatically start mating - let MatingSystem handle partner coordination
    if (shouldFocusOnMating && this.soul.canMate()) {
      // Just indicate readiness for mating, but don't auto-transition
      // The MatingSystem will coordinate and start mating for compatible pairs
    }

    // Check if should defend (highest priority - overrides all except mating/resting)
    // Only one soul should defend per casting enemy
    if (this.shouldBeDefender(allSouls)) {
      this.transitionTo(SoulStates.DEFENDING);
      return;
    }

    // Check if should seek enemy tiles for casting (enough energy and haven't cast recently)
    // Only (current souls count - MIN_RESTING_SOULS) souls can seek, if that number > 0
    const allowedSeekingSouls = Math.max(0, myTeamCount - GameConfig.MATING.MIN_RESTING_SOULS);
    const currentlySeekingSouls = Array.from(allSouls.values()).filter(s => 
      s.teamType === this.soul.teamType && 
      (s.isInState(SoulStates.SEEKING) || s.isInState(SoulStates.PREPARING) || s.isInState(SoulStates.CASTING))
    ).length;
    
    if (allowedSeekingSouls > 0 && currentlySeekingSouls < allowedSeekingSouls && this.shouldSeekToCast(energyPercentage)) {
      this.transitionTo(SoulStates.SEEKING);
      return;
    }

    // Check if should mate (when not in survival mode)
    // But DON'T automatically start mating - let MatingSystem handle this
    if (this.soul.canMate()) {
      // Just indicate readiness for mating, but don't auto-transition
      // The MatingSystem will coordinate and start mating for compatible pairs
    }
  }

  handleHungryState(energyPercentage, allSouls) {
    // Children cannot defend - only eat and roam
    if (!this.soul.isChild) {
      // Check if should defend (overrides all) - only for adults
      if (this.shouldBeDefender(allSouls)) {
        this.transitionTo(SoulStates.DEFENDING);
        return;
      }
    }

    // Return to roaming when energy is above 50%
    if (energyPercentage >= GameConfig.SOUL.HUNGRY_THRESHOLD) {
      this.transitionTo(SoulStates.ROAMING);
      return;
    }
  }

  handleSeekingState(energyPercentage, allSouls) {
    // Check team population - if too few souls, stop seeking and return to roaming (resting)
    const teamCounts = this.getTeamCounts(allSouls);
    const myTeamCount = teamCounts[this.soul.teamType] || 0;
    if (myTeamCount <= GameConfig.MATING.MIN_RESTING_SOULS) {
      this.transitionTo(SoulStates.ROAMING);
      return;
    }

    // Check if should defend (overrides all)
    if (this.shouldBeDefender(allSouls)) {
      this.transitionTo(SoulStates.DEFENDING);
      return;
    }

    // Check if should become hungry
    if (energyPercentage < GameConfig.SOUL.HUNGRY_THRESHOLD) {
      this.transitionTo(SoulStates.HUNGRY);
      return;
    }

    // Check if we're now in range to cast
    const distanceToEnemyTile = this.findNearestEnemyTileDistance();
    const isInRange = distanceToEnemyTile <= GameConfig.SOUL.SPELL_RANGE;
    
    // Removed debug logging to improve performance
    
    if (isInRange) {
      this.transitionTo(SoulStates.PREPARING);
      return;
    }

    // If seeking for too long, give up and return to roaming
    const timeInState = Date.now() - this.stateStartTime;
    if (timeInState > GameConfig.SOUL.SEEKING_TIMEOUT) {
      this.transitionTo(SoulStates.ROAMING);
      return;
    }
  }

  handlePreparingState() {
    // Check if should defend (overrides preparing)
    if (this.shouldDefend() && this.hasEnemyCasting()) {
      this.transitionTo(SoulStates.DEFENDING);
      return;
    }

    // Check if preparation time has elapsed
    const timeInPreparing = Date.now() - this.stateStartTime;
    if (timeInPreparing >= GameConfig.SOUL.SPELL_PREPARATION_TIME) {
      this.transitionTo(SoulStates.CASTING);
      return;
    }
  }

  handleCastingState() {
    // Check if should defend (overrides casting)
    if (this.shouldDefend() && this.hasEnemyCasting()) {
      this.transitionTo(SoulStates.DEFENDING);
      return;
    }

    // Check if casting time has elapsed
    const timeInCasting = Date.now() - this.stateStartTime;
    if (timeInCasting >= GameConfig.SOUL.SPELL_CAST_TIME) {
      this.transitionTo(SoulStates.ROAMING);
      return;
    }
  }

  handleDefendingState() {
    // Check if we should stop defending
    if (!this.hasEnemyCasting()) {
      this.transitionTo(SoulStates.ROAMING);
      return;
    }

    // Check if we're close enough to attack the enemy
    if (this.isCloseEnoughToAttackEnemy()) {
      this.transitionTo(SoulStates.ATTACKING);
      return;
    }

    // If defending for too long, give up
    const timeInDefending = Date.now() - this.stateStartTime;
    if (timeInDefending > GameConfig.SOUL.STATE_TIMEOUT) {
      this.transitionTo(SoulStates.ROAMING);
      return;
    }
  }

  handleAttackingState() {
    // Check if we should stop attacking  
    if (!this.hasEnemyCasting()) {
      this.transitionTo(SoulStates.ROAMING);
      return;
    }

    // Check if we're no longer close enough to attack
    if (!this.isCloseEnoughToAttackEnemy()) {
      this.transitionTo(SoulStates.DEFENDING);
      return;
    }

    // Continue attacking (CombatSystem handles the actual attacks)
  }


  handleMatingState(energyPercentage, allSouls) {
    // Check if we have a mating partner
    if (!this.soul.matingPartner) {
      // Try to find a partner
      const potentialMate = this.findPotentialMate(allSouls);
      if (!potentialMate) {
        this.transitionTo(SoulStates.ROAMING);
        return;
      }
      
      // Start mating with the partner
      this.soul.startMating(potentialMate);
      potentialMate.startMating(this.soul);
    }

    // Check if mating is complete
    if (this.soul.matingStartTime && 
        Date.now() - this.soul.matingStartTime >= GameConfig.MATING.MATING_TIME) {
      // Mating completed - DON'T complete here, let MatingSystem handle it
      // Just mark as ready for completion but stay in mating state until MatingSystem processes it
      this.soul.readyToCompleteMating = true;
      return;
    }

    // Check if partner is still valid and in range
    const partner = this.soul.matingPartner;
    if (partner && partner.isMating && 
        this.soul.getDistanceTo(partner) > GameConfig.MATING.MATING_RANGE) {
      // Too far apart - cancel mating
      this.soul.cancelMating();
      partner.cancelMating();
      this.transitionTo(SoulStates.ROAMING);
      return;
    }

    // Update soul mating flag
    this.soul.isMating = true;
  }

  isCloseEnoughToAttackEnemy() {
    if (!this.soul.castingEnemyId) return false;
    
    // This is a simplified check - in practice should find the actual enemy soul
    // For now, assume we're close enough after some time in defending state
    const timeInDefending = Date.now() - this.stateStartTime;
    return timeInDefending > 2000; // After 2 seconds of defending, assume close enough
  }

  shouldDefend() {
    // Soul can defend if not already defending, attacking, preparing, or casting
    return this.currentState !== SoulStates.DEFENDING && 
           this.currentState !== SoulStates.ATTACKING &&
           this.currentState !== SoulStates.PREPARING &&
           this.currentState !== SoulStates.CASTING;
  }

  // Check if this soul should be the one to defend (prevent multiple defenders)
  shouldBeDefender(allSouls) {
    if (!this.hasEnemyCasting() || !this.shouldDefend()) {
      return false;
    }

    const castingEnemyId = this.soul.castingEnemyId;
    if (!castingEnemyId) return false;

    // Check if another soul is already defending this enemy
    const existingDefender = Array.from(allSouls.values()).find(otherSoul => 
      otherSoul.id !== this.soul.id &&
      (otherSoul.getCurrentState() === SoulStates.DEFENDING || 
       otherSoul.getCurrentState() === SoulStates.ATTACKING) &&
      otherSoul.castingEnemyId === castingEnemyId
    );

    return !existingDefender; // Only defend if no one else is defending this enemy
  }

  hasEnemyCasting() {
    // This will be set by the game systems when an enemy starts casting
    return this.soul.enemyCastingDetected || false;
  }

  shouldSeekToCast(energyPercentage) {
    const timeSinceLastCast = this.getTimeSinceLastCast();
    
    return energyPercentage >= GameConfig.SOUL.HUNGRY_THRESHOLD && 
           timeSinceLastCast > GameConfig.SOUL.SPELL_COOLDOWN &&
           this.soul.energy >= GameConfig.SOUL.MIN_ENERGY_TO_CAST;
  }

  isNearEnemyTile() {
    // Check if there are enemy tiles within spell range
    return this.findNearestEnemyTileDistance() <= GameConfig.SOUL.SPELL_RANGE;
  }

  findNearestEnemyTileDistance() {
    if (!this.tileMap) {
      // If no tileMap, souls should not try to cast - return very large distance
      return Infinity;
    }

    const opponentTileType = this.soul.type === 'dark-soul' ? 'green' : 'gray';
    let nearestDistance = Infinity;

    // Check distance to nearest enemy tile
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[y][x];

        if (tile.type === opponentTileType) {
          const tileWorldX = tile.worldX + this.tileMap.tileWidth / 2;
          const tileWorldY = tile.worldY + this.tileMap.tileHeight / 2;
          
          const dx = tileWorldX - this.soul.x;
          const dy = tileWorldY - this.soul.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < nearestDistance) {
            nearestDistance = distance;
          }
        }
      }
    }

    return nearestDistance;
  }

  transitionTo(newState) {
    if (newState === this.currentState) return;

    
    this.previousState = this.currentState;
    this.currentState = newState;
    this.stateStartTime = Date.now();

    // Reset state-specific flags
    if (newState !== SoulStates.DEFENDING) {
      this.defendingTarget = null;
    }

    // Update soul properties based on new state
    this.updateSoulProperties();
  }

  updateSoulProperties() {
    switch (this.currentState) {
      case SoulStates.CASTING:
        this.lastCastTime = Date.now();
        break;
        
      case SoulStates.DEFENDING:
        // Set defending target based on detected casting enemy
        if (this.soul.castingEnemyId) {
          this.defendingTarget = this.soul.castingEnemyId;
          this.soul.isDefending = true;
          this.soul.defendingTarget = this.soul.castingEnemyId;
        }
        break;
        
      case SoulStates.ROAMING:
      case SoulStates.HUNGRY:
        // Clear any state-specific properties
        this.soul.isDefending = false;
        this.soul.isResting = false;
        this.defendingTarget = null;
        break;
        
      case SoulStates.RESTING:
        this.soul.isResting = true;
        this.soul.isMating = false;
        break;
        
      case SoulStates.MATING:
        this.soul.isMating = true;
        this.soul.isResting = false;
        break;
        
      default:
        // Clear any state-specific properties
        this.soul.isDefending = false;
        this.soul.isResting = false;
        this.soul.isMating = false;
        this.defendingTarget = null;
        break;
    }
  }

  // External methods for state management
  setDefending(targetId) {
    this.defendingTarget = targetId;
    this.soul.isDefending = true;
    this.soul.defendingTarget = targetId;
    this.transitionTo(SoulStates.DEFENDING);
  }

  stopDefending() {
    this.defendingTarget = null;
    this.soul.isDefending = false;
    this.soul.defendingTarget = null;
    // Will transition in next update
  }

  forceToRoaming() {
    this.transitionTo(SoulStates.ROAMING);
  }

  isInState(state) {
    return this.currentState === state;
  }

  canInterrupt() {
    // Can interrupt casting but not defending
    return this.currentState !== SoulStates.DEFENDING;
  }

  onAttacked() {
    // If casting when attacked, return to roaming
    if (this.currentState === SoulStates.CASTING) {
      this.transitionTo(SoulStates.ROAMING);
    }
  }

  // Utility methods for mating system
  getTeamCounts(allSouls) {
    const counts = { green: 0, gray: 0 };
    
    allSouls.forEach(soul => {
      if (soul.isAdult()) { // Only count adult souls
        counts[soul.teamType] = (counts[soul.teamType] || 0) + 1;
      }
    });
    
    return counts;
  }

  findPotentialMate(allSouls) {
    // Find adult souls of the same team that can mate and are not already mating
    const candidates = Array.from(allSouls.values()).filter(soul => 
      soul.id !== this.soul.id &&
      soul.teamType === this.soul.teamType &&
      soul.isAdult() &&
      soul.canMate() &&
      !soul.isMating &&
      !soul.matingPartner &&
      this.soul.getDistanceTo(soul) <= GameConfig.MATING.MATING_RANGE
    );

    // Return the closest candidate
    if (candidates.length === 0) return null;
    
    return candidates.reduce((closest, soul) => {
      const distanceToSoul = this.soul.getDistanceTo(soul);
      const distanceToClosest = this.soul.getDistanceTo(closest);
      return distanceToSoul < distanceToClosest ? soul : closest;
    });
  }
}

module.exports = { SoulStateMachine, SoulStates };
