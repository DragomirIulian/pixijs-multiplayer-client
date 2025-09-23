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
        this.tileMap = null;
        this.grayTileTexture = null;
        this.greenTileTexture = null;
        this.borderScores = null;
        this.showScores = true; // Debug mode toggle
    }

    async createMap() {
        await this.loadTileTextures();
        this.container.addChild(this.tileContainer);
        this.container.addChild(this.scoreContainer);
    }

    async loadTileTextures() {
        // Load tile textures using configuration values
        this.grayTileTexture = await Assets.load(`./resources/background_gray_${ClientConfig.MAP.TILE_TEXTURE_WIDTH}x${ClientConfig.MAP.TILE_TEXTURE_HEIGHT}.png`);
        this.greenTileTexture = await Assets.load(`./resources/background_green_${ClientConfig.MAP.TILE_TEXTURE_WIDTH}x${ClientConfig.MAP.TILE_TEXTURE_HEIGHT}.png`);
    }

    updateTileMap(tileMapData, borderScores = null) {
        if (!tileMapData || !this.grayTileTexture || !this.greenTileTexture) return;
        
        // Clear existing tiles
        this.tileContainer.removeChildren();
        
        // Store tile map data and border scores
        this.tileMap = tileMapData;
        if (borderScores) {
            this.borderScores = borderScores;
        }
        
        // Render tiles based on server data
        for (let y = 0; y < tileMapData.height; y++) {
            for (let x = 0; x < tileMapData.width; x++) {
                const tileData = tileMapData.tiles[y][x];
                const texture = tileData.type === 'gray' ? this.grayTileTexture : this.greenTileTexture;
                
                const tileSprite = new Sprite(texture);
                tileSprite.x = tileData.worldX;
                tileSprite.y = tileData.worldY;
                // Scale the tiles down from texture size to display size
                tileSprite.width = ClientConfig.MAP.TILE_DISPLAY_WIDTH;
                tileSprite.height = ClientConfig.MAP.TILE_DISPLAY_HEIGHT;
                
                this.tileContainer.addChild(tileSprite);
            }
        }
        
        // Update score display
        this.updateScoreDisplay();
    }

    updateSingleTile(tileX, tileY, newType) {
        if (!this.tileMap || !this.grayTileTexture || !this.greenTileTexture) return;
        
        // Find and update the specific tile sprite
        const tileIndex = tileY * this.tileMap.width + tileX;
        const tileSprite = this.tileContainer.getChildAt(tileIndex);
        
        if (tileSprite) {
            const texture = newType === 'gray' ? this.grayTileTexture : this.greenTileTexture;
            tileSprite.texture = texture;
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
        
        // Only display scores within the border rectangle area
        // First, calculate border rectangle bounds (same logic as server)
        const lightNexus = { TILE_X: 5, TILE_Y: 45 };  // Bottom-left nexus
        const darkNexus = { TILE_X: 54, TILE_Y: 15 };   // Top-right nexus
        
        // Calculate border width based on 100 pixels divided by tile dimensions
        const borderWidthX = Math.ceil(100 / ClientConfig.MAP.TILE_DISPLAY_WIDTH);  // Horizontal border width in tiles
        const borderWidthY = Math.ceil(100 / ClientConfig.MAP.TILE_DISPLAY_HEIGHT); // Vertical border width in tiles
        
        // Create rectangle with nexuses sitting in the MIDDLE of the border width
        const halfBorderX = Math.floor(borderWidthX / 2);
        const halfBorderY = Math.floor(borderWidthY / 2);
        
        const borderRect = {
            left: lightNexus.TILE_X - halfBorderX,     // Light nexus in middle of left border
            top: darkNexus.TILE_Y - halfBorderY,      // Dark nexus in middle of top border
            right: darkNexus.TILE_X + halfBorderX,    // Dark nexus in middle of right border
            bottom: lightNexus.TILE_Y + halfBorderY   // Light nexus in middle of bottom border
        };
        
        // Display scores in the 100px WIDE border path around the rectangle
        for (let y = Math.max(0, borderRect.top); y <= Math.min(this.tileMap.height - 1, borderRect.bottom); y++) {
            for (let x = Math.max(0, borderRect.left); x <= Math.min(this.tileMap.width - 1, borderRect.right); x++) {
                // Show scores in the border path area (100px wide on each side)
                const isInTopBorder = (y <= borderRect.top + borderWidthY);
                const isInBottomBorder = (y >= borderRect.bottom - borderWidthY);
                const isInLeftBorder = (x <= borderRect.left + borderWidthX);
                const isInRightBorder = (x >= borderRect.right - borderWidthX);
                
                const isInBorderPath = (isInTopBorder || isInBottomBorder || isInLeftBorder || isInRightBorder);
                
                if (!isInBorderPath) continue; // Skip tiles outside the border path
                
                const tileData = this.tileMap.tiles[y][x];
                
                // Light team scores (green)
                const lightScore = this.borderScores.green[y][x];
                const lightText = new Text(lightScore.toString(), lightTeamStyle);
                lightText.x = tileData.worldX + 2;
                lightText.y = tileData.worldY + 2;
                this.scoreContainer.addChild(lightText);
                
                // Dark team scores (gray)
                const darkScore = this.borderScores.gray[y][x];
                const darkText = new Text(darkScore.toString(), darkTeamStyle);
                darkText.x = tileData.worldX + 2;
                darkText.y = tileData.worldY + 8; // Offset below light team score
                this.scoreContainer.addChild(darkText);
            }
        }
    }

    toggleScoreDisplay() {
        this.showScores = !this.showScores;
        if (this.showScores) {
            this.updateScoreDisplay();
        } else {
            this.scoreContainer.removeChildren();
        }
    }
}
