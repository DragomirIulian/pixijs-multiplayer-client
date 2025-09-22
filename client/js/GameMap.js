import { Container, Sprite, Assets } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
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
        this.tileMap = null;
        this.grayTileTexture = null;
        this.greenTileTexture = null;
    }

    async createMap() {
        await this.loadTileTextures();
        this.container.addChild(this.tileContainer);
    }

    async loadTileTextures() {
        // Load tile textures using configuration values
        this.grayTileTexture = await Assets.load(`./resources/background_gray_${ClientConfig.MAP.TILE_TEXTURE_WIDTH}x${ClientConfig.MAP.TILE_TEXTURE_HEIGHT}.png`);
        this.greenTileTexture = await Assets.load(`./resources/background_green_${ClientConfig.MAP.TILE_TEXTURE_WIDTH}x${ClientConfig.MAP.TILE_TEXTURE_HEIGHT}.png`);
    }

    updateTileMap(tileMapData) {
        if (!tileMapData || !this.grayTileTexture || !this.greenTileTexture) return;
        
        // Clear existing tiles
        this.tileContainer.removeChildren();
        
        // Store tile map data
        this.tileMap = tileMapData;
        
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
    }
}
