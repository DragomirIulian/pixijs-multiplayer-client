const GameConfig = require('../config/gameConfig');

/**
 * Nexus entity class
 * Represents the team spawn points and victory objectives
 */
class Nexus {
  constructor(type, tileMap) {
    this.type = type; // 'light' or 'dark'
    this.teamType = type === 'light' ? 'green' : 'gray';
    this.id = `nexus-${type}`;
    
    // Health system
    this.maxHealth = GameConfig.NEXUS.MAX_HEALTH;
    this.currentHealth = this.maxHealth;
    this.lastRegenTime = Date.now();
    
    // Position (in tile coordinates)
    const nexusConfig = type === 'light' ? GameConfig.NEXUS.LIGHT_NEXUS : GameConfig.NEXUS.DARK_NEXUS;
    this.tileX = nexusConfig.TILE_X;
    this.tileY = nexusConfig.TILE_Y;
    
    // Calculate world position from tile coordinates
    this.x = this.tileX * tileMap.tileWidth + (tileMap.tileWidth / 2);
    this.y = this.tileY * tileMap.tileHeight + (tileMap.tileHeight / 2);
    
    // Status
    this.isDestroyed = false;
    this.isActive = true;
    
    // Creation time
    this.createdAt = Date.now();
  }

  /**
   * Update nexus state (health regeneration, etc.)
   */
  update() {
    if (this.isDestroyed || !this.isActive) return;

    // Regenerate health
    const now = Date.now();
    if (now - this.lastRegenTime >= GameConfig.NEXUS.REGENERATION_INTERVAL) {
      this.regenerateHealth();
      this.lastRegenTime = now;
    }
  }

  /**
   * Regenerate nexus health
   */
  regenerateHealth() {
    if (this.currentHealth < this.maxHealth) {
      this.currentHealth = Math.min(
        this.maxHealth, 
        this.currentHealth + GameConfig.NEXUS.HEALTH_REGENERATION
      );
    }
  }

  /**
   * Take damage to the nexus
   */
  takeDamage(damage) {
    if (this.isDestroyed) return false;

    this.currentHealth = Math.max(0, this.currentHealth - damage);
    
    if (this.currentHealth <= 0) {
      this.destroy();
      return true; // Nexus was destroyed
    }
    
    return false; // Still alive
  }

  /**
   * Destroy the nexus
   */
  destroy() {
    this.isDestroyed = true;
    this.isActive = false;
    this.currentHealth = 0;
  }

  /**
   * Get the spawn position for souls from this nexus
   */
  getSpawnPosition() {
    // Add slight randomization around the nexus position
    const offsetRange = GameConfig.NEXUS.SPAWN_OFFSET_RANGE;
    return {
      x: this.x + (Math.random() - 0.5) * offsetRange,
      y: this.y + (Math.random() - 0.5) * offsetRange
    };
  }

  /**
   * Get distance to a point
   */
  getDistanceTo(x, y) {
    const dx = this.x - x;
    const dy = this.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get health percentage
   */
  getHealthPercentage() {
    return this.currentHealth / this.maxHealth;
  }

  /**
   * Serialize nexus data for client
   */
  serialize() {
    return {
      id: this.id,
      type: this.type,
      teamType: this.teamType,
      x: this.x,
      y: this.y,
      tileX: this.tileX,
      tileY: this.tileY,
      currentHealth: this.currentHealth,
      maxHealth: this.maxHealth,
      healthPercentage: this.getHealthPercentage(),
      isDestroyed: this.isDestroyed,
      isActive: this.isActive,
      size: GameConfig.NEXUS.SIZE_TILES,
      visualMultiplier: GameConfig.NEXUS.VISUAL_MULTIPLIER
    };
  }
}

module.exports = Nexus;
