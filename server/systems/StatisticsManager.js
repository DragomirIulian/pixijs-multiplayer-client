const GameConfig = require('../config/gameConfig');

/**
 * Statistics Manager
 * Tracks comprehensive game statistics including team percentages, births, deaths, and tile conquest
 */
class StatisticsManager {
  constructor() {
    // Team statistics
    this.teamStats = {
      light: {
        totalSouls: 0,
        adultSouls: 0,
        childSouls: 0,
        percentage: 0,
        births: 0,
        deaths: 0,
        tilesControlled: 0,
        totalTilesConquered: 0
      },
      dark: {
        totalSouls: 0,
        adultSouls: 0,
        childSouls: 0,
        percentage: 0,
        births: 0,
        deaths: 0,
        tilesControlled: 0,
        totalTilesConquered: 0
      }
    };

    // Overall game statistics
    this.gameStats = {
      totalBirths: 0,
      totalDeaths: 0,
      totalSouls: 0,
      gameStartTime: Date.now(),
      lastUpdateTime: Date.now()
    };

    // Tile ownership tracking
    this.tileOwnership = new Map(); // tileKey -> { owner: 'light'|'dark', captureTime: timestamp }
    this.initialTerritoryMapped = false;

    // Historical data for trends
    this.statsHistory = [];
    this.maxHistoryLength = 100; // Keep last 100 data points
  }

  /**
   * Initialize the statistics system with the current game state
   */
  initialize(gameManager) {
    this.mapInitialTerritory(gameManager.getTileMap());
    this.updateFromGameState(gameManager);
  }

  /**
   * Map the initial territory ownership based on tile types
   */
  mapInitialTerritory(tileMap) {
    if (this.initialTerritoryMapped || !tileMap) return;

    const tiles = tileMap.tiles;
    let lightTiles = 0;
    let darkTiles = 0;

    for (let y = 0; y < tileMap.height; y++) {
      for (let x = 0; x < tileMap.width; x++) {
        const tile = tiles[y][x];
        const tileKey = `${x},${y}`;
        
        if (tile.type === 'green') {
          this.tileOwnership.set(tileKey, { 
            owner: 'light', 
            captureTime: this.gameStats.gameStartTime,
            originalOwner: 'light'
          });
          lightTiles++;
        } else if (tile.type === 'gray') {
          this.tileOwnership.set(tileKey, { 
            owner: 'dark', 
            captureTime: this.gameStats.gameStartTime,
            originalOwner: 'dark'
          });
          darkTiles++;
        }
      }
    }

    this.teamStats.light.tilesControlled = lightTiles;
    this.teamStats.dark.tilesControlled = darkTiles;
    this.initialTerritoryMapped = true;
  }

  /**
   * Update statistics from current game state
   */
  updateFromGameState(gameManager) {
    this.updateSoulCounts(gameManager.souls);
    this.updateTeamPercentages();
    this.updateTileControl(gameManager);
    this.gameStats.lastUpdateTime = Date.now();
    
    // Add current state to history
    this.addToHistory();
  }

  /**
   * Update soul counts and percentages
   */
  updateSoulCounts(souls) {
    // Reset counts
    this.teamStats.light.totalSouls = 0;
    this.teamStats.light.adultSouls = 0;
    this.teamStats.light.childSouls = 0;
    this.teamStats.dark.totalSouls = 0;
    this.teamStats.dark.adultSouls = 0;
    this.teamStats.dark.childSouls = 0;

    // Count souls by team
    souls.forEach(soul => {
      const team = soul.type === 'light-soul' ? 'light' : 'dark';
      this.teamStats[team].totalSouls++;
      
      if (soul.isAdult()) {
        this.teamStats[team].adultSouls++;
      } else {
        this.teamStats[team].childSouls++;
      }
    });

    this.gameStats.totalSouls = this.teamStats.light.totalSouls + this.teamStats.dark.totalSouls;
  }

  /**
   * Calculate team percentages based on territory control (tiles owned)
   */
  updateTeamPercentages() {
    const totalTiles = this.teamStats.light.tilesControlled + this.teamStats.dark.tilesControlled;
    
    if (totalTiles > 0) {
      this.teamStats.light.percentage = Math.round((this.teamStats.light.tilesControlled / totalTiles) * 100 * 10) / 10;
      this.teamStats.dark.percentage = Math.round((this.teamStats.dark.tilesControlled / totalTiles) * 100 * 10) / 10;
    } else {
      // Fallback to 50/50 if no tiles are controlled
      this.teamStats.light.percentage = 50;
      this.teamStats.dark.percentage = 50;
    }
    
  }

