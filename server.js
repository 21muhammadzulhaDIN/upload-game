// server.js - Wargaopoly Alam Nusantara 3D Server
// Full-featured multiplayer engine with Advanced Economy, Takeovers, Mortgages, and Trading

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_QUESTIONS } = require('./public/js/questions.js');
const { AVATARS, BUILDING_NAMES, BOARD_TILES } = require('./public/js/board_data.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// ----------------------------------------------------
// HTTP Static File Server
// ----------------------------------------------------
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;
  if (pathname === '/') pathname = '/index.html';

  if (pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', name: 'Wargaopoly Alam Nusantara 3D', roomsCount: Object.keys(rooms).length }));
    return;
  }

  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Akses ditolak.');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (err2, content) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(safePath).pipe(res);
  });
});

// ----------------------------------------------------
// RFC 6455 WebSocket Implementation
// ----------------------------------------------------
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function createWebSocketAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function sendWsFrame(socket, payload, opcode = 0x01) {
  if (!socket || !socket.writable) return;
  const payloadBuffer = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const length = payloadBuffer.length;

  let header;
  if (length <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = length;
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  try {
    socket.write(Buffer.concat([header, payloadBuffer]));
  } catch (err) {
    console.error('Error writing WS frame:', err.message);
  }
}

server.on('upgrade', (req, socket, head) => {
  const wsKey = req.headers['sec-websocket-key'];
  if (!wsKey) {
    socket.destroy();
    return;
  }

  const acceptKey = createWebSocketAccept(wsKey);
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];

  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 2) {
      const firstByte = buffer[0];
      const secondByte = buffer[1];
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) === 0x80;
      let payloadLength = secondByte & 0x7f;

      let offset = 2;
      if (payloadLength === 126) {
        if (buffer.length < 4) return;
        payloadLength = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (buffer.length < 10) return;
        payloadLength = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      let maskKey = null;
      if (masked) {
        if (buffer.length < offset + 4) return;
        maskKey = buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      if (buffer.length < offset + payloadLength) return;

      const rawPayload = buffer.subarray(offset, offset + payloadLength);
      buffer = buffer.subarray(offset + payloadLength);

      let unmaskedPayload;
      if (masked && maskKey) {
        unmaskedPayload = Buffer.alloc(payloadLength);
        for (let i = 0; i < payloadLength; i++) {
          unmaskedPayload[i] = rawPayload[i] ^ maskKey[i % 4];
        }
      } else {
        unmaskedPayload = rawPayload;
      }

      if (opcode === 0x08) {
        sendWsFrame(socket, Buffer.alloc(0), 0x08);
        socket.end();
        return;
      } else if (opcode === 0x09) {
        sendWsFrame(socket, unmaskedPayload, 0x0a);
      } else if (opcode === 0x01) {
        try {
          const text = unmaskedPayload.toString('utf8');
          const data = JSON.parse(text);
          handleClientMessage(socket, data);
        } catch (e) {
          console.error('Error handling WebSocket message:', e.message);
        }
      }
    }
  });

  socket.on('close', () => {
    handleSocketDisconnect(socket);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
    handleSocketDisconnect(socket);
  });
});

// ----------------------------------------------------
// Multi-Room State Management
// ----------------------------------------------------
const rooms = {};
const socketPlayerMap = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function broadcastToRoom(roomCode, message) {
  const room = rooms[roomCode];
  if (!room) return;
  for (const player of room.players) {
    if (player.ws && player.ws.writable) {
      sendWsFrame(player.ws, message);
    }
  }
}

function logActivity(room, text) {
  const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
  room.activityLog.unshift(`[${time}] ${text}`);
  if (room.activityLog.length > 50) room.activityLog.pop();
}

function checkProvincialMonopoly(room, playerId, group) {
  if (!group || group === 'transport' || group === 'special') return false;
  const groupTiles = BOARD_TILES.filter(t => t.group === group);
  if (groupTiles.length === 0) return false;
  return groupTiles.every(t => {
    const prop = room.properties[t.id];
    return prop && prop.ownerId === playerId && !prop.isMortgaged;
  });
}

function sanitizeRoomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    settings: room.settings,
    currentRound: room.currentRound,
    currentTurnIndex: room.currentTurnIndex,
    turnState: room.turnState,
    lastRoll: room.lastRoll,
    properties: room.properties,
    takeoverOffer: room.takeoverOffer || null,
    pendingMoneyRequest: room.pendingMoneyRequest || null,
    pendingTradeOffer: room.pendingTradeOffer || null,
    currentQuiz: room.currentQuiz ? {
      playerId: room.currentQuiz.playerId,
      tileId: room.currentQuiz.tileId,
      context: room.currentQuiz.context,
      question: {
        id: room.currentQuiz.question.id,
        category: room.currentQuiz.question.category,
        difficulty: room.currentQuiz.question.difficulty,
        type: room.currentQuiz.question.type,
        question: room.currentQuiz.question.question,
        options: room.currentQuiz.question.options,
        reward: room.currentQuiz.question.reward,
        penalty: room.currentQuiz.question.penalty
      },
      deadline: room.currentQuiz.deadline,
      result: room.currentQuiz.result || null
    } : null,
    activityLog: room.activityLog.slice(0, 15),
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      isBot: p.isBot,
      isReady: p.isReady,
      cash: p.cash,
      position: p.position,
      inJail: p.inJail,
      jailTurns: p.jailTurns,
      canUpgradeThisTurn: !!p.canUpgradeThisTurn,
      upgradedCitiesThisTurn: p.upgradedCitiesThisTurn || [],
      isBankrupt: p.isBankrupt,
      isDisconnected: p.isDisconnected,
      netWorth: calculateNetWorth(room, p)
    }))
  };
}

