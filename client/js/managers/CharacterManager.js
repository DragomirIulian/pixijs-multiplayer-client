import { Character } from '../character.js';
import { ClientConfig } from '../config/clientConfig.js';

/**
 * CharacterManager - Single Responsibility: Character lifecycle management
 * Handles spawning, updating, removing characters
 */
export class CharacterManager {
    constructor(app, characterCard) {
        this.app = app;
        this.characterCard = characterCard;
        this.characters = new Map();
    }

    async spawnCharacter(characterData) {
        const character = new Character(this.app, characterData);
        await character.init();
        
        // Set up click detection for this character
        character.sprite.interactive = true;
        character.sprite.buttonMode = true;
        character.sprite.on('pointerdown', () => {
            this.characterCard.show(character);
        });
        
        this.characters.set(characterData.id, character);
        this.app.stage.addChild(character.sprite);
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
            
            this.app.stage.removeChild(character.sprite);
            this.characters.delete(characterId);
        }
    }

    clearAllCharacters() {
        this.characters.forEach((character, id) => {
            if (character.sprite) {
                this.app.stage.removeChild(character.sprite);
            }
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
        console.log(`[CharacterManager] Character death: ${data.characterId} at ${Date.now()}`);
        const character = this.characters.get(data.characterId);
        if (character && effectsSystem) {
            console.log(`[CharacterManager] Starting death animation for ${data.characterId}`);
            effectsSystem.createDeathAnimation(character);
        } else {
            console.log(`[CharacterManager] No character found for death: ${data.characterId}`);
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
