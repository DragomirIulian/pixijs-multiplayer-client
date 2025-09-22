const GameConfig = require('../config/gameConfig');
const { SoulStates } = require('../entities/SoulStateMachine');

/**
 * Combat System
 * Handles combat interactions between souls
 */
class CombatSystem {
  constructor(spellSystem = null) {
    this.attackEvents = [];
    this.spellSystem = spellSystem;
  }

  update(allSouls) {
    this.attackEvents = [];
    
    allSouls.forEach(soul => {
      this.processSoulCombat(soul, allSouls);
    });

    return this.attackEvents;
  }

  processSoulCombat(soul, allSouls) {
    // Only attack when defending against an enemy that is casting
    if (!soul.isDefending || !soul.defendingTarget) {
      return;
    }

    // Skip if soul is retreating or casting
    if (soul.isRetreating || soul.isCasting || soul.isPreparing) {
      return;
    }

    // Only attack the specific enemy being defended against
    const target = allSouls.get(soul.defendingTarget);
    if (!target || !soul.isEnemy(target)) {
      return;
    }

    const distance = soul.getDistanceTo(target);
    
    // Attack the casting enemy when in range (remove the casting check - attack defending target regardless)
    if (distance <= GameConfig.SOUL.ATTACK_RANGE && soul.canAttack()) {
      this.executeAttack(soul, target, allSouls);
    }
  }

  executeAttack(attacker, target, allSouls) {
    const attackResult = attacker.performAttack(target);
    
    if (!attackResult) return;

    // ALWAYS interrupt any spells by the target when attacked
    if (this.spellSystem) {
      this.spellSystem.interruptSpell(target, allSouls);
    }

    // Record attack event for broadcasting
    this.attackEvents.push({
      type: 'attack',
      attackerId: attacker.id,
      targetId: target.id,
      damage: attackResult.damage,
      attackerPos: attackResult.attackerPos,
      targetPos: attackResult.targetPos,
      isDefensiveAttack: attacker.isDefending
    });

  }

  // Find and assign defenders against enemy spells
  assignDefenders(castingSpell, allSouls) {
    const defenders = this.findAvailableDefenders(castingSpell, allSouls);
    
    // Assign the best defender (all souls participate unless incompatible with state)
    if (defenders.length > 0) {
      const bestDefender = this.selectBestDefender(defenders, castingSpell);
      bestDefender.startDefending(castingSpell.casterId);
      return [bestDefender];
    }

    return [];
  }

  findAvailableDefenders(castingSpell, allSouls) {
    const targetTileType = castingSpell.casterType === 'dark-soul' ? 'green' : 'gray';
    const defenderType = targetTileType === 'green' ? 'light-soul' : 'dark-soul';

    // Find all souls of the defending team that can defend
    return Array.from(allSouls.values()).filter(soul => {
      if (soul.type !== defenderType) return false;
      
      // Available defenders are those NOT in defending or casting states
      if (soul.isDefending) return false;
      if (soul.isCasting || soul.isPreparing) return false;
      
      return true;
    });
  }

  selectBestDefender(potentialDefenders, castingSpell) {
    // Select defender based on energy only - no distance limitations
    const scoredDefenders = potentialDefenders.map(defender => {
      return {
        defender: defender,
        score: defender.energy // Higher score for more energy
      };
    });

    // Sort by score (highest first) and return the best
    scoredDefenders.sort((a, b) => b.score - a.score);
    return scoredDefenders[0].defender;
  }

  // Collision handling moved to MovementSystem for proper integration

  getAttackEvents() {
    return this.attackEvents;
  }

  clearEvents() {
    this.attackEvents = [];
  }
}

module.exports = CombatSystem;