function calculateNetWorth(room, player) {
  let total = player.cash;
  for (const [tileIdStr, prop] of Object.entries(room.properties)) {
    if (prop.ownerId === player.id) {
      const tile = BOARD_TILES[Number(tileIdStr)];
      if (tile) {
        if (!prop.isMortgaged) {
          total += tile.price;
          if (tile.upgradeCost && prop.level > 0) {
            total += prop.level * tile.upgradeCost;
          }
        } else {
          total += Math.round(tile.price * 0.5); // mortgage value
        }
      }
    }
  }
  return total;
}

function createRoom(hostName, hostAvatar, customSettings = {}) {
  const code = generateRoomCode();
  const hostId = 'p_' + crypto.randomBytes(4).toString('hex');
  const token = generateToken();

  const settings = {
    startingCash: 3500000,
    passGoSalary: 1000000,
    maxRounds: 25,
    turnTimer: 35,
    quizOnBuy: true,
    quizOnEvent: true,
    taxRate: 200000,
    ...customSettings
  };

  const room = {
    code,
    hostId,
    status: 'lobby',
    settings,
    currentRound: 1,
    currentTurnIndex: 0,
    turnState: 'WAIT_ROLL',
    lastRoll: [1, 1],
    properties: {}, // tileId => { ownerId, level: 0..3, isMortgaged: boolean }
    takeoverOffer: null,
    pendingMoneyRequest: null,
    pendingTradeOffer: null,
    questions: JSON.parse(JSON.stringify(DEFAULT_QUESTIONS)),
    players: [
      {
        id: hostId,
        token,
        name: hostName || 'Pak RW (Host)',
        avatar: hostAvatar || 'ojol',
        isHost: true,
        isBot: false,
        isReady: true,
        cash: settings.startingCash,
        position: 0,
        inJail: false,
        jailTurns: 0,
        canUpgradeThisTurn: false,
        upgradedCitiesThisTurn: [],
        isBankrupt: false,
        isDisconnected: false,
        ws: null
      }
    ],
    activityLog: [`Kamar Nusantara ${code} berhasil dibuat oleh ${hostName || 'Host'}.`],
    currentQuiz: null,
    timerHandle: null
  };

  rooms[code] = room;
  return { room, hostId, token };
}

function syncRoom(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  broadcastToRoom(roomCode, {
    type: 'ROOM_SYNC',
    state: sanitizeRoomState(room)
  });
}

function getActivePlayer(room) {
  if (!room || !room.players.length) return null;
  return room.players[room.currentTurnIndex];
}

function nextTurn(room) {
  clearTurnTimer(room);
  room.currentQuiz = null;
  room.takeoverOffer = null;
  room.pendingMoneyRequest = null;
  room.pendingTradeOffer = null;

  // Reset turn upgrade flag for outgoing player
  const curr = getActivePlayer(room);
  if (curr) {
    curr.canUpgradeThisTurn = false;
    curr.upgradedCitiesThisTurn = [];
  }

  const activePlayers = room.players.filter(p => !p.isBankrupt);
  if (activePlayers.length <= 1 && room.players.length > 1) {
    endGame(room, 'Pemenang ditentukan! Hanya tersisa 1 warga yang tidak bangkrut.');
    return;
  }

  let nextIdx = (room.currentTurnIndex + 1) % room.players.length;
  let loops = 0;
  while (room.players[nextIdx].isBankrupt && loops < room.players.length) {
    nextIdx = (nextIdx + 1) % room.players.length;
    loops++;
  }

  if (nextIdx <= room.currentTurnIndex) {
    room.currentRound++;
    logActivity(room, `🏁 Memasuki Putaran Ronde ${room.currentRound} / ${room.settings.maxRounds}!`);
    if (room.settings.maxRounds > 0 && room.currentRound > room.settings.maxRounds) {
      endGame(room, 'Batas putaran ronde tercapai!');
      return;
    }
  }

  room.currentTurnIndex = nextIdx;
  room.turnState = 'WAIT_ROLL';
  const player = room.players[nextIdx];

  logActivity(room, `👉 Giliran ${player.name} (${player.avatar.toUpperCase()}).`);
  syncRoom(room.code);

  startTurnTimer(room);

  if (player.isBot) {
    handleBotTurn(room, player);
  }
}

function clearTurnTimer(room) {
  if (room.timerHandle) {
    clearTimeout(room.timerHandle);
    room.timerHandle = null;
  }
}

function startTurnTimer(room) {
  clearTurnTimer(room);
  const timeoutMs = (room.settings.turnTimer || 35) * 1000;

  room.timerHandle = setTimeout(() => {
    const player = getActivePlayer(room);
    if (!player) return;

    logActivity(room, `⏱️ Waktu giliran ${player.name} habis! Otomatis diteruskan.`);
    if (room.turnState === 'WAIT_QUIZ' && room.currentQuiz) {
      resolveQuizAnswer(room, player, -1);
    } else {
      nextTurn(room);
    }
  }, timeoutMs);
}

function endGame(room, reason) {
  clearTurnTimer(room);
  room.status = 'game_over';
  logActivity(room, `🏆 PERMAINAN SELESAI: ${reason}`);

  const sorted = [...room.players].sort((a, b) => calculateNetWorth(room, b) - calculateNetWorth(room, a));
  const winner = sorted[0];

  broadcastToRoom(room.code, {
    type: 'GAME_OVER',
    reason,
    winner: {
      name: winner.name,
      avatar: winner.avatar,
      netWorth: calculateNetWorth(room, winner)
    },
    leaderboard: sorted.map((p, idx) => ({
      rank: idx + 1,
      name: p.name,
      avatar: p.avatar,
      cash: p.cash,
      netWorth: calculateNetWorth(room, p),
      isBankrupt: p.isBankrupt
    })),
    state: sanitizeRoomState(room)
  });
}

