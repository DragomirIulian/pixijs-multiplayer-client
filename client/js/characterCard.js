import { Container, Graphics, Text, TextStyle } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';

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
        this.infoCard.position.set(this.app.screen.width - 280, 20);
        this.infoCard.visible = false;

        // Create 8-bit style background (larger)
        const cardBackground = new Graphics();
        cardBackground.beginFill(0x000000);
        cardBackground.lineStyle(3, 0xffffff);
        cardBackground.drawRect(0, 0, 260, 180);
        cardBackground.endFill();
        this.infoCard.addChild(cardBackground);

        // Create pixelated text style (larger)
        const textStyle = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 16,
            fill: 0xffffff,
            align: 'left'
        });

        // Character name text
        this.nameText = new Text('', textStyle);
        this.nameText.position.set(15, 15);
        this.infoCard.addChild(this.nameText);

        // Character ID text
        this.idText = new Text('', textStyle);
        this.idText.position.set(15, 40);
        this.infoCard.addChild(this.idText);

        // Energy text
        this.energyText = new Text('', textStyle);
        this.energyText.position.set(15, 65);
        this.infoCard.addChild(this.energyText);

        // Energy bar background (larger)
        const energyBarBg = new Graphics();
        energyBarBg.beginFill(0x333333);
        energyBarBg.drawRect(15, 90, 230, 25);
        energyBarBg.endFill();
        this.infoCard.addChild(energyBarBg);

        // Energy bar
        this.energyBar = new Graphics();
        this.infoCard.addChild(this.energyBar);

        // Energy percentage text
        this.energyPercentText = new Text('', new TextStyle({
            fontFamily: 'monospace',
            fontSize: 14,
            fill: 0xffffff,
            align: 'center'
        }));
        this.energyPercentText.anchor.set(0.5);
        this.energyPercentText.position.set(130, 102);
        this.infoCard.addChild(this.energyPercentText);

        // Close button (larger)
        const closeButton = new Graphics();
        closeButton.beginFill(0xff0000);
        closeButton.lineStyle(2, 0xffffff);
        closeButton.drawRect(220, 10, 30, 30);
        closeButton.endFill();
        
        const closeText = new Text('X', new TextStyle({
            fontFamily: 'monospace',
            fontSize: 18,
            fill: 0xffffff,
            align: 'center'
        }));
        closeText.anchor.set(0.5);
        closeText.position.set(235, 25);
        closeButton.addChild(closeText);
        
        closeButton.interactive = true;
        closeButton.buttonMode = true;
        closeButton.on('pointerdown', () => this.hide());
        this.infoCard.addChild(closeButton);

        this.app.stage.addChild(this.infoCard);
    }

    show(character) {
        this.selectedCharacter = character;
        this.nameText.text = `Name: ${character.name}`;
        this.idText.text = `ID: ${character.id}`;
        this.energyText.text = `Energy: ${Math.floor(character.getEnergy())}/${Math.floor(character.maxEnergy)}`;
        
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
        
        // Update energy text and bar
        this.energyText.text = `Energy: ${Math.floor(this.selectedCharacter.getEnergy())}/${Math.floor(this.selectedCharacter.maxEnergy)}`;
        this.updateEnergyBar();
    }

    updateEnergyBar() {
        if (!this.selectedCharacter) return;
        
        this.energyBar.clear();
        const energyPercentage = this.selectedCharacter.getEnergyPercentage() / 100;
        const barWidth = 230 * energyPercentage;
        
        if (energyPercentage > 0.6) {
            this.energyBar.beginFill(0x00ff00); // Green
        } else if (energyPercentage > 0.3) {
            this.energyBar.beginFill(0xffff00); // Yellow
        } else {
            this.energyBar.beginFill(0xff0000); // Red
        }
        
        this.energyBar.drawRect(15, 90, barWidth, 25);
        this.energyBar.endFill();
        
        // Update percentage text
        this.energyPercentText.text = `${Math.round(energyPercentage * 100)}%`;
    }

    isVisible() {
        return this.infoCard.visible;
    }
}
