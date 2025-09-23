import { ClientConfig } from '../config/clientConfig.js';

/**
 * NetworkHandler - Single Responsibility: Network message handling
 * Handles all server message processing and delegation
 */
export class NetworkHandler {
    constructor(characterManager, energyOrbManager, spellManager, gameMap, effectsSystem, dayNightManager, nexusManager, statisticsDisplay) {
        this.characterManager = characterManager;
        this.energyOrbManager = energyOrbManager;
        this.spellManager = spellManager;
        this.gameMap = gameMap;
        this.effectsSystem = effectsSystem;
        this.dayNightManager = dayNightManager;
        this.nexusManager = nexusManager;
        this.statisticsDisplay = statisticsDisplay;
    }

    handleServerMessage(data) {
        if (data.type === 'spell_completed') {
            console.log(`[NetworkHandler] Processing spell_completed for ${data.spellId}`);
        }
        switch(data.type) {
            case 'disconnected':
                this.clearAllGameData();
                break;
            case 'character_update':
                this.characterManager.updateCharacter(data.character);
                break;
            case 'character_spawn':
                this.characterManager.spawnCharacter(data.character);
                break;
            case 'character_remove':
                // Don't immediately remove if it might be part of a spell death
                setTimeout(() => {
                    this.characterManager.removeCharacter(data.characterId);
                }, ClientConfig.ANIMATION.CHARACTER_REMOVE_DELAY);
                break;
            case 'world_state':
                this.updateWorldState(data.characters, data.energyOrbs, data.nexuses, data.tileMap, data.activeSpells, data.dayNightState, data.statistics);
                break;
            case 'orb_spawned':
                this.energyOrbManager.spawnEnergyOrb(data.orb);
                break;
            case 'orb_collected':
                this.energyOrbManager.handleOrbCollection(data.orbId, data.collectorId, this.characterManager, this.effectsSystem);
                break;
            case 'attack':
                this.characterManager.handleAttack(data.attackerId, data.targetId, data.attackerPos, data.targetPos, this.effectsSystem);
                break;
            case 'spell_started':
                this.spellManager.handleSpellStarted(data.spell, this.gameMap);
                break;
            case 'spell_completed':
                console.log(`[NetworkHandler] Received spell_completed event:`, data);
                this.spellManager.handleSpellCompleted(data);
                break;
            case 'tile_updated':
                this.handleTileUpdated(data);
                break;
            case 'spell_interrupted':
                this.spellManager.handleSpellInterrupted(data);
                break;
            case 'mating_started':
                this.handleMatingStarted(data);
                break;
            case 'mating_completed':
                this.handleMatingCompleted(data);
                break;
            case 'mating_cancelled':
                this.handleMatingCancelled(data);
                break;
            case 'soul_matured':
                this.handleSoulMatured(data);
                break;
            case 'character_death':
                console.log(`[NetworkHandler] Received character_death event:`, data);
                this.characterManager.handleCharacterDeath(data, this.effectsSystem);
                // Notify statistics display for visual feedback
                if (this.statisticsDisplay) {
                    this.statisticsDisplay.processGameEvent(data);
                }
                break;
            case 'day_night_phase_change':
                this.dayNightManager.updateState(data);
                break;
            case 'statistics_update':
                this.statisticsDisplay.updateStatistics(data.statistics);
                break;
            case 'statistics_response':
                this.statisticsDisplay.updateStatistics(data.statistics);
                break;
            case 'nexus_attack':
                // Handle visual effects for nexus attacks
                this.effectsSystem.createAttackEffect(data.attackerPos, data.nexusPos);
                break;
            case 'nexus_destroyed':
                // Handle nexus destruction
                console.log(`[NetworkHandler] Nexus destroyed! ${data.nexusType} nexus destroyed by ${data.destroyedByTeam} team`);
                // Could add special effects or UI notifications here
                break;
        }
    }

    clearAllGameData() {
        this.characterManager.clearAllCharacters();
        this.energyOrbManager.clearAllOrbs();
        this.spellManager.clearAllSpells();
    }

    updateWorldState(charactersData, energyOrbsData, nexusesData, tileMapData, activeSpellsData, dayNightState, statistics) {
        // Smart update - only change what's different to prevent visual glitches
        this.updateCharactersSmartly(charactersData);
        this.updateEnergyOrbsSmartly(energyOrbsData);
        this.updateNexusesSmartly(nexusesData);
        this.updateSpellsSmartly(activeSpellsData);
        
        // Update tile map only if provided (usually only on first connect)
        if (tileMapData && this.gameMap) {
            this.gameMap.updateTileMap(tileMapData);
        }
        
        // Update day/night state
        if (dayNightState && this.dayNightManager) {
            this.dayNightManager.updateState(dayNightState);
        }
        
        // Update statistics
        if (statistics && this.statisticsDisplay) {
            this.statisticsDisplay.updateStatistics(statistics);
        }
    }