// ----------------------------------------------------
// Bot AI Automator
// ----------------------------------------------------
function handleBotTurn(room, bot) {
  setTimeout(() => {
    if (room.status !== 'playing' || getActivePlayer(room)?.id !== bot.id) return;

    if (bot.inJail) {
      if (bot.cash >= 300000) {
        bot.cash -= 150000;
        bot.inJail = false;
        bot.jailTurns = 0;
        logActivity(room, `👮 Bot ${bot.name} bayar jaminan pos karantina Rp 150.000 untuk bebas.`);
      } else {
        bot.jailTurns++;
        if (bot.jailTurns >= 2) {
          bot.inJail = false;
          bot.jailTurns = 0;
          logActivity(room, `👮 Bot ${bot.name} bebas dari pos karantina setelah 2 putaran.`);
        } else {
          logActivity(room, `👮 Bot ${bot.name} masih mendekam di pos karantina.`);
          nextTurn(room);
          return;
        }
      }
    }

    performDiceRoll(room, bot);
  }, 1200);
}

function handleBotQuiz(room, bot) {
  setTimeout(() => {
    if (!room.currentQuiz || room.currentQuiz.playerId !== bot.id) return;
    const q = room.currentQuiz.question;
    const isCorrect = Math.random() < 0.75;
    const chosenIndex = isCorrect ? q.correct_index : (q.correct_index + 1) % q.options.length;
    resolveQuizAnswer(room, bot, chosenIndex);
  }, 1800);
}

function handleBotActionAfterMove(room, bot, tile) {
  setTimeout(() => {
    if (room.status !== 'playing' || getActivePlayer(room)?.id !== bot.id) return;

    // Check if takeover available and bot has plenty of cash
    if (room.takeoverOffer && room.takeoverOffer.targetOwnerId !== bot.id && bot.cash >= room.takeoverOffer.cost + 1000000) {
      executeTakeover(room, bot, room.takeoverOffer.tileId);
      return;
    }

    const prop = room.properties[tile.id];
    if (tile.type === 'property' || tile.type === 'utility') {
      if (!prop && bot.cash >= tile.price + 500000) {
        buyProperty(room, bot, tile.id);
        return;
      }
    }

    // Check if can upgrade
    if (bot.canUpgradeThisTurn) {
      for (const [tileIdStr, p] of Object.entries(room.properties)) {
        if (p.ownerId === bot.id && p.level < 3 && !p.isMortgaged) {
          const t = BOARD_TILES[Number(tileIdStr)];
          if (t && t.upgradeCost && bot.cash >= t.upgradeCost + 600000 && !bot.upgradedCitiesThisTurn.includes(t.id)) {
            upgradeProperty(room, bot, t.id);
            return;
          }
        }
      }
    }

    nextTurn(room);
  }, 1500);
}

// ----------------------------------------------------
// Game Core Mechanics
// ----------------------------------------------------
function performDiceRoll(room, player) {
  if (room.turnState !== 'WAIT_ROLL') return;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const steps = d1 + d2;
  room.lastRoll = [d1, d2];
  room.takeoverOffer = null;

  const oldPos = player.position;
  let newPos = (oldPos + steps) % BOARD_TILES.length;

  // Passed or landed on START: GAJIAN Rp 1.000.000!
  if (newPos < oldPos || newPos === 0) {
    const salary = room.settings.passGoSalary || 1000000;
    player.cash += salary;
    player.canUpgradeThisTurn = true;
    player.upgradedCitiesThisTurn = [];
    logActivity(room, `🎉 ${player.name} GAJIAN putaran START Rp ${salary.toLocaleString('id-ID')}! Tawaran bangun dibuka di akhir giliran.`);
  }

  player.position = newPos;
  const targetTile = BOARD_TILES[newPos];
  logActivity(room, `🎲 ${player.name} melempar [${d1} + ${d2} = ${steps}], tiba di ${targetTile.icon} ${targetTile.name}.`);

  resolveTileLanding(room, player, targetTile, steps);
}

function resolveTileLanding(room, player, tile, steps) {
  switch (tile.type) {
    case 'start':
      room.turnState = 'WAIT_ACTION';
      syncRoom(room.code);
      if (player.isBot) handleBotActionAfterMove(room, player, tile);
      break;

    case 'jail':
      logActivity(room, `☕ ${player.name} mampir santai di Pos Karantina Alam.`);
      room.turnState = 'WAIT_ACTION';
      syncRoom(room.code);
      if (player.isBot) handleBotActionAfterMove(room, player, tile);
      break;

    case 'go_to_jail':
      player.position = 6;
      player.inJail = true;
      player.jailTurns = 0;
      logActivity(room, `🚨 RAZIA ALAM! ${player.name} melanggar ketertiban dan digiring ke Pos Karantina!`);
      room.turnState = 'RESOLVED';
      syncRoom(room.code);
      setTimeout(() => nextTurn(room), 1500);
      break;

    case 'free_parking':
      logActivity(room, `🌳 ${player.name} bersantai di Taman Wisata Alam. Parkir bebas sewa.`);
      room.turnState = 'WAIT_ACTION';
      syncRoom(room.code);
      if (player.isBot) handleBotActionAfterMove(room, player, tile);
      break;

    case 'reward':
      player.cash += tile.amount || 250000;
      logActivity(room, `💸 ${player.name} menerima insentif subsidi konservasi Rp ${(tile.amount || 250000).toLocaleString('id-ID')}!`);
      room.turnState = 'WAIT_ACTION';
      syncRoom(room.code);
      if (player.isBot) handleBotActionAfterMove(room, player, tile);
      break;

    case 'tax':
      handleTaxTile(room, player, tile);
      break;

    case 'event':
    case 'community_chest':
      handleEventTile(room, player, tile);
      break;

    case 'property':
    case 'utility':
      handlePropertyLanding(room, player, tile, steps);
      break;

    default:
      room.turnState = 'WAIT_ACTION';
      syncRoom(room.code);
      if (player.isBot) handleBotActionAfterMove(room, player, tile);
      break;
  }
}

