const GameConfig = require('../config/gameConfig');
const Soul = require('../entities/Soul');
const { SoulStates } = require('../entities/SoulStateMachine');

/**
 * Mating System
 * Handles soul reproduction, child maturation, and mating events
 */
class MatingSystem {
  constructor(gameManager) {
    this.gameManager = gameManager;
    this.matingEvents = [];
  }

  update(allSouls) {
    this.matingEvents = [];
    
    // Process child maturation
    this.processChildMaturation(allSouls);
    
    // Only check for new mating pairs every 3 seconds to reduce frequency
    if (!this.lastMatingCheck || Date.now() - this.lastMatingCheck > 3000) {
      this.findAndStartMatingPairs(allSouls);
      this.lastMatingCheck = Date.now();
    }
    
    // Process completed mating pairs
    this.processCompletedMating(allSouls);
    
    return this.matingEvents;
  }

  processChildMaturation(allSouls) {
    allSouls.forEach(soul => {
      if (soul.matureChild()) {
        // Child has matured to adult
        this.matingEvents.push({
          type: 'soul_matured',
          soulId: soul.id,
          soulData: soul.toClientData()
        });
      }
    });
  }

  findAndStartMatingPairs(allSouls) {
    // Find souls that are ready to mate
    const readySouls = Array.from(allSouls.values()).filter(soul => 
      soul.canMate() && 
      !soul.isMating && 
      !soul.matingPartner &&
      soul.isInState(SoulStates.ROAMING) // Only roaming souls should start mating
    );
    

    // Group by team
    const readySoulsByTeam = {};
    readySouls.forEach(soul => {
      if (!readySoulsByTeam[soul.teamType]) {
        readySoulsByTeam[soul.teamType] = [];
      }
      readySoulsByTeam[soul.teamType].push(soul);
    });

    // Try to form pairs within each team
    Object.values(readySoulsByTeam).forEach(teamSouls => {
      this.formMatingPairsInTeam(teamSouls);
    });
  }

  formMatingPairsInTeam(teamSouls) {
    const processedSouls = new Set();

    for (let i = 0; i < teamSouls.length; i++) {
      const soul1 = teamSouls[i];
      if (processedSouls.has(soul1.id) || soul1.isMating) continue;

      // Find the closest compatible mate
      let closestMate = null;
      let closestDistance = Infinity;

      for (let j = i + 1; j < teamSouls.length; j++) {
        const soul2 = teamSouls[j];
        if (processedSouls.has(soul2.id) || soul2.isMating) continue;

        const distance = soul1.getDistanceTo(soul2);
        if (distance <= GameConfig.MATING.MATING_RANGE && distance < closestDistance) {
          closestMate = soul2;
          closestDistance = distance;
        }
      }

      if (closestMate) {
        // Start mating between these two souls
        this.startMating(soul1, closestMate);
        processedSouls.add(soul1.id);
        processedSouls.add(closestMate.id);
      }
    }
  }

  processCompletedMating(allSouls) {
    const completedMatingPairs = new Set();
    
    allSouls.forEach(soul => {
      if (soul.isMating && soul.matingPartner && soul.readyToCompleteMating) {
        
        const partnerId = soul.matingPartner.id;
        const pairKey = [soul.id, partnerId].sort().join('-');
        
        // Avoid processing the same pair twice
        if (!completedMatingPairs.has(pairKey)) {
          completedMatingPairs.add(pairKey);
          
          // Create new child soul
          const child = this.createChildSoul(soul, soul.matingPartner);
          if (child) {
            this.gameManager.souls.set(child.id, child);
            
            // Broadcast mating completion and child birth
            this.matingEvents.push({
              type: 'mating_completed',
              parent1Id: soul.id,
              parent2Id: partnerId,
              childData: child.toClientData()
            });
            
            this.matingEvents.push({
              type: 'character_spawn',
              character: child.toClientData()
            });
          }
          
          // Complete mating for both parents
          const partner = soul.matingPartner;
          soul.completeMating();
          partner.completeMating();
          
          // Transition both souls back to roaming
          soul.stateMachine.transitionTo(SoulStates.ROAMING);
          partner.stateMachine.transitionTo(SoulStates.ROAMING);
        }
      }
    });
  }

  createChildSoul(parent1, parent2) {
    // Check if team has space for new soul
    const teamCounts = this.getTeamCounts(this.gameManager.souls);
    const teamType = parent1.teamType;
    
    if (teamCounts[teamType] >= GameConfig.MATING.MAX_SOULS_PER_TEAM) {
      return null; // Team is at max capacity
    }
    
    // Create child soul at midpoint between parents
    const childX = (parent1.x + parent2.x) / 2;
    const childY = (parent1.y + parent2.y) / 2;
    const childId = `${parent1.type}-child-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Child inherits team type from parents
    const childSoul = new Soul(childId, parent1.type, childX, childY, this.gameManager.tileMap, true, this.gameManager.movementSystem, this.gameManager.spellSystem, this.gameManager.dayNightSystem);
    
    // Set initial child properties
    childSoul.energy = GameConfig.SOUL.STARTING_ENERGY_MIN; // Children start with minimum energy
    
    return childSoul;
  }

  getTeamCounts(allSouls) {
    const counts = { green: 0, gray: 0 };
    
    allSouls.forEach(soul => {
      // Count ALL souls (adults + children) for population limits
      counts[soul.teamType] = (counts[soul.teamType] || 0) + 1;
    });
    
    return counts;
  }

  // Helper method to start mating between two souls
  startMating(soul1, soul2) {
    if (!soul1.canMate() || !soul2.canMate()) {
      return false;
    }
    
    if (soul1.teamType !== soul2.teamType) {
      return false; // Different teams cannot mate
    }
    
    if (soul1.getDistanceTo(soul2) > GameConfig.MATING.MATING_RANGE) {
      return false; // Too far apart
    }

    // Check if team would exceed max population after having a child
    const teamCounts = this.getTeamCounts(this.gameManager.souls);
    if (teamCounts[soul1.teamType] >= GameConfig.MATING.MAX_SOULS_PER_TEAM) {
      return false; // Team would exceed max capacity with a new child
    }
    
    // Start mating for both souls
    soul1.startMating(soul2);
    soul2.startMating(soul1);
    
    // Transition both souls to MATING state
    soul1.stateMachine.transitionTo(SoulStates.MATING);
    soul2.stateMachine.transitionTo(SoulStates.MATING);
    
    // Broadcast mating started event
    this.matingEvents.push({
      type: 'mating_started',
      soul1Id: soul1.id,
      soul2Id: soul2.id,
      position: { x: (soul1.x + soul2.x) / 2, y: (soul1.y + soul2.y) / 2 }
    });
    
    return true;
  }

  // Helper method to cancel mating if souls get too far apart
  cancelMatingIfTooFar(allSouls) {
    allSouls.forEach(soul => {
      if (soul.isMating && soul.matingPartner) {
        const distance = soul.getDistanceTo(soul.matingPartner);
        if (distance > GameConfig.MATING.MATING_RANGE) {
          // Cancel mating for both souls
          soul.cancelMating();
          soul.matingPartner.cancelMating();
          
          this.matingEvents.push({
            type: 'mating_cancelled',
            soul1Id: soul.id,
            soul2Id: soul.matingPartner.id
          });
        }
      }
    });
  }
}

module.exports = MatingSystem;
