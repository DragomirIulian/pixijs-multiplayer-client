const GameConfig = require('../config/gameConfig');

/**
 * Scoring System
 * Centralized tile scoring logic for both movement and spell systems
 * Calculates Manhattan distances and border scores for pathfinding and spell targeting
 */
class ScoringSystem {
  constructor(tileMap) {
    this.tileMap = tileMap;
    
    // Border scoring matrices for team-specific path finding
    this.borderScores = {
      green: [], // Light team scores (top+left border)
      gray: []   // Dark team scores (right+bottom border)
    };
    
    // Note: SpellSystem uses getBorderScore which already includes Manhattan distance calculation
    
    // Border rectangle coordinates
    this.borderRect = {
      left: 0,
      top: 0, 
      right: 0,
      bottom: 0
    };
    
    // Calculate border dimensions
    this.borderWidthX = Math.ceil(100 / GameConfig.TILEMAP.TILE_WIDTH);
    this.borderWidthY = Math.ceil(100 / GameConfig.TILEMAP.TILE_HEIGHT);
    
    this.initializeScoring();
  }

  /**
   * Initialize all scoring systems
   */
  initializeScoring() {
    this.calculateBorderRectangle();
    this.calculateBorderScores();
  }

  /**
   * Calculate border rectangle bounds based on nexus positions
   */
  calculateBorderRectangle() {
    const lightNexus = GameConfig.NEXUS.LIGHT_NEXUS;
    const darkNexus = GameConfig.NEXUS.DARK_NEXUS;
    
    // Create rectangle with nexuses sitting in the MIDDLE of the border width
    const halfBorderX = Math.floor(this.borderWidthX / 2);
    const halfBorderY = Math.floor(this.borderWidthY / 2);
    
    this.borderRect = {
      left: lightNexus.TILE_X - halfBorderX,     // Light nexus in middle of left border
      top: darkNexus.TILE_Y - halfBorderY,      // Dark nexus in middle of top border  
      right: darkNexus.TILE_X + halfBorderX,    // Dark nexus in middle of right border
      bottom: lightNexus.TILE_Y + halfBorderY   // Light nexus in middle of bottom border
    };
  }

