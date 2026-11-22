// The Winter Bowl — a glass bowl full of snow. Swipe across it and the snow swirls
// up, then slowly sinks again — and what lies buried under it is unveiled, one surprise
// at a time (a little Christmas tree first). Custom particle sim for the snow (no physics
// engine needed), Three.js r179 local (MIT). Palette: navy night, ice white, brand gold.
import * as THREE from '../vendor/three.module.min.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeK = k => k * k * (3 - 2 * k);
const rand = (a, b) => a + Math.random() * (b - a);

function glowSprite(color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.25, color); gr.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---- rock helpers: deterministic jitter so the crag looks the same on every load ---- */
const hash3 = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
const q3 = v => Math.round(v * 1e3) / 1e3;   // same position → same jitter (keeps seams closed)
function craggy(geo, amt, ampY = 0, seed = 0) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  geo.computeBoundingBox(); const top = geo.boundingBox.max.y;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const x = q3(v.x), y = q3(v.y), z = q3(v.z);
    const a = hash3(x + seed, y, z) - .5, b = hash3(z, x + seed, y) - .5;
    const isTop = Math.abs(v.y - top) < 1e-4;          // keep the top flat: the castle stands on it
    const k = 1 + a * amt * (isTop ? .35 : 1);
    v.x *= k; v.z *= k; if (!isTop) v.y += b * ampY;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
function lump(r, seed, squash = .72) {
  const geo = new THREE.IcosahedronGeometry(r, 1), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (hash3(q3(v.x) + seed, q3(v.y), q3(v.z)) - .5) * .45); v.y *= squash;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
// gable roof: a triangular prism along x, ridge up (width 1.73r, height 1.5r)
function gable(r, len) { const g = new THREE.CylinderGeometry(r, r, len, 3); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); return g; }

