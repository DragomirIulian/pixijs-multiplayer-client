import { Container, Text, Graphics, Sprite, Assets } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from '../config/clientConfig.js';

/**
 * Buff Display Manager
 * Manages the display of team buffs at the top of the screen
 */
export class BuffDisplay {
  constructor(app) {
    this.app = app;
    this.container = new Container();
    this.container.zIndex = 1001; // Higher than day/night UI
    
    // Team buff containers
    this.lightTeamContainer = new Container();
    this.darkTeamContainer = new Container();
    
    // Current buffs data
    this.currentBuffs = {
      light: [],
      dark: []
    };
    
    // Buff icon cache
    this.iconCache = new Map();
    
    this.setupContainers();
    this.loadBuffIcons();
  }

  setupContainers() {
    // Position light team buffs to the left of the sun
    this.lightTeamContainer.x = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_X - 250;
    this.lightTeamContainer.y = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_Y - 10;
    
    // Position dark team buffs to the right of the sun
    this.darkTeamContainer.x = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_X + 150;
    this.darkTeamContainer.y = ClientConfig.DAY_NIGHT.SUN_MOON_POSITION_Y - 10;
    
    this.container.addChild(this.lightTeamContainer);
    this.container.addChild(this.darkTeamContainer);
    
    // Add to app stage
    this.app.stage.addChild(this.container);
  }

  async loadBuffIcons() {
    try {
      // Load common buff icons
      const iconPaths = {
        'sun': './resources/sun.png',
        'moon': './resources/moon3.png',
        'energy': './resources/energy_icon.png',
        'speed': './resources/speed_icon.png',
        'magic': './resources/magic_icon.png',
        'default': null // Will create a fallback graphic
      };

      for (const [iconName, path] of Object.entries(iconPaths)) {
        try {
          if (path) {
            const texture = await Assets.load(path);
            this.iconCache.set(iconName, texture);
          } else {
            // Create fallback icon
            const fallbackTexture = this.createFallbackIcon();
            this.iconCache.set(iconName, fallbackTexture);
          }
        } catch (error) {
          console.warn(`Failed to load buff icon ${iconName}:`, error);
          // Create fallback for failed loads
          const fallbackTexture = this.createFallbackIcon();
          this.iconCache.set(iconName, fallbackTexture);
        }
      }
    } catch (error) {
      console.error('Error loading buff icons:', error);
    }
  }

  createFallbackIcon() {
    // Create a simple colored circle as fallback
    const graphics = new Graphics();
    graphics.circle(0, 0, 16);
    graphics.fill(0x4CAF50);
    graphics.stroke({ color: 0x2E7D32, width: 2 });
    
    return this.app.renderer.generateTexture(graphics);
  }

  /**
   * Update buff display with new buff data
   * @param {Object} buffsData - Buff data from server
   */
  updateBuffs(buffsData) {
    if (!buffsData) return;
    
    // Update light team buffs
    if (buffsData.light) {
      this.updateTeamBuffs('light', buffsData.light);
    }
    
    // Update dark team buffs
    if (buffsData.dark) {
      this.updateTeamBuffs('dark', buffsData.dark);
    }
  }

  /**
   * Update buffs for a specific team
   * @param {string} team - 'light' or 'dark'
   * @param {Array} buffs - Array of buff objects
   */
  updateTeamBuffs(team, buffs) {
    const container = team === 'light' ? this.lightTeamContainer : this.darkTeamContainer;
    const teamColor = team === 'light' ? 0xFFD700 : 0x9C27B0;
    
    // Clear existing buff displays
    container.removeChildren();
    
    // Sort buffs by priority (higher priority first)
    const sortedBuffs = [...buffs].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Create displays for each buff
    sortedBuffs.forEach((buff, index) => {
      const buffDisplay = this.createBuffDisplay(buff, teamColor, team);
      buffDisplay.y = index * 45; // Stack vertically with spacing
      container.addChild(buffDisplay);
    });
    
    this.currentBuffs[team] = buffs;
  }

