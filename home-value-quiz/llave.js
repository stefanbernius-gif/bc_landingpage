// La Llave — a gold antique key flies into the lock of a colonial door, turns, and the door opens into a lit courtyard.
// Same sticky-stage contract as retablo.js: host is tall, .r-stick sticks, scroll progress 0..1 drives everything.
// Three.js r179 (local copy, MIT). Renders only while the stage is on screen.
import * as THREE from './vendor/three.module.min.js';

const cl = x => Math.max(0, Math.min(1, x));
const ease = t => t * t * (3 - 2 * t);
const seg = (p, a, b) => cl((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

function envMap(renderer) {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x0c0805);
  const lamp = (c, x, y, z, sx, sy) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  lamp(0xfff1d6, 0, 6, 4, 6, 2); lamp(0xffb760, -6, 2, 2, 2, 5); lamp(0xffd9a0, 6, 1, 3, 2, 4); lamp(0x3a2412, 0, -5, 0, 10, 10); lamp(0xffe7c2, 0, 2, -6, 4, 3);
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(s, 0.04).texture; pm.dispose(); return tex;
}
function canvasTex(w, h, draw, srgb) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function noise(g, w, h, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } }

/* pink cantera stone: blocks + mortar (colour map and bump map share the layout) */
function stone(bump) {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = bump ? '#fff' : '#a88a7c'; g.fillRect(0, 0, w, h);
    const rows = 6;
    for (let r = 0; r < rows; r++) {
      const y = r * h / rows, off = (r % 2) * 130;
      for (let x = -off; x < w; x += 260) {
        if (!bump) { const k = 150 + Math.random() * 26 | 0; g.fillStyle = `rgb(${k + 26},${k + 8},${k + 2})`; g.fillRect(x + 2, y + 2, 256, h / rows - 4); }
        g.fillStyle = bump ? '#000' : '#7a6257'; g.fillRect(x, y, 2, h / rows); g.fillRect(x, y, 260, 2);
      }
    }
    noise(g, w, h, 16000, bump ? .3 : .1);
  }, !bump);
}
/* old wood planks with grain */
function wood(bump) {
  return canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = bump ? '#888' : '#3a2110'; g.fillRect(0, 0, w, h);
    const planks = 5, pw = w / planks;
    for (let i = 0; i < planks; i++) {
      if (!bump) { const k = 40 + Math.random() * 18 | 0; g.fillStyle = `rgb(${k + 22},${k},${k - 22})`; g.fillRect(i * pw + 3, 0, pw - 6, h); }
      g.strokeStyle = bump ? 'rgba(0,0,0,.5)' : 'rgba(20,10,4,.55)';
      for (let k = 0; k < 26; k++) { g.lineWidth = .6 + Math.random() * 1.6; g.beginPath(); const x0 = i * pw + 6 + Math.random() * (pw - 12); g.moveTo(x0, 0); g.bezierCurveTo(x0 + 8, h * .3, x0 - 8, h * .6, x0 + 4, h); g.stroke(); }
      g.fillStyle = bump ? '#000' : '#140a04'; g.fillRect(i * pw, 0, 4, h);
    }
    g.fillStyle = bump ? '#000' : '#140a04'; g.fillRect(0, h * .32, w, 6); g.fillRect(0, h * .68, w, 6);   // cross bands
    noise(g, w, h, 5000, .18);
  }, !bump);
}
/* chased ornament on the gold lock plate (bump) */
function plateBump() {
  return canvasTex(256, 420, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 6;
    g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 3; g.strokeRect(24, 24, w - 48, h - 48);
    for (const [x, y] of [[w / 2, 70], [w / 2, h - 70]]) { for (let i = 0; i < 8; i++) { g.save(); g.translate(x, y); g.rotate(i * Math.PI / 4); g.beginPath(); g.ellipse(16, 0, 14, 5, 0, 0, 7); g.fill(); g.restore(); } }
    g.beginPath(); g.moveTo(40, h / 2 - 60); g.bezierCurveTo(10, h / 2, 10, h / 2, 40, h / 2 + 60); g.stroke();
    g.beginPath(); g.moveTo(w - 40, h / 2 - 60); g.bezierCurveTo(w - 10, h / 2, w - 10, h / 2, w - 40, h / 2 + 60); g.stroke();
  });
}
/* opening outline: straight jambs + round arch on top */
function archShape(w, h, path) {
  const s = path || new THREE.Shape(), r = w / 2, spring = h - r;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return s;
}