  /**
   * Update tile control statistics based on current soul positions
   */
  updateTileControl(gameManager) {
    if (!gameManager.tileMap || !gameManager.souls) return;
    
    // Reset tile ownership based on soul presence
    const tileMap = gameManager.tileMap;
    const souls = Array.from(gameManager.souls.values());
    
    // Reset all tiles to neutral, then assign based on soul presence
    let lightTiles = 0;
    let darkTiles = 0;
    
    // Count tiles by checking which team has more souls in each area
    for (let y = 0; y < tileMap.height; y++) {
      for (let x = 0; x < tileMap.width; x++) {
        const tileWorldX = x * tileMap.tileWidth + tileMap.tileWidth / 2;
        const tileWorldY = y * tileMap.tileHeight + tileMap.tileHeight / 2;
        
        // Count souls within this tile area
        let lightSoulsInTile = 0;
        let darkSoulsInTile = 0;
        
        souls.forEach(soul => {
          // Check if soul is within this tile bounds
          const soulTileX = Math.floor(soul.x / tileMap.tileWidth);
          const soulTileY = Math.floor(soul.y / tileMap.tileHeight);
          
          if (soulTileX === x && soulTileY === y) {
            if (soul.type === 'light-soul') {
              lightSoulsInTile++;
            } else if (soul.type === 'dark-soul') {
              darkSoulsInTile++;
            }
          }
        });
        
        // Assign tile ownership based on soul presence
        const tileKey = `${x},${y}`;
        if (lightSoulsInTile > darkSoulsInTile) {
          // Light team controls this tile
          this.tileOwnership.set(tileKey, {
            owner: 'light',
            captureTime: Date.now(),
            originalOwner: tileMap.tiles[y][x].type === 'green' ? 'light' : 'dark'
          });
          lightTiles++;
        } else if (darkSoulsInTile > lightSoulsInTile) {
          // Dark team controls this tile
          this.tileOwnership.set(tileKey, {
            owner: 'dark', 
            captureTime: Date.now(),
            originalOwner: tileMap.tiles[y][x].type === 'green' ? 'light' : 'dark'
          });
          darkTiles++;
        } else {
          // Neutral or tied - use original tile type
          const originalType = tileMap.tiles[y][x].type;
          const owner = originalType === 'green' ? 'light' : 'dark';
          this.tileOwnership.set(tileKey, {
            owner: owner,
            captureTime: this.gameStats.gameStartTime,
            originalOwner: owner
          });
          
          if (owner === 'light') {
            lightTiles++;
          } else {
            darkTiles++;
          }
        }
      }
    }
    
    // Update tile control counts
    this.teamStats.light.tilesControlled = lightTiles;
    this.teamStats.dark.tilesControlled = darkTiles;
  }

  /**
   * Process game events to update statistics
   */
  processGameEvents(events) {
    events.forEach(event => {
      switch (event.type) {
        case 'character_spawn':
          this.handleBirth(event);
          break;
        case 'character_death':
        case 'character_remove':
          this.handleDeath(event);
          break;
        case 'mating_completed':
          this.handleMatingCompleted(event);
          break;
        case 'tile_conquered':
          this.handleTileConquest(event);
          break;
      }
    });
  }

  /**
   * Handle birth events
   */
  handleBirth(event) {
    if (event.character) {
      const team = event.character.type === 'light-soul' ? 'light' : 'dark';
      this.teamStats[team].births++;
      this.gameStats.totalBirths++;
    }
  }

  /**
   * Handle death events
   */
  handleDeath(event) {
    if (event.characterData) {
      const team = event.characterData.type === 'light-soul' ? 'light' : 'dark';
      this.teamStats[team].deaths++;
      this.gameStats.totalDeaths++;
    }
  }

  /**
   * Handle mating completion (birth events)
   */
  handleMatingCompleted(event) {
    if (event.childData) {
      const team = event.childData.type === 'light-soul' ? 'light' : 'dark';
      this.teamStats[team].births++;
      this.gameStats.totalBirths++;
    }
  }

