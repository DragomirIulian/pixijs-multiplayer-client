import { Graphics, Container } from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import * as PIXI from 'https://unpkg.com/pixi.js@8.13.0/dist/pixi.min.mjs';
import { ClientConfig } from '../config/clientConfig.js';

/**
 * Effects System
 * Manages visual effects like attacks, energy absorption, spell tethers, etc.
 */
export class EffectsSystem {
  constructor(app) {
    this.app = app;
    this.activeEffects = new Map();
  }

  createAttackEffect(startPos, endPos) {
    // Create 8-bit style energy projectile that travels from attacker to target
    const projectile = new Graphics();
    
    // Create pixelated projectile using small rectangles
    const projectileColors = ClientConfig.COLORS.ATTACK_PROJECTILE;
    
    // Draw pixelated projectile
    for (let x = -ClientConfig.EFFECTS.PROJECTILE_RANGE; x <= ClientConfig.EFFECTS.PROJECTILE_RANGE; x++) {
      for (let y = -ClientConfig.EFFECTS.PROJECTILE_RANGE; y <= ClientConfig.EFFECTS.PROJECTILE_RANGE; y++) {
        const distance = Math.abs(x) + Math.abs(y); // Diamond shape
        if (distance <= ClientConfig.EFFECTS.PROJECTILE_RANGE) {
          const colorIndex = Math.min(distance, projectileColors.length - 1);
          projectile.beginFill(projectileColors[colorIndex], 1.0);
          projectile.drawRect(x * ClientConfig.EFFECTS.PROJECTILE_SIZE, y * ClientConfig.EFFECTS.PROJECTILE_SIZE, ClientConfig.EFFECTS.PROJECTILE_SIZE, ClientConfig.EFFECTS.PROJECTILE_SIZE);
          projectile.endFill();
        }
      }
    }
    
    // Add bright center
    projectile.beginFill(ClientConfig.COLORS.ATTACK_CENTER, ClientConfig.EFFECTS.PROJECTILE_ALPHA);
    projectile.drawRect(-ClientConfig.EFFECTS.PROJECTILE_CENTER_OFFSET, -ClientConfig.EFFECTS.PROJECTILE_CENTER_OFFSET, ClientConfig.EFFECTS.PROJECTILE_CENTER_SIZE, ClientConfig.EFFECTS.PROJECTILE_CENTER_SIZE);
    projectile.endFill();
    
    projectile.x = startPos.x;
    projectile.y = startPos.y;
    
    this.app.stage.addChild(projectile);
    
    // Animate projectile to target
    const duration = ClientConfig.ANIMATION.ATTACK_DURATION;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1) {
        // Linear interpolation
        projectile.x = startPos.x + (endPos.x - startPos.x) * progress;
        projectile.y = startPos.y + (endPos.y - startPos.y) * progress;
        
        // Flicker effect
        projectile.alpha = ClientConfig.EFFECTS.SPELL_ALPHA_BASE + Math.random() * ClientConfig.EFFECTS.SPELL_ALPHA_VARIATION;
        
        requestAnimationFrame(animate);
      } else {
        // Remove projectile when animation is done
        this.app.stage.removeChild(projectile);
      }
    };
    
    animate();
  }

  createEnergizerEffect(character) {
    if (!character || !character.sprite || character.isDying) return;
    
    // Create a temporary blue glow effect around the soul with 8-bit style
    const glow = new Graphics();
    
    // Create pixelated glow rings using rectangles
    const glowColors = ClientConfig.COLORS.ENERGY_GLOW;
    
    // Draw pixelated glow rings
    for (let ring = 0; ring < ClientConfig.EFFECTS.ENERGY_GLOW_RINGS; ring++) {
      const radius = (ring + ClientConfig.EFFECTS.ENERGY_GLOW_RING_BASE) * ClientConfig.EFFECTS.ENERGY_GLOW_RING_SIZE;
      const color = glowColors[ring];
      const alpha = 0.6 - (ring * ClientConfig.EFFECTS.ENERGY_GLOW_FADE);
      
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        
        glow.beginFill(color, alpha);
        glow.drawRect(px - ClientConfig.EFFECTS.ENERGY_GLOW_BLOCK_SIZE/2, py - ClientConfig.EFFECTS.ENERGY_GLOW_BLOCK_SIZE/2, ClientConfig.EFFECTS.ENERGY_GLOW_BLOCK_SIZE, ClientConfig.EFFECTS.ENERGY_GLOW_BLOCK_SIZE);
        glow.endFill();
      }
    }
    
    glow.x = character.sprite.x;
    glow.y = character.sprite.y;
    glow.scale.set(ClientConfig.EFFECTS.ENERGY_GLOW_SCALE);
    
    this.app.stage.addChild(glow);
    
    // Animate the glow effect
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / ClientConfig.ANIMATION.ENERGIZER_DURATION;
      
      if (progress < 1) {
        // Update position to follow soul
        glow.x = character.sprite.x;
        glow.y = character.sprite.y;
        
        // Pulsing scale
        const pulseScale = ClientConfig.EFFECTS.ENERGY_GLOW_SCALE + Math.sin(elapsed * ClientConfig.EFFECTS.SPELL_PULSE_SPEED) * ClientConfig.EFFECTS.ENERGY_GLOW_PULSE;
        glow.scale.set(pulseScale);
        
        // Fade out
        glow.alpha = 1 - progress;
        requestAnimationFrame(animate);
      } else {
        this.app.stage.removeChild(glow);
      }
    };
    
    animate();
  }

  createAbsorptionEffect(x, y) {
    // Create a blue particle effect for orb absorption
    const effect = new Graphics();
    
    // Create 8-bit style blue absorption effect
    const blueColors = ClientConfig.COLORS.ABSORPTION_COLORS;
    
    // Draw pixelated absorption rings
    for (let ring = 0; ring < ClientConfig.EFFECTS.ABSORPTION_RINGS; ring++) {
      const radius = (ring + 1) * ClientConfig.EFFECTS.ABSORPTION_RING_SIZE;
      const color = blueColors[ring];
      
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        
        effect.beginFill(color, 1.0);
        effect.drawRect(px * 2, py * 2, ClientConfig.EFFECTS.ABSORPTION_BLOCK_SIZE, ClientConfig.EFFECTS.ABSORPTION_BLOCK_SIZE);
        effect.endFill();
      }
    }
    
    // Add bright blue center
    effect.beginFill(0x00CCFF, 1.0);
    effect.drawRect(-ClientConfig.EFFECTS.ABSORPTION_CENTER_OFFSET, -ClientConfig.EFFECTS.ABSORPTION_CENTER_OFFSET, ClientConfig.EFFECTS.ABSORPTION_CENTER_SIZE, ClientConfig.EFFECTS.ABSORPTION_CENTER_SIZE);
    effect.endFill();
    
    effect.x = x;
    effect.y = y;
    effect.scale.set(1);
    
    this.app.stage.addChild(effect);
    
    // Animate the effect
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / ClientConfig.ANIMATION.ABSORPTION_DURATION;
      
      if (progress < 1) {
        effect.scale.set(1 + progress * ClientConfig.EFFECTS.ABSORPTION_SCALE_MULTIPLIER);
        effect.alpha = 1 - progress;
        requestAnimationFrame(animate);
      } else {
        this.app.stage.removeChild(effect);
      }
    };
    
    animate();
  }

  createDeathAnimation(character) {
    if (!character || !character.sprite) return;
    
    // Simple death animation: turn gray and fade out
    character.isDying = true;
    
    // Make soul gray and stop moving
    character.sprite.tint = 0x808080; // Gray color
    
    // Stop all movement immediately
    character.vx = 0;
    character.vy = 0;
    character.targetX = character.x;
    character.targetY = character.y;
    
    // Animate the death effect
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / ClientConfig.ANIMATION.DEATH_DURATION;
      
      if (progress < 1 && character.sprite) {
        // Keep gray tint and gradually reduce transparency
        character.sprite.tint = 0x808080; // Force gray tint
        character.sprite.alpha = 1 - progress;
        
        requestAnimationFrame(animate);
      } else {
        // Cleanup - make completely invisible
        if (character.sprite) {
          character.sprite.alpha = 0;
          character.sprite.tint = 0x808080;
        }
      }
    };
    
    animate();
  }

  createMatingHearts(x, y) {
    // Create floating heart particles above mating souls
    const heartContainer = new PIXI.Container();
    heartContainer.x = x;
    heartContainer.y = y - 50; // Above the souls
    this.app.stage.addChild(heartContainer);

    // Create several heart particles
    for (let i = 0; i < 5; i++) {
      const heart = new PIXI.Graphics();
      heart.beginFill(0xFF1493); // Deep pink
      
      // Draw a simple star/diamond shape instead of complex heart
      heart.moveTo(0, -8);
      heart.lineTo(4, -2);
      heart.lineTo(8, 0);
      heart.lineTo(4, 2);
      heart.lineTo(0, 8);
      heart.lineTo(-4, 2);
      heart.lineTo(-8, 0);
      heart.lineTo(-4, -2);
      heart.closePath();
      heart.endFill();

      heart.x = (Math.random() - 0.5) * 60;
      heart.y = Math.random() * 30;
      heart.scale.set(1.0 + Math.random() * 0.5); // Bigger hearts
      heart.alpha = 1.0;
      
      heartContainer.addChild(heart);
      
      // Animate hearts floating upward
      const startTime = Date.now();
      const animateHeart = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / 3000; // 3 second animation
        
        if (progress < 1) {
          heart.y -= 1.0; // Float upward faster
          heart.alpha = 1.0 * (1 - progress); // Fade out
          heart.scale.set((1.0 + Math.random() * 0.5) * (1 - progress * 0.3)); // Shrink less
          
          requestAnimationFrame(animateHeart);
        } else {
          heartContainer.removeChild(heart);
        }
      };
      
      // Stagger the start times
      setTimeout(animateHeart, i * 200);
    }
    
    // Remove the container after animation
    setTimeout(() => {
      if (heartContainer.parent) {
        this.app.stage.removeChild(heartContainer);
      }
    }, 4000);
    
    return heartContainer;
  }

  createChildSpawnEffect(x, y) {
    // Create sparkle effect when child is born
    const sparkleContainer = new PIXI.Container();
    sparkleContainer.x = x;
    sparkleContainer.y = y;
    this.app.stage.addChild(sparkleContainer);

    // Create sparkle particles
    for (let i = 0; i < 12; i++) {
      const sparkle = new PIXI.Graphics();
      sparkle.beginFill(0xFFFFFF); // White sparkles
      // Draw a simple star shape using lines instead of drawStar
      sparkle.moveTo(0, -3);
      sparkle.lineTo(1, 0);
      sparkle.lineTo(3, 0);
      sparkle.lineTo(1, 1);
      sparkle.lineTo(0, 3);
      sparkle.lineTo(-1, 1);
      sparkle.lineTo(-3, 0);
      sparkle.lineTo(-1, 0);
      sparkle.closePath();
      sparkle.endFill();
      
      const angle = (i / 12) * Math.PI * 2;
      const distance = 30;
      sparkle.x = Math.cos(angle) * distance;
      sparkle.y = Math.sin(angle) * distance;
      sparkle.scale.set(0.5);
      
      sparkleContainer.addChild(sparkle);
      
      // Animate sparkles expanding outward
      const startTime = Date.now();
      const animateSparkle = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / 1500; // 1.5 second animation
        
        if (progress < 1) {
          sparkle.alpha = 1 - progress;
          sparkle.scale.set(0.5 + progress * 0.5);
          
          requestAnimationFrame(animateSparkle);
        } else {
          sparkleContainer.removeChild(sparkle);
        }
      };
      
      animateSparkle();
    }
    
    // Remove container after animation
    setTimeout(() => {
      if (sparkleContainer.parent) {
        this.app.stage.removeChild(sparkleContainer);
      }
    }, 2000);
    
    return sparkleContainer;
  }

  updateSpellTether(tether, time) {
    const spellData = tether.spellData;
    const elapsed = Date.now() - tether.startTime;
    const progress = elapsed / spellData.duration;
    
    // Clear and redraw tether
    tether.clear();
    
    // Stop rendering if animation has reached expected duration OR if force completed
    if (progress >= 1.0 || tether.forceCompleted) {
      return;
    }
    
    // Animated tether color based on caster type
    const color = spellData.casterType === 'dark-soul' ? 
      ClientConfig.COLORS.DARK_SOUL_CASTING : 
      ClientConfig.COLORS.LIGHT_SOUL_CASTING;
    const alpha = ClientConfig.EFFECTS.SPELL_ALPHA_BASE + Math.sin(elapsed * ClientConfig.EFFECTS.SPELL_PULSE_SPEED) * ClientConfig.EFFECTS.SPELL_ALPHA_VARIATION;
    
    // Draw only traveling particles (no thick beam)
    const particleCount = ClientConfig.EFFECTS.SPELL_PARTICLE_COUNT;
    for (let i = 0; i < particleCount; i++) {
      const t = (i / particleCount + elapsed * ClientConfig.EFFECTS.SPELL_PARTICLE_SPEED) % 1;
      const particleX = spellData.casterX + (spellData.targetX - spellData.casterX) * t;
      const particleY = spellData.casterY + (spellData.targetY - spellData.casterY) * t;
      
      // Create brighter, more visible particles
      tether.beginFill(color, Math.min(1.0, alpha + 0.3));
      tether.drawCircle(particleX, particleY, ClientConfig.EFFECTS.SPELL_PARTICLE_SIZE + 1);
      tether.endFill();
      
      // Add a small inner glow
      tether.beginFill(0xFFFFFF, 0.6);
      tether.drawCircle(particleX, particleY, Math.max(1, ClientConfig.EFFECTS.SPELL_PARTICLE_SIZE - 1));
      tether.endFill();
    }
    
    // Progress indicator at target
    const progressRadius = ClientConfig.EFFECTS.SPELL_PROGRESS_RADIUS * (1 + progress);
    tether.lineStyle(ClientConfig.EFFECTS.SPELL_TETHER_THICKNESS, color, ClientConfig.EFFECTS.SPELL_BORDER_ALPHA);
    tether.drawCircle(spellData.targetX, spellData.targetY, progressRadius);
  }

  updateTileTransformEffect(effect, time) {
    const elapsed = Date.now() - effect.startTime;
    const progress = elapsed / effect.duration;
    
    // Clear and redraw transformation effect
    effect.clear();
    
    // Stop rendering if animation has reached expected duration OR if force completed
    if (progress >= 1 || effect.forceCompleted) return;
    
    // Create subtle transformation effect on the tile
    const targetColor = effect.casterType === 'dark-soul' ? 
      ClientConfig.TILE_TRANSFORM.GRAY_TARGET_COLOR : 
      ClientConfig.TILE_TRANSFORM.GREEN_TARGET_COLOR;
    const baseAlpha = Math.max(0.1, ClientConfig.TILE_TRANSFORM.BASE_ALPHA + 
      Math.sin(elapsed * ClientConfig.TILE_TRANSFORM.PULSE_SPEED) * ClientConfig.TILE_TRANSFORM.ALPHA_VARIATION);
    
    // Draw subtle transformation glow overlay on tile
    effect.beginFill(targetColor, baseAlpha * 0.3); // Much more subtle
    effect.drawRect(effect.tileX, effect.tileY, effect.tileWidth, effect.tileHeight);
    effect.endFill();
    
    // Add gentle pulsing border instead of crackling lines
    const pulseIntensity = Math.sin(elapsed * 0.008) * 0.5 + 0.5;
    const borderAlpha = baseAlpha * pulseIntensity * 0.4; // Subtle border
    effect.lineStyle(2, targetColor, borderAlpha);
    effect.drawRect(effect.tileX, effect.tileY, effect.tileWidth, effect.tileHeight);
  }

  cleanup() {
    // Clean up any remaining effects
    this.activeEffects.clear();
  }
}