/* ---- the surprises buried under the snow, in reveal order ---- */
const MINIS = [
  { pos: [0, 0], scale: 1.15, cap: 'A castle on its hill — Neuschwanstein sleeps under the snow.', build(g, m) {
      /* the rock: a craggy crag with a flat top, snow on top, outcrops on the cliff */
      const CH = 1.05;                                                     // crag height
      const crag = new THREE.Mesh(craggy(new THREE.CylinderGeometry(.86, 1.08, CH, 16, 5), .26, .07, 1), m.rock);
      crag.position.y = CH / 2; g.add(crag);
      const capSnow = new THREE.Mesh(craggy(new THREE.CylinderGeometry(.84, .88, .06, 16, 1), .12, .02, 2), m.snowRock);
      capSnow.position.y = CH - .01; g.add(capSnow);
      [[-.86, .38, .36, .2], [.72, .3, .55, .18], [.9, .62, -.22, .17], [-.82, .7, -.32, .19], [.18, .48, .93, .15],
       [-.42, .22, .9, .16], [.5, .78, .62, .13], [-.62, .82, .52, .12], [.02, .7, -.88, .18]].forEach(([x, y, z, r], i) => {
        const rk = new THREE.Mesh(lump(r, i * 3.1), m.rock); rk.position.set(x, y, z); rk.rotation.y = i * 1.7; g.add(rk);
        if (i % 2 === 0) {                                                // a little snow on every other outcrop
          const sn = new THREE.Mesh(lump(r * .8, i * 5.3, .35), m.snowRock); sn.position.set(x, y + r * .42, z); g.add(sn);
        }
      });

      /* the castle, standing on the flat top of the crag */
      const c = new THREE.Group(); c.position.y = CH + .01; c.scale.setScalar(.82); g.add(c);
      const y0 = .07;                                                      // top of the stone plinth
      const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); c.add(o); return o; };
      const win = (x, y, z, ry = 0, w = .05, h = .085) => { const o = add(new THREE.PlaneGeometry(w, h), m.warm, x, y, z); o.rotation.y = ry; return o; };
      const finial = (x, y, z) => {
        add(new THREE.CylinderGeometry(.007, .007, .1, 5), m.gold, x, y + .05, z);
        add(new THREE.SphereGeometry(.018, 8, 6), m.gold, x, y + .02, z);
      };
      const tower = (x, z, r, h, rh, wins = 2) => {
        add(new THREE.CylinderGeometry(r, r * 1.06, h, 16), m.stone, x, y0 + h / 2, z);
        add(new THREE.CylinderGeometry(r * 1.2, r * 1.0, .07, 16), m.plinth, x, y0 + h - .02, z);   // corbelled gallery
        add(new THREE.ConeGeometry(r * 1.26, rh, 16), m.royal, x, y0 + h + .015 + rh / 2, z);
        finial(x, y0 + h + .015 + rh, z);
        const angs = r < .1 ? [0] : [-.5, .5];
        for (let k = 0; k < wins; k++) {
          const wy = y0 + h - .16 - k * .22; if (wy < y0 + .2) break;
          angs.forEach(a => win(x + Math.sin(a) * (r + .004), wy, z + Math.cos(a) * (r + .004), a, r < .1 ? .035 : .045, .075));
        }
      };

      add(new THREE.BoxGeometry(1.8, .14, 1.0), m.plinth, 0, 0, -.02);                  // stone plinth, sunk into the rock

      // the tall keep, centred at the back (the star floats above it)
      tower(0, -.32, .16, 1.25, .44, 4);
      add(new THREE.CylinderGeometry(.215, .17, .05, 16), m.plinth, 0, y0 + .82, -.32);   // balcony ring
      const flag = add(new THREE.PlaneGeometry(.13, .075), m.flag, .07, y0 + 1.25 + .015 + .44 + .08, -.32);
      flag.rotation.y = -.3;
      tower(.17, -.18, .06, 1.34, .2, 3);                                                 // slim stair turret
      tower(-.6, -.3, .14, .9, .36, 3);                                                   // rear towers
      tower(.62, -.3, .13, .78, .32, 2);

      // the palas: main hall with a steep slate gable roof, two rows of lit windows
      add(new THREE.BoxGeometry(1.24, .62, .4), m.stone, 0, y0 + .31, -.08);
      add(gable(.25, 1.3), m.slateFlat, 0, y0 + .62 + .125, -.08);
      for (const row of [.42, .54]) for (let i = 0; i < 7; i++) win(-.48 + i * .16, y0 + row, .123);
      for (const sx of [-1, 1]) {                                                         // oriel turrets on the hall corners
        add(new THREE.CylinderGeometry(.05, .035, .26, 10), m.stone, sx * .6, y0 + .62, .1);
        add(new THREE.ConeGeometry(.065, .22, 10), m.royal, sx * .6, y0 + .62 + .13 + .11, .1);
        finial(sx * .6, y0 + .62 + .13 + .22, .1);
      }

      // side wings with hip roofs
      add(new THREE.BoxGeometry(.36, .46, .34), m.stone, .74, y0 + .23, .02);
      const wr = add(new THREE.ConeGeometry(.29, .26, 4), m.royal, .74, y0 + .46 + .13, .02); wr.rotation.y = Math.PI / 4;
      win(.68, y0 + .3, .193); win(.8, y0 + .3, .193);
      add(new THREE.BoxGeometry(.32, .36, .3), m.stone, -.74, y0 + .18, .04);
      const wl = add(new THREE.ConeGeometry(.26, .24, 4), m.royal, -.74, y0 + .36 + .12, .04); wl.rotation.y = Math.PI / 4;
      win(-.74, y0 + .22, .193);

      // front curtain wall with battlements, corner towers and the gatehouse
      add(new THREE.BoxGeometry(1.5, .34, .14), m.stone, 0, y0 + .17, .38);
      for (let i = 0; i < 11; i++) add(new THREE.BoxGeometry(.065, .07, .15), m.stone, -.7 + i * .14, y0 + .34 + .035, .38);
      tower(-.8, .38, .12, .58, .32, 1); tower(.8, .38, .12, .58, .32, 1);
      add(new THREE.BoxGeometry(.4, .52, .26), m.stone, 0, y0 + .26, .42);                 // gatehouse
      const gr = add(new THREE.ConeGeometry(.31, .22, 4), m.royal, 0, y0 + .52 + .11, .42); gr.rotation.y = Math.PI / 4;
      finial(0, y0 + .52 + .22, .42);
      add(new THREE.BoxGeometry(.16, .2, .02), m.wood, 0, y0 + .1, .556);                  // gate door
      const arch = add(new THREE.CylinderGeometry(.08, .08, .02, 14, 1, false, -Math.PI / 2, Math.PI), m.wood, 0, y0 + .2, .556);
      arch.rotation.x = Math.PI / 2;
      win(-.1, y0 + .38, .553); win(.1, y0 + .38, .553);
      for (const sx of [-1, 1]) {                                                         // gate turrets
        add(new THREE.CylinderGeometry(.045, .03, .3, 10), m.stone, sx * .2, y0 + .5, .55);
        add(new THREE.ConeGeometry(.06, .18, 10), m.royal, sx * .2, y0 + .65 + .09, .55);
      }
      add(new THREE.BoxGeometry(.18, .012, .42), m.plinth, 0, -.004, .72);                 // path from the gate to the cliff edge
    } },
  /* ---- language-exchange flyers: they circle the castle (orbit = radius, height, speed, phase) ---- */
  { orbit: [1.6, -.3, .5, 0], scale: .85, spin: true, cap: 'Eine Brezel — Hallo!', build(g) {
      const pts = [[-.22, -.3, 0], [-.12, -.1, .04], [0, .08, .06], [.14, .24, .03], [.3, .36, 0], [.5, .28, 0], [.58, .05, 0],
        [.5, -.22, 0], [.28, -.4, 0], [0, -.45, 0], [-.28, -.4, 0], [-.5, -.22, 0], [-.58, .05, 0], [-.5, .28, 0], [-.3, .36, 0],
        [-.14, .24, -.03], [0, .08, -.06], [.12, -.1, -.04], [.22, -.3, 0]].map(p => new THREE.Vector3(...p));
      const curve = new THREE.CatmullRomCurve3(pts);
      const dough = new THREE.MeshStandardMaterial({ color: 0x8a4a1f, roughness: .42, metalness: .05 });
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 140, .075, 10, false), dough));
      for (const e of [pts[0], pts[pts.length - 1]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(.075, 10, 8), dough); s.position.copy(e); g.add(s); }
      const salt = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3 });
      for (let i = 0; i < 18; i++) {
        const p = curve.getPointAt((i + .5) / 18), s = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .03), salt);
        s.position.set(p.x + (hash3(i, 1, 2) - .5) * .05, p.y + (hash3(i, 3, 4) - .5) * .05, p.z + .065); s.rotation.set(i, i * 2, i * 3); g.add(s);
      }
    } },
  { orbit: [1.75, -.95, .5, 1.57], scale: 1.1, cap: 'Un ajolote — ¡Hola!', build(g) {
      const pink = new THREE.MeshStandardMaterial({ color: 0xf4a6c0, roughness: .55 });
      const gill = new THREE.MeshStandardMaterial({ color: 0xd9467a, roughness: .5 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x1a1020, roughness: .3 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .38, 6, 12), pink); body.rotation.z = Math.PI / 2; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), pink); head.scale.set(1, .78, 1.12); head.position.x = .33; g.add(head);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(.11, .42, 12), pink); tail.scale.z = .3; tail.rotation.z = Math.PI / 2; tail.position.x = -.42; g.add(tail);
      for (const sz of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.026, 8, 6), dark); eye.position.set(.42, .06, sz * .13); g.add(eye);
        for (let k = 0; k < 3; k++) {                                  // the feathery gills, three per side
          const gl = new THREE.Mesh(new THREE.CylinderGeometry(.018, .01, .2, 6), gill);
          gl.position.set(.26, .05 + (k - 1) * .07, sz * .2); gl.rotation.set(sz * (.9 + k * .15), 0, (k - 1) * .5 + .3); g.add(gl);
        }
        for (const lx of [.16, -.16]) {                                // little legs
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(.025, .02, .14, 6), pink);
          leg.position.set(lx, -.09, sz * .1); leg.rotation.x = sz * .7; g.add(leg);
        }
      }
      g.userData.tail = tail;
    } },
  { orbit: [1.5, .25, .5, 3.14], scale: 1.0, cap: 'Une baguette — Bonjour !', build(g) {
      const crust = new THREE.MeshStandardMaterial({ color: 0xd49a4f, roughness: .6 });
      const cut = new THREE.MeshStandardMaterial({ color: 0xf2d9a6, roughness: .8 });
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .78, 6, 14), crust); b.rotation.z = Math.PI / 2; b.scale.set(1, 1, .82); g.add(b);
      for (let i = 0; i < 5; i++) {                                    // the diagonal score marks on top
        const s = new THREE.Mesh(new THREE.BoxGeometry(.15, .012, .035), cut);
        s.position.set(-.34 + i * .17, .078, 0); s.rotation.y = .55; g.add(s);
      }
    } },
  { orbit: [1.4, .7, .5, 4.71], scale: 1.0, spin: true, cap: 'Una pizza al salame — Ciao!', build(g) {
      const tiltG = new THREE.Group(); tiltG.rotation.x = .6; g.add(tiltG);       // tipped toward us so we see the top
      const pie = new THREE.Group(); tiltG.add(pie); g.userData.spinner = pie;
      const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .6 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.38, .37, .05, 32), mat(0xe0a35a)); pie.add(base);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.355, .04, 10, 40), mat(0xc98a42)); rim.rotation.x = Math.PI / 2; rim.position.y = .025; pie.add(rim);
      const sauce = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, .012, 32), mat(0xb3261e)); sauce.position.y = .03; pie.add(sauce);
      const cheese = new THREE.Mesh(craggy(new THREE.CylinderGeometry(.3, .3, .012, 24), .12, 0, 9), mat(0xf5d27a)); cheese.position.y = .038; pie.add(cheese);
      [[0, 0], [.17, .08], [-.15, .12], [.05, -.19], [-.18, -.1], [.2, -.12], [-.03, .22], [.13, .2]].forEach(([x, z], i) => {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .012, 16), mat(i % 2 ? 0x8e1f2b : 0x9e2a33));
        s.position.set(x, .05, z); pie.add(s);
        const fat = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .013, 6), mat(0xf3d3c8));   // a fleck of fat
        fat.position.set(x + .02, .051, z - .015); pie.add(fat);
      });
      for (let i = 0; i < 6; i++) {                                    // basil leaves
        const a = i * 1.05 + .4, leaf = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), mat(0x2f6b2a));
        leaf.scale.set(1, .25, .6); leaf.position.set(Math.cos(a) * .24, .05, Math.sin(a) * .24); pie.add(leaf);
      }
    } },
  { pos: [-1.05, -.6], cap: 'A warm house. Someone is home.', build(g, m) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(.8, .5, .6), m.ice); b.position.y = .25; g.add(b);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(.62, .42, 4), m.red); roof.position.y = .71; roof.rotation.y = Math.PI / 4; g.add(roof);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(.16, .16), m.warm); win.position.set(.15, .28, .301); g.add(win);
    } },
  { pos: [1.1, -.55], cap: 'The sleigh is ready to fly.', build(g, m) {
      const sMat = new THREE.MeshStandardMaterial({ color: 0x6e2230, roughness: .5, metalness: .2 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(.9, .4, .5), sMat); box.position.y = .3; g.add(box);
      const sack = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), m.goldMatte); sack.position.set(-.2, .55, 0); sack.scale.y = .8; g.add(sack);
      for (const dz of [-.18, .18]) { const r = new THREE.Mesh(new THREE.BoxGeometry(1.1, .04, .07), m.goldMatte); r.position.set(0, .08, dz); g.add(r); }
      for (let i = 0; i < 2; i++) {
        const d = new THREE.Group();
        d.add(new THREE.Mesh(new THREE.BoxGeometry(.45, .22, .18), sMat));
        const n = new THREE.Mesh(new THREE.BoxGeometry(.14, .22, .08), sMat); n.position.set(.26, .2, 0); n.rotation.z = -.4; d.add(n);
        d.position.set(.85 + i * .45, .14, i * .14 - .07); d.rotation.y = (i ? -.2 : .15); g.add(d);
      }
    } },
  { pos: [.1, .95], cap: 'Gifts — for someone far away.', build(g, m) {
      const spots = [[-.45, 0, .5], [.05, -.02, .7], [.42, 0, .55]];
      const styles = [[m.ice, m.red], [m.red, m.goldMatte], [m.white, m.red]];
      spots.forEach((s, i) => {
        const [bm, rm] = styles[i];
        const b = new THREE.Mesh(new THREE.BoxGeometry(s[2], s[2], s[2]), bm); b.position.set(s[0], s[2] / 2, s[1]); g.add(b);
        const r1 = new THREE.Mesh(new THREE.BoxGeometry(s[2] * 1.02, s[2] * 1.001, s[2] * .16), rm); r1.position.copy(b.position); g.add(r1);
        const r2 = new THREE.Mesh(new THREE.BoxGeometry(s[2] * .16, s[2] * 1.001, s[2] * 1.02), rm); r2.position.copy(b.position); g.add(r2);
      });
    } },
  { pos: [0, 0, -.58], float: true, cap: 'And a star for the tallest tower.', build(g, m) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), m.star); star.position.y = .55; g.add(star); g.userData.star = star;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: m.glow, transparent: true, depthWrite: false }));
      halo.scale.setScalar(1.6); halo.position.y = .55; g.add(halo);
    } },
];