  /**
   * Handle tile conquest events (for future dynamic territory system)
   */
  handleTileConquest(event) {
    if (event.tileX !== undefined && event.tileY !== undefined && event.newOwner) {
      const tileKey = `${event.tileX},${event.tileY}`;
      const previousOwner = this.tileOwnership.get(tileKey);
      
      if (previousOwner && previousOwner.owner !== event.newOwner) {
        // Update tile ownership
        this.tileOwnership.set(tileKey, {
          owner: event.newOwner,
          captureTime: Date.now(),
          originalOwner: previousOwner.originalOwner
        });

        // Update conquest counters
        const conquerer = event.newOwner;
        const victim = previousOwner.owner;
        
        this.teamStats[conquerer].totalTilesConquered++;
        this.teamStats[conquerer].tilesControlled++;
        this.teamStats[victim].tilesControlled--;
      }
    }
  }

  /**
   * Add current state to history for trend analysis
   */
  addToHistory() {
    const snapshot = {
      timestamp: Date.now(),
      light: { ...this.teamStats.light },
      dark: { ...this.teamStats.dark },
      totalSouls: this.gameStats.totalSouls
    };

    this.statsHistory.push(snapshot);

    // Keep history within limits
    if (this.statsHistory.length > this.maxHistoryLength) {
      this.statsHistory.shift();
    }
  }

  /**
   * Get current statistics for client display
   */
  getClientStats() {
    return {
      teams: {
        light: {
          name: 'Light Souls',
          color: '#FFD700', // Gold
          totalSouls: this.teamStats.light.totalSouls,
          adultSouls: this.teamStats.light.adultSouls,
          childSouls: this.teamStats.light.childSouls,
          percentage: Math.round(this.teamStats.light.percentage * 10) / 10, // Round to 1 decimal
          births: this.teamStats.light.births,
          deaths: this.teamStats.light.deaths,
          tilesControlled: this.teamStats.light.tilesControlled,
          totalTilesConquered: this.teamStats.light.totalTilesConquered
        },
        dark: {
          name: 'Dark Souls',
          color: '#8A2BE2', // BlueViolet
          totalSouls: this.teamStats.dark.totalSouls,
          adultSouls: this.teamStats.dark.adultSouls,
          childSouls: this.teamStats.dark.childSouls,
          percentage: Math.round(this.teamStats.dark.percentage * 10) / 10, // Round to 1 decimal
          births: this.teamStats.dark.births,
          deaths: this.teamStats.dark.deaths,
          tilesControlled: this.teamStats.dark.tilesControlled,
          totalTilesConquered: this.teamStats.dark.totalTilesConquered
        }
      },
      game: {
        totalSouls: this.gameStats.totalSouls,
        totalBirths: this.gameStats.totalBirths,
        totalDeaths: this.gameStats.totalDeaths,
        gameUptime: Date.now() - this.gameStats.gameStartTime,
        lastUpdate: this.gameStats.lastUpdateTime
      },
      history: this.getRecentHistory(10) // Last 10 data points for charts
    };
  }

  /**
   * Get recent history for trend visualization
   */
  getRecentHistory(count = 10) {
    const recentHistory = this.statsHistory.slice(-count);
    return recentHistory.map(snapshot => ({
      timestamp: snapshot.timestamp,
      lightPercentage: Math.round(snapshot.light.percentage),
      darkPercentage: Math.round(snapshot.dark.percentage),
      lightSouls: snapshot.light.totalSouls,
      darkSouls: snapshot.dark.totalSouls,
      lightTiles: snapshot.light.tilesControlled,
      darkTiles: snapshot.dark.tilesControlled
    }));
  }


  /**
   * Reset all statistics (for game restart)
   */
  reset() {
    this.teamStats.light = {
      totalSouls: 0, adultSouls: 0, childSouls: 0, percentage: 0,
      births: 0, deaths: 0, tilesControlled: 0, totalTilesConquered: 0
    };
    this.teamStats.dark = {
      totalSouls: 0, adultSouls: 0, childSouls: 0, percentage: 0,
      births: 0, deaths: 0, tilesControlled: 0, totalTilesConquered: 0
    };
    this.gameStats = {
      totalBirths: 0, totalDeaths: 0, totalSouls: 0,
      gameStartTime: Date.now(), lastUpdateTime: Date.now()
    };
    this.tileOwnership.clear();
    this.statsHistory = [];
    this.initialTerritoryMapped = false;
  }
}

module.exports = StatisticsManager;
