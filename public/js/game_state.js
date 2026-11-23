// game_state.js - Reactive Client State Store for Wargaopoly Alam Nusantara 3D

class GameStateStore {
  constructor() {
    this.room = null;
    this.myPlayerId = null;
    this.selectedAvatar = 'ojol';
    this.customQuestions = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  }

  setMyPlayerId(id) {
    this.myPlayerId = id;
    this.notify();
  }

  updateRoomState(roomState) {
    this.room = roomState;
    this.notify();
  }

  getMyPlayer() {
    if (!this.room || !this.room.players) return null;
    return this.room.players.find(p => p.id === this.myPlayerId) || null;
  }

  isHost() {
    const me = this.getMyPlayer();
    return !!(me && me.isHost);
  }

  getActivePlayer() {
    if (!this.room || !this.room.players || this.room.currentTurnIndex === undefined) return null;
    return this.room.players[this.room.currentTurnIndex] || null;
  }

  isMyTurn() {
    const active = this.getActivePlayer();
    return !!(active && active.id === this.myPlayerId);
  }

  canRoll() {
    return this.isMyTurn() && this.room?.status === 'playing' && this.room?.turnState === 'WAIT_ROLL';
  }

  canBuy() {
    if (!this.isMyTurn() || this.room?.status !== 'playing' || this.room?.turnState !== 'WAIT_ACTION') return false;
    const me = this.getMyPlayer();
    if (!me) return false;
    const tile = BOARD_TILES[me.position];
    if (!tile || (tile.type !== 'property' && tile.type !== 'utility')) return false;

    const prop = this.room.properties[tile.id];
    if (prop) return false;

    let price = tile.price;
    if (this.room.currentQuiz && this.room.currentQuiz.discountedPrice) {
      price = this.room.currentQuiz.discountedPrice;
    }
    return me.cash >= price;
  }

  canTakeover() {
    if (!this.isMyTurn() || this.room?.status !== 'playing' || this.room?.turnState !== 'WAIT_ACTION') return false;
    const me = this.getMyPlayer();
    if (!me || !this.room.takeoverOffer) return false;
    return me.cash >= this.room.takeoverOffer.cost;
  }

  canUpgrade() {
    if (!this.isMyTurn() || this.room?.status !== 'playing' || this.room?.turnState !== 'WAIT_ACTION') return false;
    const me = this.getMyPlayer();
    if (!me || !me.canUpgradeThisTurn) return false;

    // Check if player owns any city that is < level 3 and can afford upgrade
    for (const [tileIdStr, p] of Object.entries(this.room.properties)) {
      if (p.ownerId === me.id && p.level < 3 && !p.isMortgaged) {
        const tile = BOARD_TILES[Number(tileIdStr)];
        if (tile && tile.upgradeCost && me.cash >= tile.upgradeCost && !(me.upgradedCitiesThisTurn || []).includes(tile.id)) {
          return true;
        }
      }
    }
    return false;
  }

  canEndTurn() {
    return this.isMyTurn() && this.room?.status === 'playing' && this.room?.turnState === 'WAIT_ACTION';
  }
}

window.gameState = new GameStateStore();