export function mount(host) {
  const stick = host.querySelector('.r-stick'), wrap = host.querySelector('.r-canvas'), phs = host.querySelectorAll('.r-ph');
  const W = () => wrap.clientWidth, H = () => wrap.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95; renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0805); scene.fog = new THREE.Fog(0x0b0805, 16, 36);
  scene.environment = envMap(renderer);
  const camera = new THREE.PerspectiveCamera(36, W() / H(), 0.05, 80);

  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a743, metalness: 1, roughness: .24 });
  const goldPlate = new THREE.MeshStandardMaterial({ color: 0xd8a743, metalness: 1, roughness: .3, bumpMap: plateBump(), bumpScale: 5 });
  const DW = 2.4, DH = 3.7;

  // wall with an arched opening (extruded shape with a hole)
  const wallShape = new THREE.Shape(); wallShape.moveTo(-14, -1); wallShape.lineTo(14, -1); wallShape.lineTo(14, 12); wallShape.lineTo(-14, 12); wallShape.lineTo(-14, -1);
  wallShape.holes.push(archShape(DW + .02, DH + .01, new THREE.Path()));
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: .6, bevelEnabled: false });
  const sMap = stone(false), sBump = stone(true);
  [sMap, sBump].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(.2, .2); });
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: sMap, bumpMap: sBump, bumpScale: 3, roughness: .92, color: 0xe0c0aa }));
  wall.position.z = -.6; scene.add(wall);
  // carved stone frame around the opening
  const surround = new THREE.Shape(); archShape(DW + .9, DH + .45, surround); surround.holes.push(archShape(DW + .02, DH + .01, new THREE.Path()));
  const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(surround, { depth: .2, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2 }),
    new THREE.MeshStandardMaterial({ map: sMap, roughness: .85, color: 0xf0d4bf })); fr.position.z = -.02; scene.add(fr);
  const keystone = new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .32), new THREE.MeshStandardMaterial({ color: 0xe9c7ae, roughness: .8 }));
  keystone.position.set(0, DH + .2, .08); scene.add(keystone);
  const crest = new THREE.Mesh(new THREE.TorusGeometry(.13, .03, 10, 40), gold); crest.position.set(0, DH + .2, .26); scene.add(crest);
  // step
  const step = new THREE.Mesh(new THREE.BoxGeometry(DW + 1.6, .18, 1.1), new THREE.MeshStandardMaterial({ color: 0x9c7663, roughness: .9 })); step.position.set(0, -.09, .35); scene.add(step);

  // courtyard behind the door
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  yard.position.set(0, 2.2, -3.4); scene.add(yard);
  new THREE.TextureLoader().load('media/quiz-courtyard.webp', t => { t.colorSpace = THREE.SRGBColorSpace; yard.material = new THREE.MeshBasicMaterial({ map: t, color: 0x000000 }); });
  const floorIn = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), new THREE.MeshStandardMaterial({ color: 0x8a6a52, roughness: .8 })); floorIn.rotation.x = -Math.PI / 2; floorIn.position.set(0, 0, -1.6); scene.add(floorIn);

  // the door leaf, hinged on the left jamb
  const pivot = new THREE.Group(); pivot.position.set(-DW / 2, 0, -.05); scene.add(pivot);
  const leafShape = archShape(DW - .04, DH - .03);
  const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: .14, bevelEnabled: false }); leafGeo.translate(DW / 2, 0, -.07);
  const wMap = wood(false), wBump = wood(true);
  [wMap, wBump].forEach(t => { t.repeat.set(1 / DW, 1 / DH); t.offset.set(.5, 0); });
  const leaf = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ map: wMap, bumpMap: wBump, bumpScale: 2.5, roughness: .75 }));
  pivot.add(leaf);
  // gold studs (clavos) in a grid
  const studs = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, 60);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); let n = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 6; c++) { if (n >= 60) break; m4.compose(new THREE.Vector3(.3 + c * (DW - .6) / 5, .3 + r * .3, .075), q, new THREE.Vector3(1, 1, 1)); studs.setMatrixAt(n++, m4); }
  pivot.add(studs);
  // lock plate, keyhole, ring knocker
  const KH = new THREE.Vector3(DW - .42, 1.55, .08);                       // keyhole, in door coordinates
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.3, .5, .025), goldPlate); plate.position.set(KH.x, KH.y, .08); pivot.add(plate);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(.03, 20), new THREE.MeshBasicMaterial({ color: 0x050302 })); hole.position.set(KH.x, KH.y + .02, .094); pivot.add(hole);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(.022, .07), hole.material); slot.position.set(KH.x, KH.y - .03, .094); pivot.add(slot);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.17, .025, 12, 48), gold); ring.position.set(DW / 2, 2.35, .14); pivot.add(ring);
  const lion = new THREE.Mesh(new THREE.SphereGeometry(.07, 24, 16), gold); lion.position.set(DW / 2, 2.52, .12); lion.scale.z = .5; pivot.add(lion);

  // the key: ornate bow, collars, shaft, bit. Built pointing down -Z (into the door).
  const key = new THREE.Group(); pivot.add(key);
  const bow = new THREE.Group(); key.add(bow);
  bow.add(new THREE.Mesh(new THREE.TorusGeometry(.24, .04, 14, 60), gold));
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.09, .022, 10, 36), gold); const a = i * Math.PI / 2; t.position.set(Math.cos(a) * .1, Math.sin(a) * .1, 0); bow.add(t); }
  bow.add(new THREE.Mesh(new THREE.SphereGeometry(.05, 20, 14), gold));
  bow.rotation.x = 0; bow.position.z = .32;
  [.06, .12].forEach(z => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .035, 24), gold); c.rotation.x = Math.PI / 2; c.position.z = z; key.add(c); });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.0, 20), gold); shaft.rotation.x = Math.PI / 2; shaft.position.z = -.45; key.add(shaft);
  [[-.82, .14], [-.9, .1], [-.97, .16]].forEach(([z, hgt]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.03, hgt, .055), gold); b.position.set(0, -hgt / 2, z); key.add(b); });
  key.scale.setScalar(1.25);

  // lights
  scene.add(new THREE.HemisphereLight(0xffe2b0, 0x120a04, .18));
  const keyL = new THREE.SpotLight(0xffd59a, 70, 26, .32, .75, 1.5); keyL.position.set(2.5, 7.5, 7); keyL.target.position.set(0, 1.8, 0); scene.add(keyL, keyL.target);
  const rim = new THREE.PointLight(0xff9d4a, 4, 12, 1.8); rim.position.set(-4, 3, 3); scene.add(rim);
  const inside = new THREE.PointLight(0xffc77a, 0, 9, 1.4); inside.position.set(0, 2, -1.5); scene.add(inside);
  const shine = new THREE.PointLight(0xfff0cf, 3, 4, 2); scene.add(shine);   // follows the key so it always glints

  // dust in the light
  const N = innerWidth < 700 ? 380 : 800, pos = new Float32Array(N * 3), sd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 6; pos[i * 3 + 1] = Math.random() * 5; pos[i * 3 + 2] = Math.random() * 5 - 2.5; sd[i] = Math.random() * 6.28; }
  const base = pos.slice(), dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dm = new THREE.PointsMaterial({ color: 0xffd27a, size: .03, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(dg, dm));

  const FLOAT = new THREE.Vector3(DW / 2 + .1, 2.55, 3.0);      // key hovering in front of the door (door coords)
  const kp = new THREE.Vector3(), tmp = new THREE.Vector3();
  let target = 0, p = 0, on = false, raf = 0;
  const progress = () => { const r = host.getBoundingClientRect(); return cl(-r.top / (r.height - innerHeight)); };
  const cap = innerWidth < 760 ? 1000 / 30 : 0; let last = 0;          // phones: 30 fps is smooth enough and saves battery
  function frame() {
    raf = 0; if (!on) return;
    const now = performance.now(); if (cap && now - last < cap) { raf = requestAnimationFrame(frame); return; } last = now;
    p += (target - p) * .1;
    const t = performance.now() / 1000, portrait = W() / H() < .85;
    const fly = ease(seg(p, .22, .46)), insert = ease(seg(p, .44, .52)), turn = ease(seg(p, .52, .6)), open = ease(seg(p, .6, .84));
    // key path: float → in front of keyhole → into it → turn
    const front = tmp.set(KH.x, KH.y, .9);
    kp.copy(FLOAT).lerp(front, fly); kp.z = lerp(kp.z, KH.z + .55, insert);
    kp.y += Math.sin(t * 1.4) * .05 * (1 - fly);
    key.position.copy(kp);
    key.rotation.set(0, 0, 0);
    key.rotation.y = (1 - fly) * (Math.sin(t * .7) * .6 + .35);              // idle turn so the gold catches light
    key.rotation.x = (1 - fly) * .18;
    key.rotation.z = turn * Math.PI / 2;
    pivot.rotation.y = open * 1.55;
    inside.intensity = 14 * open; dm.opacity = .2 + .5 * open;
    yard.material.map && yard.material.color.setScalar(.08 + .92 * open);
    key.getWorldPosition(shine.position); shine.position.z += .6;
    for (let i = 0; i < N; i++) { pos[i * 3 + 1] = base[i * 3 + 1] + ((t * .05 + sd[i]) % 1) * .5; pos[i * 3] = base[i * 3] + Math.sin(t * .4 + sd[i]) * .07; }
    dg.attributes.position.needsUpdate = true;
    // camera: wide → follows the key to the lock → walks through the door
    const far = portrait ? 15 : 9.5, mid = portrait ? 8.5 : 5.2, near = -1.2;
    const a = ease(seg(p, .1, .5)), b = ease(seg(p, .7, 1));
    const z = lerp(lerp(far, mid, a), near, b);
    const lx = lerp(0, .5, a * (1 - b)), ly = lerp(2.0, 1.75, a);
    camera.position.set(lx + Math.sin(p * 3) * .25 * (1 - b), lerp(2.1, 1.85, a), z);
    camera.lookAt(lx, ly, lerp(0, -3.4, b));
    host.style.setProperty('--end', seg(p, .86, 1).toFixed(3));
    const th = [0, .3, .66]; let k = 0; th.forEach((v, i) => { if (p >= v) k = i; });
    phs.forEach((e, i) => e.classList.toggle('on', i === k));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  addEventListener('scroll', () => { target = progress(); }, { passive: true });
  addEventListener('resize', () => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
  new IntersectionObserver(es => { on = es[0].isIntersecting; if (on && !raf) { target = progress(); raf = requestAnimationFrame(frame); } }, { threshold: .01 }).observe(stick);
  target = p = progress();
  host.classList.add('live');
}
