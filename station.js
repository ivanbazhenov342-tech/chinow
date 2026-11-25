import * as T from "./vendor/three.module.js";
const $ = (id) => document.getElementById(id);
const audio = new Audio("./audio/exit.mp3");
let stage = 0,
  feedback = "",
  walkTo = null,
  turn = null,
  player = null,
  target = null,
  arrival = null;
try {
  stage = Math.min(
    3,
    Math.max(0, Number(localStorage.getItem("shanjiang-station-step")) || 0),
  );
} catch {}
function advance(value) {
  stage = value;
  feedback = "";
  try {
    localStorage.setItem("shanjiang-station-step", String(value));
  } catch {}
  render();
}
function hear() {
  audio.currentTime = 0;
  audio.play().catch(() => {
    feedback = "Запись недоступна. 出口 читается chūkǒu.";
    render();
  });
}
const points = {
  guard: [-3, 1],
  entry: [1, -2],
  exit: [6, -2],
  friend: [7, -6],
};
function interact(id) {
  if (stage === 0 && id === "guard") {
    advance(1);
    hear();
    return;
  }
  if (stage === 1 && id === "exit") {
    advance(2);
    return;
  }
  if (stage === 2 && id === "friend") {
    advance(3);
    return;
  }
  feedback =
    id === "entry"
      ? "入口 (rùkǒu) означает «вход». Этот проход ведёт обратно к поездам."
      : id === "guard"
        ? "Дежурный показывает на знак 出口."
        : stage === 0
          ? "Сначала узнай у дежурного, где выход."
          : "Посмотри, кого или что нужно найти.";
  render();
}
function visit(id) {
  if (walkTo) walkTo(...points[id], () => interact(id));
  else interact(id);
}
function button(label, action) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = action;
  $("actions").append(b);
}
function render() {
  const scenes = [
    [
      "Вас встречают у выхода",
      "Подойди к дежурному у платформы и узнай, какую надпись искать.",
    ],
    [
      "Какой проход ведёт в город?",
      "Дежурный сказал: «出口, chūkǒu». Послушай и выбери нужный проход.",
    ],
    [
      "Найди встречающую",
      "Ты вышел в город. У скамьи тебя ждёт хозяйка с синим зонтом.",
    ],
    [
      "Первая встреча состоялась",
      "Теперь ты узнаешь 出口 — выход и 入口 — вход. Эти знаки пригодятся и в метро, и в аэропорту.",
    ],
  ];
  $("step").textContent =
    stage === 3 ? "МИССИЯ ЗАВЕРШЕНА" : "ПРИБЫТИЕ · " + (stage + 1) + " / 3";
  $("title").textContent = scenes[stage][0];
  $("story").textContent = feedback || scenes[stage][1];
  $("actions").replaceChildren();
  if (stage === 0) button("Подойти к дежурному", () => visit("guard"));
  if (stage === 1) {
    button("▶ Слушать", hear);
    button("入口", () => visit("entry"));
    button("出口", () => visit("exit"));
  }
  if (stage === 2) button("Подойти к синему зонту", () => visit("friend"));
  if (stage === 3) {
    button("▶ Повторить 出口", hear);
    button("Пройти заново", () => {
      target = null;
      arrival = null;
      player?.position.set(-9, 0.32, 2);
      advance(0);
    });
  }
}
$("ticket").onclick = () => document.querySelector("dialog").showModal();
$("close").onclick = () => document.querySelector("dialog").close();
$("left").onclick = () => turn?.(-Math.PI / 4);
$("right").onclick = () => turn?.(Math.PI / 4);
render();
function station() {
  const root = $("view"),
    scene = new T.Scene(),
    renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  root.prepend(renderer.domElement);
  scene.background = new T.Color(0xdde4ce);
  scene.fog = new T.FogExp2(0xe0e7d7, 0.014);
  const cam = new T.OrthographicCamera(-16, 16, 11, -11, 0.1, 130),
    light = new T.DirectionalLight(0xffe6b1, 2.7);
  light.position.set(-14, 22, 10);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {
    left: -25,
    right: 25,
    top: 25,
    bottom: -25,
  });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.normalBias = 0.035;
  scene.add(light, new T.HemisphereLight(0xfff1cf, 0x92a48b, 2));
  const cube = new T.BoxGeometry(),
    mats = new Map(),
    hits = [];
  function mesh(g, color, x, y, z, parent = scene) {
    if (!mats.has(color))
      mats.set(color, new T.MeshStandardMaterial({ color, roughness: 0.95 }));
    const o = new T.Mesh(g, mats.get(color));
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(x, y, z, w, h, d, c, parent) {
    const o = mesh(cube, c, x, y, z, parent);
    o.scale.set(w, h, d);
    return o;
  }
  function orb(x, y, z, r, c, p) {
    return mesh(new T.SphereGeometry(r, 12, 10), c, x, y, z, p);
  }
  function sign(label, x, y, z) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 160;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#34544e";
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = "#d8c791";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = "#fff1cd";
    ctx.font = "bold 94px serif";
    ctx.textAlign = "center";
    ctx.fillText(label, 256, 114);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const o = new T.Sprite(new T.SpriteMaterial({ map: tex }));
    scene.add(o);
    o.position.set(x, y, z);
    o.scale.set(2.9, 0.91, 1);
    return o;
  }
  box(0, -0.61, 0, 42, 0.8, 25, 0x98ad8e);
  box(0, 0.04, 0, 24, 0.52, 15, 0xc9bda2);
  for (let i = -11; i < 12; i++)
    box(i, 0.312, 4.65, 0.6, 0.024, 0.17, 0xd3a158);
  for (const z of [6, 7.5]) box(0, 0.35, z, 31, 0.17, 0.14, 0x596267);
  const train = new T.Group();
  scene.add(train);
  for (let i = 0; i < 2; i++) {
    let x = -6 + i * 8;
    box(x, 1.65, 6.8, 7.65, 2.15, 1.95, 0x526f60, train);
    box(x, 2.81, 6.8, 7.8, 0.2, 2.12, 0x485555, train);
    for (let j = 0; j < 6; j++)
      box(x - 2.95 + j * 1.15, 2.1, 5.79, 0.82, 0.71, 0.08, 0xbddcd3, train);
  }
  function pavilion(x, z) {
    box(x, 1.7, z, 4.7, 2.8, 3.1, 0xe4cfa9);
    for (let i = -2; i <= 2; i++)
      box(x + i, 1.65, z + 1.59, 0.13, 2.7, 0.14, 0x805d45);
    for (let i = 0; i < 5; i++)
      box(
        x,
        3.16 + i * 0.16,
        z,
        5.4 - i * 0.36,
        0.21,
        3.8 - i * 0.52,
        0x556b69,
      );
  }
  pavilion(-8, -5);
  pavilion(0, -10);
  pavilion(11, -10);
  for (let x of [1, 6]) {
    for (let side of [-1, 1])
      box(x + side * 1.55, 1.85, -2, 0.24, 3.1, 0.24, 0x876346);
    box(x, 3.55, -2, 3.6, 0.3, 0.8, 0x516765);
    const o = sign(x === 1 ? "入口" : "出口", x, 3.12, -2);
    o.userData.id = x === 1 ? "entry" : "exit";
    hits.push(o);
  }
  function person(x, z, c) {
    const p = new T.Group();
    scene.add(p);
    p.position.set(x, 0.32, z);
    mesh(new T.CylinderGeometry(0.28, 0.38, 0.84, 10), c, 0, 0.84, 0, p);
    orb(0, 1.52, 0, 0.29, 0xca9971, p);
    orb(0, 1.66, -0.03, 0.26, 0x463c35, p);
    for (const k of [-1, 1])
      box(0.14 * k, 0.23, 0, 0.16, 0.42, 0.2, 0x455154, p);
    return p;
  }
  function npc(id, x, z, c) {
    const p = person(x, z, c);
    p.traverse((o) => {
      if (o.isMesh) {
        o.userData.id = id;
        hits.push(o);
      }
    });
    return p;
  }
  npc("guard", -3.8, 1, 0x435c70);
  sign("站务", -3.8, 2.65, 1);
  const friend = npc("friend", 7.8, -6, 0x9b6054);
  const shade = mesh(
    new T.ConeGeometry(1, 0.48, 12),
    0x507eaa,
    0.1,
    2.2,
    0,
    friend,
  );
  shade.userData.id = "friend";
  hits.push(shade);
  player = person(-9, 2, 0xc17943);
  if (stage > 0)
    player.position.set(
      ...(stage === 1
        ? [-3, 0.32, 1]
        : stage === 2
          ? [6, 0.32, -2]
          : [7, 0.32, -6]),
    );
  for (let i = 0; i < 14; i++) {
    let x = -18 + i * 2.6,
      z = -12 - Math.sin(i) * 1.4;
    box(x, 1, z, 0.4, 2.5, 0.4, 0x76664d);
    orb(x, 3, z, 1.6 + (i % 3) * 0.26, [0x7f9873, 0x829c84, 0xa4ad72][i % 3]);
  }
  box(9, 0.85, -5, 2.7, 0.18, 0.7, 0x826844);
  for (const x of [8, 10]) box(x, 0.55, -5, 0.2, 0.58, 0.45, 0x525952);
  let angle = 0.38,
    wanted = angle;
  const focus = new T.Vector3(),
    clock = new T.Clock(),
    ray = new T.Raycaster(),
    ground = new T.Plane(new T.Vector3(0, 1, 0), -0.32);
  function size() {
    const w = root.clientWidth,
      h = root.clientHeight,
      a = w / h,
      e = Math.min(16, Math.max(7.7, 14 / a));
    cam.left = -e * a;
    cam.right = e * a;
    cam.top = e;
    cam.bottom = -e;
    cam.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(size).observe(root);
  size();
  turn = (d) => (wanted += d);
  walkTo = (x, z, cb) => {
    target = new T.Vector3(x, 0.32, z);
    arrival = cb;
  };
  let start = null,
    drag = false;
  const cv = renderer.domElement;
  cv.onpointerdown = (e) => {
    cv.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY, a: wanted };
    drag = false;
  };
  cv.onpointermove = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.hypot(dx, e.clientY - start.y) > 6) drag = true;
    if (drag) wanted = start.a - dx * 0.009;
  };
  cv.onpointercancel = () => (start = null);
  cv.onpointerup = (e) => {
    if (!start) return;
    start = null;
    if (drag) return;
    const r = cv.getBoundingClientRect();
    ray.setFromCamera(
      {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: 1 - ((e.clientY - r.top) / r.height) * 2,
      },
      cam,
    );
    const hit = ray.intersectObjects(hits, false)[0];
    if (hit) {
      visit(hit.object.userData.id);
      return;
    }
    const pos = new T.Vector3();
    if (ray.ray.intersectPlane(ground, pos))
      walkTo(
        T.MathUtils.clamp(pos.x, -10.6, 10.6),
        T.MathUtils.clamp(pos.z, -6.7, 4.2),
        null,
      );
  };
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (target) {
      const delta = target.clone().sub(player.position),
        dist = delta.length();
      if (dist <= dt * 4) {
        player.position.copy(target);
        target = null;
        const cb = arrival;
        arrival = null;
        cb?.();
      } else {
        player.rotation.y = Math.atan2(delta.x, delta.z);
        player.position.addScaledVector(delta, (dt * 4) / dist);
      }
    }
    angle += (wanted - angle) * (1 - Math.exp(-dt * 8));
    const weight = root.clientWidth < 650 ? 0.72 : 0.24;
    focus.lerp(
      new T.Vector3(player.position.x * weight, 0, player.position.z * weight),
      1 - Math.exp(-dt * 4),
    );
    cam.position.set(
      focus.x + Math.sin(angle) * 27,
      23,
      focus.z + Math.cos(angle) * 27,
    );
    cam.lookAt(focus);
    train.position.x = Math.min(50, Math.max(0, clock.elapsedTime - 4) * 1.6);
    renderer.render(scene, cam);
  });
}
try {
  station();
} catch (err) {
  console.warn(err);
  $("fallback").hidden = false;
}