  /**
   * Create a display element for a single buff
   * @param {Object} buff - Buff data object
   * @param {number} teamColor - Team color for styling
   * @param {string} team - Team name for positioning
   * @returns {Container} Buff display container
   */
  createBuffDisplay(buff, teamColor, team) {
    const buffContainer = new Container();
    
    // Background panel
    const background = new Graphics();
    const panelWidth = 200;
    const panelHeight = 35;
    
    // Create gradient-like effect with multiple rectangles
    background.rect(0, 0, panelWidth, panelHeight);
    background.fill({ color: 0x000000, alpha: 0.7 });
    background.stroke({ color: teamColor, width: 2 });
    
    buffContainer.addChild(background);
    
    // Buff icon
    const iconSize = 24;
    const iconTexture = this.iconCache.get(buff.icon) || this.iconCache.get('default');
    
    let icon;
    if (iconTexture) {
      icon = new Sprite(iconTexture);
      icon.width = iconSize;
      icon.height = iconSize;
    } else {
      // Fallback to colored circle
      icon = new Graphics();
      icon.circle(iconSize / 2, iconSize / 2, iconSize / 2);
      icon.fill(teamColor);
    }
    
    icon.x = 8;
    icon.y = (panelHeight - iconSize) / 2;
    buffContainer.addChild(icon);
    
    // Buff name
    const nameText = new Text({
      text: buff.name || 'Unknown Buff',
      style: {
        fontSize: 12,
        fill: teamColor,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold'
      }
    });
    nameText.x = icon.x + iconSize + 8;
    nameText.y = 4;
    buffContainer.addChild(nameText);
    
    // Buff description
    const descText = new Text({
      text: buff.description || '',
      style: {
        fontSize: 9,
        fill: 0xCCCCCC,
        fontFamily: 'Arial, sans-serif',
        wordWrap: true,
        wordWrapWidth: panelWidth - (icon.x + iconSize + 16)
      }
    });
    descText.x = icon.x + iconSize + 8;
    descText.y = 18;
    buffContainer.addChild(descText);
    
    // Add glow effect for active buffs
    this.addGlowEffect(buffContainer, teamColor);
    
    return buffContainer;
  }

  /**
   * Add a subtle glow effect to buff displays
   * @param {Container} container - The buff container
   * @param {number} color - The glow color
   */
  addGlowEffect(container, color) {
    // Create a subtle pulse effect
    const glowGraphics = new Graphics();
    glowGraphics.rect(-2, -2, 204, 39);
    glowGraphics.fill({ color: color, alpha: 0.1 });
    
    container.addChildAt(glowGraphics, 0); // Add behind other elements
    
    // Simple pulse animation
    let pulseDirection = 1;
    let pulseAlpha = 0.1;
    
    const pulse = () => {
      pulseAlpha += pulseDirection * 0.005;
      if (pulseAlpha >= 0.2) {
        pulseDirection = -1;
      } else if (pulseAlpha <= 0.05) {
        pulseDirection = 1;
      }
      glowGraphics.alpha = pulseAlpha;
    };
    
    // Add pulse to ticker (simple approach)
    const ticker = this.app.ticker;
    ticker.add(pulse);
    
    // Store cleanup function
    container._cleanup = () => {
      ticker.remove(pulse);
    };
  }

  /**
   * Handle buff applied event from server
   * @param {Object} event - Buff event data
   */
  handleBuffApplied(event) {
    if (!event.buff || !event.team) return;
    
    // Add buff to current buffs and refresh display
    const teamBuffs = this.currentBuffs[event.team] || [];
    const existingIndex = teamBuffs.findIndex(b => b.id === event.buff.id);
    
    if (existingIndex >= 0) {
      // Update existing buff
      teamBuffs[existingIndex] = event.buff;
    } else {
      // Add new buff
      teamBuffs.push(event.buff);
    }
    
    this.updateTeamBuffs(event.team, teamBuffs);
  }

  /**
   * Handle buff removed event from server
   * @param {Object} event - Buff event data
   */
  handleBuffRemoved(event) {
    if (!event.buffId || !event.team) return;
    
    // Remove buff from current buffs and refresh display
    const teamBuffs = this.currentBuffs[event.team] || [];
    const filteredBuffs = teamBuffs.filter(b => b.id !== event.buffId);
    
    this.updateTeamBuffs(event.team, filteredBuffs);
  }

  /**
   * Cleanup method
   */
  destroy() {
    // Clean up all containers and their children
    [this.lightTeamContainer, this.darkTeamContainer].forEach(container => {
      container.children.forEach(child => {
        if (child._cleanup) {
          child._cleanup();
        }
      });
      container.removeChildren();
    });
    
    this.container.removeChildren();
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
  }
}