    updateCharactersSmartly(charactersData) {
        const serverCharacterIds = new Set(charactersData.map(c => c.id));
        const currentCharacterIds = new Set(this.characterManager.getAllCharacters().keys());

        // Remove characters that no longer exist on server
        currentCharacterIds.forEach(id => {
            if (!serverCharacterIds.has(id)) {
                this.characterManager.removeCharacter(id);
            }
        });

        // Add or update characters
        charactersData.forEach(characterData => {
            if (currentCharacterIds.has(characterData.id)) {
                // Update existing character
                this.characterManager.updateCharacter(characterData);
            } else {
                // Spawn new character
                this.characterManager.spawnCharacter(characterData);
            }
        });
    }

    updateEnergyOrbsSmartly(energyOrbsData) {
        if (!energyOrbsData) return;

        const serverOrbIds = new Set(energyOrbsData.map(o => o.id));
        const currentOrbIds = new Set(this.energyOrbManager.energyOrbs.keys());

        // Remove orbs that no longer exist on server
        currentOrbIds.forEach(id => {
            if (!serverOrbIds.has(id)) {
                this.energyOrbManager.removeEnergyOrb(id);
            }
        });

        // Add new orbs (existing ones don't need updates as they're static)
        energyOrbsData.forEach(orbData => {
            if (!currentOrbIds.has(orbData.id)) {
                this.energyOrbManager.spawnEnergyOrb(orbData);
            }
        });
    }

    updateNexusesSmartly(nexusesData) {
        if (!nexusesData) return;

        // Update nexuses using the nexus manager
        this.nexusManager.updateNexuses(nexusesData);
    }

    updateSpellsSmartly(activeSpellsData) {
        if (!activeSpellsData) {
            // If no active spells from server, force cleanup all client spells
            this.spellManager.clearAllSpells();
            this.spellManager.forceCleanupHangingSpells();
            return;
        }

        const serverSpellIds = new Set(activeSpellsData.map(s => s.spellId));
        const currentSpellIds = new Set(this.spellManager.activeSpells.keys());

        // Remove spells that no longer exist on server
        currentSpellIds.forEach(id => {
            if (!serverSpellIds.has(id)) {
                this.spellManager.handleSpellCompleted({ spellId: id });
            }
        });

        // Add new spells (existing ones continue as-is)
        activeSpellsData.forEach(spellData => {
            if (!currentSpellIds.has(spellData.spellId)) {
                this.spellManager.handleSpellStarted(spellData, this.gameMap);
            }
        });

        // Force cleanup any hanging spell effects every sync
        this.spellManager.forceCleanupHangingSpells();
    }

    handleTileUpdated(data) {
        // Update tile in the game map
        if (this.gameMap && this.gameMap.tileMap) {
            const tile = this.gameMap.tileMap.tiles[data.tileY][data.tileX];
            tile.type = data.newType;
            
            // Update the visual tile
            this.gameMap.updateSingleTile(data.tileX, data.tileY, data.newType);
        }
    }

    // Mating event handlers
    handleMatingStarted(data) {
        // Create heart effects at the mating location
        if (this.effectsSystem && data.position) {
            this.effectsSystem.createMatingHearts(data.position.x, data.position.y);
        }
    }

    handleMatingCompleted(data) {
        // Child spawn is handled by character_spawn event
        // Create sparkle effect for birth
        if (this.effectsSystem && data.childData) {
            this.effectsSystem.createChildSpawnEffect(data.childData.x, data.childData.y);
        }
        
        // Notify statistics display for visual feedback
        if (this.statisticsDisplay) {
            this.statisticsDisplay.processGameEvent(data);
        }
    }

    handleMatingCancelled(data) {
        // No special effects needed for cancellation
    }

    handleSoulMatured(data) {
        // Update the character if it exists
        const character = this.characterManager.getCharacter(data.soulId);
        if (character && data.soulData) {
            character.updateFromServer(data.soulData);
            
            // Create maturation effect
            if (this.effectsSystem) {
                this.effectsSystem.createChildSpawnEffect(character.x, character.y);
            }
        }
    }
}
