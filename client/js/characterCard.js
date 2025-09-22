import { Container, Graphics, Text, TextStyle } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from './config/clientConfig.js';

export class CharacterCard {
    constructor(app) {
        this.app = app;
        this.infoCard = null;
        this.selectedCharacter = null;
        this.nameText = null;
        this.idText = null;
        this.energyText = null;
        this.energyBar = null;
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

        // Create 8-bit style background (larger)
        const cardBackground = new Graphics();
        cardBackground.beginFill(ClientConfig.COLORS.UI_BACKGROUND);
        cardBackground.lineStyle(ClientConfig.UI.CARD_BORDER_WIDTH, ClientConfig.COLORS.UI_BORDER);
        cardBackground.drawRect(0, 0, ClientConfig.UI.CHARACTER_CARD_WIDTH, ClientConfig.UI.CHARACTER_CARD_HEIGHT);
        cardBackground.endFill();
        this.infoCard.addChild(cardBackground);

        // Create pixelated text style (larger)
        const textStyle = new TextStyle({
            fontFamily: 'monospace',
            fontSize: ClientConfig.UI.TEXT_FONT_SIZE,
            fill: ClientConfig.COLORS.UI_TEXT,
            align: 'left'
        });

        // Character name text
        this.nameText = new Text('', textStyle);
        this.nameText.position.set(ClientConfig.UI.CARD_PADDING, ClientConfig.UI.CARD_PADDING);
        this.infoCard.addChild(this.nameText);

        // Character ID text
        this.idText = new Text('', textStyle);
        this.idText.position.set(ClientConfig.UI.CARD_PADDING, ClientConfig.UI.CARD_PADDING + ClientConfig.UI.TEXT_LINE_HEIGHT);
        this.infoCard.addChild(this.idText);

        // Energy text
        this.energyText = new Text('', textStyle);
        this.energyText.position.set(ClientConfig.UI.CARD_PADDING, ClientConfig.UI.CARD_PADDING + ClientConfig.UI.TEXT_LINE_HEIGHT * 2);
        this.infoCard.addChild(this.energyText);

        // State text
        this.stateText = new Text('', textStyle);
        this.stateText.position.set(ClientConfig.UI.CARD_PADDING, ClientConfig.UI.CARD_PADDING + ClientConfig.UI.TEXT_LINE_HEIGHT * 3);
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

        // Energy percentage text
        this.energyPercentText = new Text('', new TextStyle({
            fontFamily: 'monospace',
            fontSize: ClientConfig.UI.PERCENT_FONT_SIZE,
            fill: 0xFFFFFF,
            stroke: 0x000000,
            strokeThickness: ClientConfig.UI.TEXT_STROKE_THICKNESS,
            align: 'center'
        }));
        this.energyPercentText.anchor.set(0.5);
        this.energyPercentText.position.set(ClientConfig.UI.ENERGY_PERCENT_X, ClientConfig.UI.ENERGY_PERCENT_Y);
        this.infoCard.addChild(this.energyPercentText);

        // Close button (larger)
        const closeButton = new Graphics();
        closeButton.beginFill(ClientConfig.COLORS.UI_CLOSE_BUTTON);
        closeButton.lineStyle(ClientConfig.UI.CLOSE_BUTTON_BORDER, ClientConfig.COLORS.UI_BORDER);
        closeButton.drawRect(ClientConfig.UI.CLOSE_BUTTON_X, ClientConfig.UI.CLOSE_BUTTON_Y, ClientConfig.UI.CLOSE_BUTTON_SIZE, ClientConfig.UI.CLOSE_BUTTON_SIZE);
        closeButton.endFill();
        
        const closeText = new Text('X', new TextStyle({
            fontFamily: 'monospace',
            fontSize: ClientConfig.UI.CLOSE_FONT_SIZE,
            fill: ClientConfig.COLORS.UI_TEXT,
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
        this.idText.text = `ID: ${character.id}`;
        this.energyText.text = `Energy: ${Math.floor(character.getEnergy())}/${Math.floor(character.maxEnergy)}`;
        this.stateText.text = `State: ${character.currentState || 'unknown'}`;
        
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
        
        // Show state with additional mating info
        let stateText = `State: ${this.selectedCharacter.currentState || 'unknown'}`;
        if (this.selectedCharacter.isMating) {
            stateText += ' 💕';
        }
        if (this.selectedCharacter.isChild) {
            stateText += ' 👶';
        }
        this.stateText.text = stateText;
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
        
        // Update percentage text
        this.energyPercentText.text = `${Math.round(energyPercentage * 100)}%`;
    }

    isVisible() {
        return this.infoCard.visible;
    }
}