  /**
   * Calculate border scores for movement pathfinding
   */
  calculateBorderScores() {
    const width = this.tileMap.width;
    const height = this.tileMap.height;
    
    // Initialize arrays
    this.borderScores.green = Array(height).fill(null).map(() => Array(width).fill(0));
    this.borderScores.gray = Array(height).fill(null).map(() => Array(width).fill(0));
    
    // Calculate scores for all tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.borderScores.green[y][x] = this.calculateTileScore(x, y, 'green');
        this.borderScores.gray[y][x] = this.calculateTileScore(x, y, 'gray');
      }
    }
  }


  /**
   * Calculate score for a specific tile based on team rules (used by MovementSystem)
   */
  calculateTileScore(x, y, teamType) {
    // Outside border rectangle = 0 score
    if (x < this.borderRect.left || x > this.borderRect.right ||
        y < this.borderRect.top || y > this.borderRect.bottom) {
      return 0;
    }
    
    // Check if tile is owned by this team (0 score if owned)
    const tile = this.tileMap.tiles[y] && this.tileMap.tiles[y][x];
    if (tile && tile.type === teamType) {
      return 0;
    }
    
    // Check if tile is occupied by enemy nexus (0 score - can't attack nexus tiles)
    const enemyNexus = teamType === 'green' ? GameConfig.NEXUS.DARK_NEXUS : GameConfig.NEXUS.LIGHT_NEXUS;
    if (this.isTileOccupiedByNexus(x, y, enemyNexus)) {
      return 0;
    }
    
    // Team-specific border restrictions
    if (teamType === 'green') {
      // Light team: ONLY top and left sides of rectangle
      const isOnTopSide = (y <= this.borderRect.top + this.borderWidthY);
      const isOnLeftSide = (x <= this.borderRect.left + this.borderWidthX);
      
      if (!isOnTopSide && !isOnLeftSide) {
        return 0; // Not on light team's assigned sides
      }
    } else {
      // Dark team: ONLY right and bottom sides of rectangle  
      const isOnRightSide = (x >= this.borderRect.right - this.borderWidthX);
      const isOnBottomSide = (y >= this.borderRect.bottom - this.borderWidthY);
      
      if (!isOnRightSide && !isOnBottomSide) {
        return 0; // Not on dark team's assigned sides
      }
    }
    
    // Calculate Manhattan distance to closest enemy nexus tile
    const manhattanDistance = this.getDistanceToClosestNexusTile(x, y, enemyNexus);
    
    // Return Manhattan distance directly as score
    // Tiles NEAR enemy nexus have LOW scores, tiles FAR from enemy nexus have HIGH scores
    // Souls seek HIGHEST scores, so they'll prioritize tiles far from enemy nexus (closer to their own base)
    return manhattanDistance;
  }

  /**
   * Check if a tile is occupied by a nexus (8x8 tile area)
   */
  isTileOccupiedByNexus(x, y, nexusConfig) {
    const NEXUS_SIZE = 8; // 8x8 tiles
    const halfSize = Math.floor(NEXUS_SIZE / 2);
    
    const nexusLeft = nexusConfig.TILE_X - halfSize;
    const nexusRight = nexusConfig.TILE_X + halfSize - 1;
    const nexusTop = nexusConfig.TILE_Y - halfSize;
    const nexusBottom = nexusConfig.TILE_Y + halfSize - 1;
    
    return x >= nexusLeft && x <= nexusRight && y >= nexusTop && y <= nexusBottom;
  }

  /**
   * Get Manhattan distance to the closest tile of the enemy nexus
   */
  getDistanceToClosestNexusTile(x, y, nexusConfig) {
    const NEXUS_SIZE = 8; // 8x8 tiles
    const halfSize = Math.floor(NEXUS_SIZE / 2);
    
    const nexusLeft = nexusConfig.TILE_X - halfSize;
    const nexusRight = nexusConfig.TILE_X + halfSize - 1;
    const nexusTop = nexusConfig.TILE_Y - halfSize;
    const nexusBottom = nexusConfig.TILE_Y + halfSize - 1;
    
    // Find the closest nexus tile
    const closestX = Math.max(nexusLeft, Math.min(nexusRight, x));
    const closestY = Math.max(nexusTop, Math.min(nexusBottom, y));
    
    // Return Manhattan distance to closest nexus tile
    return Math.abs(x - closestX) + Math.abs(y - closestY);
  }

  /**
   * Update scores when tiles change (called after spell casting)
   */
  updateScores() {
    this.calculateBorderScores();
  }

  /**
   * Get border score for a specific tile and team (used by MovementSystem)
   */
  getBorderScore(x, y, teamType) {
    if (y < 0 || y >= this.borderScores[teamType].length || 
        x < 0 || x >= this.borderScores[teamType][0].length) {
      return 0;
    }
    return this.borderScores[teamType][y][x];
  }

  /**
   * Get Manhattan score for a specific tile and team (used by SpellSystem)
   * This is the same as getBorderScore - just an alias for clarity
   */
  getManhattanScore(x, y, teamType) {
    return this.getBorderScore(x, y, teamType);
  }

  /**
   * Get all border scores (used by GameManager for client updates)
   */
  getAllBorderScores() {
    return this.borderScores;
  }

  /**
   * Get border rectangle bounds
   */
  getBorderRect() {
    return this.borderRect;
  }

  /**
   * Get border width dimensions
   */
  getBorderDimensions() {
    return {
      widthX: this.borderWidthX,
      widthY: this.borderWidthY
    };
  }
}

module.exports = ScoringSystem;