function handleTaxTile(room, player, tile) {
  const tax = tile.taxAmount || room.settings.taxRate || 200000;
  if (room.settings.quizOnEvent) {
    triggerQuiz(room, player, tile, 'TAX', tax);
  } else {
    deductCash(room, player, tax, 'Pajak Konservasi Lingkungan');
    room.turnState = 'WAIT_ACTION';
    syncRoom(room.code);
    if (player.isBot) handleBotActionAfterMove(room, player, tile);
  }
}

function handleEventTile(room, player, tile) {
  if (room.settings.quizOnEvent) {
    triggerQuiz(room, player, tile, 'EVENT', 150000);
  } else {
    const isBonus = Math.random() < 0.6;
    const amount = 150000;
    if (isBonus) {
      player.cash += amount;
      logActivity(room, `📦 Dana Warga: ${player.name} dapat reward pelestarian Rp ${amount.toLocaleString('id-ID')}!`);
    } else {
      deductCash(room, player, amount, 'Iuran Pemeliharaan Taman');
    }
    room.turnState = 'WAIT_ACTION';
    syncRoom(room.code);
    if (player.isBot) handleBotActionAfterMove(room, player, tile);
  }
}

function handlePropertyLanding(room, player, tile, steps) {
  const prop = room.properties[tile.id];

  if (!prop) {
    room.turnState = 'WAIT_ACTION';
    logActivity(room, `🏛️ ${tile.name} masih kosong! Harga beli tanah kavling: Rp ${tile.price.toLocaleString('id-ID')}.`);
    syncRoom(room.code);
    if (player.isBot) handleBotActionAfterMove(room, player, tile);
  } else if (prop.ownerId === player.id) {
    room.turnState = 'WAIT_ACTION';
    logActivity(room, `🏠 ${player.name} mampir di aset miliknya (${tile.name}).`);
    syncRoom(room.code);
    if (player.isBot) handleBotActionAfterMove(room, player, tile);
  } else {
    // Other player's property
    const owner = room.players.find(p => p.id === prop.ownerId);

    // If mortgaged, no rent!
    if (prop.isMortgaged) {
      logActivity(room, `🏦 ${tile.name} sedang digadaikan ke Negara! Bebas biaya sewa.`);
      room.turnState = 'WAIT_ACTION';
      syncRoom(room.code);
      if (player.isBot) handleBotActionAfterMove(room, player, tile);
      return;
    }

    // Calculate rent
    let rent = tile.baseRent;
    if (tile.type === 'utility') {
      rent = (steps || 7) * (tile.multiplier || 25000);
    } else if (prop.level === 1) rent = tile.rentL1;
    else if (prop.level === 2) rent = tile.rentL2;
    else if (prop.level === 3) rent = tile.rentL3;
    else if (prop.level === 0) {
      // Check provincial monopoly: sewa tanah kosong naik 2x lipat!
      if (checkProvincialMonopoly(room, owner.id, tile.group)) {
        rent = tile.baseRent * 2;
        logActivity(room, `⭐ Monopoli Provinsi ${tile.groupName}! Sewa tanah kavling naik 2x menjadi Rp ${rent.toLocaleString('id-ID')}.`);
      }
    }

    logActivity(room, `💸 ${player.name} membayar sewa ke ${owner.name} sebesar Rp ${rent.toLocaleString('id-ID')} (${tile.name} - ${BUILDING_NAMES[prop.level]})!`);
    payRent(room, player, owner, rent);

    // Check Takeover eligibility: 2x total value (tanah + bangunan)
    const isMonopoly = checkProvincialMonopoly(room, owner.id, tile.group);
    const isElite = prop.level === 3;
    const isMortgaged = !!prop.isMortgaged;
    const totalValue = tile.price + (prop.level * (tile.upgradeCost || 0));
    const takeoverCost = totalValue * 2;

    if (!isElite && !isMonopoly && !isMortgaged && player.cash >= takeoverCost) {
      room.takeoverOffer = {
        tileId: tile.id,
        tileName: tile.name,
        targetOwnerId: owner.id,
        targetOwnerName: owner.name,
        cost: takeoverCost
      };
      logActivity(room, `⚔️ Opsi Ambil Alih: ${player.name} berhak mengambil alih ${tile.name} seharga 2× nilainya (Rp ${takeoverCost.toLocaleString('id-ID')})!`);
    } else {
      room.takeoverOffer = null;
    }

    room.turnState = 'WAIT_ACTION';
    syncRoom(room.code);
    if (player.isBot) handleBotActionAfterMove(room, player, tile);
  }
}

function payRent(room, tenant, owner, amount) {
  tenant.cash -= amount;
  owner.cash += amount;
  if (tenant.cash < 0) {
    handleBankruptcy(room, tenant, owner);
  }
}

function deductCash(room, player, amount, reason) {
  player.cash -= amount;
  logActivity(room, `📉 ${player.name} membayar Rp ${amount.toLocaleString('id-ID')} untuk ${reason}.`);
  if (player.cash < 0) {
    handleBankruptcy(room, player, null);
  }
}

function handleBankruptcy(room, player, creditor) {
  player.isBankrupt = true;
  logActivity(room, `💥 GULUNG TIKAR! ${player.name} kehabisan kas dan dinyatakan bangkrut!`);

  for (const [tileIdStr, prop] of Object.entries(room.properties)) {
    if (prop.ownerId === player.id) {
      if (creditor && !creditor.isBankrupt) {
        prop.ownerId = creditor.id;
        logActivity(room, `🔑 Aset ${BOARD_TILES[Number(tileIdStr)].name} disita oleh ${creditor.name}.`);
      } else {
        delete room.properties[tileIdStr];
        logActivity(room, `🏛️ Aset ${BOARD_TILES[Number(tileIdStr)].name} kembali dilelang ke pasar.`);
      }
    }
  }

  const active = room.players.filter(p => !p.isBankrupt);
  if (active.length <= 1) {
    endGame(room, 'Tersisa satu juragan ekonomi warga!');
  }
}

