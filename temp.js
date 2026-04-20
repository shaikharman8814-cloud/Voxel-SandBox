
    import * as THREE from "three";
    import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
    import * as CANNON from "cannon-es";

    // --- Audio Engine (Synthetic Sounds) ---
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playThud(vol = 0.2) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(100, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    }
    
    function playStep() {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(150 + Math.random()*50, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 800;
      osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    }
    
    function updateHealthUI() {
       let str = "";
       for(let i=0; i<10; i++) str += i < health ? "❤️" : "🖤";
       document.getElementById("healthBar").innerHTML = str;
       if (health <= 0) {
          alert("YOU DIED! The simulation will now respawn you.");
          health = 10; hunger = 10;
          respawn(); updateHealthUI(); updateHungerUI();
       }
    }
    
    function updateHungerUI() {
       let str = "";
       for(let i=0; i<10; i++) str += i < Math.floor(hunger) ? "🍗" : "🦴";
       document.getElementById("hungerBar").innerHTML = str;
    }

    function playPlace() {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    }
    
    const windGain = audioCtx.createGain();
    windGain.gain.value = 0;
    const bufferSize = 2 * audioCtx.sampleRate, noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate), output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    const whiteNoise = audioCtx.createBufferSource(); whiteNoise.buffer = noiseBuffer; whiteNoise.loop = true;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 400;
    whiteNoise.connect(filter); filter.connect(windGain); windGain.connect(audioCtx.destination);
    whiteNoise.start();

    // --- Textures & Constants ---
    function createTexture(colorHex, type) {
      const canvas = document.createElement("canvas");
      canvas.width = 16; canvas.height = 16;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = colorHex;
      ctx.fillRect(0,0,16,16);
      for(let x=0; x<16; x++) for(let y=0; y<16; y++) {
        if (Math.random() > 0.5) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; ctx.fillRect(x,y,1,1); }
        else { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`; ctx.fillRect(x,y,1,1); }
      }
      if (type === "grass") {
        ctx.fillStyle = "#4daf4a"; ctx.fillRect(0,0,16,4);
        for(let i=0; i<16; i++) if (Math.random() > 0.3) ctx.fillRect(i,4,1,1+Math.floor(Math.random()*2));
      } else if (type === "glass") {
        ctx.clearRect(0,0,16,16); ctx.fillStyle = "rgba(173, 216, 230, 0.2)"; ctx.fillRect(0,0,16,16);
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(0,0,16,1); ctx.fillRect(0,0,1,16); ctx.fillRect(15,0,1,16); ctx.fillRect(0,15,16,1); ctx.fillRect(2,2,4,2);
      } else if (type === "water") {
        ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(0, 0, 16, 2);
      } else if (type === "tnt") {
        ctx.fillStyle = "#ff3333"; ctx.fillRect(0,0,16,16);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0,5,16,6);
        ctx.fillStyle = "#000"; ctx.font = "bold 6px monospace"; ctx.fillText("TNT", 1, 10);
      }
      const tex = new THREE.CanvasTexture(canvas); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      return tex;
    }

    const BLOCKS = [
      { id: 1, name: "Grass", map: createTexture("#8b5a2b", "grass"), color: 0xffffff },
      { id: 2, name: "Dirt", map: createTexture("#8b5a2b", "dirt"), color: 0xffffff },
      { id: 3, name: "Stone", map: createTexture("#666666", "stone"), color: 0xffffff },
      { id: 4, name: "Wood", map: createTexture("#4a3018", "wood"), color: 0xffffff },
      { id: 5, name: "Leaves", map: createTexture("#1e5c22", "leaves"), color: 0xffffff, transparent: true, opacity: 0.9 },
      { id: 6, name: "Planks", map: createTexture("#b08d6a", "planks"), color: 0xffffff },
      { id: 7, name: "Glass", map: createTexture("#add8e6", "glass"), color: 0xffffff, transparent: true, opacity: 1 },
      { id: 9, name: "Water", map: createTexture("#1ca3ec", "water"), color: 0xffffff, transparent: true, opacity: 0.7 },
      { id: 10, name: "TNT", map: createTexture("#ff3333", "tnt"), color: 0xffffff },
      { id: 8, name: "Physics Ball", color: 0xff3333, isPhysics: true }
    ];

    // --- Core Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.02); // Smooth Fog

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const controls = new PointerLockControls(camera, document.body);
    scene.add(controls.object);

    const world = new CANNON.World();
    world.gravity.set(0, -20, 0);

    // --- Player Physics ---
    const playerBody = new CANNON.Body({
      mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.3)),
      position: new CANNON.Vec3(0, 10, 0), fixedRotation: true, linearDamping: 0.9
    });
    world.addBody(playerBody);

    // Hand Swing (1P)
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
    hand.position.set(0.5, -0.3, -0.4);
    hand.rotation.y = -Math.PI / 8;
    hand.rotation.x = Math.PI / 12;
    camera.add(hand);
    
    // Flashlight
    const flashlight = new THREE.SpotLight(0xffffff, 0, 50, Math.PI/5, 0.5, 1);
    flashlight.position.set(0, 0, 0); flashlight.target.position.set(0, 0, -1);
    camera.add(flashlight); camera.add(flashlight.target);

    // --- Player Model ---
    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x00aaff });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0000aa });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
    head.position.set(0, 0.7, 0);
    playerGroup.add(head);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.3), shirtMat);
    torso.position.set(0, 0.2, 0);
    playerGroup.add(torso);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.45, 0.5, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), skinMat);
    leftArmMesh.position.y = -0.4;
    leftArmPivot.add(leftArmMesh);
    playerGroup.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.45, 0.5, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), skinMat);
    rightArmMesh.position.y = -0.4;
    rightArmPivot.add(rightArmMesh);
    playerGroup.add(rightArmPivot);

    const heldItem1P = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshStandardMaterial({ color: BLOCKS[0].color, map: BLOCKS[0].map || null }));
    heldItem1P.position.set(-0.05, 0.1, -0.3);
    hand.add(heldItem1P);
    
    const heldItem3P = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: BLOCKS[0].color, map: BLOCKS[0].map || null }));
    heldItem3P.position.set(0, -0.4, 0);
    rightArmMesh.add(heldItem3P);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.15, -0.1, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), pantsMat);
    leftLegMesh.position.y = -0.4;
    leftLegPivot.add(leftLegMesh);
    playerGroup.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.15, -0.1, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), pantsMat);
    rightLegMesh.position.y = -0.4;
    rightLegPivot.add(rightLegMesh);
    playerGroup.add(rightLegPivot);

    // --- Lighting (Day/Night) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    scene.add(sun);

    // --- Atmosphere & Effects ---
    const starsGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(500 * 3);
    for(let i=0; i<1500; i++) posArray[i] = (Math.random() - 0.5) * 400;
    starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMesh = new THREE.Points(starsGeo, new THREE.PointsMaterial({ size: 0.6, color: 0xffffff, transparent: true }));
    scene.add(starMesh);
    const outlineMesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    outlineMesh.visible = false;
    scene.add(outlineMesh);

    const clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 2, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, flatShading: true }), 30);
    const dummy = new THREE.Object3D();
    for(let i=0; i<30; i++) {
        dummy.position.set((Math.random()-0.5)*120, 35 + Math.random()*5, (Math.random()-0.5)*120);
        dummy.scale.set(1 + Math.random()*2, 1, 1 + Math.random()*2);
        dummy.updateMatrix();
        clouds.setMatrixAt(i, dummy.matrix);
    }
    scene.add(clouds);

    // --- Vehicle (Raycast Car) ---
    const carChassis = new CANNON.Body({ mass: 150, shape: new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)) });
    carChassis.position.set(5, 5, 5);
    world.addBody(carChassis);

    const carMesh = new THREE.Group();
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
    bodyMesh.castShadow = true;
    carMesh.add(bodyMesh);
    scene.add(carMesh);

    const wheels = [];
    for(let i=0; i<4; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      wheel.rotation.z = Math.PI/2;
      carMesh.add(wheel);
      wheels.push(wheel);
    }

    // --- Voxel Engine ---
    const worldData = new Map();
    const voxelGroup = new THREE.Group();
    scene.add(voxelGroup);
    const blockKey = (x, y, z) => `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;

    function generate() {
      for (let x=-30; x<30; x++) {
        for (let z=-30; z<30; z++) {
          const h = Math.floor(Math.sin(x*0.1)*2 + Math.cos(z*0.1)*2 + 5);
          for (let y=0; y<=h; y++) worldData.set(blockKey(x, y, z), y===h?1:(y>h-3?2:3));
          for (let y=1; y<=4; y++) if (!worldData.has(blockKey(x, y, z))) worldData.set(blockKey(x, y, z), 9);
          
          if (h > 4 && Math.random() < 0.02) {
             for(let ty=1; ty<=4; ty++) worldData.set(blockKey(x, h+ty, z), 4);
             for(let lx=-2; lx<=2; lx++) for(let lz=-2; lz<=2; lz++) for(let ly=3; ly<=5; ly++) {
                if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === 5) continue;
                if (!worldData.has(blockKey(x+lx, h+ly, z+lz))) worldData.set(blockKey(x+lx, h+ly, z+lz), 5);
             }
          }
        }
      }
    }

    function rebuild() {
      while(voxelGroup.children.length) {
        const c = voxelGroup.children[0];
        voxelGroup.remove(c); c.geometry.dispose(); c.material.dispose();
      }
      const typeMap = new Map();
      worldData.forEach((t, k) => { if(!typeMap.has(t)) typeMap.set(t, []); typeMap.get(t).push(k.split(",").map(Number)); });
      typeMap.forEach((blocks, id) => {
        const type = BLOCKS.find(t => t.id === id);
        const mat = new THREE.MeshStandardMaterial({ color: type.color, map: type.map || null, transparent: !!type.transparent, opacity: type.opacity || 1 });
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, blocks.length);
        const matrix = new THREE.Matrix4();
        blocks.forEach((b, i) => {
          matrix.makeTranslation(b[0]+0.5, b[1]+0.5, b[2]+0.5);
          // FAKE AO: Darken blocks that are lower
          mesh.setMatrixAt(i, matrix);
        });
        mesh.userData.blocks = blocks; voxelGroup.add(mesh);
      });
    }

    // Dynamic Physics Colliders
    const physicsBodies = new Map();
    function syncPhysics() {
      const p = isDriving ? carChassis.position : playerBody.position;
      const px=Math.floor(p.x), py=Math.floor(p.y), pz=Math.floor(p.z);
      const keys = new Set();
      for (let x=px-3; x<=px+3; x++) for (let y=py-3; y<=py+3; y++) for (let z=pz-3; z<=pz+3; z++) {
        const k = blockKey(x, y, z);
        if (worldData.has(k)) {
          keys.add(k);
          if (!physicsBodies.has(k)) {
            const b = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)) });
            b.position.set(x+0.5, y+0.5, z+0.5); world.addBody(b); physicsBodies.set(k, b);
          }
        }
      }
      physicsBodies.forEach((body, k) => { if(!keys.has(k)) { world.removeBody(body); physicsBodies.delete(k); } });
    }

    // --- State & Input ---
    let isDriving = false;
    let isThirdPerson = false;
    let swingTime = 0;
    let walkTime = 0;
    let fallVelocity = 0;
    let shakeTime = 0;
    let selectedIdx = 0;
    let currentCamZ = 0, currentCamY = 0;
    let lineStart = null;
    let dayTime = 0; // 0 to 1
    const input = { w: false, a: false, s: false, d: false, space: false, shift: false };
    const physicsObjects = [];
    const npcs = [];
    const zombies = [];
    const activeTNTs = [];
    let health = 10;
    let hunger = 10;
    let zombieTimer = 60; // 60s per prompt

    let miningTimer = null;
    let miningTarget = null;
    let miningMesh = null;

    let isFlying = false;
    let isUnderwater = false;
    let lastSpaceTime = 0;
    let canDoubleJump = false;
    const keys = {};
    document.addEventListener('keydown', (e) => {
      if (!controls.isLocked) return;
      keys[e.code] = true;
      if (e.code === 'Space' && !isDriving) {
        const now = performance.now();
        if (now - lastSpaceTime < 300) {
           isFlying = !isFlying;
           if (isFlying) {
             playerBody.velocity.y = 0;
             document.getElementById("status").innerHTML = "MODE: FLYING";
             document.getElementById("status").style.color = "#00ffff";
           } else {
             document.getElementById("status").innerHTML = "MODE: WALKING";
             document.getElementById("status").style.color = "#00ff88";
           }
        }
        lastSpaceTime = now;
        if (!isFlying) {
           if (Math.abs(playerBody.velocity.y) < 0.1 || isUnderwater) {
             playerBody.velocity.y = 8; canDoubleJump = true;
           } else if (canDoubleJump) {
             playerBody.velocity.y = 8; canDoubleJump = false; playThud(0.2);
           }
        }
      }
      if (e.code === 'KeyQ') {
         const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
         playerBody.velocity.x = forward.x * 25; playerBody.velocity.z = forward.z * 25;
         playThud(0.4); camera.fov += 15; camera.updateProjectionMatrix();
      }
      if (e.code === 'KeyE') {
         const inv = document.getElementById('inventoryUI');
         if (controls.isLocked) {
            controls.unlock();
            inv.style.display = 'flex';
         } else if (inv.style.display === 'flex') {
            inv.style.display = 'none';
            controls.lock();
         }
      }
      if (e.code === "KeyV") toggleVehicle();
      if (e.code === "KeyR") respawn();
      if (e.code === "KeyP") spawnNPC();
      if (e.code === "KeyC") isThirdPerson = !isThirdPerson;
      if (e.code === "KeyF") { 
        flashlight.intensity = flashlight.intensity === 0 ? 3 : 0; 
        playThud(0.1); 
        document.getElementById("status").innerHTML = flashlight.intensity > 0 ? "FLASHLIGHT: ON" : "FLASHLIGHT: OFF";
      } hand.visible = !isThirdPerson; 
      if (e.code.startsWith("Digit")) {
        let d = parseInt(e.code.replace("Digit", ""));
        if (d === 0) d = 10;
        d -= 1;
        if (d >= 0 && d < BLOCKS.length) {
          selectedIdx = d;
          document.querySelectorAll(".slot").forEach((s, i) => s.classList.toggle("active", i === d));
          const b = BLOCKS[d];
          heldItem1P.material.color.setHex(b.color); heldItem3P.material.color.setHex(b.color);
          heldItem1P.material.map = b.map || null; heldItem3P.material.map = b.map || null;
          heldItem1P.material.needsUpdate = true; heldItem3P.material.needsUpdate = true;
          heldItem1P.material.transparent = !!b.transparent; heldItem3P.material.transparent = !!b.transparent;
          heldItem1P.material.opacity = b.opacity || 1; heldItem3P.material.opacity = b.opacity || 1;
        }
      }
    });
    window.addEventListener("mouseup", e => {
       if (e.button === 0 && miningTimer) {
          clearTimeout(miningTimer); miningTimer = null; miningTarget = null;
          if (miningMesh) scene.remove(miningMesh);
       }
    });

    window.addEventListener("keyup", e => {
      keys[e.code] = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        input.shift = false; lineStart = null; document.getElementById("line-status").textContent = "OFF";
      }
    });

    const raycaster = new THREE.Raycaster();
    window.addEventListener("mousedown", e => {
      if (!controls.isLocked || isDriving) return;
      raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
      const hit = raycaster.intersectObjects(voxelGroup.children).find(i => i.distance < 8);
      
      if (hit) {
        playThud();
        swingTime = 0.2;
        const b = hit.object.userData.blocks[hit.instanceId];
        const n = hit.face.normal.clone().round();
        const target = [b[0] + n.x, b[1] + n.y, b[2] + n.z];
        
        if (e.button === 2 && worldData.get(blockKey(b[0], b[1], b[2])) === 10) { // Ignite TNT
            igniteTNT(b[0], b[1], b[2]);
            return;
        }

        if (e.button === 0) { // Destroy
          const deletedId = worldData.get(blockKey(b[0], b[1], b[2]));
          if (deletedId === 10) {
             igniteTNT(b[0], b[1], b[2]); // TNT is instant
          } else {
             miningTarget = [b[0], b[1], b[2]];
             const type = BLOCKS.find(t => t.id === deletedId);
             const duration = (type && type.id === 3) ? 800 : 250; // Stone takes longer
             
             miningMesh = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent:true, opacity:0.8 }));
             miningMesh.position.set(b[0]+0.5, b[1]+0.5, b[2]+0.5);
             scene.add(miningMesh);

             miningTimer = setTimeout(() => {
                if (miningTarget) {
                   worldData.delete(blockKey(miningTarget[0], miningTarget[1], miningTarget[2]));
                   if (type && type.id !== 9) {
                     for(let p=0; p<5; p++) {
                       const body = new CANNON.Body({ mass: 0.1, shape: new CANNON.Box(new CANNON.Vec3(0.1,0.1,0.1)), position: new CANNON.Vec3(b[0]+0.5+(Math.random()-0.5)*0.5, b[1]+0.5, b[2]+0.5+(Math.random()-0.5)*0.5) });
                       body.velocity.set((Math.random()-0.5)*5, Math.random()*5, (Math.random()-0.5)*5); world.addBody(body);
                       const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshStandardMaterial({ color: type.color, map: type.map||null }));
                       scene.add(mesh); physicsObjects.push({ body, mesh, isDebris: true, timer: 1.5 });
                     }
                     playThud(0.3);
                   }
                   rebuild();
                   if(miningMesh) scene.remove(miningMesh);
                   miningTarget = null;
                }
             }, duration);
          }
        } else if (e.button === 2) { // Place
          const type = BLOCKS[selectedIdx];
          if (type.isPhysics) {
             spawnPhysicsBall(b[0] + n.x + 0.5, b[1] + n.y + 1, b[2] + n.z + 0.5);
          } else if (input.shift) {
            if (!lineStart) {
              lineStart = target;
              document.getElementById("line-status").textContent = "POINT_A_SET";
            } else {
              fillLine(lineStart, target, type.id);
              lineStart = null;
              document.getElementById("line-status").textContent = "LINE_COMPLETE";
              rebuild();
            }
          } else {
            worldData.set(blockKey(...target), type.id);
            playPlace();
            rebuild();
          }
        }
      }
    });

    function fillLine(a, b, type) {
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
      const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
      const z1 = Math.min(a[2], b[2]), z2 = Math.max(a[2], b[2]);
      for(let x=x1; x<=x2; x++) for(let y=y1; y<=y2; y++) for(let z=z1; z<=z2; z++) worldData.set(blockKey(x,y,z), type);
    }

    function spawnPhysicsBall(x, y, z) {
      const body = new CANNON.Body({ mass: 5, shape: new CANNON.Sphere(0.4), position: new CANNON.Vec3(x, y, z) });
      world.addBody(body);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshStandardMaterial({ color: 0xff3333 }));
      scene.add(mesh);
      physicsObjects.push({ body, mesh });
    }

    function explode(cx, cy, cz) {
      playThud(1.0);
      for (let x = -5; x <= 5; x++) {
        for (let y = -5; y <= 5; y++) {
          for (let z = -5; z <= 5; z++) {
            if (x*x + y*y + z*z < 25) {
              const k = blockKey(cx+x, cy+y, cz+z);
              if (worldData.has(k)) {
                const typeId = worldData.get(k);
                worldData.delete(k);
                const tType = BLOCKS.find(t => t.id === typeId);
                if (tType && tType.id !== 9 && Math.random() > 0.7) {
                  const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.5,0.5,0.5)), position: new CANNON.Vec3(cx+x+0.5, cy+y+0.5, cz+z+0.5) });
                  body.velocity.set(x*2, y*2+5, z*2); world.addBody(body);
                  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ color: tType.color, map: tType.map||null }));
                  scene.add(mesh); physicsObjects.push({ body, mesh, isDebris: true, timer: 4 });
                }
              }
            }
          }
        }
      }
      rebuild();
      const pDist = Math.sqrt((playerBody.position.x - cx)**2 + (playerBody.position.y - cy)**2 + (playerBody.position.z - cz)**2);
      if (pDist < 10) {
         const force = 60 / Math.max(1, pDist);
         const dx = playerBody.position.x - cx; const dy = playerBody.position.y - cy; const dz = playerBody.position.z - cz;
         const vmag = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
         playerBody.velocity.x += (dx/vmag) * force;
         playerBody.velocity.y += (dy/vmag) * force + 8;
         playerBody.velocity.z += (dz/vmag) * force;
      }
    }
    
    function igniteTNT(x, y, z) {
       worldData.delete(blockKey(x, y, z));
       rebuild();
       const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
       mesh.position.set(x+0.5, y+0.5, z+0.5);
       scene.add(mesh);
       activeTNTs.push({ x, y, z, mesh, timer: 3.0 });
       playThud(0.5);
    }

    function spawnNPC() {
      const npcMat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
      const npcBody = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.3)), position: new CANNON.Vec3(playerBody.position.x, playerBody.position.y + 2, playerBody.position.z - 2), linearDamping: 0.9, fixedRotation: true });
      world.addBody(npcBody);
      const npcMesh = new THREE.Group();
      const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), npcMat);
      npcMesh.add(bodyM);
      scene.add(npcMesh);
      npcs.push({ body: npcBody, mesh: npcMesh, dir: new CANNON.Vec3(1,0,0), timer: 0 });
    };

    function toggleVehicle() {
      const dist = carChassis.position.distanceTo(playerBody.position);
      if (isDriving) {
        isDriving = false;
        playerBody.position.set(carChassis.position.x, carChassis.position.y + 2, carChassis.position.z);
        document.getElementById("mode").textContent = "WALKING";
        document.getElementById("v-status").textContent = "READY";
      } else if (dist < 4) {
        isDriving = true;
        document.getElementById("mode").textContent = "DRIVING";
        document.getElementById("v-status").textContent = "ACTIVE";
      }
    }

    function respawn() {
      playerBody.position.set(0, 15, 0); playerBody.velocity.set(0,0,0);
      carChassis.position.set(5, 5, 5); carChassis.velocity.set(0,0,0); carChassis.quaternion.set(0,0,0,1);
    }

    // --- Animation Loop ---
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      
      // Day/Night Cycle (10 min = 600s)
      if (controls.isLocked) dayTime += dt / 600;
      const angle = dayTime * Math.PI * 2;
      sun.position.set(Math.cos(angle)*100, Math.sin(angle)*100, 50);
      
      isUnderwater = worldData.get(blockKey(Math.floor(playerBody.position.x), Math.floor(playerBody.position.y+0.5), Math.floor(playerBody.position.z))) === 9;

      const timeOfDay = (dayTime*24)%24;
      const timeStr = `${Math.floor(timeOfDay).toString().padStart(2,'0')}:${Math.floor((dayTime*1440)%60).toString().padStart(2,'0')}`;
      document.getElementById("clock").textContent = timeStr;

      clouds.rotation.y += dt * 0.02;
      starMesh.rotation.y -= dt * 0.005;

      const cDay = new THREE.Color(0x87CEEB), cSun = new THREE.Color(0xffa07a), cNight = new THREE.Color(0x0a0a2a);
      let sCol = new THREE.Color();
      if (timeOfDay >= 6 && timeOfDay < 18) {
        let f = timeOfDay < 8 ? (timeOfDay-6)/2 : (timeOfDay > 16 ? 1 - (timeOfDay-16)/2 : 1);
        sCol.lerpColors(cSun, cDay, f); ambientLight.intensity = 0.5 + f*0.3; sun.intensity = f; starMesh.material.opacity = 1-f;
      } else {
        let f = timeOfDay < 6 ? timeOfDay/6 : (24-timeOfDay)/6;
        sCol.lerpColors(cNight, cSun, f); ambientLight.intensity = 0.2 + f*0.3; sun.intensity = 0; starMesh.material.opacity = 1;
      }
      if (isUnderwater) {
        scene.background = new THREE.Color(0x1ca3ec);
        scene.fog.color.setHex(0x1ca3ec);
        scene.fog.near = 1; scene.fog.far = 15;
      } else {
        scene.background = sCol; scene.fog.color = sCol;
        scene.fog.near = 20; scene.fog.far = 80;
      }

      if (controls.isLocked) {
        windGain.gain.setTargetAtTime(0.05, audioCtx.currentTime, 0.5);
        if (isDriving) {
          // Car Physics
          if (input.w) carChassis.applyLocalForce(new CANNON.Vec3(0, 0, -500), new CANNON.Vec3(0,0,0));
          if (input.s) carChassis.applyLocalForce(new CANNON.Vec3(0, 0, 300), new CANNON.Vec3(0,0,0));
          if (input.a) carChassis.angularVelocity.y = 2;
          else if (input.d) carChassis.angularVelocity.y = -2;
          else carChassis.angularVelocity.y *= 0.9;
          
          carMesh.position.copy(carChassis.position);
          carMesh.quaternion.copy(carChassis.quaternion);
          
          // 3rd Person Cam
          const camOffset = new THREE.Vector3(0, 3, 8).applyQuaternion(carMesh.quaternion);
          camera.position.copy(carMesh.position).add(camOffset);
          camera.lookAt(carMesh.position);

          playerGroup.visible = false;
          hand.visible = false;
        } else {
          playerGroup.visible = true;
          hand.visible = !isThirdPerson;

          if (isFlying) {
            playerBody.applyForce(new CANNON.Vec3(0, playerBody.mass * 20, 0), playerBody.position); 
            playerBody.velocity.y *= 0.9;
            if (keys['Space']) playerBody.velocity.y = 8;
            if (keys['ShiftLeft']) playerBody.velocity.y = -8;
          }
          
          if (isUnderwater) {
             playerBody.velocity.y *= 0.9; // floaty water
             if (keys['Space']) playerBody.velocity.y = 4; // swim up
          }

          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          forward.y = 0; forward.normalize();
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          right.y = 0; right.normalize();

          let moveX = 0, moveZ = 0;
          if (keys['KeyW']) { moveX += forward.x; moveZ += forward.z; }
          if (keys['KeyS']) { moveX -= forward.x; moveZ -= forward.z; }
          if (keys['KeyA']) { moveX -= right.x; moveZ -= right.z; }
          if (keys['KeyD']) { moveX += right.x; moveZ += right.z; }

          const mag = Math.sqrt(moveX*moveX + moveZ*moveZ);
          if (mag > 0) { moveX /= mag; moveZ /= mag; }
          
          let speedMulti = isUnderwater ? 4 : (isFlying ? 30 : 10);
          let targetFov = document.getElementById('fovSlider') ? parseFloat(document.getElementById('fovSlider').value) : 75;
          if (keys['ShiftLeft'] && !isFlying && !isUnderwater) { speedMulti = 16; targetFov += 10; } // Sprint
          
          camera.fov += (targetFov - camera.fov) * 0.1;
          camera.updateProjectionMatrix();

          playerBody.velocity.x = moveX * speedMulti;
          playerBody.velocity.z = moveZ * speedMulti;
          const isMoving = mag > 0;
          
          const inAir = Math.abs(playerBody.velocity.y) > 0.1 && !isUnderwater;
          
          // Falling Physics & Shake
          if (inAir && !isFlying) {
            fallVelocity = playerBody.velocity.y;
          } else if (fallVelocity < -15) {
            shakeTime = 0.3; playThud(1.0);
            const dmg = Math.floor(Math.abs(fallVelocity) - 12) / 2;
            if (dmg >= 1) { health -= dmg; updateHealthUI(); }
            fallVelocity = 0;
          } else if (fallVelocity < -10) {
            shakeTime = 0.3; playThud(0.8); fallVelocity = 0;
          } else {
            fallVelocity = 0;
          }
          
          if (isMoving && Math.random() < 0.005) {
             hunger = Math.max(0, hunger - 0.1); updateHungerUI();
             if (hunger === 0 && Math.random() < 0.05) { health -= 1; updateHealthUI(); }
          }

          camera.position.copy(playerBody.position);
          camera.position.y += 0.7; // head height
          
          const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
          playerGroup.rotation.y = euler.y;
          
          const targetCamZ = isThirdPerson ? 6 : 0;
          const targetCamY = isThirdPerson ? 1 : 0;
          currentCamZ = THREE.MathUtils.lerp(currentCamZ, targetCamZ, 0.1);
          currentCamY = THREE.MathUtils.lerp(currentCamY, targetCamY, 0.1);

          camera.translateZ(currentCamZ);
          camera.position.y += currentCamY;
          head.visible = currentCamZ > 1;

          // Screen Shake
          if (shakeTime > 0) {
            shakeTime -= dt;
            const shake = shakeTime * 2;
            camera.position.x += (Math.random() - 0.5) * shake;
            camera.position.y += (Math.random() - 0.5) * shake;
            camera.position.z += (Math.random() - 0.5) * shake;
          }

          // Animations
          const speed = isMoving ? 1 : 0;
          if (speed > 0) {
            const oldPhase = Math.floor(walkTime / Math.PI);
            walkTime += dt * 10;
            if (Math.floor(walkTime / Math.PI) > oldPhase && !inAir) playStep();
          }
          
          if (inAir) {
             leftLegPivot.rotation.x = -0.2;
             rightLegPivot.rotation.x = -0.2;
             leftArmPivot.rotation.z = 0.2;
             rightArmPivot.rotation.z = -0.2;
          } else {
             leftLegPivot.rotation.x = speed > 0 ? -Math.sin(walkTime) * 0.5 : THREE.MathUtils.lerp(leftLegPivot.rotation.x, 0, 0.1);
             rightLegPivot.rotation.x = speed > 0 ? Math.sin(walkTime) * 0.5 : THREE.MathUtils.lerp(rightLegPivot.rotation.x, 0, 0.1);
             leftArmPivot.rotation.z = THREE.MathUtils.lerp(leftArmPivot.rotation.z, 0, 0.1);
             rightArmPivot.rotation.z = THREE.MathUtils.lerp(rightArmPivot.rotation.z, 0, 0.1);
          }

          if (swingTime > 0) {
            swingTime -= dt;
            const t = Math.max(0, swingTime / 0.2);
            rightArmPivot.rotation.x = -Math.PI / 2 * t;
            hand.rotation.x = -0.6 * t;
          } else {
            hand.rotation.x = 0;
            if (inAir) {
               rightArmPivot.rotation.x = -0.2;
               leftArmPivot.rotation.x = 0.2;
            } else {
               rightArmPivot.rotation.x = speed > 0 ? Math.sin(walkTime) * 0.5 : THREE.MathUtils.lerp(rightArmPivot.rotation.x, 0, 0.1);
               leftArmPivot.rotation.x = speed > 0 ? -Math.sin(walkTime) * 0.5 : THREE.MathUtils.lerp(leftArmPivot.rotation.x, 0, 0.1);
            }
          }

          const distToCar = playerBody.position.distanceTo(carChassis.position);
          document.getElementById("vehicle-hint").style.opacity = distToCar < 4 ? 1 : 0;
        }

        // Raycast for Outline
        raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
        const hit = raycaster.intersectObjects(voxelGroup.children).find(i => i.distance < 8);
        if (hit && !isDriving) {
          const b = hit.object.userData.blocks[hit.instanceId];
          outlineMesh.position.set(b[0] + 0.5, b[1] + 0.5, b[2] + 0.5);
          outlineMesh.visible = true;
        } else {
          outlineMesh.visible = false;
        }
        
        syncPhysics();
        world.step(1/60);
      } else {
        windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
      }

      zombieTimer -= dt;
      if (zombieTimer <= 0) {
         zombieTimer = 30;
         const angle = Math.random() * Math.PI * 2;
         const zx = playerBody.position.x + Math.cos(angle) * 20;
         const zz = playerBody.position.z + Math.sin(angle) * 20;
         const zBody = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4)), position: new CANNON.Vec3(zx, playerBody.position.y + 10, zz), fixedRotation: true, linearDamping: 0.9 });
         world.addBody(zBody);
         const zMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
         scene.add(zMesh);
         zombies.push({ body: zBody, mesh: zMesh, hurtTimer: 0 });
      }

      for (let i = activeTNTs.length - 1; i >= 0; i--) {
         const tnt = activeTNTs[i];
         tnt.timer -= dt;
         tnt.mesh.material.color.setHex((Math.floor(tnt.timer * 5) % 2 === 0) ? 0xffffff : 0xffaaaa);
         if (tnt.timer <= 0) {
            scene.remove(tnt.mesh);
            explode(tnt.x, tnt.y, tnt.z);
            activeTNTs.splice(i, 1);
         }
      }

      zombies.forEach(z => {
         z.mesh.position.copy(z.body.position);
         const dx = playerBody.position.x - z.body.position.x;
         const dz = playerBody.position.z - z.body.position.z;
         const dist = Math.sqrt(dx*dx + dz*dz) || 1;
         if (dist > 1 && !isFlying) {
            z.body.velocity.x = (dx/dist) * 3;
            z.body.velocity.z = (dz/dist) * 3;
         }
         z.hurtTimer -= dt;
         if (dist < 1.5 && Math.abs(playerBody.position.y - z.body.position.y) < 2 && z.hurtTimer <= 0 && !isFlying) {
            health -= 1; z.hurtTimer = 1.0; updateHealthUI(); playThud(0.8);
            playerBody.velocity.x -= (dx/dist) * 10; playerBody.velocity.z -= (dz/dist) * 10; // knockback
         }
      });

      for(let i = physicsObjects.length - 1; i >= 0; i--) {
        const obj = physicsObjects[i];
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
        if (obj.isDebris) {
          obj.timer -= dt;
          if (obj.timer <= 0) { scene.remove(obj.mesh); world.removeBody(obj.body); physicsObjects.splice(i, 1); }
        }
      }
      
      npcs.forEach(npc => {
        npc.mesh.position.copy(npc.body.position);
        npc.mesh.quaternion.copy(npc.body.quaternion);
        npc.timer -= dt;
        if (npc.timer <= 0) {
           const angle = Math.random() * Math.PI * 2;
           npc.dir.set(Math.cos(angle), 0, Math.sin(angle));
           npc.timer = 1 + Math.random() * 3;
        }
        if (Math.abs(npc.body.velocity.y) < 0.1) {
           npc.body.velocity.x = npc.dir.x * 3;
           npc.body.velocity.z = npc.dir.z * 3;
           if (Math.random() < 0.02) npc.body.velocity.y = 6;
        }
      });

      renderer.render(scene, camera);
      document.getElementById("pos").textContent = `${Math.round(isDriving?carChassis.position.x:playerBody.position.x)}, ${Math.round(isDriving?carChassis.position.y:playerBody.position.y)}, ${Math.round(isDriving?carChassis.position.z:playerBody.position.z)}`;
    }

    // Hotbar Setup
    const hotbar = document.getElementById("hotbar");
    BLOCKS.forEach((b, i) => {
      const s = document.createElement("div"); s.className = "slot" + (i === 0 ? " active" : "");
      const icon = document.createElement("div"); icon.className = "icon"; 
      if (b.map) {
        icon.style.backgroundImage = `url(${b.map.image.toDataURL()})`;
        icon.style.backgroundSize = "cover";
      } else {
        icon.style.background = `#${b.color.toString(16).padStart(6, '0')}`;
      }
      s.appendChild(icon); hotbar.appendChild(s);
    });

    controls.addEventListener('lock', () => { document.getElementById('overlay').style.display = 'none'; });
    controls.addEventListener('unlock', () => { 
      document.getElementById('overlay').style.display = 'flex'; 
      document.getElementById('timeSlider').value = (dayTime * 24) % 24;
      document.getElementById('fovSlider').value = camera.fov;
    });

    document.getElementById("resume")?.addEventListener("click", () => { controls.lock(); audioCtx.resume(); });
    document.getElementById("saveBtn")?.addEventListener("click", () => {
      localStorage.setItem('voxel_world', JSON.stringify(Array.from(worldData.entries())));
      alert("World Saved to Local Storage! 🌍");
    });
    document.getElementById("exportBtn")?.addEventListener("click", () => {
       const exportData = { health, hunger, position: { x: playerBody.position.x, y: playerBody.position.y, z: playerBody.position.z }, world: Array.from(worldData.entries()) };
       const blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'});
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url; a.download = 'voxel_city_save.json'; a.click(); URL.revokeObjectURL(url);
    });
    document.getElementById("clearBtn")?.addEventListener("click", () => {
      if(confirm("Are you sure you want to nuke the entire map? This cannot be undone.")) {
         worldData.clear();
         for (let x=-30; x<30; x++) for (let z=-30; z<30; z++) worldData.set(blockKey(x, 0, z), 1);
         rebuild(); controls.lock(); audioCtx.resume();
      }
    });

    document.getElementById('timeSlider')?.addEventListener('input', (e) => { dayTime = parseFloat(e.target.value) / 24; });
    document.getElementById('fovSlider')?.addEventListener('input', (e) => { camera.fov = parseFloat(e.target.value); camera.updateProjectionMatrix(); });

    function loadWorld() {
      const data = localStorage.getItem('voxel_world');
      if (data) { worldData.clear(); JSON.parse(data).forEach(([k, v]) => worldData.set(k, v)); rebuild(); }
      else { generate(); rebuild(); }
    }

    // --- Inventory System Setup ---
    const invGrid = document.getElementById('invGrid');
    BLOCKS.forEach(b => {
       const d = document.createElement('div');
       d.className = 'inv-slot';
       d.style.cssText = `background:#${b.color.toString(16)}; height:60px; border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; text-shadow: 1px 1px 2px black; border: 2px solid #555;`;
       d.innerText = `ID: ${b.id}`;
       d.onclick = () => addToCraft(b.id, b.color);
       invGrid.appendChild(d);
    });

    let craftGrid = [null, null, null, null];
    function addToCraft(id, colorHex) {
       const idx = craftGrid.findIndex(c => c === null);
       if (idx !== -1) {
          craftGrid[idx] = id;
          document.getElementById('c'+(idx+1)).style.background = '#' + colorHex.toString(16);
          checkRecipe();
       }
    }
    document.querySelectorAll('.craft-slot').forEach((slot, idx) => {
       slot.onclick = () => {
          craftGrid[idx] = null;
          slot.style.background = '#222';
          checkRecipe();
       };
    });
    function checkRecipe() {
       if (craftGrid.every(c => c === 4)) {
          document.getElementById('craftResult').innerHTML = "CRAFTING<br>TABLE";
          document.getElementById('craftResult').style.background = "#b08d57";
       } else {
          document.getElementById('craftResult').innerHTML = "";
          document.getElementById('craftResult').style.background = "#222";
       }
    }
    document.getElementById('craftResult').onclick = () => {
       if (craftGrid.every(c => c === 4)) {
          alert("Crafted a Crafting Table! 🎉\n(In a full build, this item would drop into your hotbar)");
          craftGrid = [null, null, null, null];
          for(let i=1; i<=4; i++) document.getElementById('c'+i).style.background = "#222";
          checkRecipe();
       }
    };

    loadWorld(); animate();
    window.addEventListener("resize", () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
  