// socket.js - WebSocket Client Connection & Reconnection Manager

class NetworkManager {
  constructor() {
    this.ws = null;
    this.roomCode = null;
    this.playerId = null;
    this.token = null;
    this.handlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isExplicitDisconnect = false;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Terhubung ke server game Wargaopoly 62.');
      this.reconnectAttempts = 0;
      this.emit('connection_open');

      // Check if we have saved session to reconnect
      const savedCode = localStorage.getItem('wargaopoly_room');
      const savedToken = localStorage.getItem('wargaopoly_token');
      if (savedCode && savedToken && !this.isExplicitDisconnect) {
        this.send('RECONNECT', { roomCode: savedCode, token: savedToken });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('Gagal mem-parsing pesan server:', e);
      }
    };

    this.ws.onclose = () => {
      console.warn('Koneksi WebSocket terputus.');
      this.emit('connection_lost');
      if (!this.isExplicitDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('Gagal mengirim pesan: WebSocket belum terbuka.', type);
    }
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(handler);
  }

  emit(event, ...args) {
    const list = this.handlers.get(event) || [];
    for (const fn of list) {
      fn(...args);
    }
  }

  handleMessage(data) {
    const { type } = data;

    if (type === 'ROOM_CREATED' || type === 'JOINED_SUCCESS' || type === 'RECONNECT_SUCCESS') {
      this.roomCode = data.roomCode;
      this.playerId = data.playerId;
      this.token = data.token;
      localStorage.setItem('wargaopoly_room', data.roomCode);
      localStorage.setItem('wargaopoly_token', data.token);
    }

    if (type === 'RECONNECT_FAILED' || type === 'KICKED') {
      localStorage.removeItem('wargaopoly_room');
      localStorage.removeItem('wargaopoly_token');
    }

    this.emit(type, data);
    this.emit('*', data);
  }

  clearSession() {
    this.isExplicitDisconnect = true;
    localStorage.removeItem('wargaopoly_room');
    localStorage.removeItem('wargaopoly_token');
    if (this.ws) {
      this.ws.close();
    }
  }
}

window.netManager = new NetworkManager();