// ----------------------------------------------------
// Quiz Engine
// ----------------------------------------------------
function triggerQuiz(room, player, tile, context, extraParam = 0) {
  clearTurnTimer(room);

  const activeQuestions = room.questions.filter(q => q.active !== false);
  const qPool = activeQuestions.length > 0 ? activeQuestions : DEFAULT_QUESTIONS;
  const picked = qPool[Math.floor(Math.random() * qPool.length)];

  const timeoutSecs = 20;
  const deadline = Date.now() + timeoutSecs * 1000;

  room.currentQuiz = {
    playerId: player.id,
    tileId: tile.id,
    context,
    extraParam,
    question: picked,
    deadline,
    result: null
  };
  room.turnState = 'WAIT_QUIZ';

  logActivity(room, `❓ KUIS PENGETAHUAN UMUM: ${player.name} menghadapi soal "${picked.category}"!`);
  syncRoom(room.code);

  room.timerHandle = setTimeout(() => {
    if (room.currentQuiz && room.currentQuiz.playerId === player.id && !room.currentQuiz.result) {
      logActivity(room, `⌛ ${player.name} kehabisan waktu menjawab kuis.`);
      resolveQuizAnswer(room, player, -1);
    }
  }, (timeoutSecs + 1) * 1000);

  if (player.isBot) {
    handleBotQuiz(room, player);
  }
}

function resolveQuizAnswer(room, player, answerIndex) {
  clearTurnTimer(room);
  if (!room.currentQuiz) return;

  const q = room.currentQuiz.question;
  const isCorrect = answerIndex === q.correct_index;
  const context = room.currentQuiz.context;
  const tile = BOARD_TILES[room.currentQuiz.tileId];

  let rewardMsg = '';
  if (isCorrect) {
    if (context === 'BUY') {
      const discountPct = q.reward?.discount_pct || 15;
      const discountedPrice = Math.round(tile.price * (1 - discountPct / 100));
      rewardMsg = `Jawaban BENAR! Mendapatkan diskon ${discountPct}% (Harga menjadi Rp ${discountedPrice.toLocaleString('id-ID')}).`;
      room.currentQuiz.discountedPrice = discountedPrice;
      room.currentQuiz.canBuy = true;
    } else if (context === 'TAX') {
      rewardMsg = `Jawaban BENAR! Anda terbebas dari pungutan pajak lingkungan!`;
    } else if (context === 'EVENT') {
      const bonus = q.reward?.cash || 150000;
      player.cash += bonus;
      rewardMsg = `Jawaban BENAR! Anda memperoleh insentif wawasan sebesar Rp ${bonus.toLocaleString('id-ID')}.`;
    }
  } else {
    if (context === 'BUY') {
      const fine = q.penalty?.cash || 50000;
      deductCash(room, player, fine, 'Biaya Administrasi Salah Jawab');
      rewardMsg = `Jawaban KURANG TEPAT! Izin beli ditunda putaran ini & denda Rp ${fine.toLocaleString('id-ID')}.`;
      room.currentQuiz.canBuy = false;
    } else if (context === 'TAX') {
      const tax = room.currentQuiz.extraParam || 200000;
      deductCash(room, player, tax, 'Pajak PBB Lingkungan Penuh');
      rewardMsg = `Jawaban SALAH! Wajib membayar pajak penuh Rp ${tax.toLocaleString('id-ID')}.`;
    } else if (context === 'EVENT') {
      const fine = q.penalty?.cash || 60000;
      deductCash(room, player, fine, 'Denda Kelestarian');
      rewardMsg = `Jawaban SALAH! Kena denda iuran lingkungan Rp ${fine.toLocaleString('id-ID')}.`;
    }
  }

  room.currentQuiz.result = {
    isCorrect,
    chosenIndex: answerIndex,
    correctIndex: q.correct_index,
    explanation: q.explanation,
    rewardMsg
  };

  logActivity(room, `📚 ${player.name} menjawab [${isCorrect ? 'BENAR' : 'SALAH'}]: ${rewardMsg}`);
  syncRoom(room.code);

  setTimeout(() => {
    room.turnState = 'WAIT_ACTION';
    syncRoom(room.code);
    startTurnTimer(room);
    if (player.isBot) handleBotActionAfterMove(room, player, tile);
  }, 4000);
}

function buyProperty(room, player, tileId) {
  const tile = BOARD_TILES[tileId];
  if (!tile || (tile.type !== 'property' && tile.type !== 'utility')) return;
  if (room.properties[tileId]) {
    logActivity(room, `⚠️ ${tile.name} sudah dimiliki oleh juragan lain!`);
    return;
  }

  if (room.settings.quizOnBuy && (!room.currentQuiz || !room.currentQuiz.canBuy || room.currentQuiz.tileId !== tileId)) {
    triggerQuiz(room, player, tile, 'BUY');
    return;
  }

  let price = tile.price;
  if (room.currentQuiz && room.currentQuiz.discountedPrice) {
    price = room.currentQuiz.discountedPrice;
  }

  if (player.cash < price) {
    logActivity(room, `⚠️ Kas ${player.name} tidak cukup (Butuh Rp ${price.toLocaleString('id-ID')}).`);
    return;
  }

  player.cash -= price;
  room.properties[tileId] = {
    ownerId: player.id,
    level: 0,
    isMortgaged: false
  };

  logActivity(room, `🎉 ${player.name} RESMI membeli tanah kavling di ${tile.name} seharga Rp ${price.toLocaleString('id-ID')}!`);
  room.currentQuiz = null;
  room.turnState = 'WAIT_ACTION';
  syncRoom(room.code);

  if (player.isBot) {
    setTimeout(() => nextTurn(room), 1000);
  }
}

