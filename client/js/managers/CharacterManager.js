import { Character } from '../character.js';
import { ClientConfig } from '../config/clientConfig.js';

/**
 * CharacterManager - Single Responsibility: Character lifecycle management
 * Handles spawning, updating, removing characters
 */
export class CharacterManager {
    constructor(app, characterCard, dayNightManager = null) {
        this.app = app;
        this.characterCard = characterCard;
        this.dayNightManager = dayNightManager;
        this.characters = new Map();
    }

    async spawnCharacter(characterData) {
        const character = new Character(this.app, characterData, this.dayNightManager);
        await character.init();
        
        // Add shadow sprite to stage first (behind character)
        if (character.shadowSprite) {
            this.app.stage.addChild(character.shadowSprite);
        }
        
        // Set up click detection for this character
        character.sprite.interactive = true;
        character.sprite.buttonMode = true;
        character.sprite.on('pointerdown', () => {
            this.characterCard.show(character);
        });
        
        this.characters.set(characterData.id, character);
        this.app.stage.addChild(character.sprite);
        
        // Add casting progress bar to stage
        if (character.castingContainer) {
            this.app.stage.addChild(character.castingContainer);
        }
    }

    updateCharacter(characterData) {
        const character = this.characters.get(characterData.id);
        if (character) {
            character.updateFromServer(characterData);
        }
    }

    removeCharacter(characterId) {
        const character = this.characters.get(characterId);
        if (character && !character.isBeingRemoved) {
            character.isBeingRemoved = true; // Prevent double removal
            
            // Close character card if this character is being monitored
            if (this.characterCard && this.characterCard.selectedCharacter && 
                this.characterCard.selectedCharacter.id === characterId) {
                this.characterCard.hide();
            }
            
            // Remove character sprite
            if (character.sprite) {
                this.app.stage.removeChild(character.sprite);
            }
            
            // Remove shadow sprite
            if (character.shadowSprite) {
                this.app.stage.removeChild(character.shadowSprite);
            }
            
            // Remove casting progress bar
            if (character.castingContainer) {
                this.app.stage.removeChild(character.castingContainer);
            }
            
            // Clean up character resources
            character.destroy();
            this.characters.delete(characterId);
        }
    }

    clearAllCharacters() {
        this.characters.forEach((character, id) => {
            if (character.sprite) {
                this.app.stage.removeChild(character.sprite);
            }
            if (character.shadowSprite) {
                this.app.stage.removeChild(character.shadowSprite);
            }
            if (character.castingContainer) {
                this.app.stage.removeChild(character.castingContainer);
            }
            character.destroy();
        });
        this.characters.clear();
    }

    updateCharacters(time) {
        this.characters.forEach(character => {
            character.update(time);
        });
    }

    getCharacter(id) {
        return this.characters.get(id);
    }

    getAllCharacters() {
        return this.characters;
    }

    handleCharacterDeath(data, effectsSystem) {
        const character = this.characters.get(data.characterId);
        if (character && effectsSystem) {
            effectsSystem.createDeathAnimation(character);
        }
    }

    handleAttack(attackerId, targetId, attackerPos, targetPos, effectsSystem) {
        // Create attack animation from attacker to target
        effectsSystem.createAttackEffect(attackerPos, targetPos);
        
        // Flash the target character red briefly
        const target = this.characters.get(targetId);
        if (target && target.sprite) {
            target.sprite.tint = ClientConfig.COLORS.ATTACK_FLASH;
            setTimeout(() => {
                target.sprite.tint = 0xFFFFFF; // Reset color
            }, ClientConfig.ANIMATION.ATTACK_FLASH_DURATION);
        }
    }
}
