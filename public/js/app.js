// app.js - Main Application Controller for Wargaopoly Alam Nusantara 3D

document.addEventListener('DOMContentLoaded', () => {
  let boardUI = null;
  let quizTimerInterval = null;

  // Initialize Audio & Sound
  const soundBtn = document.getElementById('btn-sound-toggle');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      const isMuted = window.soundEngine.toggleMute();
      soundBtn.textContent = isMuted ? '🔇 Bisu' : '🔊 Suara';
    });
  }

  // Camera 3D / 2D View Toggle
  const cameraBtn = document.getElementById('btn-camera-toggle');
  if (cameraBtn) {
    cameraBtn.addEventListener('click', () => {
      if (!boardUI) return;
      const is3D = boardUI.toggleCameraView();
      cameraBtn.textContent = is3D ? '🎥 Sudut 3D' : '📐 Sudut 2D';
    });
  }

  // Populate 10 Unique 3D Avatars in Lobby
  const avatarGrid = document.getElementById('avatar-selector');
  if (avatarGrid) {
    AVATARS.forEach((av, index) => {
      const opt = document.createElement('div');
      opt.className = `avatar-option ${index === 0 ? 'selected' : ''}`;
      opt.dataset.avatarId = av.id;
      opt.innerHTML = `
        <span class="icon">${av.icon}</span>
        <span class="name">${av.name}</span>
      `;
      opt.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        opt.classList.add('selected');
        window.gameState.selectedAvatar = av.id;
      });
      avatarGrid.appendChild(opt);
    });
  }

  // Initialize 3D Board UI
  boardUI = new BoardUI('board-container');

  // Check URL query parameters for invite link: ?room=CODE
  const urlParams = new URLSearchParams(window.location.search);
  const roomQuery = urlParams.get('room');
  if (roomQuery) {
    const joinInput = document.getElementById('join-room-code-input');
    if (joinInput) joinInput.value = roomQuery.toUpperCase().trim();
  }

  // Connect to WebSocket Server
  window.netManager.connect();

  // ----------------------------------------------------
  // Network Event Listeners
  // ----------------------------------------------------
  window.netManager.on('ROOM_CREATED', (data) => {
    window.gameState.setMyPlayerId(data.playerId);
    window.gameState.updateRoomState(data.state);
    updateLobbyUI(data.state);
    if (window.soundEngine) window.soundEngine.playCashGain();
  });

  window.netManager.on('JOINED_SUCCESS', (data) => {
    window.gameState.setMyPlayerId(data.playerId);
    window.gameState.updateRoomState(data.state);
    updateLobbyUI(data.state);
    if (window.soundEngine) window.soundEngine.playCashGain();
  });

  window.netManager.on('RECONNECT_SUCCESS', (data) => {
    window.gameState.setMyPlayerId(data.playerId);
    window.gameState.updateRoomState(data.state);
    if (data.state.status === 'playing') {
      showScreen('screen-game');
      renderGameBoard(data.state);
    } else {
      updateLobbyUI(data.state);
    }
  });

  window.netManager.on('ROOM_SYNC', (data) => {
    const prevState = window.gameState.room;
    window.gameState.updateRoomState(data.state);

    if (data.state.status === 'playing') {
      showScreen('screen-game');
      renderGameBoard(data.state, prevState);
    } else {
      updateLobbyUI(data.state);
    }
  });

  window.netManager.on('GAME_OVER', (data) => {
    window.gameState.updateRoomState(data.state);
    showGameOverModal(data);
    if (window.soundEngine) window.soundEngine.playGameOver();
  });

  window.netManager.on('ERROR', (data) => {
    alert(data.message || 'Terjadi kesalahan sistem.');
  });

  window.netManager.on('KICKED', (data) => {
    alert(data.message || 'Anda telah dikeluarkan dari room.');
    window.location.reload();
  });

  // ----------------------------------------------------
  // Lobby Actions & UI
  // ----------------------------------------------------
  const btnCreateRoom = document.getElementById('btn-create-room');
  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      const nameInput = document.getElementById('player-name-input');
      const name = (nameInput?.value || '').trim() || 'Pak RT (Host)';
      const avatar = window.gameState.selectedAvatar || 'ojol';

      window.netManager.send('CREATE_ROOM', {
        name,
        avatar,
        settings: {
          startingCash: 3500000,
          passGoSalary: 1000000,
          maxRounds: 25,
          turnTimer: 35
        }
      });
    });
  }

  const btnJoinRoom = document.getElementById('btn-join-room');
  if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', () => {
      const nameInput = document.getElementById('player-name-input');
      const name = (nameInput?.value || '').trim() || 'Petualang Alam';
      const codeInput = document.getElementById('join-room-code-input');
      const code = (codeInput?.value || '').trim().toUpperCase();

      if (!code) {
        alert('Silakan masukkan Kode Room yang valid!');
        return;
      }

      window.netManager.send('JOIN_ROOM', {
        roomCode: code,
        name,
        avatar: window.gameState.selectedAvatar || 'becak'
      });
    });
  }

  const btnAddBot = document.getElementById('btn-add-bot');
  if (btnAddBot) {
    btnAddBot.addEventListener('click', () => {
      window.netManager.send('ADD_BOT');
    });
  }

  const btnStartGame = document.getElementById('btn-start-game');
  if (btnStartGame) {
    btnStartGame.addEventListener('click', () => {
      window.netManager.send('START_GAME');
    });
  }

  const roomBadge = document.getElementById('room-code-badge');
  if (roomBadge) {
    roomBadge.addEventListener('click', () => {
      const code = window.gameState.room?.code;
      if (!code) return;
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert(`Tautan undangan disalin ke clipboard:\n${shareUrl}`);
      }).catch(() => {
        prompt('Salin tautan room:', shareUrl);
      });
    });
  }

  const settingStartingCash = document.getElementById('setting-starting-cash');
  const settingSalary = document.getElementById('setting-salary');
  const settingMaxRounds = document.getElementById('setting-max-rounds');
  const settingTurnTimer = document.getElementById('setting-turn-timer');

  function pushHostSettings() {
    if (!window.gameState.isHost()) return;
    window.netManager.send('UPDATE_SETTINGS', {
      settings: {
        startingCash: Number(settingStartingCash.value),
        passGoSalary: Number(settingSalary.value),
        maxRounds: Number(settingMaxRounds.value),
        turnTimer: Number(settingTurnTimer.value)
      }
    });
  }

  [settingStartingCash, settingSalary, settingMaxRounds, settingTurnTimer].forEach(el => {
    if (el) el.addEventListener('change', pushHostSettings);
  });

  function updateLobbyUI(room) {
    if (!room) return;

    const badge = document.getElementById('room-code-badge');
    const displayCode = document.getElementById('display-room-code');
    if (badge && displayCode) {
      badge.style.display = 'flex';
      displayCode.textContent = room.code;
    }

    const lobbyDetails = document.getElementById('lobby-room-details');
    if (lobbyDetails) {
      lobbyDetails.style.opacity = '1';
      lobbyDetails.style.pointerEvents = 'auto';
    }

    const actionSection = document.getElementById('room-action-section');
    if (actionSection) {
      actionSection.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid #10b981; border-radius: 12px; padding: 12px; text-align: center; color: #065f46; font-weight: 800;">
          ✅ Anda sudah bergabung di Kamar <strong>${room.code}</strong>
        </div>
      `;
    }

    const countEl = document.getElementById('player-count-indicator');
    if (countEl) countEl.textContent = `(${room.players.length}/10 Pemain)`;

    const playerList = document.getElementById('lobby-player-list');
    if (playerList) {
      playerList.innerHTML = '';
      room.players.forEach(p => {
        const avatar = AVATARS.find(a => a.id === p.avatar) || AVATARS[0];
        const slot = document.createElement('div');
        slot.className = 'player-slot';

        let badgeHtml = '';
        if (p.isHost) badgeHtml += '<span class="slot-badge host">👑 HOST</span> ';
        if (p.isBot) badgeHtml += '<span class="slot-badge bot">🤖 BOT</span> ';
        if (p.id === window.gameState.myPlayerId) badgeHtml += '<span style="color: #0284c7; font-weight: 800;">(Anda)</span>';

        let kickBtn = '';
        if (window.gameState.isHost() && !p.isHost) {
          kickBtn = `<button class="icon-btn" style="padding: 4px 8px; color: #ef4444;" onclick="removePlayer('${p.id}')">Keluarkan</button>`;
        }

        slot.innerHTML = `
          <div class="player-slot-left">
            <div class="slot-avatar" style="background-color: ${avatar.color};">
              ${avatar.icon}
            </div>
            <div class="slot-info">
              <span class="slot-name">${p.name} ${badgeHtml}</span>
              <span class="slot-badge">Saldo Awal: Rp ${p.cash.toLocaleString('id-ID')}</span>
            </div>
          </div>
          ${kickBtn}
        `;
        playerList.appendChild(slot);
      });
    }

    const isHost = window.gameState.isHost();
    const hostPanel = document.getElementById('host-settings-panel');
    const btnAddBot = document.getElementById('btn-add-bot');
    const btnStart = document.getElementById('btn-start-game');
    const btnHostQuiz = document.getElementById('btn-host-quiz-modal');

    if (hostPanel) hostPanel.style.display = isHost ? 'block' : 'none';
    if (btnAddBot) btnAddBot.style.display = (isHost && room.players.length < 10) ? 'inline-flex' : 'none';
    if (btnStart) btnStart.style.display = isHost ? 'inline-flex' : 'none';
    if (btnHostQuiz) btnHostQuiz.style.display = isHost ? 'inline-flex' : 'none';
  }

  window.removePlayer = function(playerId) {
    window.netManager.send('REMOVE_PLAYER', { playerId });
  };

  // ----------------------------------------------------
  // Game Board Render & Turn Flow
  // ----------------------------------------------------
  function renderGameBoard(room, prevState) {
    if (!room) return;

    // Show "Lihat Aset" button
    const btnAssets = document.getElementById('btn-view-assets');
    if (btnAssets) btnAssets.style.display = 'inline-flex';

    const roundEl = document.getElementById('round-indicator');
    if (roundEl) roundEl.textContent = `Ronde ${room.currentRound} / ${room.settings.maxRounds || '∞'}`;

    // Update 10 Player summary cards
    const cardsContainer = document.getElementById('game-player-cards');
    if (cardsContainer) {
      cardsContainer.innerHTML = '';
      room.players.forEach((p, idx) => {
        const avatar = AVATARS.find(a => a.id === p.avatar) || AVATARS[0];
        const isActive = idx === room.currentTurnIndex;
        const card = document.createElement('div');
        card.className = `p-card ${isActive ? 'active-turn' : ''} ${p.isBankrupt ? 'bankrupt' : ''}`;

        let statusText = `Kas: Rp ${p.cash.toLocaleString('id-ID')}`;
        if (p.isBankrupt) statusText = '💥 BANGKRUT';
        else if (p.inJail) statusText += ' (Karantina)';
        else if (p.isDisconnected) statusText += ' (Terputus)';

        card.innerHTML = `
          <div class="p-card-avatar" style="background-color: ${avatar.color};">
            ${avatar.icon}
          </div>
          <div class="p-card-details">
            <div class="p-card-name">${p.name} ${p.id === window.gameState.myPlayerId ? '⭐ (Anda)' : ''}</div>
            <div class="p-card-cash">${statusText}</div>
            <div class="p-card-networth">Total Nilai: Rp ${p.netWorth.toLocaleString('id-ID')}</div>
          </div>
          ${isActive ? '<span style="font-size: 1.2rem;">👉</span>' : ''}
        `;

        card.addEventListener('click', () => {
          boardUI.highlightPlayerCities(p.id);
        });

        cardsContainer.appendChild(card);
      });
    }

    const activePlayer = window.gameState.getActivePlayer();
    boardUI.updatePawns(room.players, activePlayer?.id);
    boardUI.updateProperties(room.properties, room.players, activePlayer?.id);

    // If new dice roll happened, animate 3D dice
    if (prevState && prevState.lastRoll && (prevState.lastRoll[0] !== room.lastRoll[0] || prevState.lastRoll[1] !== room.lastRoll[1])) {
      boardUI.animateDiceRoll(room.lastRoll[0], room.lastRoll[1]);
    } else {
      const sumEl = document.getElementById('dice-sum-display');
      if (sumEl && room.lastRoll) {
        sumEl.textContent = `Hasil Dadu 3D: ${room.lastRoll[0]} + ${room.lastRoll[1]} = ${room.lastRoll[0] + room.lastRoll[1]}`;
      }
    }

    // Update Activity Log
    const logList = document.getElementById('activity-log-list');
    if (logList && room.activityLog) {
      logList.innerHTML = room.activityLog.map(txt => `<div class="activity-item">${txt}</div>`).join('');
    }

    // Check for incoming money request
    handleIncomingMoneyRequest(room);

    // Update Bottom Context HUD Controls
    updateHudControls(room);

    // Check if Quiz Modal needs to be shown
    handleQuizModal(room);
  }

  function updateHudControls(room) {
    const isMyTurn = window.gameState.isMyTurn();
    const activePlayer = window.gameState.getActivePlayer();

    const pill = document.getElementById('turn-status-pill');
    const turnIcon = document.getElementById('turn-icon');
    const turnText = document.getElementById('turn-text');

    if (pill && turnText) {
      if (isMyTurn) {
        pill.className = 'turn-pill my-turn';
        turnIcon.textContent = '🎯';
        turnText.textContent = 'Giliran Anda Beraksi!';
        if (window.soundEngine && (!window.lastAlertTurnId || window.lastAlertTurnId !== room.currentTurnIndex)) {
          window.lastAlertTurnId = room.currentTurnIndex;
          window.soundEngine.playTurnAlert();
        }
      } else {
        pill.className = 'turn-pill wait-turn';
        turnIcon.textContent = '⏳';
        turnText.textContent = `Menunggu giliran ${activePlayer ? activePlayer.name : 'warga'}...`;
      }
    }

    // Buttons before roll
    const btnPreTransfer = document.getElementById('btn-pre-transfer');
    const btnPreMortgage = document.getElementById('btn-pre-mortgage');
    const btnPreTrade = document.getElementById('btn-pre-trade');

    const canPreAct = isMyTurn && room.turnState === 'WAIT_ROLL';
    if (btnPreTransfer) btnPreTransfer.style.display = canPreAct ? 'inline-flex' : 'none';
    if (btnPreMortgage) btnPreMortgage.style.display = canPreAct ? 'inline-flex' : 'none';
    if (btnPreTrade) btnPreTrade.style.display = canPreAct ? 'inline-flex' : 'none';

    // Main Roll Dice Button
    const btnRoll = document.getElementById('btn-roll-dice');
    if (btnRoll) {
      btnRoll.disabled = !window.gameState.canRoll();
      btnRoll.style.display = room.turnState === 'WAIT_ROLL' ? 'inline-flex' : 'none';
    }

    const me = window.gameState.getMyPlayer();
    const currentTile = me ? BOARD_TILES[me.position] : null;

    // Buy Property Button
    const btnBuy = document.getElementById('btn-buy-property');
    if (btnBuy) {
      const canBuy = window.gameState.canBuy();
      btnBuy.style.display = canBuy ? 'inline-flex' : 'none';
      if (canBuy && currentTile) {
        btnBuy.textContent = `🏛️ Beli ${currentTile.name} (Rp ${currentTile.price.toLocaleString('id-ID')})`;
      }
    }

    // Hostile Takeover Button (Ambil Alih 2x Nilai)
    const btnTakeover = document.getElementById('btn-takeover-property');
    if (btnTakeover) {
      const canTakeover = window.gameState.canTakeover();
      btnTakeover.style.display = canTakeover ? 'inline-flex' : 'none';
      if (canTakeover && room.takeoverOffer) {
        btnTakeover.textContent = `⚔️ Ambil Alih ${room.takeoverOffer.tileName} (Rp ${room.takeoverOffer.cost.toLocaleString('id-ID')})`;
      }
    }

    // Upgrade Property Button (Bangun saat gajian)
    const btnUpgrade = document.getElementById('btn-upgrade-property');
    if (btnUpgrade) {
      const canUpgrade = window.gameState.canUpgrade();
      btnUpgrade.style.display = canUpgrade ? 'inline-flex' : 'none';
    }

    // End Turn Button
    const btnEnd = document.getElementById('btn-end-turn');
    if (btnEnd) {
      const canEnd = window.gameState.canEndTurn();
      btnEnd.style.display = canEnd ? 'inline-flex' : 'none';
    }
  }

  // ----------------------------------------------------
  // Action Button Listeners
  // ----------------------------------------------------
  const btnRoll = document.getElementById('btn-roll-dice');
  if (btnRoll) {
    btnRoll.addEventListener('click', () => {
      window.netManager.send('ROLL_DICE');
    });
  }

  const btnBuy = document.getElementById('btn-buy-property');
  if (btnBuy) {
    btnBuy.addEventListener('click', () => {
      window.netManager.send('BUY_PROPERTY');
    });
  }

  const btnTakeover = document.getElementById('btn-takeover-property');
  if (btnTakeover) {
    btnTakeover.addEventListener('click', () => {
      const offer = window.gameState.room?.takeoverOffer;
      if (!offer) return;
      if (confirm(`Apakah Anda yakin ingin mengambil alih ${offer.tileName} dari ${offer.targetOwnerName} seharga 2× nilainya (Rp ${offer.cost.toLocaleString('id-ID')})?`)) {
        window.netManager.send('TAKEOVER_PROPERTY', { tileId: offer.tileId });
      }
    });
  }

  const btnUpgrade = document.getElementById('btn-upgrade-property');
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', () => {
      const room = window.gameState.room;
      const me = window.gameState.getMyPlayer();
      if (!room || !me) return;

      // Find upgradable properties
      const upgradable = [];
      for (const [tileIdStr, prop] of Object.entries(room.properties)) {
        if (prop.ownerId === me.id && prop.level < 3 && !prop.isMortgaged) {
          const tile = BOARD_TILES[Number(tileIdStr)];
          if (tile && tile.upgradeCost && me.cash >= tile.upgradeCost && !(me.upgradedCitiesThisTurn || []).includes(tile.id)) {
            upgradable.push({ tile, prop });
          }
        }
      }

      if (upgradable.length === 0) {
        alert('Tidak ada kota yang dapat dinaikkan tingkatnya saat ini (butuh kas cukup & belum dinaikkan di putaran ini).');
        return;
      }

      const optionsText = upgradable.map((u, i) => `${i + 1}. ${u.tile.name} (Naik ke ${BUILDING_NAMES[u.prop.level + 1]} - Rp ${u.tile.upgradeCost.toLocaleString('id-ID')})`).join('\n');
      const choice = prompt(`Pilih nomor kota yang ingin dinaikkan (1 tingkat per kota saat gajian):\n${optionsText}`);
      const choiceIdx = parseInt(choice) - 1;
      if (upgradable[choiceIdx]) {
        window.netManager.send('UPGRADE_PROPERTY', { tileId: upgradable[choiceIdx].tile.id });
      }
    });
  }

  const btnEnd = document.getElementById('btn-end-turn');
  if (btnEnd) {
    btnEnd.addEventListener('click', () => {
      window.netManager.send('END_TURN');
    });
  }

  // ----------------------------------------------------
  // Modal: Lihat Aset
  // ----------------------------------------------------
  const btnViewAssets = document.getElementById('btn-view-assets');
  const modalAssets = document.getElementById('modal-assets');
  const btnCloseAssets = document.getElementById('btn-close-assets');

  if (btnViewAssets && modalAssets) {
    btnViewAssets.addEventListener('click', () => {
      renderAssetCards();
      modalAssets.classList.add('active');
    });
  }
  if (btnCloseAssets && modalAssets) {
    btnCloseAssets.addEventListener('click', () => {
      modalAssets.classList.remove('active');
    });
  }

  function renderAssetCards() {
    const room = window.gameState.room;
    const me = window.gameState.getMyPlayer();
    if (!room || !me) return;

    const cashEl = document.getElementById('asset-cash');
    const networthEl = document.getElementById('asset-networth');
    const countEl = document.getElementById('asset-count');
    const gridEl = document.getElementById('asset-cards-list');

    if (cashEl) cashEl.textContent = `Rp ${me.cash.toLocaleString('id-ID')}`;
    if (networthEl) networthEl.textContent = `Rp ${me.netWorth.toLocaleString('id-ID')}`;

    const myProps = [];
    for (const [tileIdStr, prop] of Object.entries(room.properties)) {
      if (prop.ownerId === me.id) {
        myProps.push({ tile: BOARD_TILES[Number(tileIdStr)], prop });
      }
    }

    if (countEl) countEl.textContent = myProps.length;

    if (gridEl) {
      if (myProps.length === 0) {
        gridEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px;">Anda belum memiliki tanah kota di Nusantara. Beli tanah kavling saat mendarat di kota kosong!</div>`;
        return;
      }

      gridEl.innerHTML = myProps.map(({ tile, prop }) => {
        let currentRent = tile.baseRent;
        if (prop.level === 1) currentRent = tile.rentL1;
        if (prop.level === 2) currentRent = tile.rentL2;
        if (prop.level === 3) currentRent = tile.rentL3;

        const isElite = prop.level === 3;
        const mortgageVal = Math.round(tile.price * 0.5);

        let safeBadge = isElite ? `<span class="badge-safe">🛡️ AMAN (ELIT)</span>` : `<span class="badge-vulnerable">⚔️ Rentan Ambil Alih</span>`;
        if (prop.isMortgaged) safeBadge = `<span class="badge-vulnerable" style="background: #f1f5f9; color: #64748b;">🏦 Tergadai</span>`;

        return `
          <div class="asset-card-item">
            <div class="header">
              <strong style="color: #0f172a;">${tile.icon} ${tile.name}</strong>
              ${safeBadge}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 4px;">Provinsi: ${tile.groupName}</div>
            <div style="font-size: 0.85rem; font-weight: 800; color: #0284c7;">${BUILDING_NAMES[prop.level] || 'Kavling'}</div>
            <div style="font-size: 0.8rem; margin: 4px 0;">Sewa Saat Ini: <strong>Rp ${currentRent.toLocaleString('id-ID')}</strong></div>
            <div style="font-size: 0.75rem; color: #64748b;">Nilai Gadai: Rp ${mortgageVal.toLocaleString('id-ID')} | Tebus: Rp ${(Math.round(tile.price * 0.6)).toLocaleString('id-ID')}</div>
          </div>
        `;
      }).join('');
    }
  }

  // ----------------------------------------------------
  // Modal: Kirim / Minta Uang Antarpemain
  // ----------------------------------------------------
  const btnPreTransfer = document.getElementById('btn-pre-transfer');
  const modalTransfer = document.getElementById('modal-money-transfer');
  const btnCloseTransfer = document.getElementById('btn-close-money-modal');
  const btnModeSend = document.getElementById('btn-mode-send');
  const btnModeRequest = document.getElementById('btn-mode-request');
  const dirIndicator = document.getElementById('transfer-direction-indicator');
  const btnExecTransfer = document.getElementById('btn-execute-transfer');
  let transferMode = 'SEND'; // 'SEND' | 'REQUEST'

  if (btnPreTransfer && modalTransfer) {
    btnPreTransfer.addEventListener('click', () => {
      populateTransferTargets();
      modalTransfer.classList.add('active');
    });
  }
  if (btnCloseTransfer && modalTransfer) {
    btnCloseTransfer.addEventListener('click', () => {
      modalTransfer.classList.remove('active');
    });
  }

  if (btnModeSend && btnModeRequest) {
    btnModeSend.addEventListener('click', () => {
      transferMode = 'SEND';
      btnModeSend.className = 'btn btn-primary';
      btnModeRequest.className = 'btn btn-secondary';
      dirIndicator.textContent = '➡️ Panah Transaksi: Anda → Penerima (Kirim Kas Langsung)';
      btnExecTransfer.textContent = 'Kirim Uang Sekarang';
    });
    btnModeRequest.addEventListener('click', () => {
      transferMode = 'REQUEST';
      btnModeSend.className = 'btn btn-secondary';
      btnModeRequest.className = 'btn btn-primary';
      dirIndicator.textContent = '⬅️ Panah Transaksi: Target → Anda (Menunggu Persetujuan)';
      btnExecTransfer.textContent = 'Kirim Permintaan Dana';
    });
  }

  function populateTransferTargets() {
    const sel = document.getElementById('transfer-target-player');
    const room = window.gameState.room;
    const me = window.gameState.getMyPlayer();
    if (!sel || !room) return;

    sel.innerHTML = room.players
      .filter(p => p.id !== me.id && !p.isBankrupt)
      .map(p => `<option value="${p.id}">${p.name} (Kas: Rp ${p.cash.toLocaleString('id-ID')})</option>`)
      .join('');
  }

  if (btnExecTransfer) {
    btnExecTransfer.addEventListener('click', () => {
      const sel = document.getElementById('transfer-target-player');
      const input = document.getElementById('transfer-amount-input');
      const targetId = sel.value;
      const amount = Number(input.value);

      if (!targetId || amount <= 0) {
        alert('Pilih pemain tujuan dan nominal yang valid!');
        return;
      }

      if (transferMode === 'SEND') {
        const me = window.gameState.getMyPlayer();
        if (me.cash < amount) {
          alert('Kas tunai Anda tidak mencukupi untuk transfer ini!');
          return;
        }
        window.netManager.send('TRANSFER_MONEY', { targetPlayerId: targetId, amount });
      } else {
        window.netManager.send('REQUEST_MONEY', { targetPlayerId: targetId, amount });
      }

      modalTransfer.classList.remove('active');
    });
  }

  // ----------------------------------------------------
  // Incoming Money Request Alert
  // ----------------------------------------------------
  function handleIncomingMoneyRequest(room) {
    const modal = document.getElementById('modal-incoming-request');
    const reqText = document.getElementById('incoming-request-text');
    const btnAccept = document.getElementById('btn-accept-request');
    const btnReject = document.getElementById('btn-reject-request');
    if (!modal) return;

    const req = room.pendingMoneyRequest;
    if (req && req.toPlayerId === window.gameState.myPlayerId) {
      modal.classList.add('active');
      if (reqText) {
        reqText.innerHTML = `<strong>${req.fromPlayerName}</strong> meminta bantuan dana sebesar <strong>Rp ${req.amount.toLocaleString('id-ID')}</strong>. Apakah Anda setuju memberikan bantuan dana ini?`;
      }

      btnAccept.onclick = () => {
        window.netManager.send('RESPOND_MONEY_REQUEST', { accept: true });
        modal.classList.remove('active');
      };
      btnReject.onclick = () => {
        window.netManager.send('RESPOND_MONEY_REQUEST', { accept: false });
        modal.classList.remove('active');
      };
    } else {
      modal.classList.remove('active');
    }
  }

  // ----------------------------------------------------
  // Modal: Gadai & Tebus Kota
  // ----------------------------------------------------
  const btnPreMortgage = document.getElementById('btn-pre-mortgage');
  const modalMortgage = document.getElementById('modal-mortgage');
  const btnCloseMortgage = document.getElementById('btn-close-mortgage');

  if (btnPreMortgage && modalMortgage) {
    btnPreMortgage.addEventListener('click', () => {
      renderMortgageCities();
      modalMortgage.classList.add('active');
    });
  }
  if (btnCloseMortgage && modalMortgage) {
    btnCloseMortgage.addEventListener('click', () => {
      modalMortgage.classList.remove('active');
    });
  }

  function renderMortgageCities() {
    const listEl = document.getElementById('mortgage-city-list');
    const room = window.gameState.room;
    const me = window.gameState.getMyPlayer();
    if (!listEl || !room || !me) return;

    const myProps = [];
    for (const [tileIdStr, prop] of Object.entries(room.properties)) {
      if (prop.ownerId === me.id) {
        myProps.push({ tile: BOARD_TILES[Number(tileIdStr)], prop });
      }
    }

    if (myProps.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">Anda belum memiliki kota untuk digadaikan/ditebus.</div>`;
      return;
    }

    listEl.innerHTML = myProps.map(({ tile, prop }) => {
      const mortgageVal = Math.round(tile.price * 0.5);
      const redeemVal = Math.round(tile.price * 0.6);

      let actionBtn = '';
      if (!prop.isMortgaged) {
        if (prop.level === 0) {
          actionBtn = `<button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="mortgageCity(${tile.id})">🏦 Gadai (Dapat Rp ${mortgageVal.toLocaleString('id-ID')})</button>`;
        } else {
          actionBtn = `<span style="font-size: 0.75rem; color: #64748b;">(Ada bangunan, tidak bisa digadai)</span>`;
        }
      } else {
        actionBtn = `<button class="btn btn-success" style="font-size: 0.8rem; padding: 6px 12px;" onclick="redeemCity(${tile.id})">🔓 Tebus (Bayar Rp ${redeemVal.toLocaleString('id-ID')})</button>`;
      }

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0;">
          <div>
            <strong>${tile.icon} ${tile.name}</strong> (${BUILDING_NAMES[prop.level] || 'Kavling'})
            <div style="font-size: 0.75rem; color: var(--text-muted);">Status: ${prop.isMortgaged ? '<span style="color: #ef4444; font-weight: 800;">TERGADAI</span>' : 'Aktif'}</div>
          </div>
          ${actionBtn}
        </div>
      `;
    }).join('');
  }

  window.mortgageCity = function(tileId) {
    window.netManager.send('MORTGAGE_PROPERTY', { tileId });
    setTimeout(renderMortgageCities, 200);
  };

  window.redeemCity = function(tileId) {
    window.netManager.send('REDEEM_PROPERTY', { tileId });
    setTimeout(renderMortgageCities, 200);
  };

  // ----------------------------------------------------
  // Modal: Usul Tukar Tanah
  // ----------------------------------------------------
  const btnPreTrade = document.getElementById('btn-pre-trade');
  const modalTrade = document.getElementById('modal-trade');
  const btnCloseTrade = document.getElementById('btn-close-trade');

  if (btnPreTrade && modalTrade) {
    btnPreTrade.addEventListener('click', () => {
      populateTradeOptions();
      modalTrade.classList.add('active');
    });
  }
  if (btnCloseTrade && modalTrade) {
    btnCloseTrade.addEventListener('click', () => {
      modalTrade.classList.remove('active');
    });
  }

  function populateTradeOptions() {
    const selTarget = document.getElementById('trade-target-player');
    const selGive = document.getElementById('trade-give-tile');
    const selGet = document.getElementById('trade-get-tile');
    const room = window.gameState.room;
    const me = window.gameState.getMyPlayer();
    if (!room || !me) return;

    selTarget.innerHTML = room.players
      .filter(p => p.id !== me.id && !p.isBankrupt)
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join('');

    const myCities = [];
    for (const [tileIdStr, prop] of Object.entries(room.properties)) {
      if (prop.ownerId === me.id) {
        myCities.push(BOARD_TILES[Number(tileIdStr)]);
      }
    }
    selGive.innerHTML = myCities.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    function updateGetCities() {
      const targetId = selTarget.value;
      const targetCities = [];
      for (const [tileIdStr, prop] of Object.entries(room.properties)) {
        if (prop.ownerId === targetId) {
          targetCities.push(BOARD_TILES[Number(tileIdStr)]);
        }
      }
      selGet.innerHTML = targetCities.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    selTarget.onchange = updateGetCities;
    updateGetCities();
  }

  const btnSubmitTrade = document.getElementById('btn-submit-trade');
  if (btnSubmitTrade) {
    btnSubmitTrade.addEventListener('click', () => {
      const selTarget = document.getElementById('trade-target-player');
      const selGive = document.getElementById('trade-give-tile');
      const selGet = document.getElementById('trade-get-tile');
      const cashInput = document.getElementById('trade-cash-input');

      if (!selGive.value || !selGet.value) {
        alert('Kedua belah pihak harus memiliki kota yang ditukarkan!');
        return;
      }

      window.netManager.send('TRADE_PROPERTY', {
        targetPlayerId: selTarget.value,
        giveTileId: Number(selGive.value),
        getTileId: Number(selGet.value),
        cashCompensation: Number(cashInput.value) || 0
      });

      modalTrade.classList.remove('active');
    });
  }

  // ----------------------------------------------------
  // Quiz Modal Engine (Pengetahuan Umum)
  // ----------------------------------------------------
  function handleQuizModal(room) {
    const modal = document.getElementById('modal-quiz');
    if (!modal) return;

    if (!room.currentQuiz) {
      modal.classList.remove('active');
      if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
      }
      return;
    }

    const quiz = room.currentQuiz;
    const isTargetPlayer = quiz.playerId === window.gameState.myPlayerId;

    modal.classList.add('active');

    const catEl = document.getElementById('quiz-category');
    const diffEl = document.getElementById('quiz-difficulty');
    const qTextEl = document.getElementById('quiz-question-text');
    const optList = document.getElementById('quiz-options-list');
    const timerEl = document.getElementById('quiz-timer');
    const explBox = document.getElementById('quiz-explanation-box');
    const explText = document.getElementById('quiz-explanation-text');
    const rewardText = document.getElementById('quiz-reward-text');
    const resTitle = document.getElementById('quiz-result-title');

    if (catEl) catEl.textContent = quiz.question.category || 'Pengetahuan Umum';
    if (diffEl) diffEl.textContent = `Tingkat: ${quiz.question.difficulty || 'Sedang'}`;
    if (qTextEl) qTextEl.textContent = quiz.question.question;

    if (!quizTimerInterval && !quiz.result) {
      quizTimerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((quiz.deadline - Date.now()) / 1000));
        if (timerEl) timerEl.textContent = `⏱️ ${remaining}s`;
        if (remaining <= 0) {
          clearInterval(quizTimerInterval);
          quizTimerInterval = null;
        }
      }, 500);
    }

    if (optList) {
      optList.innerHTML = '';
      quiz.question.options.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt-btn';
        btn.innerHTML = `<span style="font-weight: 800; color: #0284c7;">${String.fromCharCode(65 + idx)}.</span> <span>${optText}</span>`;

        if (quiz.result) {
          btn.disabled = true;
          if (idx === quiz.result.correctIndex) {
            btn.classList.add('correct');
          } else if (idx === quiz.result.chosenIndex && !quiz.result.isCorrect) {
            btn.classList.add('wrong');
          }
        } else {
          btn.disabled = !isTargetPlayer;
          btn.addEventListener('click', () => {
            window.netManager.send('SUBMIT_QUIZ', { answerIndex: idx });
          });
        }
        optList.appendChild(btn);
      });
    }

    if (quiz.result) {
      if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
      }

      if (explBox) explBox.classList.add('show');
      if (resTitle) {
        resTitle.textContent = quiz.result.isCorrect ? '✅ JAWABAN BENAR!' : '❌ KURANG TEPAT!';
        resTitle.style.color = quiz.result.isCorrect ? '#10b981' : '#ef4444';
      }
      if (explText) explText.textContent = quiz.result.explanation;
      if (rewardText) rewardText.textContent = quiz.result.rewardMsg;

      if (isTargetPlayer) {
        if (quiz.result.isCorrect && window.soundEngine) window.soundEngine.playQuizCorrect();
        else if (!quiz.result.isCorrect && window.soundEngine) window.soundEngine.playQuizWrong();
      }
    } else {
      if (explBox) explBox.classList.remove('show');
    }
  }

  // ----------------------------------------------------
  // Host Question Bank Editor
  // ----------------------------------------------------
  const btnOpenQuestions = document.getElementById('btn-host-quiz-modal');
  const modalQuestions = document.getElementById('modal-questions-editor');
  const btnCloseQuestions = document.getElementById('btn-close-questions');

  if (btnOpenQuestions && modalQuestions) {
    btnOpenQuestions.addEventListener('click', () => {
      renderQuestionsEditor();
      modalQuestions.classList.add('active');
    });
  }
  if (btnCloseQuestions && modalQuestions) {
    btnCloseQuestions.addEventListener('click', () => {
      modalQuestions.classList.remove('active');
    });
  }

  function renderQuestionsEditor() {
    const list = document.getElementById('editor-question-list');
    if (!list) return;
    const questions = window.gameState.room?.questions || DEFAULT_QUESTIONS;

    list.innerHTML = '';
    questions.forEach((q, idx) => {
      const item = document.createElement('div');
      item.className = 'card';
      item.style.padding = '12px';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.gap = '10px';

      item.innerHTML = `
        <div style="flex: 1;">
          <div style="font-size: 0.75rem; color: #0284c7; font-weight: 800;">${q.category || 'Pengetahuan Umum'} • ${q.difficulty || 'Sedang'}</div>
          <div style="font-weight: 800; font-size: 0.88rem; margin: 2px 0;">${idx + 1}. ${q.question}</div>
          <div style="font-size: 0.78rem; color: #10b981;">Kunci Jawaban: ${q.options[q.correct_index] || '-'}</div>
        </div>
        <button class="icon-btn" style="color: #ef4444; padding: 6px 10px;" onclick="deleteQuestion(${idx})">Hapus</button>
      `;
      list.appendChild(item);
    });
  }

  window.deleteQuestion = function(index) {
    const questions = [...(window.gameState.room?.questions || DEFAULT_QUESTIONS)];
    questions.splice(index, 1);
    window.netManager.send('UPDATE_QUESTIONS', { questions });
    setTimeout(renderQuestionsEditor, 200);
  };

  const btnAddNewQ = document.getElementById('btn-add-new-question');
  if (btnAddNewQ) {
    btnAddNewQ.addEventListener('click', () => {
      const questionText = prompt('Masukkan pertanyaan pengetahuan umum:');
      if (!questionText) return;
      const optA = prompt('Pilihan A:') || 'Opsi A';
      const optB = prompt('Pilihan B:') || 'Opsi B';
      const optC = prompt('Pilihan C:') || 'Opsi C';
      const optD = prompt('Pilihan D:') || 'Opsi D';
      const correctChar = (prompt('Huruf Jawaban Benar (A/B/C/D):') || 'A').toUpperCase();
      const correctIdx = correctChar === 'B' ? 1 : correctChar === 'C' ? 2 : correctChar === 'D' ? 3 : 0;
      const explanation = prompt('Penjelasan singkat fakta:') || 'Pengetahuan umum penting untuk wawasan.';

      const newQ = {
        id: 'custom_' + Date.now(),
        category: 'Pengetahuan Umum',
        difficulty: 'Sedang',
        type: 'multiple_choice',
        question: questionText,
        options: [optA, optB, optC, optD],
        correct_index: correctIdx,
        explanation,
        reward: { cash: 200000, discount_pct: 20 },
        penalty: { cash: 60000 }
      };

      const questions = [...(window.gameState.room?.questions || DEFAULT_QUESTIONS), newQ];
      window.netManager.send('UPDATE_QUESTIONS', { questions });
      setTimeout(renderQuestionsEditor, 200);
    });
  }

  const btnExportQ = document.getElementById('btn-export-questions');
  if (btnExportQ) {
    btnExportQ.addEventListener('click', () => {
      const questions = window.gameState.room?.questions || DEFAULT_QUESTIONS;
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(questions, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'bank_soal_pengetahuan_umum.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  const inputImportQ = document.getElementById('input-import-questions');
  if (inputImportQ) {
    inputImportQ.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (Array.isArray(imported)) {
            window.netManager.send('UPDATE_QUESTIONS', { questions: imported });
            alert(`Berhasil mengimpor ${imported.length} soal!`);
            setTimeout(renderQuestionsEditor, 200);
          }
        } catch (err) {
          alert('Format berkas JSON tidak valid.');
        }
      };
      reader.readAsText(file);
    });
  }

  const btnResetQ = document.getElementById('btn-reset-questions');
  if (btnResetQ) {
    btnResetQ.addEventListener('click', () => {
      if (confirm('Kembalikan bank soal ke soal bawaan standar?')) {
        window.netManager.send('UPDATE_QUESTIONS', { questions: DEFAULT_QUESTIONS });
        setTimeout(renderQuestionsEditor, 200);
      }
    });
  }

  // ----------------------------------------------------
  // Game Over Podium
  // ----------------------------------------------------
  function showGameOverModal(data) {
    const modal = document.getElementById('modal-game-over');
    if (!modal) return;
    modal.classList.add('active');

    const reasonEl = document.getElementById('game-over-reason');
    if (reasonEl) reasonEl.textContent = data.reason;

    const podiumContainer = document.getElementById('podium-steps-container');
    const tableContainer = document.getElementById('final-leaderboard-list');

    const leaderboard = data.leaderboard || [];

    if (podiumContainer && leaderboard.length >= 1) {
      const p1 = leaderboard[0];
      const p2 = leaderboard[1] || null;
      const p3 = leaderboard[2] || null;

      const av1 = AVATARS.find(a => a.id === p1.avatar) || AVATARS[0];
      const av2 = p2 ? (AVATARS.find(a => a.id === p2.avatar) || AVATARS[0]) : null;
      const av3 = p3 ? (AVATARS.find(a => a.id === p3.avatar) || AVATARS[0]) : null;

      podiumContainer.innerHTML = `
        ${p2 ? `
          <div class="podium-step rank-2">
            <span style="font-size: 1.5rem;">🥈</span>
            <span style="font-size: 1.4rem;">${av2.icon}</span>
            <div style="font-size: 0.8rem; font-weight: 800; margin-top: 4px;">${p2.name}</div>
            <div style="font-size: 0.72rem; color: #059669; font-weight: 800;">Rp ${(p2.netWorth / 1000)}k</div>
          </div>
        ` : ''}
        <div class="podium-step rank-1">
          <span style="font-size: 2rem;">👑 🥇</span>
          <span style="font-size: 1.8rem;">${av1.icon}</span>
          <div style="font-size: 0.95rem; font-weight: 800; margin-top: 4px; color: #b45309;">${p1.name}</div>
          <div style="font-size: 0.78rem; color: #059669; font-weight: 800;">Rp ${(p1.netWorth / 1000)}k</div>
        </div>
        ${p3 ? `
          <div class="podium-step rank-3">
            <span style="font-size: 1.5rem;">🥉</span>
            <span style="font-size: 1.4rem;">${av3.icon}</span>
            <div style="font-size: 0.8rem; font-weight: 800; margin-top: 4px;">${p3.name}</div>
            <div style="font-size: 0.72rem; color: #059669; font-weight: 800;">Rp ${(p3.netWorth / 1000)}k</div>
          </div>
        ` : ''}
      `;
    }

    if (tableContainer) {
      tableContainer.innerHTML = leaderboard.map(p => {
        const av = AVATARS.find(a => a.id === p.avatar) || AVATARS[0];
        return `
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.88rem;">
            <span><strong>#${p.rank}</strong> ${av.icon} ${p.name} ${p.isBankrupt ? '(💥 Bangkrut)' : ''}</span>
            <span style="color: #059669; font-weight: 800;">Rp ${p.netWorth.toLocaleString('id-ID')}</span>
          </div>
        `;
      }).join('');
    }

    const btnPlayAgain = document.getElementById('btn-play-again');
    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', () => {
        window.location.href = window.location.pathname;
      });
    }
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  }
});
