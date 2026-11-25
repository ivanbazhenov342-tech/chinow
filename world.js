import * as T from "./vendor/three.module.js";

const palettes = [
  { wall: 0xe8d6b3, roof: 0x3a625b, leaf: 0x73936d },
  { wall: 0xe9d6b8, roof: 0x42665a, leaf: 0x83975c },
  { wall: 0xe8c8ab, roof: 0x776256, leaf: 0x73906b },
  { wall: 0xf0d6b3, roof: 0x4c6d6c, leaf: 0x759e78 },
];
export function createWorld(root, onVisit) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  root.prepend(renderer.domElement);
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xb8cfc5, 0.011);
  const camera = new T.OrthographicCamera(-15, 15, 12, -12, 0.1, 160);
  const sunlight = new T.DirectionalLight(0xffedc6, 3);
  sunlight.position.set(-14, 28, 14);
  sunlight.castShadow = true;
  const shadowSize = root.clientWidth < 700 ? 1024 : 2048;
  sunlight.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sunlight.shadow.camera, {
    left: -29,
    right: 29,
    top: 29,
    bottom: -29,
    near: 0.1,
    far: 90,
  });
  sunlight.shadow.camera.updateProjectionMatrix();
  sunlight.shadow.normalBias = 0.045;
  sunlight.shadow.bias = -0.0001;
  scene.add(sunlight, new T.HemisphereLight(0xfff3d9, 0x678e80, 2.1));
  const cube = new T.BoxGeometry(),
    sphere = new T.SphereGeometry(1, 12, 10);
  const materials = new Map();
  let town = new T.Group(),
    hits = [],
    obstacles = [],
    animated = [],
    player,
    marker,
    route = [],
    arrival = null;
  scene.add(town);
  function material(color) {
    if (!materials.has(color))
      materials.set(
        color,
        new T.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
    return materials.get(color);
  }
  function mesh(geometry, color, x, y, z, parent = town) {
    const o = new T.Mesh(geometry, material(color));
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(x, y, z, w, h, d, color, parent) {
    const o = mesh(cube, color, x, y, z, parent);
    o.scale.set(w, h, d);
    return o;
  }
  function orb(x, y, z, r, color, parent) {
    const o = mesh(sphere, color, x, y, z, parent);
    o.scale.setScalar(r);
    return o;
  }
  function label(text, x, y, z, id, scale = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#294e43";
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = "#d4bc80";
    ctx.lineWidth = 5;
    ctx.strokeRect(9, 9, 494, 174);
    ctx.font = "76px serif";
    ctx.fillStyle = "#fff0cb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 103);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const sprite = new T.Sprite(
      new T.SpriteMaterial({ map: texture, depthTest: true }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(3.1 * scale, 1.16 * scale, 1);
    town.add(sprite);
    if (id) {
      sprite.userData.id = id;
      hits.push(sprite);
    }
    return sprite;
  }
  function lantern(x, y, z, parent = town) {
    mesh(
      new T.CylinderGeometry(0.05, 0.05, 0.35, 6),
      0x806140,
      x,
      y + 0.45,
      z,
      parent,
    );
    const body = orb(x, y, z, 0.25, 0xc66c43, parent);
    body.scale.y = 0.9;
    mesh(
      new T.CylinderGeometry(0.13, 0.13, 0.07, 8),
      0xdbb16c,
      x,
      y + 0.24,
      z,
      parent,
    );
    mesh(
      new T.CylinderGeometry(0.035, 0.035, 0.22, 5),
      0xdbb16c,
      x,
      y - 0.35,
      z,
      parent,
    );
    animated.push({ kind: "lantern", o: body, y, phase: x + z });
  }
  function building(
    x,
    z,
    w = 5,
    d = 3.5,
    text = "茶",
    id = "tea",
    palette = palettes[0],
  ) {
    const group = new T.Group();
    town.add(group);
    group.position.set(x, 0, z);
    box(0, 0.42, 0, w + 0.65, 0.3, d + 0.65, 0xa69f88, group);
    box(0, 1.85, 0, w, 2.7, d, palette.wall, group);
    for (const a of [-1, 1])
      box(
        a * (w / 2 - 0.12),
        1.9,
        d / 2 + 0.06,
        0.19,
        2.8,
        0.19,
        0x6a4e39,
        group,
      );
    box(0, 1.45, d / 2 + 0.08, 1.06, 2.15, 0.12, 0x5a5542, group);
    for (const a of [-1, 1]) {
      box(a * w * 0.32, 2, d / 2 + 0.08, 0.9, 1.15, 0.1, 0x8d9f88, group);
      for (let t = -1; t <= 1; t++)
        box(
          a * w * 0.32 + t * 0.26,
          2,
          d / 2 + 0.15,
          0.055,
          1.15,
          0.06,
          0x72553c,
          group,
        );
      box(a * w * 0.32, 2, d / 2 + 0.16, 0.94, 0.07, 0.06, 0x72553c, group);
    }
    const shape = new T.Shape();
    shape.moveTo(-w / 2 - 0.8, 3.16);
    shape.quadraticCurveTo(-w * 0.3, 3.12, 0, 4.5);
    shape.quadraticCurveTo(w * 0.3, 3.12, w / 2 + 0.8, 3.16);
    shape.lineTo(w / 2 + 0.6, 2.97);
    shape.quadraticCurveTo(w * 0.28, 3.02, 0, 4.22);
    shape.quadraticCurveTo(-w * 0.28, 3.02, -w / 2 - 0.6, 2.97);
    shape.closePath();
    mesh(
      new T.ExtrudeGeometry(shape, {
        depth: d + 1,
        bevelEnabled: false,
        steps: 1,
      }),
      palette.roof,
      0,
      0,
      -d / 2 - 0.5,
      group,
    );
    box(0, 4.49, 0, 0.16, 0.14, d + 1.25, 0x55776a, group);
    for (let a of [-1, 1])
      lantern(a * (w / 2 - 0.45), 2.85, d / 2 + 0.42, group);
    label(text, x, 2.85, z + d / 2 + 0.2, id, 0.76);
    obstacles.push({ x, z, w: w + 0.5, d: d + 0.5 });
    return group;
  }
  function tree(x, z, size = 1, color = 0x769569) {
    mesh(
      new T.CylinderGeometry(0.14 * size, 0.22 * size, 2.2 * size, 7),
      0x806b4b,
      x,
      1.25 * size,
      z,
    );
    for (let i = 0; i < 3; i++) {
      const leaf = orb(
        x + Math.sin(i * 2.2) * 0.55 * size,
        (2.6 + i * 0.4) * size,
        z + Math.cos(i * 2.2) * 0.5 * size,
        (1.12 - i * 0.12) * size,
        color,
      );
      leaf.scale.y = 0.7;
    }
  }
  function person(x, z, color, id) {
    const group = new T.Group();
    group.position.set(x, 0.32, z);
    town.add(group);
    box(0, 0.24, 0, 0.42, 0.43, 0.3, 0x44574f, group);
    for (const side of [-1, 1])
      box(side * 0.14, 0.12, 0.03, 0.16, 0.24, 0.25, 0x4b4b40, group);
    mesh(new T.CylinderGeometry(0.26, 0.34, 0.75, 8), color, 0, 0.79, 0, group);
    orb(0, 1.39, 0, 0.25, 0xd2a278, group);
    const hair = orb(0, 1.51, -0.035, 0.24, 0x403f34, group);
    hair.scale.y = 0.7;
    for (const side of [-1, 1]) {
      const arm = box(side * 0.32, 0.8, 0, 0.14, 0.55, 0.17, color, group);
      arm.rotation.z = side * 0.1;
    }
    if (id)
      group.traverse((o) => {
        if (o.isMesh) {
          o.userData.id = id;
          hits.push(o);
        }
      });
    return group;
  }
  function train() {
    const group = new T.Group();
    town.add(group);
    for (let i = 0; i < 3; i++) {
      let x = -13 + i * 8;
      box(x, 1.6, 8, 7.7, 2.1, 2.1, 0x37624f, group);
      box(x, 2.78, 8, 7.85, 0.25, 2.3, 0x465652, group);
      box(x, 0.9, 6.91, 7.6, 0.25, 0.06, 0xd8b772, group);
      for (let j = 0; j < 6; j++) {
        box(x - 3 + j * 1.16, 2, 6.91, 0.78, 0.7, 0.05, 0xadd5cb, group);
        box(x - 3 + j * 1.16, 2.38, 6.86, 0.8, 0.06, 0.06, 0xddd7b4, group);
      }
      for (let side of [-1, 1])
        mesh(
          new T.CylinderGeometry(0.33, 0.33, 2, 10),
          0x444e46,
          x + side * 2.5,
          0.5,
          8,
          group,
        ).rotation.x = Math.PI / 2;
    }
    animated.push({ kind: "train", o: group });
  }
  function table(x, z) {
    mesh(new T.CylinderGeometry(0.9, 0.9, 0.14, 20), 0xa77a4a, x, 1.1, z);
    mesh(new T.CylinderGeometry(0.12, 0.2, 1, 8), 0x735c41, x, 0.6, z);
    for (let side of [-1, 1])
      mesh(
        new T.CylinderGeometry(0.35, 0.4, 0.55, 10),
        0x806542,
        x + side * 1.3,
        0.6,
        z,
      );
    mesh(
      new T.CylinderGeometry(0.1, 0.08, 0.19, 12),
      0xeee1b7,
      x + 0.3,
      1.27,
      z,
    );
    mesh(
      new T.CylinderGeometry(0.15, 0.19, 0.25, 12),
      0x6f9074,
      x - 0.2,
      1.3,
      z,
    );
    for (let i = 0; i < 4; i++) {
      const puff = orb(x - 0.2, 1.65 + i * 0.22, z, 0.07, 0xeff2dc);
      puff.material = new T.MeshBasicMaterial({
        color: 0xf3f2de,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      animated.push({
        kind: "steam",
        o: puff,
        base: 1.55,
        phase: i * 0.6,
        x: x - 0.2,
        z,
      });
    }
    obstacles.push({ x, z, w: 2, d: 2 });
  }
  function districtScenery(index) {
    if ([3, 8, 10].includes(index)) {
      const pond = mesh(
        new T.CylinderGeometry(2.2, 2.2, 0.13, 36),
        0x739c8b,
        0,
        0.4,
        -7,
      );
      pond.scale.z = 0.7;
      const rim = mesh(
        new T.TorusGeometry(2.25, 0.12, 6, 36),
        0xaeb49a,
        0,
        0.48,
        -7,
      );
      rim.rotation.x = Math.PI / 2;
      rim.scale.y = 0.7;
      obstacles.push({ x: 0, z: -7, w: 4.7, d: 3.6 });
      for (let i = 0; i < 5; i++) {
        const x = Math.sin(i * 2.3) * 1.45,
          z = -7 + Math.cos(i * 2.3) * 0.8;
        const pad = mesh(
          new T.CylinderGeometry(0.28, 0.28, 0.025, 12),
          0x648a63,
          x,
          0.49,
          z,
        );
        if (i % 2 === 0) orb(x, 0.61, z, 0.13, 0xd3a49b);
      }
      tree(-10, 1, 0.9, index === 8 ? 0xbf9d63 : 0x73946f);
      tree(8, -3, 0.7, index === 8 ? 0xc1a16a : 0x8b9e72);
    }
    if (index === 4) {
      const tower = building(0, -8, 3, 3, "时", "resident", palettes[3]);
      box(0, 5, 0, 2.2, 1.1, 2.2, 0xd4c4a1, tower);
      mesh(
        new T.ConeGeometry(2.2, 0.9, 4),
        0x4b6d62,
        0,
        6,
        0,
        tower,
      ).rotation.y = Math.PI / 4;
      label("时间", 0, 5.2, -6.4, "resident", 0.6);
    }
    if (index === 7) {
      for (let i = 0; i < 3; i++) {
        box(-1 + i * 1.3, 0.9, -6, 1, 0.18, 0.9, 0x8c6d46);
        for (let j = 0; j < 3; j++)
          box(
            -1 + i * 1.3,
            0.99 + j * 0.09,
            -6,
            0.8,
            0.07,
            0.65,
            [0xb59568, 0x6a8a7b, 0xc4ad7d][j],
          );
      }
      obstacles.push({ x: 0.3, z: -6, w: 4, d: 1.5 });
    }
    if (index === 1 || index === 3) {
      for (const x of [-1, 2]) box(x, 2.8, -7, 0.1, 4.8, 0.1, 0x7e7250);
      box(0.5, 4.5, -7, 3.2, 0.06, 0.06, 0x8c7859);
      for (let i = 0; i < 4; i++)
        box(
          -0.7 + i * 0.7,
          4.1,
          -7,
          0.45,
          0.65,
          0.04,
          [0xc6a775, 0x9ea88a, 0xb7886c, 0x779a8b][i],
        );
    }
    if (index === 11) {
      for (let i = 0; i < 8; i++) {
        const x = -9 + i * 2.6;
        box(x, 3.9, 1, 0.075, 7.2, 0.075, 0x80694d);
        lantern(x, 4.4, 1);
        lantern(x, 4.1, -4);
      }
      scene.fog.color.setHex(0xbac1bc);
      sunlight.color.setHex(0xffd69b);
    } else {
      scene.fog.color.setHex(0xb8cfc5);
      sunlight.color.setHex(0xffedc6);
    }
  }
  const places = {
    guard: [-5, 3],
    entry: [-1, -1],
    exit: [4, -1],
    friend: [6, -3],
    tea: [-3, -6],
    resident: [3, 1],
    board: [-1, 1],
  };
  let time = 0,
    angle = 0.65,
    wanted = 0.65,
    zoom = 1,
    zoomTarget = 1;
  function build(index = 0) {
    scene.remove(town);
    town.traverse((o) => {
      if (o.geometry && o.geometry !== cube && o.geometry !== sphere)
        o.geometry.dispose();
      if (o.isSprite) {
        o.material.map.dispose();
        o.material.dispose();
      }
      if (o.material?.transparent && !o.isSprite) o.material.dispose();
    });
    town = new T.Group();
    scene.add(town);
    hits = [];
    obstacles = [];
    animated = [];
    route = [];
    arrival = null;
    time = 0;
    const pal = palettes[index % palettes.length];
    box(0, -0.6, -2, 34, 1.4, 28, 0x91a487);
    box(0, 0.12, 0, 24, 0.4, 19, 0xc9c2a6);
    box(0, 0.34, 0, 21, 0.035, 5, 0xe0d3b5);
    box(4, 0.34, -4, 4, 0.035, 13, 0xe0d3b5);
    for (let i = 0; i < 28; i++) {
      const x = -10 + (i % 7) * 3.3,
        z = -8 + Math.floor(i / 7) * 4.8;
      box(x, 0.35, z, 1.5, 0.03, 0.035, 0xb8b49a);
    }
    // Canal and embankment are raised separately to prevent coplanar surfaces.
    box(14, -0.05, -1, 3.8, 0.2, 27, 0x679b98);
    for (let z = -13; z < 13; z += 2)
      box(11.9, 0.3, z, 0.32, 0.7, 1.8, 0xb1b5a0);
    box(14, 0.7, -1, 4, 0.24, 3, 0xb59b72);
    for (const z of [-2.3, 0.3]) {
      box(14, 1.23, z, 4, 0.13, 0.12, 0x7d6850);
      for (let x = 12.3; x < 16; x += 1)
        box(x, 1, z, 0.13, 0.9, 0.13, 0x7d6850);
    }
    if (index === 0) {
      places.tea = [-3, -6];
      places.friend = [6, -3];
      places.guard = [-5, 3];
      for (let z of [7.2, 8.8]) box(0, 0.35, z, 35, 0.15, 0.12, 0x666957);
      for (let x = -17; x < 17; x++) box(x, 0.22, 8, 0.18, 0.11, 2.5, 0x82775e);
      train();
      building(-7, -4, 5, 3.6, "山江站", "guard", pal);
      building(-5, -9, 5, 3.6, "茶馆", "tea", palettes[1]);
      building(5, -9, 4, 3.5, "客栈", "friend", pal);
      for (const [id, x, text] of [
        ["entry", -1, "入口"],
        ["exit", 4, "出口"],
      ]) {
        for (const side of [-1, 1])
          box(x + side * 1.5, 1.8, -1, 0.22, 3, 0.25, 0x7b6243);
        box(x, 3.5, -1, 3.5, 0.25, 0.85, pal.roof);
        label(text, x, 3, -1, id, 0.85);
      }
    } else {
      const texts = [
        ["学堂", "家", "茶馆"],
        ["市场", "水果", "商店"],
        ["客栈", "家", "书店"],
        ["钟楼", "茶馆", "邮局"],
        ["茶馆", "饭馆", "厨房"],
        ["问路", "车站", "地图"],
        ["工坊", "学校", "公司"],
        ["照相馆", "书店", "旧物"],
        ["剧院", "商店", "茶馆"],
        ["药店", "医院", "休息"],
        ["灯会", "茶馆", "客栈"],
      ];
      const names = texts[(index - 1) % texts.length];
      building(-7, -6, 5, 4, names[0], "tea", pal);
      building(5, -8, 5, 3.5, names[1], "friend", pal);
      building(-7, 6, 4, 3.5, names[2], "guard", pal);
      if (index === 2 || index === 9)
        for (let j = 0; j < 3; j++) {
          box(-1 + j * 3.3, 0.9, -5, 2.5, 0.25, 1.5, 0x8a6f4d);
          const canopy = box(
            -1 + j * 3.3,
            2.6,
            -5,
            2.8,
            0.18,
            2,
            j % 2 ? 0xb7684c : 0x68816b,
          );
          canopy.rotation.x = 0.12;
          for (let k = 0; k < 5; k++)
            orb(
              -1 + j * 3.3 + (k % 3) * 0.6 - 0.6,
              1.16,
              -5 + Math.floor(k / 3) * 0.5,
              0.22,
              0xd3a457,
            );
          obstacles.push({ x: -1 + j * 3.3, z: -5, w: 2.8, d: 2 });
        }
      places.tea = [-3, -4];
      places.friend = [6, -3];
      places.guard = [-5, 3];
    }
    districtScenery(index);
    const guard = person(-5, 3, 0x466e7a, "guard");
    mesh(
      new T.CylinderGeometry(0.28, 0.28, 0.12, 10),
      0x314b52,
      0,
      1.68,
      0,
      guard,
    );
    const friend = person(6, -3, 0xb46d52, "friend");
    mesh(
      new T.CylinderGeometry(0.025, 0.025, 1.8, 6),
      0x6d674e,
      0.33,
      1.3,
      0,
      friend,
    );
    mesh(new T.ConeGeometry(0.95, 0.38, 16), 0x527e9a, 0.33, 2.2, 0, friend);
    person(3, 1, 0x7e9270, "resident");
    label("茶", -4, 2.7, -6, "tea", 0.62);
    label("?", 3, 2.7, 1, "resident", 0.4);
    for (let i = 0; i < 4; i++) {
      const x = -1 + i * 2.6;
      const p = person(x, 3.8, [0xab8e56, 0x718b79, 0x92786a, 0x497b7b][i]);
      animated.push({ kind: "walker", o: p, x, z: 3.8, phase: i * 2 });
    }
    table(-7, -0.8);
    table(8, 3.5);
    for (let i = 0; i < 18; i++) {
      const x = -14 + (i % 9) * 3.3,
        z = i < 9 ? -13 : 12;
      tree(x, z, 0.7 + (i % 3) * 0.2, [pal.leaf, 0x93a477, 0x628d75][i % 3]);
    }
    tree(-11, -1, 0.8, pal.leaf);
    tree(10, -6, 0.8, pal.leaf);
    for (let i = 0; i < 9; i++) {
      const stone = orb(-10 + i * 3.5, -0.3, -16, 3 + (i % 3), 0x819d8d);
      stone.scale.y = 1.7;
    }
    for (let i = 0; i < 8; i++) {
      const cloud = orb(-28 + i * 8, 11 + (i % 3), -23, 2.8, 0xe1e6d5);
      cloud.scale.set(2.3, 0.25, 1);
      animated.push({ kind: "cloud", o: cloud, x: cloud.position.x, phase: i });
    }
    player = person(-8, 3, 0xcf8c4b);
    box(0, 0.8, -0.29, 0.48, 0.6, 0.2, 0x835c3e, player);
    marker = mesh(new T.RingGeometry(0.48, 0.63, 36), 0xd69c48, -5, 0.39, 3);
    marker.rotation.x = -Math.PI / 2;
    marker.material = new T.MeshBasicMaterial({
      color: 0xd5a253,
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    marker.visible = false;
    focus.set(-1, 0, -1);
    wanted = 0.65;
    angle = 0.65;
  }
  // Grid paths keep the character outside building footprints.
  const cell = 0.6,
    minX = -10.8,
    minZ = -10.2,
    cols = 37,
    rows = 26;
  function gridPosition(x, z) {
    return [
      T.MathUtils.clamp(Math.round((x - minX) / cell), 0, cols - 1),
      T.MathUtils.clamp(Math.round((z - minZ) / cell), 0, rows - 1),
    ];
  }
  function blocked(x, z) {
    return obstacles.some(
      (o) =>
        Math.abs(x - o.x) < o.w / 2 + 0.26 &&
        Math.abs(z - o.z) < o.d / 2 + 0.26,
    );
  }
  function pathTo(x, z) {
    const start = gridPosition(player.position.x, player.position.z),
      end = gridPosition(x, z);
    const key = (a, b) => b * cols + a,
      queue = [start],
      previous = new Map([[key(...start), null]]);
    let found = null;
    for (let q = 0; q < queue.length; q++) {
      const [a, b] = queue[q];
      if (a === end[0] && b === end[1]) {
        found = [a, b];
        break;
      }
      for (const [da, db] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const na = a + da,
          nb = b + db,
          k = key(na, nb);
        if (
          na < 0 ||
          na >= cols ||
          nb < 0 ||
          nb >= rows ||
          previous.has(k) ||
          blocked(minX + na * cell, minZ + nb * cell)
        )
          continue;
        previous.set(k, [a, b]);
        queue.push([na, nb]);
      }
    }
    if (!found) return null;
    const path = [];
    while (found) {
      path.push(
        new T.Vector3(minX + found[0] * cell, 0.32, minZ + found[1] * cell),
      );
      found = previous.get(key(...found));
    }
    return path.reverse().slice(1);
  }
  function visit(id) {
    const point = places[id];
    if (!point) return;
    const path = pathTo(...point);
    if (!path) return false;
    route = path;
    arrival = () => onVisit(id);
    if (!route.length) {
      arrival();
      arrival = null;
    }
  }
  const focus = new T.Vector3(-1, 0, -1),
    clock = new T.Clock(),
    ray = new T.Raycaster(),
    ground = new T.Plane(new T.Vector3(0, 1, 0), -0.32);
  function size() {
    const w = root.clientWidth,
      h = root.clientHeight,
      a = w / h,
      e = w < 700 ? 12.6 : 12;
    camera.left = -e * a * zoom;
    camera.right = e * a * zoom;
    camera.top = e * zoom;
    camera.bottom = -e * zoom;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(size).observe(root);
  const pointers = new Map();
  let gesture = null,
    drag = false;
  const cv = renderer.domElement;
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture = {
      x: e.clientX,
      y: e.clientY,
      a: wanted,
      zoom: zoomTarget,
      distance: 0,
    };
    drag = false;
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      gesture.distance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      drag = true;
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()],
        distance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (gesture.distance)
        zoomTarget = T.MathUtils.clamp(
          (gesture.zoom * gesture.distance) / Math.max(20, distance),
          0.6,
          1.6,
        );
      return;
    }
    const dx = e.clientX - gesture.x;
    if (Math.hypot(dx, e.clientY - gesture.y) > 7) drag = true;
    if (drag) wanted = gesture.a - dx * 0.008;
  });
  cv.addEventListener("pointerup", (e) => {
    pointers.delete(e.pointerId);
    if (!gesture) return;
    const wasDrag = drag;
    gesture = null;
    if (wasDrag) return;
    const rect = cv.getBoundingClientRect();
    ray.setFromCamera(
      {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: 1 - ((e.clientY - rect.top) / rect.height) * 2,
      },
      camera,
    );
    const hit = ray.intersectObjects(hits, false)[0];
    if (hit) {
      visit(hit.object.userData.id);
      return;
    }
    const pos = new T.Vector3();
    if (ray.ray.intersectPlane(ground, pos)) {
      const x = T.MathUtils.clamp(pos.x, -10.5, 10.5),
        z = T.MathUtils.clamp(pos.z, -9.7, 4.5);
      if (!blocked(x, z)) {
        route = pathTo(x, z) || [];
        arrival = null;
      }
    }
  });
  cv.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    gesture = null;
  });
  cv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomTarget = T.MathUtils.clamp(zoomTarget + e.deltaY * 0.001, 0.6, 1.6);
    },
    { passive: false },
  );
  cv.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    document.getElementById("fallback").hidden = false;
  });
  build(0);
  size();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (document.hidden) return;
    time += dt;
    let walking = route.length > 0;
    if (walking) {
      const delta = route[0].clone().sub(player.position),
        dist = delta.length();
      if (dist < dt * 4.5) {
        player.position.copy(route.shift());
        if (!route.length) {
          const cb = arrival;
          arrival = null;
          cb?.();
        }
      } else {
        player.rotation.y = Math.atan2(delta.x, delta.z);
        player.position.addScaledVector(delta, (dt * 4.5) / dist);
      }
    }
    player.position.y =
      0.32 + (walking && !reduced ? Math.abs(Math.sin(time * 11)) * 0.055 : 0);
    angle = reduced ? wanted : T.MathUtils.damp(angle, wanted, 8, dt);
    if (Math.abs(zoom - zoomTarget) > 0.001) {
      zoom = T.MathUtils.damp(zoom, zoomTarget, 9, dt);
      size();
    }
    const mobile = root.clientWidth < 700;
    focus.lerp(
      new T.Vector3(
        player.position.x * (mobile ? 0.8 : 0.28),
        0,
        player.position.z * (mobile ? 0.6 : 0.25) - 2,
      ),
      1 - Math.exp(-dt * 4),
    );
    camera.position.set(
      focus.x + Math.sin(angle) * 30,
      26,
      focus.z + Math.cos(angle) * 30,
    );
    camera.lookAt(focus);
    if (mobile) {
      camera.setViewOffset(
        root.clientWidth,
        root.clientHeight,
        0,
        root.clientHeight * 0.14,
        root.clientWidth,
        root.clientHeight,
      );
    } else camera.clearViewOffset();
    for (const a of animated) {
      if (a.kind === "train")
        a.o.position.x = reduced
          ? 0
          : Math.min(75, Math.max(0, time - 7) * 1.5);
      if (reduced) continue;
      if (a.kind === "walker") {
        a.o.position.x = a.x + Math.sin(time * 0.22 + a.phase) * 1.5;
        a.o.rotation.y =
          Math.cos(time * 0.22 + a.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
        a.o.position.y = 0.32 + Math.abs(Math.sin(time * 6 + a.phase)) * 0.04;
      }
      if (a.kind === "steam") {
        const t = (time * 0.35 + a.phase) % 1.5;
        a.o.position.y = a.base + t;
        a.o.position.x = a.x + Math.sin(time + a.phase) * 0.09;
        a.o.material.opacity = 0.32 * (1 - t / 1.5);
      }
      if (a.kind === "cloud")
        a.o.position.x = a.x + Math.sin(time * 0.035 + a.phase) * 2;
      if (a.kind === "lantern")
        a.o.rotation.z = Math.sin(time * 1.2 + a.phase) * 0.055;
    }
    if (marker.visible && !reduced)
      marker.material.opacity = 0.6 + Math.sin(time * 3) * 0.3;
    renderer.render(scene, camera);
  });
  return {
    visit,
    rotate: (delta) => (wanted += delta),
    zoom: (delta) =>
      (zoomTarget = T.MathUtils.clamp(zoomTarget + delta, 0.6, 1.6)),
    district: (index) => build(index),
    highlight: (id) => {
      if (places[id]) {
        marker.position.set(places[id][0], 0.39, places[id][1]);
        marker.visible = true;
      } else marker.visible = false;
    },
  };
}