function upgradeProperty(room, player, tileId) {
  const tile = BOARD_TILES[tileId];
  const prop = room.properties[tileId];
  if (!tile || !prop || prop.ownerId !== player.id || !tile.upgradeCost) return;

  if (prop.isMortgaged) {
    logActivity(room, `⚠️ ${tile.name} sedang digadaikan! Tebus dulu sebelum membangun.`);
    return;
  }

  if (prop.level >= 3) {
    logActivity(room, `⚠️ ${tile.name} sudah mencapai Perumahan Elit (Maksimal)!`);
    return;
  }

  // Check if player has gajian upgrade right this turn
  if (!player.canUpgradeThisTurn) {
    logActivity(room, `⚠️ Bangunan hanya bisa dinaikkan saat gajian melewati START!`);
    return;
  }

  // Max 1 level per city per turn
  if (player.upgradedCitiesThisTurn && player.upgradedCitiesThisTurn.includes(tileId)) {
    logActivity(room, `⚠️ ${tile.name} sudah dinaikkan 1 tingkat di putaran gajian ini!`);
    return;
  }

  if (player.cash < tile.upgradeCost) {
    logActivity(room, `⚠️ Kas ${player.name} tidak cukup (Butuh Rp ${tile.upgradeCost.toLocaleString('id-ID')}).`);
    return;
  }

  player.cash -= tile.upgradeCost;
  prop.level++;
  player.upgradedCitiesThisTurn.push(tileId);

  logActivity(room, `🏗️ ${player.name} menaikkan bangunan di ${tile.name} menjadi ${BUILDING_NAMES[prop.level]}! Biaya: Rp ${tile.upgradeCost.toLocaleString('id-ID')}.`);

  syncRoom(room.code);
  if (player.isBot) {
    setTimeout(() => nextTurn(room), 1000);
  }
}

function executeTakeover(room, player, tileId) {
  const tile = BOARD_TILES[tileId];
  const prop = room.properties[tileId];
  if (!tile || !prop || prop.ownerId === player.id) return;

  const owner = room.players.find(p => p.id === prop.ownerId);
  if (!owner) return;

  // Verify safe conditions:
  if (prop.level === 3) {
    logActivity(room, `🛡️ ${tile.name} adalah Perumahan Elit dan AMAN dari ambil alih!`);
    return;
  }
  if (checkProvincialMonopoly(room, owner.id, tile.group)) {
    logActivity(room, `🛡️ ${tile.name} berada di provinsi yang dikuasai penuh (${tile.groupName}) dan AMAN dari ambil alih!`);
    return;
  }
  if (prop.isMortgaged) {
    logActivity(room, `🛡️ ${tile.name} sedang digadaikan dan AMAN dari ambil alih!`);
    return;
  }

  const totalValue = tile.price + (prop.level * (tile.upgradeCost || 0));
  const takeoverCost = totalValue * 2;

  if (player.cash < takeoverCost) {
    logActivity(room, `⚠️ Kas ${player.name} tidak cukup untuk ambil alih (Butuh Rp ${takeoverCost.toLocaleString('id-ID')}).`);
    return;
  }

  player.cash -= takeoverCost;
  owner.cash += takeoverCost;
  prop.ownerId = player.id;
  room.takeoverOffer = null;

  logActivity(room, `💥 AMBIL ALIH KOTA! ${player.name} resmi merebut ${tile.name} (${BUILDING_NAMES[prop.level]}) dari ${owner.name} seharga 2× nilai (Rp ${takeoverCost.toLocaleString('id-ID')})!`);
  syncRoom(room.code);

  if (player.isBot) {
    setTimeout(() => nextTurn(room), 1200);
  }
}

function mortgageProperty(room, player, tileId) {
  const tile = BOARD_TILES[tileId];
  const prop = room.properties[tileId];
  if (!tile || !prop || prop.ownerId !== player.id) return;

  if (prop.isMortgaged) {
    logActivity(room, `⚠️ ${tile.name} sudah dalam status gadai!`);
    return;
  }
  if (prop.level > 0) {
    logActivity(room, `⚠️ Hanya kota tanpa bangunan (Tanah Kavling) yang boleh digadaikan!`);
    return;
  }

  const mortgageValue = Math.round(tile.price * 0.5); // 50%
  prop.isMortgaged = true;
  player.cash += mortgageValue;

  logActivity(room, `🏦 ${player.name} menggadaikan ${tile.name} ke Negara seharga 50% (Rp ${mortgageValue.toLocaleString('id-ID')}). Sewa dinonaktifkan.`);
  syncRoom(room.code);
}

function redeemProperty(room, player, tileId) {
  const tile = BOARD_TILES[tileId];
  const prop = room.properties[tileId];
  if (!tile || !prop || prop.ownerId !== player.id) return;

  if (!prop.isMortgaged) {
    logActivity(room, `⚠️ ${tile.name} tidak sedang digadaikan.`);
    return;
  }

  const redeemCost = Math.round(tile.price * 0.6); // 60%
  if (player.cash < redeemCost) {
    logActivity(room, `⚠️ Kas tidak cukup untuk menebus gadai (Butuh Rp ${redeemCost.toLocaleString('id-ID')}).`);
    return;
  }

  player.cash -= redeemCost;
  prop.isMortgaged = false;

  logActivity(room, `🔓 ${player.name} menebus gadai ${tile.name} sebesar 60% (Rp ${redeemCost.toLocaleString('id-ID')}). Hak sewa aktif kembali.`);
  syncRoom(room.code);
}

