import { Container, Graphics, Text, TextStyle } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from './config/clientConfig.js';

export class CharacterCard {
    constructor(app) {
        this.app = app;
        this.infoCard = null;
        this.selectedCharacter = null;
        this.nameText = null;
        this.energyText = null;
        this.energyBar = null;
        this.teamBorder = null;
        this.headerText = null;
        this.createCard();
    }

    createCard() {
        // Create info card container
        this.infoCard = new Container();
        this.infoCard.position.set(
            ClientConfig.CANVAS.WIDTH - ClientConfig.UI.CHARACTER_CARD_OFFSET_X, 
            ClientConfig.UI.CHARACTER_CARD_OFFSET_Y
        );
        this.infoCard.visible = false;

        // Create background matching stats panel style
        const cardBackground = new Graphics();
        // Semi-transparent dark background like stats panel
        cardBackground.beginFill(0x000000, 0.2);  // rgba(0, 0, 0, 0.2)
        cardBackground.lineStyle(2, 0x444444, 0.8);  // rgba(68, 68, 68, 0.8)
        cardBackground.drawRect(0, 0, ClientConfig.UI.CHARACTER_CARD_WIDTH, ClientConfig.UI.CHARACTER_CARD_HEIGHT);
        cardBackground.endFill();
        this.infoCard.addChild(cardBackground);

        // Add header text like stats panel
        this.headerText = new Text('CHARACTER INFO', new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: 0xFFD700,  // Gold color like stats panel header
            fontWeight: 'bold',
            align: 'center'
        }));
        this.headerText.anchor.set(0.5, 0);
        this.headerText.position.set(ClientConfig.UI.CHARACTER_CARD_WIDTH / 2, 8);
        this.infoCard.addChild(this.headerText);

        // Create text style matching stats panel
        const textStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 12,
            fill: 0xFFFFFF,
            align: 'left'
        });

        // Character name text
        this.nameText = new Text('', textStyle);
        this.nameText.position.set(ClientConfig.UI.CARD_PADDING, 35);
        this.infoCard.addChild(this.nameText);


        // Energy text
        this.energyText = new Text('', textStyle);
        this.energyText.position.set(ClientConfig.UI.CARD_PADDING, 52);
        this.infoCard.addChild(this.energyText);

        // State text
        this.stateText = new Text('', textStyle);
        this.stateText.position.set(ClientConfig.UI.CARD_PADDING, 69);
        this.infoCard.addChild(this.stateText);

        // Energy bar background (larger)
        const energyBarBg = new Graphics();
        energyBarBg.beginFill(ClientConfig.COLORS.ENERGY_BACKGROUND);
        energyBarBg.drawRect(ClientConfig.UI.CARD_PADDING, ClientConfig.UI.ENERGY_BAR_Y, ClientConfig.UI.ENERGY_BAR_WIDTH, ClientConfig.UI.ENERGY_BAR_HEIGHT);
        energyBarBg.endFill();
        this.infoCard.addChild(energyBarBg);

        // Energy bar
        this.energyBar = new Graphics();
        this.infoCard.addChild(this.energyBar);


        // Close button with stats panel style
        const closeButton = new Graphics();
        closeButton.beginFill(0x2c3e50);  // Stats panel button color
        closeButton.lineStyle(2, 0x333333);
        closeButton.drawRect(ClientConfig.UI.CLOSE_BUTTON_X, ClientConfig.UI.CLOSE_BUTTON_Y, ClientConfig.UI.CLOSE_BUTTON_SIZE, ClientConfig.UI.CLOSE_BUTTON_SIZE);
        closeButton.endFill();
        
        const closeText = new Text('×', new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 16,
            fill: 0xFFFFFF,
            align: 'center'
        }));
        closeText.anchor.set(0.5);
        closeText.position.set(ClientConfig.UI.CLOSE_BUTTON_TEXT_X, ClientConfig.UI.CLOSE_BUTTON_TEXT_Y);
        closeButton.addChild(closeText);
        
        closeButton.interactive = true;
        closeButton.buttonMode = true;
        closeButton.on('pointerdown', () => this.hide());
        this.infoCard.addChild(closeButton);

        this.app.stage.addChild(this.infoCard);
        
        // Ensure character card is always on top by setting highest z-index
        this.infoCard.zIndex = 10000;
    }

    show(character) {
        this.selectedCharacter = character;
        this.nameText.text = `Name: ${character.name}`;
        this.energyText.text = `Energy: ${Math.floor(character.getEnergy())}/${Math.floor(character.maxEnergy)}`;
        this.stateText.text = `Status: ${this.formatState(character.currentState || 'unknown', character)}`;
        
        // Add team-specific border styling like stats panel
        this.updateTeamStyling(character);
        
        // Update energy bar
        this.updateEnergyBar();
        
        this.infoCard.visible = true;
    }

    hide() {
        this.infoCard.visible = false;
        this.selectedCharacter = null;
    }

    update() {
        if (!this.infoCard.visible || !this.selectedCharacter) return;

        // Close card if the monitored character is dead/dying
        if (this.selectedCharacter.isDying) {
            this.hide();
            return;
        }
        
        // Update energy text and bar
        this.energyText.text = `Energy: ${Math.floor(this.selectedCharacter.getEnergy())}/${Math.floor(this.selectedCharacter.maxEnergy)}`;
        
        // Update state with user-friendly formatting
        this.stateText.text = `Status: ${this.formatState(this.selectedCharacter.currentState || 'unknown', this.selectedCharacter)}`;
        this.updateEnergyBar();
    }

    updateEnergyBar() {
        if (!this.selectedCharacter) return;
        
        this.energyBar.clear();
        const energyPercentage = this.selectedCharacter.getEnergyPercentage() / 100;
        const barWidth = 230 * energyPercentage;
        
        if (energyPercentage > 0.6) {
            this.energyBar.beginFill(ClientConfig.COLORS.ENERGY_HIGH);
        } else if (energyPercentage > 0.3) {
            this.energyBar.beginFill(ClientConfig.COLORS.ENERGY_MEDIUM);
        } else {
            this.energyBar.beginFill(ClientConfig.COLORS.ENERGY_LOW);
        }
        
        this.energyBar.drawRect(ClientConfig.UI.CARD_PADDING, ClientConfig.UI.ENERGY_BAR_Y, barWidth, ClientConfig.UI.ENERGY_BAR_HEIGHT);
        this.energyBar.endFill();
        
    }


    updateTeamStyling(character) {
        // Add team-specific left border like stats panel
        if (this.teamBorder) {
            this.infoCard.removeChild(this.teamBorder);
        }
        
        this.teamBorder = new Graphics();
        const borderColor = character.type === 'light-soul' ? 0xFFD700 : 0x8A2BE2;  // Gold for light, purple for dark
        this.teamBorder.beginFill(borderColor);
        this.teamBorder.drawRect(0, 0, 4, ClientConfig.UI.CHARACTER_CARD_HEIGHT);
        this.teamBorder.endFill();
        this.infoCard.addChild(this.teamBorder);
    }

    formatState(state, character) {
        // Create user-friendly state names with icons
        const stateMap = {
            'roaming': '🚶 Wandering',
            'hungry': '🍽️ Hungry',
            'seeking': '🎯 Seeking Target',
            'preparing': '⚡ Preparing Spell',
            'casting': '✨ Casting Spell',
            'defending': '⚔️ Moving to Combat',
            'attacking': '⚔️ In Combat',
            'seeking_nexus': '🏰 Seeking Enemy Nexus',
            'attacking_nexus': '🏰 Attacking Nexus',
            'socialising': '👥 Socializing',
            'resting': '😌 Resting',
            'mating': '💕 Mating',
            'seeking_sleep': '😴 Seeking Rest',
            'sleeping': '😴 Sleeping',
            'unknown': '❓ Unknown'
        };

        let displayText = stateMap[state] || `❓ ${state}`;
        
        // Add additional status indicators
        if (character.isChild) {
            displayText += ' 👶';
        }
        
        return displayText;
    }

    isVisible() {
        return this.infoCard.visible;
    }
}
