// board_ui.js - World Monopoly 3D Engine (Three.js WebGL & 3D Biomes Environment)

class BoardUI {
  constructor(containerId) {
    this.domContainer = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.tiles3D = [];
    this.pawns3D = {};
    this.buildings3D = {};
    this.diceMeshes = [];
    this.is3DMode = true;
    this.highlightedPlayerId = null;
    this.animatingDice = false;

    this.init();
  }

  init() {
    if (!this.domContainer) return;
    this.domContainer.innerHTML = '';
    this.domContainer.style.position = 'relative';

    const width = this.domContainer.clientWidth || 860;
    const height = this.domContainer.clientHeight || 860;

    // 1. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbbe7fe); // Bright clear sky
    this.scene.fog = new THREE.FogExp2(0xbbe7fe, 0.015);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.setCamera3D();

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.domContainer.appendChild(this.renderer.domElement);

    // 3. Lighting (Sunlight + Ambient Skylight)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x86efac, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    sunLight.position.set(30, 60, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    this.scene.add(sunLight);

    // 4. Build 3D World Biomes Environment
    this.createWorldBiomes();

    // 5. Build 3D Board Track & Country Tiles
    this.create3DBoardTrack();

    // 6. Build 3D Tumbling Dice
    this.create3DDice();

    // 7. Raycaster for tile clicking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.renderer.domElement.addEventListener('click', (e) => this.onBoardClick(e));

    // Handle Window Resize
    window.addEventListener('resize', () => {
      if (!this.domContainer) return;
      const w = this.domContainer.clientWidth || 860;
      const h = this.domContainer.clientHeight || 860;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    // Start 60fps Animation Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  setCamera3D() {
    this.camera.position.set(0, 48, 52);
    this.camera.lookAt(0, 0, 0);
  }

  setCamera2D() {
    this.camera.position.set(0, 75, 0.1);
    this.camera.lookAt(0, 0, 0);
  }

  toggleCameraView() {
    this.is3DMode = !this.is3DMode;
    if (this.is3DMode) {
      this.setCamera3D();
    } else {
      this.setCamera2D();
    }
    return this.is3DMode;
  }

  // ----------------------------------------------------
  // 3D WORLD BIOMES ENVIRONMENT
  // ----------------------------------------------------
  createWorldBiomes() {
    this.biomesGroup = new THREE.Group();

    // Main Ocean Base Plane
    const oceanGeo = new THREE.PlaneGeometry(240, 240);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.1
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -2;
    ocean.receiveShadow = true;
    this.biomesGroup.add(ocean);

    // 1. Bioma Kepulauan Tropis (Kiri Bawah)
    const islandGeo = new THREE.CylinderGeometry(18, 22, 3, 16);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.8 });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(-36, -0.5, 36);
    island.receiveShadow = true;
    this.biomesGroup.add(island);
    this.addPalmTree(-36, 1, 36);
    this.addPalmTree(-32, 1, 40);

    // 2. Bioma Gurun & Piramida Mesir (Kiri Atas)
    const desertGeo = new THREE.CylinderGeometry(20, 24, 3, 16);
    const desertMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.9 });
    const desert = new THREE.Mesh(desertGeo, desertMat);
    desert.position.set(-36, -0.5, -36);
    desert.receiveShadow = true;
    this.biomesGroup.add(desert);
    // 3D Pyramid
    const pyrGeo = new THREE.ConeGeometry(7, 6, 4);
    const pyrMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const pyramid = new THREE.Mesh(pyrGeo, pyrMat);
    pyramid.position.set(-36, 4, -36);
    pyramid.rotation.y = Math.PI / 4;
    pyramid.castShadow = true;
    this.biomesGroup.add(pyramid);

    // 3. Bioma Pegunungan Salju & Taiga (Kanan Atas)
    const snowGeo = new THREE.CylinderGeometry(20, 24, 3, 16);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
    const snowMountain = new THREE.Mesh(snowGeo, snowMat);
    snowMountain.position.set(36, -0.5, -36);
    snowMountain.receiveShadow = true;
    this.biomesGroup.add(snowMountain);
    this.addSnowPeak(36, 1, -36);
    this.addPineTree(32, 1, -32);
    this.addPineTree(40, 1, -34);

    // 4. Bioma Savana & Hutan Tropis (Kanan Bawah)
    const savannaGeo = new THREE.CylinderGeometry(18, 22, 3, 16);
    const savannaMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8 });
    const savanna = new THREE.Mesh(savannaGeo, savannaMat);
    savanna.position.set(36, -0.5, 36);
    savanna.receiveShadow = true;
    this.biomesGroup.add(savanna);
    this.addCanopyTree(36, 1, 36);
    this.addCanopyTree(34, 1, 40);

    // 5. Procedural 3D Fluffy Clouds
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      const cloud = this.createCloud();
      cloud.position.set((Math.random() - 0.5) * 80, 25 + Math.random() * 8, (Math.random() - 0.5) * 80);
      this.biomesGroup.add(cloud);
      this.clouds.push(cloud);
    }

    this.scene.add(this.biomesGroup);
  }

  addPalmTree(x, y, z) {
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, y + 2, z);
    trunk.castShadow = true;

    const leavesGeo = new THREE.ConeGeometry(2.5, 1.2, 7);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, y + 4, z);
    leaves.castShadow = true;

    this.biomesGroup.add(trunk);
    this.biomesGroup.add(leaves);
  }

  addPineTree(x, y, z) {
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, y + 1, z);

    const foliageGeo = new THREE.ConeGeometry(2, 4, 6);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x166534 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(x, y + 3, z);
    foliage.castShadow = true;

    this.biomesGroup.add(trunk);
    this.biomesGroup.add(foliage);
  }

  addSnowPeak(x, y, z) {
    const peakGeo = new THREE.ConeGeometry(6, 9, 5);
    const peakMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const peak = new THREE.Mesh(peakGeo, peakMat);
    peak.position.set(x, y + 4.5, z);
    peak.castShadow = true;
    this.biomesGroup.add(peak);
  }

  addCanopyTree(x, y, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 3),
      new THREE.MeshStandardMaterial({ color: 0x78350f })
    );
    trunk.position.set(x, y + 1.5, z);

    const canopy = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2),
      new THREE.MeshStandardMaterial({ color: 0x16a34a })
    );
    canopy.position.set(x, y + 3.5, z);
    canopy.castShadow = true;

    this.biomesGroup.add(trunk);
    this.biomesGroup.add(canopy);
  }

  createCloud() {
    const cloud = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, transparent: true, opacity: 0.88 });
    const sphere1 = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), mat);
    const sphere2 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), mat);
    const sphere3 = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), mat);
    sphere2.position.set(2.5, 0, 0);
    sphere3.position.set(-2.5, 0, 0);
    cloud.add(sphere1);
    cloud.add(sphere2);
    cloud.add(sphere3);
    return cloud;
  }

  // ----------------------------------------------------
  // 3D BOARD TRACK (24 TILES AROUND WORLD)
  // ----------------------------------------------------
  create3DBoardTrack() {
    this.boardGroup = new THREE.Group();

    // Central Island Board Base (Wooden Rim + Marble Top)
    const baseGeo = new THREE.BoxGeometry(45, 2, 45);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const boardBase = new THREE.Mesh(baseGeo, baseMat);
    boardBase.position.y = 0;
    boardBase.receiveShadow = true;
    this.boardGroup.add(boardBase);

    // Inner World Map Display Canvas
    const innerCanvas = document.createElement('canvas');
    innerCanvas.width = 512;
    innerCanvas.height = 512;
    const ctx = innerCanvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WORLD MONOPOLY 3D', 256, 180);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Perjalanan Mengelilingi Dunia', 256, 220);
    ctx.fillText('🌍 ✈️ 🏰 🏨 🏠', 256, 270);

    const innerTex = new THREE.CanvasTexture(innerCanvas);
    const innerMat = new THREE.MeshBasicMaterial({ map: innerTex });
    const innerMesh = new THREE.Mesh(new THREE.PlaneGeometry(31, 31), innerMat);
    innerMesh.rotation.x = -Math.PI / 2;
    innerMesh.position.y = 1.05;
    this.boardGroup.add(innerMesh);

    // Calculate 24 Tile coordinates in a perimeter square (7 per side)
    const tileSize = 5.8;
    const half = 17.5;
    const coords = [];

    // Bottom side: right to left (0 to 6)
    for (let c = 6; c >= 0; c--) {
      coords.push({ x: (c - 3) * tileSize, z: half });
    }
    // Left side: bottom to top (7 to 11)
    for (let r = 5; r >= 1; r--) {
      coords.push({ x: -half, z: (r - 3) * tileSize });
    }
    // Top side: left to right (12 to 18)
    for (let c = 0; c <= 6; c++) {
      coords.push({ x: (c - 3) * tileSize, z: -half });
    }
    // Right side: top to bottom (19 to 23)
    for (let r = 1; r <= 5; r++) {
      coords.push({ x: half, z: (r - 3) * tileSize });
    }

    // Build 24 3D Tile Meshes
    BOARD_TILES.forEach((tile, idx) => {
      const pos = coords[idx];
      const isCorner = idx === 0 || idx === 6 || idx === 12 || idx === 18;
      const w = isCorner ? tileSize * 1.05 : tileSize * 0.94;
      const d = isCorner ? tileSize * 1.05 : tileSize * 0.94;

      const tileGeo = new THREE.BoxGeometry(w, 1.2, d);

      // Create Canvas Texture for Tile Top Face
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = 256;
      tileCanvas.height = 256;
      const tCtx = tileCanvas.getContext('2d');

      // Background
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0, 0, 256, 256);

      // Color Banner for Country / Group
      if (tile.color) {
        tCtx.fillStyle = tile.color;
        tCtx.fillRect(0, 0, 256, 45);
      }

      // Border
      tCtx.strokeStyle = '#cbd5e1';
      tCtx.lineWidth = 10;
      tCtx.strokeRect(0, 0, 256, 256);

      // Icon & Name
      tCtx.font = '48px sans-serif';
      tCtx.textAlign = 'center';
      tCtx.fillText(tile.icon || '📍', 128, 100);

      tCtx.fillStyle = '#0f172a';
      tCtx.font = 'bold 22px sans-serif';
      tCtx.fillText(tile.name, 128, 145);

      // Price or Salary
      if (tile.price) {
        tCtx.fillStyle = '#059669';
        tCtx.font = 'bold 20px sans-serif';
        tCtx.fillText(`Rp ${tile.price / 1000}k`, 128, 185);
      } else if (tile.salary) {
        tCtx.fillStyle = '#0284c7';
        tCtx.font = 'bold 20px sans-serif';
        tCtx.fillText(`+Rp ${tile.salary / 1000}k`, 128, 185);
      }

      const tileTex = new THREE.CanvasTexture(tileCanvas);
      const materials = [
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }),
        new THREE.MeshStandardMaterial({ map: tileTex }), // top face
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
      ];

      const tileMesh = new THREE.Mesh(tileGeo, materials);
      tileMesh.position.set(pos.x, 1.2, pos.z);
      tileMesh.receiveShadow = true;
      tileMesh.castShadow = true;
      tileMesh.userData = { tileId: idx, tileData: tile };

      this.boardGroup.add(tileMesh);
      this.tiles3D[idx] = tileMesh;
    });

    this.scene.add(this.boardGroup);
  }

  // ----------------------------------------------------
  // 3D REALISTIC TUMBLING DICE
  // ----------------------------------------------------
  create3DDice() {
    this.diceGroup = new THREE.Group();
    const diceGeo = new THREE.BoxGeometry(2.8, 2.8, 2.8);

    // Create 6 face textures with classic dots
    const createPipTexture = (number, isRed = false) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, 128, 128);

      ctx.fillStyle = isRed ? '#ef4444' : '#0f172a';
      const drawDot = (x, y, r = 12) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };

      if (number === 1) drawDot(64, 64, 18);
      else if (number === 2) { drawDot(32, 32); drawDot(96, 96); }
      else if (number === 3) { drawDot(32, 32); drawDot(64, 64); drawDot(96, 96); }
      else if (number === 4) { drawDot(32, 32); drawDot(96, 32); drawDot(32, 96); drawDot(96, 96); }
      else if (number === 5) { drawDot(32, 32); drawDot(96, 32); drawDot(64, 64); drawDot(32, 96); drawDot(96, 96); }
      else if (number === 6) {
        drawDot(36, 28); drawDot(36, 64); drawDot(36, 100);
        drawDot(92, 28); drawDot(92, 64); drawDot(92, 100);
      }
      return new THREE.CanvasTexture(c);
    };

    const diceMats = [
      new THREE.MeshStandardMaterial({ map: createPipTexture(1, true) }),
      new THREE.MeshStandardMaterial({ map: createPipTexture(6) }),
      new THREE.MeshStandardMaterial({ map: createPipTexture(2) }),
      new THREE.MeshStandardMaterial({ map: createPipTexture(5) }),
      new THREE.MeshStandardMaterial({ map: createPipTexture(3) }),
      new THREE.MeshStandardMaterial({ map: createPipTexture(4) })
    ];

    const d1 = new THREE.Mesh(diceGeo, diceMats);
    d1.position.set(-2.5, 2.5, 0);
    d1.castShadow = true;
    this.diceGroup.add(d1);
    this.diceMeshes.push(d1);

    const d2 = new THREE.Mesh(diceGeo, diceMats);
    d2.position.set(2.5, 2.5, 0);
    d2.castShadow = true;
    this.diceGroup.add(d2);
    this.diceMeshes.push(d2);

    this.scene.add(this.diceGroup);
  }

  animateDiceRoll(val1, val2, callback) {
    if (this.animatingDice) return;
    this.animatingDice = true;

    if (window.soundEngine) {
      window.soundEngine.playDiceRoll();
    }

    const d1 = this.diceMeshes[0];
    const d2 = this.diceMeshes[1];
    let startTime = performance.now();
    const duration = 850;

    const rotMap = {
      1: { x: 0, y: Math.PI / 2, z: 0 },
      6: { x: 0, y: -Math.PI / 2, z: 0 },
      2: { x: -Math.PI / 2, y: 0, z: 0 },
      5: { x: Math.PI / 2, y: 0, z: 0 },
      3: { x: 0, y: 0, z: 0 },
      4: { x: 0, y: Math.PI, z: 0 }
    };

    const target1 = rotMap[val1 || 1] || rotMap[1];
    const target2 = rotMap[val2 || 1] || rotMap[1];

    const animateRoll = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        // High 3D parabolic bounce in air
        const height = Math.sin(progress * Math.PI) * 12;
        d1.position.y = 2.5 + height;
        d2.position.y = 2.5 + height;

        d1.rotation.x += 0.45;
        d1.rotation.y += 0.55;
        d2.rotation.x += 0.5;
        d2.rotation.z += 0.4;

        requestAnimationFrame(animateRoll);
      } else {
        d1.position.y = 2.5;
        d2.position.y = 2.5;
        d1.rotation.set(target1.x, target1.y, target1.z);
        d2.rotation.set(target2.x, target2.y, target2.z);
        this.animatingDice = false;

        const sumEl = document.getElementById('dice-sum-display');
        if (sumEl) sumEl.textContent = `Hasil Dadu 3D: ${val1} + ${val2} = ${val1 + val2}`;

        if (callback) callback();
      }
    };

    requestAnimationFrame(animateRoll);
  }

  // ----------------------------------------------------
  // 10 3D WORLD CULTURE CHARACTER PAWNS
  // ----------------------------------------------------
  updatePawns(players, activePlayerId) {
    if (!players) return;

    players.forEach((player, idx) => {
      if (player.isBankrupt) {
        if (this.pawns3D[player.id]) {
          this.scene.remove(this.pawns3D[player.id]);
          delete this.pawns3D[player.id];
        }
        return;
      }

      let pawn = this.pawns3D[player.id];
      if (!pawn) {
        pawn = this.createCharacter3D(player.avatar);
        this.pawns3D[player.id] = pawn;
        this.scene.add(pawn);
      }

      // Target Tile Position
      const tileId = player.position % BOARD_TILES.length;
      const tileMesh = this.tiles3D[tileId];
      if (tileMesh) {
        // Offset multiple pawns cleanly on same tile
        const slotOffset = (idx % 4) * 1.1 - 1.6;
        const targetX = tileMesh.position.x + slotOffset;
        const targetZ = tileMesh.position.z + (idx > 3 ? 1.2 : -1.2);

        // Smooth hop movement
        pawn.position.x += (targetX - pawn.position.x) * 0.25;
        pawn.position.z += (targetZ - pawn.position.z) * 0.25;
        pawn.position.y = 2.2;

        const isActive = player.id === activePlayerId;
        pawn.scale.setScalar(isActive ? 1.3 : 1.0);
      }
    });
  }

  createCharacter3D(avatarId) {
    const avatar = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
    const group = new THREE.Group();

    // 1. Cylinder Base / Stand with culture color
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.0, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: avatar.color, metalness: 0.3, roughness: 0.4 })
    );
    stand.castShadow = true;
    group.add(stand);

    // 2. Body / Cultural Tunic
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 1.4, 12),
      new THREE.MeshStandardMaterial({ color: avatar.color, roughness: 0.5 })
    );
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // 3. Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 })
    );
    head.position.y = 1.9;
    head.castShadow = true;
    group.add(head);

    // 4. Cultural Hat / Headdress
    let hat = null;
    if (avatarId === 'id_batik') {
      hat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.8), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    } else if (avatarId === 'eg_pharaoh') {
      hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 4), new THREE.MeshStandardMaterial({ color: 0xeab308 }));
    } else if (avatarId === 'mx_charro') {
      hat = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.3, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    } else if (avatarId === 'no_bunad') {
      hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
    } else {
      hat = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 12), new THREE.MeshStandardMaterial({ color: avatar.color }));
    }
    hat.position.y = 2.4;
    hat.castShadow = true;
    group.add(hat);

    return group;
  }

  // ----------------------------------------------------
  // 3D DISTINCT PROPERTY BUILDINGS (Rumah, Hotel, Mansion)
  // ----------------------------------------------------
  updateProperties(properties, players, activePlayerId) {
    if (!properties) return;

    for (let i = 0; i < BOARD_TILES.length; i++) {
      const tileMesh = this.tiles3D[i];
      if (!tileMesh) continue;

      const prop = properties[i];
      const existingBldg = this.buildings3D[i];

      if (prop && prop.level > 0 && !prop.isMortgaged) {
        const owner = players.find(p => p.id === prop.ownerId);
        const ownerAvatar = AVATARS.find(a => a.id === owner?.avatar) || AVATARS[0];

        // Recreate building mesh if level changed
        if (!existingBldg || existingBldg.userData.level !== prop.level || existingBldg.userData.ownerId !== prop.ownerId) {
          if (existingBldg) this.scene.remove(existingBldg);

          const bldg = this.createBuilding3D(prop.level, ownerAvatar.color);
          bldg.position.set(tileMesh.position.x, 2.0, tileMesh.position.z);
          bldg.userData = { level: prop.level, ownerId: prop.ownerId };
          this.scene.add(bldg);
          this.buildings3D[i] = bldg;
        }
      } else {
        if (existingBldg) {
          this.scene.remove(existingBldg);
          delete this.buildings3D[i];
        }
      }
    }
  }

  createBuilding3D(level, roofColorHex) {
    const group = new THREE.Group();
    const roofColor = new THREE.Color(roofColorHex || 0xef4444);

    if (level === 1) {
      // LEVEL 1: RUMAH BIASA 3D (Cozy single-floor low-poly house)
      const walls = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.2, 1.8),
        new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.7 })
      );
      walls.castShadow = true;

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 1.2, 4),
        new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.4 })
      );
      roof.position.y = 1.2;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;

      group.add(walls);
      group.add(roof);

    } else if (level === 2) {
      // LEVEL 2: HOTEL 3D (Tall multi-story hotel with balconies)
      const hotelBody = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 3.2, 2.0),
        new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.4, metalness: 0.1 })
      );
      hotelBody.position.y = 0.8;
      hotelBody.castShadow = true;

      const topRoof = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.5, 2.2),
        new THREE.MeshStandardMaterial({ color: roofColor, metalness: 0.3 })
      );
      topRoof.position.y = 2.6;
      topRoof.castShadow = true;

      group.add(hotelBody);
      group.add(topRoof);

    } else if (level === 3) {
      // LEVEL 3: MANSION MEWAH 3D (Luxurious palace with golden dome & pillars)
      const mainHall = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 2.2, 2.4),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
      );
      mainHall.position.y = 0.4;
      mainHall.castShadow = true;

      // Golden Dome / Gilded Roof
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 })
      );
      dome.position.y = 1.5;
      dome.castShadow = true;

      // Side Wings
      const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 1.6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      wingLeft.position.set(-1.6, 0, 0);
      const wingRight = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 1.6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      wingRight.position.set(1.6, 0, 0);

      group.add(mainHall);
      group.add(dome);
      group.add(wingLeft);
      group.add(wingRight);
    }

    return group;
  }

  onBoardClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tiles3D);

    if (intersects.length > 0) {
      const tileId = intersects[0].object.userData.tileId;
      if (tileId !== undefined) {
        this.selectTile(tileId);
      }
    }
  }

  selectTile(tileId) {
    const tile = BOARD_TILES[tileId];
    if (!tile) return;

    const iconEl = document.getElementById('ct-icon');
    const nameEl = document.getElementById('ct-name');
    const descEl = document.getElementById('ct-desc');
    const statsEl = document.getElementById('ct-stats');

    if (iconEl) iconEl.textContent = tile.icon;
    if (nameEl) nameEl.textContent = tile.name;

    const prop = window.gameState.room?.properties[tileId];
    let stats = '';
    let desc = tile.desc || '';

    if (tile.type === 'property') {
      const owner = prop ? window.gameState.room.players.find(p => p.id === prop.ownerId) : null;
      if (owner) {
        let currentRent = tile.baseRent;
        if (prop.level === 1) currentRent = tile.rentL1;
        if (prop.level === 2) currentRent = tile.rentL2;
        if (prop.level === 3) currentRent = tile.rentL3;

        let statusText = prop.isMortgaged ? '<strong style="color: #ef4444;">[TERGADAIKAN]</strong>' : `Sewa: <strong>Rp ${currentRent.toLocaleString('id-ID')}</strong>`;
        let safeBadge = prop.level === 3 ? '🛡️ Kebal Ambil Alih (Mansion)' : '⚔️ Rentan Ambil Alih';

        desc = `Pemilik: <strong>${owner.name}</strong> (${BUILDING_NAMES[prop.level]}) • ${safeBadge}`;
        stats = `${statusText} | Biaya Bangun: Rp ${tile.upgradeCost.toLocaleString('id-ID')}`;
      } else {
        desc = `Kawasan: <strong>${tile.groupName}</strong>. Landmark: <strong>${tile.landmark}</strong>.`;
        stats = `Harga Tanah: <strong>Rp ${tile.price.toLocaleString('id-ID')}</strong> | Sewa Dasar: Rp ${tile.baseRent.toLocaleString('id-ID')}`;
      }
    }

    if (descEl) descEl.innerHTML = desc;
    if (statsEl) statsEl.innerHTML = stats;
  }

  highlightPlayerCities(playerId) {
    this.highlightedPlayerId = (this.highlightedPlayerId === playerId) ? null : playerId;
    // Visually pulse selected player's buildings or tiles
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    // Rotate and drift clouds slowly across the world
    if (this.clouds) {
      this.clouds.forEach(c => {
        c.position.x += 1.5 * delta;
        if (c.position.x > 50) c.position.x = -50;
      });
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.BoardUI = BoardUI;