// ----------------------------------------------------
// Client Message Dispatcher
// ----------------------------------------------------
function handleClientMessage(socket, data) {
  const { type, payload } = data;

  switch (type) {
    case 'CREATE_ROOM': {
      const { name, avatar, settings } = payload || {};
      const { room, hostId, token } = createRoom(name, avatar, settings);
      const player = room.players[0];
      player.ws = socket;
      socketPlayerMap.set(socket, { roomCode: room.code, playerId: hostId });

      sendWsFrame(socket, {
        type: 'ROOM_CREATED',
        roomCode: room.code,
        playerId: hostId,
        token,
        state: sanitizeRoomState(room)
      });
      break;
    }

    case 'JOIN_ROOM': {
      const { roomCode, name, avatar } = payload || {};
      const code = (roomCode || '').toUpperCase().trim();
      const room = rooms[code];

      if (!room) {
        sendWsFrame(socket, { type: 'ERROR', message: `Room dengan kode ${code} tidak ditemukan.` });
        return;
      }
      if (room.status !== 'lobby') {
        sendWsFrame(socket, { type: 'ERROR', message: 'Permainan di room ini sudah berlangsung.' });
        return;
      }
      if (room.players.length >= 10) {
        sendWsFrame(socket, { type: 'ERROR', message: 'Room sudah penuh (Maksimal 10 pemain)!' });
        return;
      }

      const usedAvatars = room.players.map(p => p.avatar);
      let chosenAvatar = avatar;
      if (usedAvatars.includes(chosenAvatar)) {
        const available = AVATARS.find(a => !usedAvatars.includes(a.id));
        chosenAvatar = available ? available.id : 'ojol';
      }

      const playerId = 'p_' + crypto.randomBytes(4).toString('hex');
      const token = generateToken();

      const newPlayer = {
        id: playerId,
        token,
        name: name || `Warga ${room.players.length + 1}`,
        avatar: chosenAvatar,
        isHost: false,
        isBot: false,
        isReady: false,
        cash: room.settings.startingCash,
        position: 0,
        inJail: false,
        jailTurns: 0,
        canUpgradeThisTurn: false,
        upgradedCitiesThisTurn: [],
        isBankrupt: false,
        isDisconnected: false,
        ws: socket
      };

      room.players.push(newPlayer);
      socketPlayerMap.set(socket, { roomCode: code, playerId });

      logActivity(room, `👋 ${newPlayer.name} bergabung ke dalam room!`);

      sendWsFrame(socket, {
        type: 'JOINED_SUCCESS',
        roomCode: code,
        playerId,
        token,
        state: sanitizeRoomState(room)
      });

      syncRoom(code);
      break;
    }

    case 'RECONNECT': {
      const { roomCode, token } = payload || {};
      const code = (roomCode || '').toUpperCase().trim();
      const room = rooms[code];

      if (!room) {
        sendWsFrame(socket, { type: 'RECONNECT_FAILED', message: 'Room sudah tidak aktif.' });
        return;
      }

      const player = room.players.find(p => p.token === token);
      if (!player) {
        sendWsFrame(socket, { type: 'RECONNECT_FAILED', message: 'Token sesi tidak valid.' });
        return;
      }

      player.ws = socket;
      player.isDisconnected = false;
      socketPlayerMap.set(socket, { roomCode: code, playerId: player.id });

      logActivity(room, `🔄 ${player.name} berhasil terhubung kembali.`);

      sendWsFrame(socket, {
        type: 'RECONNECT_SUCCESS',
        roomCode: code,
        playerId: player.id,
        token: player.token,
        state: sanitizeRoomState(room)
      });

      syncRoom(code);
      break;
    }

    case 'ADD_BOT': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'lobby' || room.hostId !== session.playerId) return;
      if (room.players.length >= 10) {
        sendWsFrame(socket, { type: 'ERROR', message: 'Kapasitas maksimal 10 pemain sudah tercapai.' });
        return;
      }

      const usedAvatars = room.players.map(p => p.avatar);
      const availableAvatar = AVATARS.find(a => !usedAvatars.includes(a.id)) || AVATARS[0];

      const botNum = room.players.filter(p => p.isBot).length + 1;
      const botNames = ['Bot Pak RT', 'Bot Bu Tejo', 'Bot Kang Bakso', 'Bot Mamat Ojol', 'Bot Mas Kuncoro', 'Bot Haji Lulung', 'Bot Cak Gito', 'Bot Bu Lurah', 'Bot Bang Jampang'];
      const botName = botNames[botNum - 1] || `Bot Warga ${botNum}`;

      const bot = {
        id: 'bot_' + crypto.randomBytes(4).toString('hex'),
        token: 'bot_' + crypto.randomBytes(8).toString('hex'),
        name: botName,
        avatar: availableAvatar.id,
        isHost: false,
        isBot: true,
        isReady: true,
        cash: room.settings.startingCash,
        position: 0,
        inJail: false,
        jailTurns: 0,
        canUpgradeThisTurn: false,
        upgradedCitiesThisTurn: [],
        isBankrupt: false,
        isDisconnected: false,
        ws: null
      };

      room.players.push(bot);
      logActivity(room, `🤖 ${bot.name} ditambahkan oleh Host.`);
      syncRoom(room.code);
      break;
    }

    case 'START_GAME': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'lobby' || room.hostId !== session.playerId) return;
      if (room.players.length < 2) {
        sendWsFrame(socket, { type: 'ERROR', message: 'Minimal butuh 2 pemain untuk memulai permainan!' });
        return;
      }

      room.status = 'playing';
      room.currentRound = 1;
      room.currentTurnIndex = 0;
      room.turnState = 'WAIT_ROLL';
      logActivity(room, `🚀 PERMAINAN ALAM NUSANTARA DIMULAI! Selamat berpetualang.`);

      syncRoom(room.code);
      startTurnTimer(room);

      const firstPlayer = getActivePlayer(room);
      if (firstPlayer.isBot) {
        handleBotTurn(room, firstPlayer);
      }
      break;
    }

    case 'ROLL_DICE': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const active = getActivePlayer(room);
      if (!active || active.id !== session.playerId) return;

      performDiceRoll(room, active);
      break;
    }

    case 'SUBMIT_QUIZ': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || !room.currentQuiz || room.currentQuiz.playerId !== session.playerId) return;

      const chosenIndex = payload?.answerIndex;
      resolveQuizAnswer(room, getActivePlayer(room), chosenIndex);
      break;
    }

    case 'BUY_PROPERTY': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const active = getActivePlayer(room);
      if (!active || active.id !== session.playerId) return;

      buyProperty(room, active, active.position);
      break;
    }

    case 'UPGRADE_PROPERTY': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const active = getActivePlayer(room);
      if (!active || active.id !== session.playerId) return;

      const tileId = payload?.tileId !== undefined ? payload.tileId : active.position;
      upgradeProperty(room, active, tileId);
      break;
    }

    case 'TAKEOVER_PROPERTY': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const active = getActivePlayer(room);
      if (!active || active.id !== session.playerId) return;

      const tileId = payload?.tileId !== undefined ? payload.tileId : active.position;
      executeTakeover(room, active, tileId);
      break;
    }

    case 'MORTGAGE_PROPERTY': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const player = room.players.find(p => p.id === session.playerId);
      if (!player) return;

      mortgageProperty(room, player, payload?.tileId);
      break;
    }

    case 'REDEEM_PROPERTY': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const player = room.players.find(p => p.id === session.playerId);
      if (!player) return;

      redeemProperty(room, player, payload?.tileId);
      break;
    }

    case 'TRANSFER_MONEY': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const sender = room.players.find(p => p.id === session.playerId);
      const recipient = room.players.find(p => p.id === payload?.targetPlayerId);
      const amount = Math.floor(Number(payload?.amount) || 0);

      if (sender && recipient && amount > 0 && sender.cash >= amount) {
        sender.cash -= amount;
        recipient.cash += amount;
        logActivity(room, `💸 ${sender.name} mentransfer Rp ${amount.toLocaleString('id-ID')} kepada ${recipient.name}.`);
        syncRoom(room.code);
      }
      break;
    }

    case 'REQUEST_MONEY': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const requester = room.players.find(p => p.id === session.playerId);
      const target = room.players.find(p => p.id === payload?.targetPlayerId);
      const amount = Math.floor(Number(payload?.amount) || 0);

      if (requester && target && amount > 0) {
        room.pendingMoneyRequest = {
          fromPlayerId: requester.id,
          fromPlayerName: requester.name,
          toPlayerId: target.id,
          toPlayerName: target.name,
          amount
        };
        logActivity(room, `📩 ${requester.name} meminta bantuan dana Rp ${amount.toLocaleString('id-ID')} kepada ${target.name}.`);
        syncRoom(room.code);
      }
      break;
    }

    case 'RESPOND_MONEY_REQUEST': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || !room.pendingMoneyRequest || room.pendingMoneyRequest.toPlayerId !== session.playerId) return;

      const { accept } = payload || {};
      const req = room.pendingMoneyRequest;
      const target = room.players.find(p => p.id === req.toPlayerId);
      const requester = room.players.find(p => p.id === req.fromPlayerId);

      if (accept && target && requester && target.cash >= req.amount) {
        target.cash -= req.amount;
        requester.cash += req.amount;
        logActivity(room, `🤝 ${target.name} MENYETUJUI permintaan dana Rp ${req.amount.toLocaleString('id-ID')} dari ${requester.name}!`);
      } else {
        logActivity(room, `✋ ${target ? target.name : 'Target'} MENOLAK permintaan dana dari ${requester ? requester.name : 'pemain'}.`);
      }
      room.pendingMoneyRequest = null;
      syncRoom(room.code);
      break;
    }

    case 'TRADE_PROPERTY': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;

      const p1 = room.players.find(p => p.id === session.playerId);
      const p2 = room.players.find(p => p.id === payload?.targetPlayerId);
      const tile1Id = payload?.giveTileId;
      const tile2Id = payload?.getTileId;
      const cashCompensation = Number(payload?.cashCompensation) || 0; // p1 pays p2 if > 0

      const prop1 = room.properties[tile1Id];
      const prop2 = room.properties[tile2Id];

      if (p1 && p2 && prop1 && prop2 && prop1.ownerId === p1.id && prop2.ownerId === p2.id) {
        // Swap ownership
        prop1.ownerId = p2.id;
        prop2.ownerId = p1.id;
        if (cashCompensation > 0 && p1.cash >= cashCompensation) {
          p1.cash -= cashCompensation;
          p2.cash += cashCompensation;
        }
        logActivity(room, `🔄 TUKAR TANAH! ${p1.name} dan ${p2.name} sepakat menukar aset ${BOARD_TILES[tile1Id].name} dan ${BOARD_TILES[tile2Id].name}!`);
        syncRoom(room.code);
      }
      break;
    }

    case 'END_TURN': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room || room.status !== 'playing') return;
      const active = getActivePlayer(room);
      if (!active || active.id !== session.playerId) return;

      nextTurn(room);
      break;
    }

    case 'SURRENDER': {
      const session = socketPlayerMap.get(socket);
      if (!session) return;
      const room = rooms[session.roomCode];
      if (!room) return;
      const player = room.players.find(p => p.id === session.playerId);
      if (player && !player.isBankrupt) {
        logActivity(room, `🏳️ ${player.name} menyerah dari permainan.`);
        handleBankruptcy(room, player, null);
        if (getActivePlayer(room)?.id === player.id) {
          nextTurn(room);
        } else {
          syncRoom(room.code);
        }
      }
      break;
    }

    default:
      break;
  }
}

function handleSocketDisconnect(socket) {
  const session = socketPlayerMap.get(socket);
  if (!session) return;

  const room = rooms[session.roomCode];
  if (!room) return;

  const player = room.players.find(p => p.id === session.playerId);
  if (!player) return;

  player.isDisconnected = true;
  player.ws = null;
  socketPlayerMap.delete(socket);

  logActivity(room, `🔌 ${player.name} terputus koneksinya.`);
  syncRoom(room.code);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Wargaopoly Alam Nusantara 3D Aktif di http://localhost:${PORT}`);
  console.log(`🎮 Board Game Edukasi 3D Alam & 7 Provinsi Nusantara`);
  console.log(`=======================================================`);
});
