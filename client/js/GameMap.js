import { Container, Sprite, Assets, Text, TextStyle } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from './config/clientConfig.js';

/**
 * GameMap class handles tile map rendering and management
 * Separated from main Game class for better code organization
 */
export class GameMap {
    constructor(app) {
        this.app = app;
        this.container = new Container();
        this.tileContainer = new Container();
        this.scoreContainer = new Container();
        this.axisContainer = new Container();
        this.tileMap = null;
        this.tileTextures = new Map(); // Store all tile textures
        this.borderScores = null;
        this.showScores = true; // Debug mode toggle
        this.showAxis = true; // Coordinate axis toggle
    }

    async createMap() {
        await this.loadTileTextures();
        this.container.addChild(this.tileContainer);
        this.container.addChild(this.scoreContainer);
        this.container.addChild(this.axisContainer);
        
        // Make sure axis renders on top of everything
        this.axisContainer.zIndex = 1000;
        
        this.createCoordinateAxis();
    }

    async loadTileTextures() {
        // Load all tile textures including edge tiles
        const baseTileNames = [
            'gray-tile-01', 'gray-tile-02', 'gray-tile-03', 'gray-tile-04', 'gray-tile-05', 'gray-tile-06',
            'green-tile-01', 'green-tile-02', 'green-tile-03', 'green-tile-04', 'green-tile-05', 'green-tile-06'
        ];
        
        // Green edge tile names only (as requested)
        const edgeTileNames = [
            // Single edge tiles
            'green-tile-left', 'green-tile-right', 'green-tile-top', 'green-tile-bottom',
            // Corner edge tiles
            'green-tile-top-left-bottom', 'green-tile-top-right-bottom',
            'green-tile-leftbottom-lefttop', 'green-tile-rightbottom-righttop',
            'green-tile-top-rightbottom', 'green-tile-bottom-righttop',
            // Inner corner tiles (for green conquests)
            'green-tile-inner-left-top', 'green-tile-inner-left-bottom', 'green-tile-inner-right-top', 'green-tile-inner-right-bottom',
            // Outer corner tiles (for gray conquests affecting green neighbors)
            'green-tile-outer-left-top', 'green-tile-outer-left-bottom', 'green-tile-outer-right-top', 'green-tile-outer-right-bottom'
        ];
        
        const allTileNames = [...baseTileNames, ...edgeTileNames];
        
        for (const tileName of allTileNames) {
            try {
                const texture = await Assets.load(`./resources/${tileName}-64x64.png`);
                this.tileTextures.set(tileName, texture);
                console.log(`Loaded texture: ${tileName}`);
            } catch (error) {
                console.error(`Failed to load texture: ${tileName}`, error);
            }
        }
        
        console.log(`Loaded ${this.tileTextures.size} tile textures`);
    }
    
    // Helper function to get random tile texture for a team
    getRandomTileTexture(teamType) {
        const grayTiles = ['gray-tile-01', 'gray-tile-02', 'gray-tile-03', 'gray-tile-04', 'gray-tile-05', 'gray-tile-06'];
        const greenTiles = ['green-tile-01', 'green-tile-02', 'green-tile-03', 'green-tile-04', 'green-tile-05', 'green-tile-06'];
        
        const tileOptions = teamType === 'gray' ? grayTiles : greenTiles;
        const randomTile = tileOptions[Math.floor(Math.random() * tileOptions.length)];
        
        return this.tileTextures.get(randomTile);
    }

