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
        // Load all tile textures
        const tileNames = [
            'gray-tile-01', 'gray-tile-02', 'gray-tile-03', 'gray-tile-04', 'gray-tile-05', 'gray-tile-06',
            'green-tile-01', 'green-tile-02', 'green-tile-03', 'green-tile-04', 'green-tile-05', 'green-tile-06'
        ];
        
        for (const tileName of tileNames) {
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

    updateTileMap(tileMapData, borderScores = null) {
        if (!tileMapData || this.tileTextures.size === 0) return;
        
        // Clear existing tiles
        this.tileContainer.removeChildren();
        
        // Store tile map data and border scores
        this.tileMap = tileMapData;
        if (borderScores) {
            this.borderScores = borderScores;
        }
        
        // Render tiles based on server data with random variants
        for (let y = 0; y < tileMapData.height; y++) {
            for (let x = 0; x < tileMapData.width; x++) {
                const tileData = tileMapData.tiles[y][x];
                const texture = tileData.variant ? 
                    this.tileTextures.get(tileData.variant) : 
                    this.getRandomTileTexture(tileData.type); // Fallback for old data
                
                if (!texture) {
                    console.warn(`No texture found for variant: ${tileData.variant}, type: ${tileData.type}`);
                }
                
                if (texture) {
                    const tileSprite = new Sprite(texture);
                    tileSprite.x = tileData.worldX;
                    tileSprite.y = tileData.worldY;
                    tileSprite.width = ClientConfig.MAP.TILE_DISPLAY_WIDTH;
                    tileSprite.height = ClientConfig.MAP.TILE_DISPLAY_HEIGHT;
                    
                    this.tileContainer.addChild(tileSprite);
                } else {
                    console.warn(`No texture found for tile type: ${tileData.type}`);
                }
            }
        }
        
        // Update score display
        this.updateScoreDisplay();
    }

    updateSingleTile(tileX, tileY, newType) {
        if (!this.tileMap || this.tileTextures.size === 0) return;
        
        // Find and update the specific tile sprite
        const tileIndex = tileY * this.tileMap.width + tileX;
        const tileSprite = this.tileContainer.getChildAt(tileIndex);
        
        if (tileSprite) {
            const texture = this.getRandomTileTexture(newType);
            if (texture) {
                tileSprite.texture = texture;
            }
        }
        
        // Update tile data
        this.tileMap.tiles[tileY][tileX].type = newType;
        
        // Update score display
        this.updateScoreDisplay();
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
