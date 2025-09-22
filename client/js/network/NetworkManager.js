import { ClientConfig } from '../config/clientConfig.js';

/**
 * Network Manager
 * Handles WebSocket connection and message routing
 */
export class NetworkManager {
  constructor(messageHandler) {
    this.socket = null;
    this.messageHandler = messageHandler;
    this.isConnected = false;
    this.reconnectTimer = null;
  }

  connect() {
    try {
      this.socket = new WebSocket(ClientConfig.NETWORK.SERVER_URL);
      this.setupEventHandlers();
    } catch (error) {
      this.scheduleReconnect();
    }
  }

  setupEventHandlers() {
    this.socket.onopen = () => {
      this.isConnected = true;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.messageHandler(data);
      } catch (error) {
      }
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      
      // Notify handler of disconnection
      this.messageHandler({ type: 'disconnected' });
      
      // Schedule reconnection
      this.scheduleReconnect();
    };

    this.socket.onerror = (error) => {
    };
  }

  scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, ClientConfig.NETWORK.RECONNECT_DELAY);
    }
  }

  send(message) {
    if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.isConnected = false;
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}
