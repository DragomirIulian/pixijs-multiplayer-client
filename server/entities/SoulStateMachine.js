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
  SEEKING_NEXUS: 'seeking_nexus', // Moving toward enemy nexus
  ATTACKING_NEXUS: 'attacking_nexus', // Close to nexus and attacking it
  SOCIALISING: 'socialising',
  RESTING: 'resting',
  MATING: 'mating'
};

class SoulStateMachine {
  constructor(soul, tileMap = null, movementSystem = null, spellSystem = null) {
    this.soul = soul;
    this.tileMap = tileMap;
    this.movementSystem = movementSystem;
    this.spellSystem = spellSystem;
    this.currentState = SoulStates.ROAMING;
    this.stateStartTime = Date.now();
    // Add variance to initial seeking cooldown to prevent all souls from seeking simultaneously
    // Generate random variance between -25% and +25% of spell cooldown
    const varianceRange = GameConfig.SOUL.SPELL_COOLDOWN * GameConfig.SOUL.SPELL_COOLDOWN_VARIANCE;
    const seekingVariance = (Math.random() - 0.5) * 2 * varianceRange; // Range: -varianceRange to +varianceRange
    this.lastCastTime = Date.now() - seekingVariance;
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

      case SoulStates.SEEKING_NEXUS:
        this.handleSeekingNexusState(energyPercentage, allSouls);
        break;

      case SoulStates.ATTACKING_NEXUS:
        this.handleAttackingNexusState(energyPercentage, allSouls);
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

    // Check if should seek enemy nexus (high priority - when no targets available)
    if (this.shouldSeekNexus(energyPercentage, allSouls)) {
      this.transitionTo(SoulStates.SEEKING_NEXUS);
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
      // Before seeking, check if there are any valid targets at all
      if (this.hasValidCastingTargets()) {
        this.transitionTo(SoulStates.SEEKING);
        return;
      } else {
        // No valid casting targets available, seek nexus instead
        this.transitionTo(SoulStates.SEEKING_NEXUS);
        return;
      }
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
    
    // Fallback: if soul has been seeking too long, check if ANY valid targets are in range
    if (!isInRange && this.soul.shouldUseFallbackCasting) {
      const hasAnyTargetInRange = this.hasAnyValidTargetInRange();
      if (hasAnyTargetInRange) {
        this.transitionTo(SoulStates.PREPARING);
        return;
      }
    }
    
    if (isInRange) {
      this.transitionTo(SoulStates.PREPARING);
      return;
    }

    // Check if there are any valid casting targets available immediately
    if (!this.hasValidCastingTargets()) {
      // No valid targets available, switch to seeking nexus immediately
      this.transitionTo(SoulStates.SEEKING_NEXUS);
      return;
    }
    
    // If seeking for too long, return to roaming (but this shouldn't happen if valid targets exist)
    const timeInState = Date.now() - this.stateStartTime;
    if (timeInState > GameConfig.SOUL.SEEKING_TIMEOUT) {
      // Fallback to roaming if somehow still seeking after timeout
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
    if (!this.movementSystem) {
      return Infinity;
    }

    // Use MovementSystem's logic to find the BEST enemy tile
    const bestTile = this.movementSystem.findNearestEnemyTile(this.soul);
    
    if (!bestTile) {
      return Infinity;
    }

    // Return distance to the BEST tile
    const dx = bestTile.x - this.soul.x;
    const dy = bestTile.y - this.soul.y;
    return Math.sqrt(dx * dx + dy * dy);
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
    
    // Clear prepare target when leaving preparation or casting states
    if (this.previousState === SoulStates.PREPARING || this.previousState === SoulStates.CASTING) {
      if (newState !== SoulStates.PREPARING && newState !== SoulStates.CASTING) {
        this.soul.prepareTarget = null;
      }
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

  /**
   * Check if soul should seek enemy nexus
   * Triggers when: No valid tiles available for casting
   */
  shouldSeekNexus(energyPercentage, allSouls) {
    // Check if there are NO valid tiles available for casting
    const hasValidTilesAvailable = this.hasValidCastingTargets();
    return !hasValidTilesAvailable;
  }

  /**
   * Handle SEEKING_NEXUS state behavior - move towards enemy nexus
   */
  handleSeekingNexusState(energyPercentage, allSouls) {
    // Switch to hungry if energy is too low
    if (energyPercentage < GameConfig.SOUL.HUNGRY_THRESHOLD) {
      this.transitionTo(SoulStates.HUNGRY);
      return;
    }

    // Check if valid casting targets became available - switch back to seeking
    if (this.hasValidCastingTargets()) {
      this.transitionTo(SoulStates.SEEKING);
      return;
    }

    // Check if close enough to nexus to start attacking
    const enemyNexusPos = this.soul.type === GameConfig.SOUL_TYPES.DARK ? 
      GameConfig.NEXUS.LIGHT_NEXUS : GameConfig.NEXUS.DARK_NEXUS;
    
    const nexusWorldX = enemyNexusPos.TILE_X * this.tileMap.tileWidth + (this.tileMap.tileWidth / 2);
    const nexusWorldY = enemyNexusPos.TILE_Y * this.tileMap.tileHeight + (this.tileMap.tileHeight / 2);
    
    const distanceToNexus = this.soul.getDistanceTo({ x: nexusWorldX, y: nexusWorldY });
    
    // If close enough to attack, switch to attacking nexus
    if (distanceToNexus <= GameConfig.SOUL.ATTACK_RANGE) {
      this.transitionTo(SoulStates.ATTACKING_NEXUS);
      return;
    }

    // Continue seeking nexus (MovementSystem will handle movement)
  }

  /**
   * Handle ATTACKING_NEXUS state behavior
   */
  handleAttackingNexusState(energyPercentage, allSouls) {
    // Switch to hungry if energy is too low
    if (energyPercentage < GameConfig.SOUL.HUNGRY_THRESHOLD) {
      this.transitionTo(SoulStates.HUNGRY);
      return;
    }

    // Check if should defend (overrides nexus attacking)
    if (this.shouldBeDefender(allSouls)) {
      this.transitionTo(SoulStates.DEFENDING);
      return;
    }

    // Souls engage in attacking until they die - no retreat once attacking nexus
    // They will continue attacking or move towards nexus until eliminated
  }

  /**
   * Check if there's a path to enemy nexus within soul height limit (10 tiles)
   * TEMPORARILY RELAXED: Simplified path checking to allow easier nexus access
   */
  hasPathToNexus(nexusWorldX, nexusWorldY) {
    if (!this.tileMap) return false;

    // Convert soul position to tile coordinates
    const soulTileX = Math.floor(this.soul.x / this.tileMap.tileWidth);
    const soulTileY = Math.floor(this.soul.y / this.tileMap.tileHeight);
    
    // Convert nexus position to tile coordinates
    const nexusTileX = Math.floor(nexusWorldX / this.tileMap.tileWidth);
    const nexusTileY = Math.floor(nexusWorldY / this.tileMap.tileHeight);
    
    // TEMPORARILY RELAXED: Just check distance, ignore path requirements
    // This allows souls to attack nexus more easily for testing
    const maxDistance = GameConfig.SOUL.ATTACK_RANGE; // Use standard attack range
    
    // Calculate straight-line distance in PIXELS
    const dx = Math.abs(nexusWorldX - this.soul.x);
    const dy = Math.abs(nexusWorldY - this.soul.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if nexus is within attack range (in pixels)
    return distance <= maxDistance;
    
    // ORIGINAL CODE (temporarily disabled):
    // If nexus is within reachable distance and we have a clear path through friendly tiles
    // if (distance <= maxDistance) {
    //   return this.hasLinearPathThroughFriendlyTerritory(soulTileX, soulTileY, nexusTileX, nexusTileY);
    // }
    // return false;
  }

  /**
   * Check if there's a straight path through friendly territory to target
   */
  hasLinearPathThroughFriendlyTerritory(startX, startY, endX, endY) {
    const dx = endX - startX;
    const dy = endY - startY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    if (steps === 0) return true;
    
    const stepX = dx / steps;
    const stepY = dy / steps;
    
    // Check each step along the path
    for (let i = 0; i <= steps; i++) {
      const checkX = Math.round(startX + stepX * i);
      const checkY = Math.round(startY + stepY * i);
      
      // Check bounds
      if (checkX < 0 || checkX >= this.tileMap.width || 
          checkY < 0 || checkY >= this.tileMap.height) {
        return false;
      }
      
      const tile = this.tileMap.tiles[checkY][checkX];
      if (tile.type !== this.soul.teamType) {
        return false; // Path blocked by enemy territory
      }
    }
    
    return true; // Clear path through friendly territory
  }

  /**
   * Check if there are ANY valid enemy tiles within casting range (for fallback)
   */
  hasAnyValidTargetInRange() {
    if (!this.tileMap) return false;
    
    const soulX = this.soul.x;
    const soulY = this.soul.y;
    const maxDistance = GameConfig.SOUL.SPELL_RANGE;
    const minDistance = GameConfig.SOUL.SPELL_MIN_DISTANCE;
    const opponentType = this.soul.type === GameConfig.SOUL_TYPES.DARK ? GameConfig.TILE_TYPES.GREEN : GameConfig.TILE_TYPES.GRAY;
    
    // Check tiles around soul position
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[y][x];
        
        if (tile && tile.type === opponentType) {
          // Check distance to soul
          const dx = (tile.worldX + this.tileMap.tileWidth / 2) - soulX;
          const dy = (tile.worldY + this.tileMap.tileHeight / 2) - soulY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= maxDistance && distance >= minDistance) {
            return true; // Found at least one valid target
          }
        }
      }
    }
    
    return false; // No valid targets in range
  }

  /**
   * Check if there are ANY valid casting targets with score > 0 anywhere on the map
   * Used to determine if soul should fall back to nexus attack
   */
  hasValidCastingTargets() {
    if (!this.tileMap || !this.movementSystem || !this.movementSystem.scoringSystem) return false;
    
    const teamType = this.soul.teamType;
    const opponentType = this.soul.type === GameConfig.SOUL_TYPES.DARK ? GameConfig.TILE_TYPES.GREEN : GameConfig.TILE_TYPES.GRAY;
    
    // Check ALL tiles on the map for any with score > 0 AND not already targeted
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.tiles[y][x];
        
        // Only consider enemy tiles
        if (tile && tile.type === opponentType) {
          // Get score for this tile
          const score = this.movementSystem.scoringSystem.getBorderScore(x, y, teamType);
          
          // If tile has score > 0, check if it's available (not already being targeted)
          if (score > 0) {
            // Check if this tile is already being targeted by an active spell
            const isAlreadyTargeted = this.spellSystem && Array.from(this.spellSystem.getActiveSpells().values()).some(spell => 
              spell.targetTile.x === tile.worldX && spell.targetTile.y === tile.worldY
            );
            
            if (!isAlreadyTargeted) {
              return true; // Found at least one valid, available target
            }
          }
        }
      }
    }
    
    return false; // No valid casting targets found
  }
}

module.exports = { SoulStateMachine, SoulStates };