    /**
     * Get the appropriate tile texture based on conquest state and neighboring tiles
     * ONLY use green edge tiles when green territory is conquered
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate  
     * @param {string} tileType - Current tile type ('gray' or 'green')
     * @param {Object} tileMapData - Full tile map data
     * @returns {Texture} The appropriate tile texture
     */
    getEdgeAwareTileTexture(x, y, tileType, tileMapData) {
        // ONLY apply edge tiles for GREEN territories (conquered tiles)
        if (tileType !== 'green') {
            return this.getRandomTileTexture(tileType);
        }
        
        // For green tiles, determine the appropriate tile based on corner logic
        const edgeTileName = this.determineGreenTileType(x, y, tileMapData);
        const texture = this.tileTextures.get(edgeTileName);
        
        if (texture) {
            return texture;
        } else {
            console.warn(`Green edge tile not found: ${edgeTileName}, falling back to random green`);
            return this.getRandomTileTexture(tileType);
        }
    }

    /**
     * Get the types of neighboring tiles (4-directional)
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {Object} tileMapData - Full tile map data
     * @returns {Array} Array of neighboring tile types
     */
    getNeighborTypes(x, y, tileMapData) {
        const neighbors = [];
        const directions = [
            { dx: 0, dy: -1 }, // top
            { dx: 1, dy: 0 },  // right  
            { dx: 0, dy: 1 },  // bottom
            { dx: -1, dy: 0 }  // left
        ];
        
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            
            if (nx >= 0 && nx < tileMapData.width && ny >= 0 && ny < tileMapData.height) {
                neighbors.push(tileMapData.tiles[ny][nx].type);
            } else {
                // Treat out-of-bounds as neutral (don't affect edge detection)
                neighbors.push(null);
            }
        }
        