export function mount(host) {
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1c33);
  scene.fog = new THREE.Fog(0x0e1c33, 22, 60);
  scene.environment = (() => {   // small env so the gold catches light
    const s = new THREE.Scene(); s.background = new THREE.Color(0x0c1322);
    const lamp = (c, x, y, z, sx, sy) => { const mm = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); mm.position.set(x, y, z); mm.lookAt(0, 0, 0); s.add(mm); };
    lamp(0xdde9ff, 0, 8, 6, 8, 3); lamp(0xffd9a0, -6, 2, 2, 2, 4); lamp(0x2a3c5e, 0, -6, 0, 10, 10);
    const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(s, 0.04).texture; pm.dispose(); return tex;
  })();

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x16233f, .55));
  const moonL = new THREE.DirectionalLight(0xbcd2ff, .75); moonL.position.set(10, 22, 8); scene.add(moonL);
  const warm = new THREE.PointLight(0xffd9a0, 12, 16, 1.6); warm.position.set(0, 5, 6); scene.add(warm);
  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('rgba(225,236,255,.75)'), transparent: true, depthWrite: false, fog: false }));
  moonDisc.scale.setScalar(5.5); moonDisc.position.set(-9, 11, -30); scene.add(moonDisc);

  /* ---- the winter around the bowl ---- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xe7effc, roughness: .96 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -2.72; scene.add(ground);
  const NP = innerWidth < 700 ? 60 : 110;
  const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.6, 7), new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: .8 }), NP);
  const pines2 = new THREE.InstancedMesh(new THREE.ConeGeometry(.7, 1.9, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85 }), NP);
  const m4 = new THREE.Matrix4(), spin = new THREE.Quaternion();
  for (let i = 0; i < NP; i++) {
    const a = Math.random() * 6.28, rr = 7 + Math.random() * 26, sc = .9 + Math.random() * 2;
    const x = Math.sin(a) * rr, z = -6 - Math.abs(Math.cos(a)) * rr * .8;
    spin.setFromEuler(new THREE.Euler(0, Math.random() * 6.3, 0));
    m4.compose(new THREE.Vector3(x, sc * 1.3 - 2.72, z), spin, new THREE.Vector3(sc, sc, sc));
    pines.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, sc * 1.3 + sc * 1.6 - 2.72, z), spin, new THREE.Vector3(sc, sc, sc));
    pines2.setMatrixAt(i, m4);
  }
  scene.add(pines, pines2);
  const N = innerWidth < 700 ? 300 : 600, spos = new Float32Array(N * 3), ssd = new Float32Array(N);
  for (let i = 0; i < N; i++) { spos[i * 3] = rand(-20, 20); spos[i * 3 + 1] = rand(0, 18); spos[i * 3 + 2] = rand(-24, 6); ssd[i] = Math.random() * 6.28; }
  const sbase = spos.slice(), sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: .1, transparent: true, opacity: .75, depthWrite: false })));

  /* ---- the bowl ---- */
  const R = 2.6, Rm = R - .12;
  const bowl = new THREE.Group(); bowl.position.set(0, 3.2, 0); scene.add(bowl);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.95, .8, 32), new THREE.MeshStandardMaterial({ color: 0xc9952f, metalness: .55, roughness: .35 }));
  base.position.y = -R + .28; bowl.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - .06, .05, 10, 60), new THREE.MeshStandardMaterial({ color: 0xd8a743, metalness: 1, roughness: .26 }));
  ring.rotation.x = Math.PI / 2; bowl.add(ring);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 44, 30), new THREE.MeshPhysicalMaterial({ color: 0xbfd8ff, transparent: true, opacity: .14, roughness: .05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
  bowl.add(glass);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(R - .03, 40, 26),
    new THREE.MeshBasicMaterial({ color: 0x0a1526, transparent: true, opacity: .5, side: THREE.BackSide, depthWrite: false }));
  shade.renderOrder = 1; bowl.add(shade);   // darken the interior backdrop so white snow reads

  /* ---- the snow fill: a dome whose height sinks to unveil ---- */
  const fill = new THREE.Mesh(new THREE.SphereGeometry(Rm, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf3f7ff, roughness: .85 }));
  fill.scale.y = .001; fill.position.y = -R + .12; bowl.add(fill);
  let pile = .9, targetPile = .9;      // dome height as a fraction of the full dome

  /* ---- the minis sit on the bowl floor, hidden under the snow until it sinks ---- */
  const mats = {
    gold: new THREE.MeshStandardMaterial({ color: 0xd8a743, metalness: 1, roughness: .26 }),
    royal: new THREE.MeshStandardMaterial({ color: 0x2e55a8, roughness: .45, metalness: .1 }),
    hill: new THREE.MeshStandardMaterial({ color: 0x93a5b5, roughness: .9 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x7b8696, roughness: .95, flatShading: true }),
    snowRock: new THREE.MeshStandardMaterial({ color: 0xf3f7ff, roughness: .9, flatShading: true }),
    stone: new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: .8 }),
    plinth: new THREE.MeshStandardMaterial({ color: 0xc4bdb0, roughness: .85 }),
    slateFlat: new THREE.MeshStandardMaterial({ color: 0x2e55a8, roughness: .45, metalness: .1, flatShading: true }),
    flag: new THREE.MeshStandardMaterial({ color: 0x9c3040, roughness: .6, side: THREE.DoubleSide }),
    star: new THREE.MeshStandardMaterial({ color: 0xf1d48a, metalness: .6, roughness: .3, emissive: 0xc9952f, emissiveIntensity: .9 }),
    goldMatte: new THREE.MeshStandardMaterial({ color: 0xc9952f, metalness: .4, roughness: .5 }),
    pine: new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: .8 }),
    ice: new THREE.MeshStandardMaterial({ color: 0xeaf2ff, roughness: .6 }),
    red: new THREE.MeshStandardMaterial({ color: 0x9c3040, roughness: .6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a4634, roughness: .85 }),
    warm: new THREE.MeshStandardMaterial({ color: 0xffca7a, emissive: 0xffb45e, emissiveIntensity: 1.6 }),
    glow: glowSprite('rgba(255,214,120,.9)'),
  };
  const minis = MINIS.map(m => { const g = new THREE.Group(); m.build(g, mats); g.visible = false; g.scale.setScalar(.001); bowl.add(g); return g; });
  let shown = -1, pendingReveal = -1;
  const capEl = document.getElementById('cap');
  function reveal(i) {
    if (i <= shown || i >= minis.length) return;
    shown = i;
    const g = minis[i], pos = MINIS[i].pos;
    g.visible = true;
    if (pos) g.position.set(pos[0], pos.length > 2 ? pos[2] + 1.0 : -R + .12 + .3, pos[1]);   // standing in the snow bed, or floating (orbiters are placed each frame)
    g.userData.pop = 0;
    dispatchEvent(new CustomEvent('bowl:reveal', { detail: i }));   // the page opens the signup popup after the 3rd shake
    if (capEl) { capEl.textContent = MINIS[i].cap; capEl.classList.add('on'); clearTimeout(capEl._t); capEl._t = setTimeout(() => capEl.classList.remove('on'), 4200); }
  }

  /* ---- snow particles inside the bowl ---- */
  const SN = innerWidth < 700 ? 1100 : 2400;
  const ppos = new Float32Array(SN * 3), pvel = [];
  for (let i = 0; i < SN; i++) {
    const r = Math.sqrt(Math.random()) * (R - .3), a = Math.random() * 6.28;
    ppos[i * 3] = Math.cos(a) * r; ppos[i * 3 + 1] = rand(-R + .3, R - .3); ppos[i * 3 + 2] = Math.sin(a) * r;
    pvel.push(new THREE.Vector3());
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: .15, transparent: true, opacity: 1, depthWrite: false }));
  pts.renderOrder = 3; bowl.add(pts);
  // the rest surface = the visible snow dome (plus a thin floor layer at the bottom)
  const restY = (x, z) => {
    const h = pile * Rm, d2 = x * x + z * z;
    const dome = h * Math.sqrt(Math.max(0, 1 - d2 / (Rm * Rm)));
    return -R + .12 + Math.max(.02, dome) + .04;
  };

  /* ---- shake input: swipe across the bowl ---- */
  let energy = 0, lastPX = null, lastPY = null, tiltT = 0, tilt = 0, lastShake = 0;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { lastPX = e.clientX; lastPY = e.clientY; }, { passive: true });
  el.addEventListener('pointermove', e => {
    if (lastPX == null) return;
    const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
    lastPX = e.clientX; lastPY = e.clientY;
    const spd = Math.min(40, Math.abs(dx) + Math.abs(dy));
    energy = Math.min(1.6, energy + spd * .012);
    tiltT = clamp(dx * .0016, -.16, .16);
    for (let i = 0; i < SN; i++) {
      const v = pvel[i], x = ppos[i * 3], z = ppos[i * 3 + 2];
      v.x += dx * .035 + rand(-1, 1);
      v.z += rand(-1, 1);
      v.y += Math.abs(dy) * .03 + rand(.2, 2.2) + Math.abs(dx) * .015;
      const s = .2 * energy;                       // wild swirl around the vertical axis
      v.x += -z * s; v.z += x * s;
      // settled or buried flakes erupt upward through the snow surface
      if (ppos[i * 3 + 1] < restY(x, z) + .3) v.y += rand(3.5, 8) * Math.min(1.6, energy);
    }
    const now = performance.now();
    if (now - lastShake > 1200 && energy > .5) { lastShake = now; if (shown < minis.length - 1) pendingReveal = shown + 1; }
  }, { passive: true });
  addEventListener('pointerup', () => { lastPX = lastPY = null; }, { passive: true });
  addEventListener('pointercancel', () => { lastPX = lastPY = null; }, { passive: true });

  /* ---- loop ---- */
  const camera = new THREE.PerspectiveCamera(40, W() / H(), .05, 120);
  // fit the WHOLE bowl (glass + gold base) on any screen: narrow phones are limited by width,
  // so the camera moves back until the glass fits with a little air at the sides
  let camDist = 10.4;
  let aimY = 3.15, camY = 3.7;
  let sway = .5;
  // outline of the glass (fibonacci points) plus the gold base rims, relative to the bowl centre
  const fitPts = [];
  for (let i = 0; i < 320; i++) {
    const y = 1 - (i + .5) / 160, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
    fitPts.push(new THREE.Vector3(Math.cos(a) * r * R, y * R, Math.sin(a) * r * R));
  }
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * 6.2832;
    fitPts.push(new THREE.Vector3(Math.cos(a) * 1.95, -R - .12, Math.sin(a) * 1.95), new THREE.Vector3(Math.cos(a) * 1.55, -R + .68, Math.sin(a) * 1.55));
  }
  const BOWL_Y = 3.2, _v = new THREE.Vector3();
  const measure = () => {   // NDC extents of the glass (x) and of glass + base (y)
    camera.updateMatrixWorld(); let mx = 0, lo = 9, hi = -9;
    for (const p of fitPts) {
      _v.set(p.x, p.y + BOWL_Y, p.z).project(camera);
      if (p.y > -R - .05 || Math.abs(p.x) > 2) mx = Math.max(mx, Math.abs(_v.x));
      lo = Math.min(lo, _v.y); hi = Math.max(hi, _v.y);
    }
    return { mx, mid: (lo + hi) / 2 };
  };
  function fitCamera() {
    camera.aspect = W() / H();
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2), hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const halfW = R + .2, halfH = (2 * R + .5) / 2 + .15;
    if (camera.aspect < .75) {
      // phones: the glass fills the width with 5 px air on each side, the bowl sits a bit below the middle,
      // and the camera looks down at ~15° like on desktop. No side-to-side sway (it would break the 5 px).
      sway = 0;
      const wantX = 1 - 10 / W(), wantMid = 1 - 2 * ((H() * .5 + (H() < 720 ? 18 : 40)) / H());
      const place = (d, aim) => { camDist = d; aimY = aim; camY = .9 + d * Math.tan(THREE.MathUtils.degToRad(15)); camera.position.set(0, camY, d); camera.lookAt(0, aim, 0); camera.updateProjectionMatrix(); };
      const aimFor = d => { let a0 = -2, a1 = 9; for (let k = 0; k < 28; k++) { const am = (a0 + a1) / 2; place(d, am); if (measure().mid > wantMid) a0 = am; else a1 = am; } return (a0 + a1) / 2; };
      let d0 = 6, d1 = 60;
      for (let k = 0; k < 28; k++) { const dm = (d0 + d1) / 2; place(dm, aimFor(dm)); if (measure().mx > wantX) d0 = dm; else d1 = dm; }
      place(d1, aimFor(d1));
    } else {
      sway = .5;
      camDist = Math.max(10.4, halfH / Math.tan(vHalf * .74), halfW / Math.sin(hHalf * .9));
      aimY = 3.15;
      camY = aimY + .55 * camDist / 10.4;
      camera.updateProjectionMatrix();
    }
    scene.fog.near = camDist + 11.6; scene.fog.far = camDist + 49.6;
  }
  fitCamera();
  window.__WINTER_BOWL = { reveal(i) { reveal(i); targetPile = pile = .25; }, camDist: () => camDist, fit: () => { const m = measure(); return { halfWidthPx: m.mx * W() / 2, W: W(), midPx: (1 - m.mid) / 2 * H() }; } };   // test handle
  const cap = innerWidth < 760 ? 1000 / 30 : 0; let last = performance.now(), t0 = last;
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    if (document.hidden) { last = now; return; }
    if (cap && now - last < cap) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;

    // energy fades fast; when a good shake has settled, the snow sinks one step and unveils
    energy = Math.max(0, energy - dt * 1.3);
    if (pendingReveal >= 0 && energy < .25) {
      targetPile = Math.max(.25, targetPile - .5);   // a snow bed always stays in the bowl
      reveal(pendingReveal);
      pendingReveal = -1;
    }
    pile += (targetPile - pile) * Math.min(1, dt * .15);
    fill.scale.y = Math.max(.001, pile);

    // bowl wobble spring
    tiltT *= (1 - Math.min(1, dt * 2.2));
    tilt += (tiltT - tilt) * Math.min(1, dt * 6);
    bowl.rotation.z = tilt;
    bowl.position.y = 3.2 + Math.sin(t * .8) * .05 + energy * .04 * Math.sin(t * 22);

    // snow particles: a third drift forever (visible snow inside the glass at all times),
    // the rest settle into the bed and erupt when shaken
    const g0 = -2.8, drag = Math.pow(.35, dt), dragY = Math.pow(.92, dt);
    for (let i = 0; i < SN; i++) {
      const ix = i * 3;
      let x = ppos[ix], y = ppos[ix + 1], z = ppos[ix + 2];
      const v = pvel[i];
      if (i % 5 < 2) {                                    // drifting snow (40%): always in the air
        v.y += (-.8 - v.y) * Math.min(1, dt * 2.5);
        v.x = v.x * drag + Math.sin(t * .9 + (i * 2.399) % 6.28) * .12;
        v.z = v.z * drag;
        x += v.x * dt; y += v.y * dt; z += v.z * dt;
        const rr = Math.sqrt(x * x + y * y + z * z), RM = R - .2;
        if (rr > RM) { const k = RM / rr; x *= k; y *= k; z *= k; v.multiplyScalar(-.2); }
        if (y <= restY(x, z) + .06) {                     // reached the snow: back to the top
          const a = Math.random() * 6.28, rr2 = Math.sqrt(Math.random()) * Rm * .75;
          x = Math.cos(a) * rr2; z = Math.sin(a) * rr2; y = rand(Rm * .5, Rm * .85);
          v.set(rand(-.2, .2), -.8, rand(-.2, .2));
        }
      } else {
        const calm = energy < .5 && Math.abs(v.y) < .35;
        if (calm && y <= restY(x, z) + .012) {
          y = restY(x, z) + .05 + Math.sin(t * 1.3 + (i * 2.399) % 6.28) * .015;   // settled, resting on top of the snow
          v.set(0, 0, 0);
        } else {
          v.y += g0 * dt;
          v.x *= drag; v.z *= drag; v.y *= dragY;
          x += v.x * dt; y += v.y * dt; z += v.z * dt;
          const rr = Math.sqrt(x * x + y * y + z * z), RM = R - .18;
          if (rr > RM) { const k = RM / rr; x *= k; y *= k; z *= k; v.multiplyScalar(-.35); }
          const ry = restY(x, z);
          if (y < ry && v.y <= 0) {           // land on the snow only while falling — shaken snow may rise through it
            y = ry;
            if (v.y < -1.2) { v.y = -v.y * .35; v.x *= .65; v.z *= .65; } else { v.y = 0; v.x *= .8; v.z *= .8; }
          }
        }
      }
      ppos[ix] = x; ppos[ix + 1] = y; ppos[ix + 2] = z;
    }
    pg.attributes.position.needsUpdate = true;

    // minis pop in with a springy scale
    minis.forEach((g, i) => {
      if (i > shown) { g.visible = false; return; }
      const base = MINIS[i].scale || 1;
      if (g.userData.pop != null && g.userData.pop < 1) {
        g.userData.pop = Math.min(1, g.userData.pop + dt * 9);   // super quick pop
        const k = g.userData.pop;
        g.scale.setScalar(Math.max(.001, easeK(k) * (1 + Math.sin(k * Math.PI) * .3) * base));
      } else g.scale.setScalar(base);
      if (g.userData.star) g.userData.star.rotation.y = t * 1.2;
      const o = MINIS[i].orbit;
      if (o) {                                       // fly in a circle around the castle, nose first, with a soft bob
        const th = t * o[2] + o[3];
        g.position.set(Math.sin(th) * o[0], o[1] + Math.sin(t * 1.6 + o[3]) * .12, Math.cos(th) * o[0]);
        g.rotation.y = MINIS[i].spin ? Math.sin(t * .9) * .7 : th;   // the pretzel rocks but keeps its face to us
        if (g.userData.spinner) g.userData.spinner.rotation.y = t * .8;
        if (g.userData.tail) g.userData.tail.rotation.y = Math.sin(t * 6) * .35;
      }
    });

    // outside snowfall
    for (let i = 0; i < N; i++) {
      spos[i * 3 + 1] = sbase[i * 3 + 1] - ((t * .8 + ssd[i]) % 18);
      spos[i * 3] = sbase[i * 3] + Math.sin(t * .5 + ssd[i]) * .5;
    }
    sg.attributes.position.needsUpdate = true;

    const ks = camDist / 10.4;
    camera.position.set(Math.sin(t * .12) * sway * ks, camY, camDist);
    camera.lookAt(0, aimY, 0);
    renderer.render(scene, camera);
  }
  addEventListener('resize', () => { renderer.setSize(W(), H()); fitCamera(); });
  frame();
}
