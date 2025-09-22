/**
 * Client-side Statistics Display Manager
 * Handles updating the statistics UI with real-time game data
 */
class StatisticsDisplay {
  constructor() {
    this.currentStats = null;
    this.updateInterval = null;
    
    // Start updating the uptime display
    this.startUptimeUpdater();
  }

  /**
   * Update statistics display with new data from server
   */
  updateStatistics(stats) {
    this.currentStats = stats;
    this.updateTeamStatistics();
    this.updatePercentageBars();
    this.updateGameStatistics();
  }

  /**
   * Update team-specific statistics
   */
  updateTeamStatistics() {
    if (!this.currentStats || !this.currentStats.teams) return;

    const { light, dark } = this.currentStats.teams;

    // Update Light team stats
    document.getElementById('light-population').textContent = light.totalSouls;
    document.getElementById('light-adults').textContent = light.adultSouls;
    document.getElementById('light-children').textContent = light.childSouls;
    document.getElementById('light-births').textContent = light.births;
    document.getElementById('light-deaths').textContent = light.deaths;
    document.getElementById('light-territory').textContent = light.tilesControlled;

    // Update Dark team stats
    document.getElementById('dark-population').textContent = dark.totalSouls;
    document.getElementById('dark-adults').textContent = dark.adultSouls;
    document.getElementById('dark-children').textContent = dark.childSouls;
    document.getElementById('dark-births').textContent = dark.births;
    document.getElementById('dark-deaths').textContent = dark.deaths;
    document.getElementById('dark-territory').textContent = dark.tilesControlled;
  }

  /**
   * Update percentage bars and percentage text (based on territory control)
   */
  updatePercentageBars() {
    if (!this.currentStats || !this.currentStats.teams) return;

    const { light, dark } = this.currentStats.teams;
    
    // Update percentage bar (territory control visualization)
    const lightPercentageBar = document.getElementById('light-percentage');
    lightPercentageBar.style.width = `${light.percentage}%`;

    // Update percentage text (territory control percentages)
    document.getElementById('light-percent-text').textContent = `${light.percentage}%`;
    document.getElementById('dark-percent-text').textContent = `${dark.percentage}%`;
  }

  /**
   * Update overall game statistics
   */
  updateGameStatistics() {
    if (!this.currentStats || !this.currentStats.game) return;

    const { game } = this.currentStats;

    document.getElementById('total-population').textContent = game.totalSouls;
    document.getElementById('total-births').textContent = game.totalBirths;
    document.getElementById('total-deaths').textContent = game.totalDeaths;
  }

  /**
   * Start the uptime updater that runs independently
   */
  startUptimeUpdater() {
    this.updateInterval = setInterval(() => {
      this.updateUptime();
    }, 1000); // Update every second
  }

  /**
   * Update the game uptime display
   */
  updateUptime() {
    if (!this.currentStats || !this.currentStats.game) return;

    const now = Date.now();
    const gameStartTime = now - this.currentStats.game.gameUptime;
    const uptimeMs = now - gameStartTime;
    
    const uptimeMinutes = Math.floor(uptimeMs / 60000);
    const uptimeSeconds = Math.floor((uptimeMs % 60000) / 1000);
    
    document.getElementById('game-uptime').textContent = `${uptimeMinutes}m ${uptimeSeconds}s`;
  }


  /**
   * Add visual effects for significant events
   */
  highlightStatistic(team, statType) {
    const elementId = `${team}-${statType}`;
    const element = document.getElementById(elementId);
    
    if (element) {
      // Add a brief highlight effect
      element.style.backgroundColor = '#FFD700';
      element.style.transition = 'background-color 0.3s ease';
      
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 300);
    }
  }

  /**
   * Show notification for important events (removed - no center screen notifications)
   */
  showNotification(message, type = 'info') {
    // Notifications disabled - just highlight relevant stats instead
    if (message.includes('born')) {
      // Highlight birth stats briefly
      this.highlightStatistic('light', 'births');
      this.highlightStatistic('dark', 'births');
    } else if (message.includes('perished')) {
      // Highlight death stats briefly
      this.highlightStatistic('light', 'deaths');
      this.highlightStatistic('dark', 'deaths');
    }
  }

  /**
   * Process game events to trigger visual feedback
   */
  processGameEvent(event) {
    switch (event.type) {
      case 'mating_completed':
        this.showNotification('New soul born!', 'birth');
        break;
      case 'character_death':
        this.showNotification('Soul has perished', 'death');
        break;
      case 'emergency_respawn':
        this.showNotification(`${event.team} team emergency respawn!`, 'emergency');
        break;
    }
  }

  /**
   * Cleanup method
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

// Global functions for HTML buttons

window.toggleStatsPanel = function() {
  const panel = document.getElementById('statistics-panel');
  const content = document.getElementById('stats-content');
  const button = document.querySelector('.stats-minimize-btn');
  
  if (content.classList.contains('minimized')) {
    // Expand
    content.classList.remove('minimized');
    button.textContent = '−';
    button.title = 'Minimize';
  } else {
    // Minimize
    content.classList.add('minimized');
    button.textContent = '+';
    button.title = 'Expand';
  }
};

export default StatisticsDisplay;