        return neighbors;
    }

    /**
     * Determine the appropriate GREEN tile type by checking ALL 8 neighbors
     * @param {number} x - Tile X coordinate  
     * @param {number} y - Tile Y coordinate
     * @param {Object} tileMapData - Full tile map data
     * @returns {string} The green tile name to use
     */
    determineGreenTileType(x, y, tileMapData) {
        // Get all 8 neighbors: [top, topRight, right, bottomRight, bottom, bottomLeft, left, topLeft]
        const allNeighbors = this.getAllNeighborTypes(x, y, tileMapData);
        
        const top = allNeighbors[0] === 'gray';
        const topRight = allNeighbors[1] === 'gray';
        const right = allNeighbors[2] === 'gray';
        const bottomRight = allNeighbors[3] === 'gray';
        const bottom = allNeighbors[4] === 'gray';
        const bottomLeft = allNeighbors[5] === 'gray';
        const left = allNeighbors[6] === 'gray';
        const topLeft = allNeighbors[7] === 'gray';
        
        if(top && topRight && right && bottomRight && bottom) return 'green-tile-top-right-bottom';
        if(top && topLeft && left && bottomLeft && bottom) return 'green-tile-top-left-bottom';
        
        if(topRight && bottomRight && !top && !right && !bottom) return 'green-tile-rightbottom-righttop';
        if(bottomLeft && topLeft && !bottom && !left && !top) return 'green-tile-leftbottom-lefttop';
        
        if(top && !right && !bottom && !left && bottomRight) return 'green-tile-top-rightbottom';
        if(bottom && !right && !top && !left && topRight) return 'green-tile-bottom-righttop';
        // OUTER CORNERS: Two adjacent sides are gray
        if (top && right) return 'green-tile-inner-right-top';
        if (right && bottom) return 'green-tile-inner-right-bottom';
        if (bottom && left) return 'green-tile-inner-left-bottom';
        if (left && top) return 'green-tile-inner-left-top';
        
        // INNER CORNERS: Diagonal is gray but adjacent sides are not gray
        if (topLeft && !top && !left) return 'green-tile-outer-right-bottom';
        if (topRight && !top && !right) return 'green-tile-outer-left-bottom';
        if (bottomRight && !bottom && !right) return 'green-tile-outer-left-top';
        if (bottomLeft && !bottom && !left) return 'green-tile-outer-right-top';
        
        // SINGLE EDGES: Only one side is gray
        if (top && !right && !bottom && !left) return 'green-tile-top';
        if (right && !top && !bottom && !left) return 'green-tile-right';
        if (bottom && !top && !right && !left) return 'green-tile-bottom';
        if (left && !top && !right && !bottom) return 'green-tile-left';
        
        // COMPLEX CASES: Multiple sides (use first priority)
        if (top) return 'green-tile-top';
        if (right) return 'green-tile-right';
        if (bottom) return 'green-tile-bottom';
        if (left) return 'green-tile-left';
        
        // No gray neighbors, use random green tile
        const baseTiles = ['green-tile-01', 'green-tile-02', 'green-tile-03', 'green-tile-04', 'green-tile-05', 'green-tile-06'];
        return baseTiles[Math.floor(Math.random() * baseTiles.length)];
    }

    /**
     * Get ALL 8 neighboring tiles systematically
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {Object} tileMapData - Full tile map data
     * @returns {Array} Array of all 8 neighbors: [top, topRight, right, bottomRight, bottom, bottomLeft, left, topLeft]
     */
    getAllNeighborTypes(x, y, tileMapData) {
        const allNeighbors = [];
        
        // Check all 8 directions systematically, starting from top and going clockwise
        const directions = [
            { dx: 0, dy: -1 },  // top
            { dx: 1, dy: -1 },  // top-right
            { dx: 1, dy: 0 },   // right
            { dx: 1, dy: 1 },   // bottom-right
            { dx: 0, dy: 1 },   // bottom
            { dx: -1, dy: 1 },  // bottom-left
            { dx: -1, dy: 0 },  // left
            { dx: -1, dy: -1 }  // top-left
        ];
        
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            
            if (nx >= 0 && nx < tileMapData.width && ny >= 0 && ny < tileMapData.height) {
                allNeighbors.push(tileMapData.tiles[ny][nx].type);
            } else {
                // Treat out-of-bounds as neutral (not gray)
                allNeighbors.push(null);
            }
        }
        
        return allNeighbors;
    }

    /**
     * Get the types of diagonal neighboring tiles
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {Object} tileMapData - Full tile map data
     * @returns {Array} Array of diagonal neighboring tile types [topLeft, topRight, bottomRight, bottomLeft]
     */
    getDiagonalTypes(x, y, tileMapData) {
        const diagonals = [];
        const directions = [
            { dx: -1, dy: -1 }, // top-left
            { dx: 1, dy: -1 },  // top-right  
            { dx: 1, dy: 1 },   // bottom-right
            { dx: -1, dy: 1 }   // bottom-left
        ];
        
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            
            if (nx >= 0 && nx < tileMapData.width && ny >= 0 && ny < tileMapData.height) {
                diagonals.push(tileMapData.tiles[ny][nx].type);
            } else {
                // Treat out-of-bounds as neutral
                diagonals.push(null);
            }
        }
        
        return diagonals;
    }

    updateTileMap(tileMapData, borderScores = null) {
        if (!tileMapData || this.tileTextures.size === 0) return;
        
        // Clear existing tiles
        this.tileContainer.removeChildren();
        
        // Store tile map data and border scores
        this.tileMap = tileMapData;
        if (borderScores) {
            this.borderScores = borderScores;
        }
        
        // Render tiles with edge-aware texture selection
        for (let y = 0; y < tileMapData.height; y++) {
            for (let x = 0; x < tileMapData.width; x++) {
                const tileData = tileMapData.tiles[y][x];
                
                // Use edge-aware texture selection for better visual borders
                const texture = this.getEdgeAwareTileTexture(x, y, tileData.type, tileMapData);
                
                if (texture) {
                    const tileSprite = new Sprite(texture);
                    tileSprite.x = tileData.worldX;
                    tileSprite.y = tileData.worldY;
                    tileSprite.width = ClientConfig.MAP.TILE_DISPLAY_WIDTH;
                    tileSprite.height = ClientConfig.MAP.TILE_DISPLAY_HEIGHT;
                    
                    this.tileContainer.addChild(tileSprite);
                } else {
                    console.warn(`No texture found for tile type: ${tileData.type} at position (${x}, ${y})`);
                }
            }
        }
        
        // Update score display
        this.updateScoreDisplay();
    }

    updateSingleTile(tileX, tileY, newType) {
        if (!this.tileMap || this.tileTextures.size === 0) return;
        
        // Update tile data first
        this.tileMap.tiles[tileY][tileX].type = newType;
        
        // Get edge-aware texture for the conquered tile
        const texture = this.getEdgeAwareTileTexture(tileX, tileY, newType, this.tileMap);
        
        // Find and update the specific tile sprite
        const tileIndex = tileY * this.tileMap.width + tileX;
        const tileSprite = this.tileContainer.getChildAt(tileIndex);
        
        if (tileSprite && texture) {
            tileSprite.texture = texture;
        }
        
        // Update neighboring tiles that might need different edge textures now
        this.updateNeighborTiles(tileX, tileY);
        
        // Update score display
        this.updateScoreDisplay();
    }

    /**
     * Update neighboring tiles after a conquest to ensure proper edge textures
     * Updates up to 5 green neighbors plus diagonals as corners can affect a wider area
     * @param {number} centerX - X coordinate of the changed tile
     * @param {number} centerY - Y coordinate of the changed tile
     */
    updateNeighborTiles(centerX, centerY) {
        // Update in a 3x3 grid around the changed tile to handle all corner cases
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                // Skip the center tile (already updated)
                if (dx === 0 && dy === 0) continue;
                
                const nx = centerX + dx;
                const ny = centerY + dy;
                
                // Check bounds
                if (nx >= 0 && nx < this.tileMap.width && ny >= 0 && ny < this.tileMap.height) {
                    const neighborTile = this.tileMap.tiles[ny][nx];
                    
                    // Only update green tiles (they're the ones that use edge tiles)
                    if (neighborTile.type === 'green') {
                        const neighborTexture = this.getEdgeAwareTileTexture(nx, ny, neighborTile.type, this.tileMap);
                        
                        const neighborIndex = ny * this.tileMap.width + nx;
                        const neighborSprite = this.tileContainer.getChildAt(neighborIndex);
                        
                        if (neighborSprite && neighborTexture) {
                            neighborSprite.texture = neighborTexture;
                        }
                    }
                }
            }
        }
    }

    updateBorderScores(borderScores) {
        this.borderScores = borderScores;
        this.updateScoreDisplay();
    }

    updateScoreDisplay() {
        if (!this.showScores || !this.borderScores || !this.tileMap) return;
        
        // Clear existing score displays
        this.scoreContainer.removeChildren();
        
        // Create text styles for different teams
        const lightTeamStyle = new TextStyle({
            fontSize: 8,
            fill: 0xFFFF00, // Bright yellow text for light team
            fontWeight: 'bold',
            stroke: 0x000000, // Black outline for visibility
            strokeThickness: 1
        });
        
        const darkTeamStyle = new TextStyle({
            fontSize: 8,
            fill: 0x00FFFF, // Bright cyan text for dark team
            fontWeight: 'bold',
            stroke: 0x000000, // Black outline for visibility
            strokeThickness: 1
        });
        
        // Get scores from server data
        const scores = this.borderScores.scores || this.borderScores; // Handle both old and new format
        
        if (!scores || !scores.green || !scores.gray) {
            console.warn('No valid scores from server');
            return;
        }
        
        // Display scores for ALL tiles that have non-zero values from server
        for (let y = 0; y < this.tileMap.height; y++) {
            for (let x = 0; x < this.tileMap.width; x++) {
                // Check if this tile has any non-zero scores from server
                const lightScore = scores.green[y] && scores.green[y][x];
                const darkScore = scores.gray[y] && scores.gray[y][x];
                
                if (lightScore === 0 && darkScore === 0) continue; // Skip tiles with all zero scores
                
                const tileData = this.tileMap.tiles[y][x];
                
                // Light team scores (green)
                const lightText = new Text(lightScore.toString(), lightTeamStyle);
                
                // Center the light score in the top half of the tile
                const tileCenterX = tileData.worldX + (ClientConfig.MAP.TILE_DISPLAY_WIDTH / 2);
                const lightCenterY = tileData.worldY + (ClientConfig.MAP.TILE_DISPLAY_HEIGHT / 4);
                lightText.anchor.set(0.5, 0.5); // Center the text anchor
                lightText.x = tileCenterX;
                lightText.y = lightCenterY;
                this.scoreContainer.addChild(lightText);
                
                // Dark team scores (gray)
                const darkText = new Text(darkScore.toString(), darkTeamStyle);
                
                // Center the dark score in the bottom half of the tile
                const darkCenterY = tileData.worldY + (ClientConfig.MAP.TILE_DISPLAY_HEIGHT * 3 / 4);
                darkText.anchor.set(0.5, 0.5); // Center the text anchor
                darkText.x = tileCenterX;
                darkText.y = darkCenterY;
                this.scoreContainer.addChild(darkText);
            }
        }
    }

    createCoordinateAxis() {
        if (!this.showAxis) return;
        
        // Clear existing axis
        this.axisContainer.removeChildren();
        
        // Get map dimensions from ClientConfig
        const mapWidth = ClientConfig.CANVAS.WIDTH;
        const mapHeight = ClientConfig.CANVAS.HEIGHT;
        
        // Style for axis labels
        const axisStyle = new TextStyle({
            fontSize: 12,
            fill: 0xFFFFFF, // White text
            fontWeight: 'bold',
            stroke: 0x000000, // Black outline for visibility
            strokeThickness: 2
        });
        
        // Create X-axis labels (top and bottom edges) - tile-based coordinates
        for (let tileX = 0; tileX < ClientConfig.MAP.TILES_WIDTH; tileX++) {
            const worldX = tileX * ClientConfig.MAP.TILE_DISPLAY_WIDTH + ClientConfig.MAP.TILE_DISPLAY_WIDTH / 2;
            
            // Top edge
            const topLabel = new Text(worldX.toString(), axisStyle);
            topLabel.anchor.set(0.5, 0); // Center horizontally, top align
            topLabel.x = worldX;
            topLabel.y = 5; // Just inside the map
            this.axisContainer.addChild(topLabel);
            
            // Bottom edge
            const bottomLabel = new Text(worldX.toString(), axisStyle);
            bottomLabel.anchor.set(0.5, 1); // Center horizontally, bottom align
            bottomLabel.x = worldX;
            bottomLabel.y = mapHeight - 5; // Just inside the map
            this.axisContainer.addChild(bottomLabel);
        }
        
        // Create Y-axis labels (left and right edges) - tile-based coordinates
        for (let tileY = 0; tileY < ClientConfig.MAP.TILES_HEIGHT; tileY++) {
            const worldY = tileY * ClientConfig.MAP.TILE_DISPLAY_HEIGHT + ClientConfig.MAP.TILE_DISPLAY_HEIGHT / 2;
            
            // Left edge
            const leftLabel = new Text(worldY.toString(), axisStyle);
            leftLabel.anchor.set(0, 0.5); // Left align, center vertically
            leftLabel.x = 5; // Just inside the map
            leftLabel.y = worldY;
            this.axisContainer.addChild(leftLabel);
            
            // Right edge
            const rightLabel = new Text(worldY.toString(), axisStyle);
            rightLabel.anchor.set(1, 0.5); // Right align, center vertically
            rightLabel.x = mapWidth - 5; // Just inside the map
            rightLabel.y = worldY;
            this.axisContainer.addChild(rightLabel);
        }
    }


}
