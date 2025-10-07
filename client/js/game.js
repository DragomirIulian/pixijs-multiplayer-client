import { Application } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { CharacterCard } from './characterCard.js';
import { GameMap } from './GameMap.js';
import { ClientConfig } from './config/clientConfig.js';
import { NetworkManager } from './network/NetworkManager.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { CharacterManager } from './managers/CharacterManager.js';
import { EnergyOrbManager } from './managers/EnergyOrbManager.js';
import { SpellManager } from './managers/SpellManager.js';
import { DayNightManager } from './managers/DayNightManager.js';
import { NexusManager } from './managers/NexusManager.js';
import { NetworkHandler } from './handlers/NetworkHandler.js';
import StatisticsDisplay from './managers/StatisticsDisplay.js';
import { BuffDisplay } from './managers/BuffDisplay.js';
import { DisasterEffectsManager } from './managers/DisasterEffectsManager.js';

/**
 * Game - Main orchestrator class following Single Responsibility Principle
 * Responsibilities: Application initialization, component coordination, game loop
 * 
 * SOLID Principles Applied:
 * - S: Single Responsibility - Only handles high-level coordination
 * - O: Open/Closed - Can extend with new managers without modification
 * - L: Liskov Substitution - Managers can be swapped with compatible implementations
 * - I: Interface Segregation - Each manager has focused, specific responsibilities
 * - D: Dependency Inversion - Depends on abstractions, not concrete implementations
 */
export class Game {
    constructor() {
        this.app = null;
        this.gameMap = null;
        this.characterCard = null;
        this.networkManager = null;
        
        // Systems
        this.effectsSystem = null;
        
        // Managers (following Single Responsibility)
        this.characterManager = null;
        this.energyOrbManager = null;
        this.spellManager = null;
        this.dayNightManager = null;
        this.nexusManager = null;
        this.networkHandler = null;
        this.statisticsDisplay = null;
        this.buffDisplay = null;
        this.disasterEffectsManager = null;
        
        this.init();
    }

    async init() {
        await this.setupApplication();
        await this.setupComponents();
        this.setupManagers();
        this.setupSystems();
        this.connectToServer();
        this.startGameLoop();
    }

    async setupApplication() {
        // Create and initialize PIXI application
        this.app = new Application();

        await this.app.init({ 
            width: ClientConfig.CANVAS.WIDTH,
            height: ClientConfig.CANVAS.HEIGHT,
            background: ClientConfig.CANVAS.BACKGROUND_COLOR,
            antialias: ClientConfig.CANVAS.ANTIALIAS
        });

        // Make stage interactive for click detection
        this.app.stage.interactive = true;
        
        // Enable sorting by z-index for proper layering
        this.app.stage.sortableChildren = true;

        // Append canvas to DOM
        document.getElementById('game-container').appendChild(this.app.canvas);
    }

    async setupComponents() {
        // Initialize core game components
        this.gameMap = new GameMap(this.app);
        
        // Setup map and wait for it to be ready
        await this.gameMap.createMap();
        this.app.stage.addChild(this.gameMap.container);
        
        // Initialize character card after map is set up to ensure proper layering
        this.characterCard = new CharacterCard(this.app);
    }

    setupManagers() {
        // Initialize day/night manager first
        this.dayNightManager = new DayNightManager(this.app, this.gameMap);
        
        // Initialize buff display manager
        this.buffDisplay = new BuffDisplay(this.app);
        
        // Initialize disaster effects manager first
        this.disasterEffectsManager = new DisasterEffectsManager(this.app);
        
        // Initialize managers with focused responsibilities
        this.characterManager = new CharacterManager(this.app, this.characterCard, this.dayNightManager, this.disasterEffectsManager);
        this.energyOrbManager = new EnergyOrbManager(this.app);
        this.spellManager = new SpellManager(this.app);
        
        // Initialize nexus manager
        this.nexusManager = new NexusManager(this.app);
        this.app.stage.addChild(this.nexusManager.container);
        
        // Initialize statistics display
        this.statisticsDisplay = new StatisticsDisplay();
        
        // Make statisticsDisplay available globally for HTML button
        window.statsDisplay = this.statisticsDisplay;
        
        // Make game instance available globally for network requests
        window.game = this;
    }

    setupSystems() {
        // Initialize effect system
        this.effectsSystem = new EffectsSystem(this.app);
        
        // Initialize network handler with all required dependencies
        this.networkHandler = new NetworkHandler(
            this.characterManager,
            this.energyOrbManager,
            this.spellManager,
            this.gameMap,
            this.effectsSystem,
            this.dayNightManager,
            this.nexusManager,
            this.statisticsDisplay,
            this.buffDisplay,
            this.disasterEffectsManager
        );
    }

    connectToServer() {
        // Setup network connection with message handler delegation
        this.networkManager = new NetworkManager((data) => {
            this.networkHandler.handleServerMessage(data);
        });
        this.networkManager.connect();
    }
    
    startGameLoop() {
        // Clean, focused game loop
        this.app.ticker.add((time) => this.gameLoop(time));
    }

    gameLoop(time) {
        // Delegate updates to respective managers
        this.characterManager.updateCharacters(time);
        this.energyOrbManager.updateOrbs(time);
        this.spellManager.updateSpells(time, this.effectsSystem);
        this.dayNightManager.update(time);
        this.nexusManager.update(time);
        this.disasterEffectsManager.update(time);
        
        // Update UI components
        if (this.characterCard) {
            this.characterCard.update();
        }
    }
}

// Initialize game when page loads
window.addEventListener('load', async () => {
    const game = new Game();
    
    // Add keyboard shortcut for toggling score display (S key)
    document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 's' && game.gameMap) {
            game.gameMap.toggleScoreDisplay();
        }
    });
});
