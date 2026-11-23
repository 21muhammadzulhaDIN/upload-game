// test_game.js - Automated QA Test Suite for Wargaopoly 62
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3001;
process.env.PORT = PORT;

console.log('--- QA AUDIT TEST SUITE: WARGAOPOLY 62 ---');

// Start server child process
const electronExe = process.env.LOCALAPPDATA + '\\Programs\\Antigravity IDE\\Antigravity IDE.exe';
const serverProc = spawn(electronExe, [path.join(__dirname, 'server.js')], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: '3001' },
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverOutput = '';
serverProc.stdout.on('data', d => serverOutput += d.toString());
serverProc.stderr.on('data', d => console.error('Server err:', d.toString()));

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runTests() {
  await wait(1500); // Wait for server to boot

  try {
    // 1. Test HTTP /api/info
    console.log('1. Testing HTTP /api/info...');
    const apiRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${PORT}/api/info`, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });

    if (apiRes.status !== 200 || apiRes.body.status !== 'ok') {
      throw new Error(`API Info failed: ${JSON.stringify(apiRes)}`);
    }
    console.log('   ✅ HTTP /api/info passed (200 OK)');

    // 2. Test HTTP /index.html
    console.log('2. Testing HTTP /index.html...');
    const htmlRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${PORT}/index.html`, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, length: body.length }));
      }).on('error', reject);
    });

    if (htmlRes.status !== 200 || htmlRes.length < 500) {
      throw new Error(`HTML response failed: ${JSON.stringify(htmlRes)}`);
    }
    console.log(`   ✅ HTTP /index.html passed (${htmlRes.length} bytes)`);

    // 3. Test Native WebSocket Connection and Protocol Handshake
    console.log('3. Testing WebSocket Protocol Handshake & Room Creation...');
    const wsKey = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      port: PORT,
      host: 'localhost',
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Key': wsKey,
        'Sec-WebSocket-Version': '13'
      }
    });

    const socket = await new Promise((resolve, reject) => {
      req.on('upgrade', (res, socket, head) => resolve(socket));
      req.on('error', reject);
      req.end();
    });

    console.log('   ✅ WebSocket Upgrade Handshake 101 Switching Protocols passed');

    // Helper to send frame
    function sendFrame(payload) {
      const buf = Buffer.from(JSON.stringify(payload));
      const len = buf.length;
      const mask = crypto.randomBytes(4);
      const masked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) masked[i] = buf[i] ^ mask[i % 4];

      let header;
      if (len <= 125) {
        header = Buffer.alloc(6);
        header[0] = 0x81; // FIN + text
        header[1] = 0x80 | len; // Masked + len
        mask.copy(header, 2);
      } else {
        header = Buffer.alloc(8);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(len, 2);
        mask.copy(header, 4);
      }
      socket.write(Buffer.concat([header, masked]));
    }

    // Helper to receive message
    function receiveMessage() {
      return new Promise((resolve) => {
        socket.once('data', (chunk) => {
          // simple unmask/decode text frame
          const second = chunk[1];
          let len = second & 0x7f;
          let offset = 2;
          if (len === 126) {
            len = chunk.readUInt16BE(2);
            offset = 4;
          }
          const text = chunk.subarray(offset, offset + len).toString('utf8');
          try {
            resolve(JSON.parse(text));
          } catch(e) {
            resolve({ raw: text });
          }
        });
      });
    }

    // 4. Create Room
    console.log('4. Testing CREATE_ROOM message...');
    sendFrame({
      type: 'CREATE_ROOM',
      payload: { name: 'Host Pak RW', avatar: 'ojol' }
    });

    const createdMsg = await receiveMessage();
    if (createdMsg.type !== 'ROOM_CREATED' || !createdMsg.roomCode) {
      throw new Error(`Create room failed: ${JSON.stringify(createdMsg)}`);
    }
    console.log(`   ✅ Room created with code: ${createdMsg.roomCode}`);

    // 5. Add 9 Bot Warga to reach 10 Players
    console.log('5. Adding 9 Bot Warga to reach full 10 players...');
    for (let i = 1; i <= 9; i++) {
      sendFrame({ type: 'ADD_BOT' });
      await receiveMessage(); // ROOM_SYNC
    }

    sendFrame({ type: 'START_GAME' });
    const startedSync = await receiveMessage();
    if (startedSync.state.status !== 'playing' || startedSync.state.players.length !== 10) {
      throw new Error(`Start game failed: ${JSON.stringify(startedSync.state)}`);
    }
    console.log(`   ✅ Game successfully started with all 10 players in Room ${createdMsg.roomCode}!`);

    // Clean up
    socket.destroy();
    serverProc.kill();
    console.log('--- ALL QA AUDIT TESTS PASSED WITH 100% SUCCESS ---');
    process.exit(0);
  } catch (err) {
    console.error('❌ QA Test Failure:', err.message);
    serverProc.kill();
    process.exit(1);
  }
}

runTests();
