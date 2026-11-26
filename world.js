import * as T from "./vendor/three.module.js";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";
import { createSurfaces } from "./materials.js?v=7";
import { createCharacters } from "./characters.js?v=7";

import { inkMaterial, copyInk, inkEdges } from "./art.js?v=7";

import { drawNeighborhood } from "./neighborhood.js?v=7";

const palettes = [
  { wall: 0xf5e2bd, roof: 0x3a625b, leaf: 0x536b42 },
  { wall: 0xe4d6b7, roof: 0x42665a, leaf: 0x667742 },
  { wall: 0xe6c3a6, roof: 0x776256, leaf: 0x506941 },
  { wall: 0xe9dec6, roof: 0x4c6d6c, leaf: 0x476c46 },
];
export function createWorld(root, onVisit) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.toneMappingExposure = 1;
  root.prepend(renderer.domElement);
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xc4c7be, 0.012);
  const camera = new T.OrthographicCamera(-15, 15, 12, -12, 0.1, 160);
  const sunlight = new T.DirectionalLight(0xffe5bc, 2.0);
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
  scene.add(sunlight, new T.HemisphereLight(0xc6d8df, 0xa29377, 1.35));
  const cube = new T.BoxGeometry(),
    sphere = new T.SphereGeometry(1, 24, 16);
  const surfaces = createSurfaces(T, renderer);
  const characters = createCharacters(renderer, surfaces.gradient);
  let architectures = [],
    occluders = [];
  const occlusionRay = new T.Raycaster();
  let occlusionKey = "",
    covering = new Set();
  let town = new T.Group(),
    hits = [],
    obstacles = [],
    animated = [],
    player,
    marker,
    route = [],
    arrival = null,
    studyGroup = null,
    studyKey = "",
    rewardGroup = null;
  scene.add(town);
  const woodColors = new Set([
    0xa77a4a, 0x735c41, 0x806542, 0x8a6f4d, 0x8c7859, 0x7e7250, 0x6d674e,
    0x826844, 0x80694d, 0x7d6f4e, 0x8c6d46, 0x7d6850, 0x835c3e, 0x684c37,
  ]);
  function material(color) {
    if (color?.isMaterial) return color;
    if (woodColors.has(color)) return surfaces.wood;
    if (color === 0x819d8d || color === 0xaeb49a) return surfaces.stone;
    return surfaces.solid(color);
  }

  function mesh(geometry, color, x, y, z, parent = town) {
    const o = new T.Mesh(geometry, material(color));
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(x, y, z, w, h, d, color, parent) {
    const mat = material(color);
    const geometry = mat.map ? new T.BoxGeometry(w, h, d) : cube;
    if (mat.map) {
      const positions = geometry.attributes.position,
        normals = geometry.attributes.normal,
        uv = geometry.attributes.uv,
        density = mat.userData.uvScale || 1;
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(normals.getX(i)),
          ny = Math.abs(normals.getY(i)),
          nz = Math.abs(normals.getZ(i));
        const u = nx > ny && nx > nz ? positions.getZ(i) : positions.getX(i);
        const v = ny > nx && ny > nz ? positions.getZ(i) : positions.getY(i);
        uv.setXY(i, u * density, v * density);
      }
    }
    const object = mesh(geometry, mat, x, y, z, parent);
    if (!mat.map) object.scale.set(w, h, d);
    if (h > 0.55 && w > 0.65 && d > 0.1 && Math.max(w, h, d) < 10)
      inkEdges(T, object, 0.26);
    return object;
  }
  function orb(x, y, z, r, color, parent) {
    const o = mesh(sphere, color, x, y, z, parent);
    o.scale.setScalar(r);
    return o;
  }
  function label(text, x, y, z, id, scale = 1, parent = town) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#8c775d";
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, 484, 164);
    ctx.font = Math.min(136, 440 / Array.from(text).length) + "px serif";
    ctx.fillStyle = "#344448";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 102);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const paint = new T.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.06,
      depthWrite: false,
    });
    paint.userData.signFace = true;
    const board = new T.Group();
    board.name = "sign-" + (id || text);
    board.userData.physicalSign = true;
    board.position.set(x, y, z);
    parent.add(board);
    const width = 3.1 * scale,
      height = 1.16 * scale,
      depth = 0.14 * scale;
    box(0, 0, 0, width, height, depth, surfaces.signWood, board);
    for (const side of [-1, 1]) {
      const face = mesh(
        new T.PlaneGeometry(width - 0.06, height - 0.06),
        paint,
        0,
        0,
        side * (depth / 2 + 0.006),
        board,
      );
      face.rotation.y = side < 0 ? Math.PI : 0;
      face.castShadow = false;
    }
    for (const cornerX of [-1, 1])
      for (const cornerY of [-1, 1]) {
        orb(
          cornerX * (width / 2 - 0.07),
          cornerY * (height / 2 - 0.07),
          depth / 2 + 0.012,
          0.024,
          surfaces.bronze,
          board,
        );
      }
    if (id)
      board.traverse((o) => {
        if (o.isMesh) {
          o.userData.id = id;
          hits.push(o);
        }
      });
    return board;
  }
  function lantern(x, y, z, parent = town) {
    const group = new T.Group();
    group.userData.isMotionRoot = true;
    group.position.set(x, y + 0.4, z);
    parent.add(group);
    mesh(
      new T.CylinderGeometry(0.012, 0.012, 0.36, 8),
      surfaces.bronze,
      0,
      -0.17,
      0,
      group,
    );
    const profile = [
      [0.12, -0.25],
      [0.2, -0.2],
      [0.265, -0.06],
      [0.265, 0.06],
      [0.2, 0.2],
      [0.12, 0.25],
    ].map((p) => new T.Vector2(...p));
    const paper = surfaces.fabric(0xc77647);
    paper.emissive.setHex(0x40200b);
    paper.emissiveIntensity = 0.12;
    mesh(new T.LatheGeometry(profile, 24), paper, 0, -0.4, 0, group);
    for (const side of [-1, 1])
      mesh(
        new T.CylinderGeometry(0.125, 0.125, 0.055, 16),
        surfaces.bronze,
        0,
        -0.4 + side * 0.26,
        0,
        group,
      );
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4,
        curve = new T.CatmullRomCurve3(
          profile.map(
            (p) =>
              new T.Vector3(
                Math.sin(angle) * p.x,
                p.y - 0.4,
                Math.cos(angle) * p.x,
              ),
          ),
        );
      mesh(
        new T.TubeGeometry(curve, 10, 0.006, 4, false),
        surfaces.bronze,
        0,
        0,
        0,
        group,
      );
    }
    for (let i = 0; i < 4; i++)
      mesh(
        new T.CylinderGeometry(0.007, 0.004, 0.2, 5),
        surfaces.fabric(0x984628),
        (i - 1.5) * 0.018,
        -0.82,
        0,
        group,
      );
    batchArtwork(group, false);
    animated.push({ kind: "lantern", o: group, phase: x + z });
  }
  function roofGeometry(width, depth) {
    const positions = [],
      uv = [],
      indices = [],
      columns = 24,
      rows = 16;
    for (let row = 0; row <= rows; row++) {
      const z = (row / rows - 0.5) * depth;
      for (let column = 0; column <= columns; column++) {
        const x = (column / columns - 0.5) * width,
          u = Math.abs(z) / (depth / 2),
          v = Math.abs(x) / (width / 2);
        const hip = Math.max(0, (v - 0.72) / 0.28);
        const y =
          4.45 -
          1.6 * u +
          0.38 * Math.pow(u, 4) -
          0.72 * hip * (1 - u) +
          0.17 * Math.pow(v, 6) * Math.pow(u, 4);
        positions.push(x, y, z);
        uv.push(x * 0.22, Math.abs(z) * 0.35);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column,
            b = a + 1,
            c = a + columns + 1,
            d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    }
    const count = positions.length / 3,
      topIndices = [...indices];
    for (let i = 0; i < count; i++) {
      positions.push(
        positions[i * 3],
        positions[i * 3 + 1] - 0.16,
        positions[i * 3 + 2],
      );
      uv.push(uv[i * 2], uv[i * 2 + 1]);
    }
    for (let i = 0; i < topIndices.length; i += 3)
      indices.push(
        topIndices[i] + count,
        topIndices[i + 2] + count,
        topIndices[i + 1] + count,
      );
    const closeEdge = (a, b) =>
      indices.push(a, b, b + count, a, b + count, a + count);
    for (let column = 0; column < columns; column++) {
      closeEdge(column, column + 1);
      closeEdge(
        rows * (columns + 1) + column + 1,
        rows * (columns + 1) + column,
      );
    }
    for (let row = 0; row < rows; row++) {
      closeEdge(
        row * (columns + 1) + columns,
        (row + 1) * (columns + 1) + columns,
      );
      closeEdge((row + 1) * (columns + 1), row * (columns + 1));
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  function archFrame(group, x, y, z, width, height, color) {
    const radius = width / 2,
      spring = y + height - radius;
    const points = [
      new T.Vector3(x - radius, y, z),
      new T.Vector3(x - radius, spring, z),
    ];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI - (i * Math.PI) / 16;
      points.push(
        new T.Vector3(
          x + Math.cos(a) * radius,
          spring + Math.sin(a) * radius,
          z,
        ),
      );
    }
    points.push(new T.Vector3(x + radius, y, z));
    mesh(
      new T.TubeGeometry(new T.CatmullRomCurve3(points), 32, 0.065, 6, false),
      color,
      0,
      0,
      0,
      group,
    );
  }
  function plantPot(x, y, z, scale = 1, parent = town) {
    const pot = mesh(
      new T.CylinderGeometry(0.23, 0.16, 0.34, 10),
      surfaces.solid(0xb28468),
      x,
      y + 0.17 * scale,
      z,
      parent,
    );
    pot.scale.setScalar(scale);
    for (let i = 0; i < 5; i++) {
      const leaf = orb(
        x + Math.sin(i * 2.4) * 0.14 * scale,
        y + 0.43 * scale + (i % 2) * 0.12 * scale,
        z + Math.cos(i * 2.4) * 0.14 * scale,
        0.17 * scale,
        [0x75845a, 0x8c9762, 0x667d5c][i % 3],
        parent,
      );
      leaf.scale.y = 1.55;
    }
  }
  function windowPanel(
    group,
    x,
    y,
    z,
    width = 1,
    height = 1.15,
    arched = false,
  ) {
    box(x, y, z, width + 0.15, height + 0.15, 0.1, surfaces.darkWood, group);
    box(x, y, z + 0.06, width, height, 0.035, surfaces.glass, group);
    for (const side of [-1, 1])
      box(
        x + side * width * 0.48,
        y,
        z + 0.1,
        0.055,
        height,
        0.06,
        surfaces.wood,
        group,
      );
    for (const shift of [-0.25, 0.25])
      box(
        x + width * shift,
        y,
        z + 0.1,
        0.038,
        height,
        0.045,
        surfaces.wood,
        group,
      );
    box(x, y - 0.14, z + 0.12, width, 0.04, 0.045, surfaces.wood, group);
    box(
      x,
      y - height / 2 - 0.09,
      z + 0.03,
      width + 0.25,
      0.11,
      0.25,
      surfaces.darkWood,
      group,
    );
    if (arched)
      archFrame(
        group,
        x,
        y - height / 2,
        z + 0.1,
        width + 0.2,
        height + 0.25,
        surfaces.wood,
      );
  }
  function batchArtwork(group, fadeable = true) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(),
      staticObjects = [],
      moving = [],
      batches = new Map(),
      copies = new Map();
    group.traverse((object) => {
      if (!object.isMesh && !object.isLineSegments) return;
      let ancestor = object.parent,
        isMoving = false;
      while (ancestor && ancestor !== group) {
        if (ancestor.userData.isMotionRoot) isMoving = true;
        ancestor = ancestor.parent;
      }
      if (isMoving) {
        moving.push(object);
        return;
      }
      staticObjects.push(object);
      const key = object.isLineSegments
        ? "line:" + object.material.opacity
        : object.material.uuid + ":" + (object.userData.id || "");
      if (!batches.has(key))
        batches.set(key, {
          material: object.material,
          id: object.userData.id,
          line: object.isLineSegments,
          geometries: [],
        });
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      geometry.applyMatrix4(
        new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
      );
      batches.get(key).geometries.push(geometry);
    });
    const own = (material) => {
      if (!fadeable) return material;
      if (!copies.has(material)) {
        const copy = copyInk(material);
        copy.userData.owned = true;
        copies.set(material, copy);
      }
      return copies.get(material);
    };
    const objects = [...moving];
    for (const object of moving) {
      object.material = own(object.material);
      object.userData.baseOpacity = object.material.opacity;
    }
    const oldSet = new Set(staticObjects);
    hits = hits.filter((object) => !oldSet.has(object));
    for (const object of staticObjects) {
      if (object.userData.architecture) {
        object.material = own(object.material);
        object.visible = false;
        continue;
      }
      object.removeFromParent();
      if (object.geometry !== cube && object.geometry !== sphere)
        object.geometry.dispose();
    }
    for (const batch of batches.values()) {
      const geometry = mergeGeometries(batch.geometries, false);
      for (const source of batch.geometries) source.dispose();
      if (!geometry) throw Error("Cannot batch painted geometry");
      const mat = own(batch.material),
        object = batch.line
          ? new T.LineSegments(geometry, mat)
          : new T.Mesh(geometry, mat);
      object.name = batch.line ? "batched-ink" : "batched-facade";
      object.castShadow = !batch.line && !mat.userData.signFace;
      object.receiveShadow = true;
      object.userData.baseOpacity = mat.opacity;
      object.userData.id = batch.id;
      group.add(object);
      objects.push(object);
      if (batch.id) hits.push(object);
    }
    return objects;
  }
  function building(
    x,
    z,
    w = 5,
    d = 3.5,
    text = "茶",
    id = "tea",
    palette = palettes[0],
    options = {},
  ) {
    const group = new T.Group();
    group.name = "house-" + text;
    town.add(group);
    group.position.set(x, 0, z);
    const station = text === "山江站";
    const floors =
      options.floors ||
      (["茶馆", "客栈", "书店", "学堂", "家", "公司", "照相馆"].includes(text)
        ? 2
        : 1);
    const wallHeight = floors * 2.55 + 0.36,
      eaveY = 0.48 + wallHeight,
      roofOffset = eaveY - 3.23;
    const plaster = surfaces.wall(palette.wall);
    const roofMaterial = surfaces.roof;
    const body = box(
      0,
      0.48 + wallHeight / 2,
      0,
      w,
      wallHeight,
      d,
      plaster,
      group,
    );
    const roof = mesh(
      roofGeometry(w + 1.05, d + 1.0),
      roofMaterial,
      0,
      roofOffset,
      0,
      group,
    );
    inkEdges(T, roof, 0.5, 42);
    body.userData.architecture = roof.userData.architecture = group;
    occluders.push(body, roof);
    box(0, 0.42, 0, w + 0.35, 0.2, d + 0.35, surfaces.stone, group);
    // Painted timber frame, deep sills and restrained masonry around openings.
    for (const side of [-1, 1]) {
      for (const front of [-1, 1])
        box(
          side * (w / 2 - 0.08),
          0.52 + wallHeight / 2,
          front * (d / 2 + 0.025),
          0.13,
          wallHeight,
          0.13,
          surfaces.darkWood,
          group,
        );
      for (let floor = 0; floor <= floors; floor++)
        box(
          0,
          0.55 + floor * 2.55,
          side * (d / 2 + 0.045),
          w + 0.08,
          0.12,
          0.12,
          surfaces.darkWood,
          group,
        );
    }
    const front = d / 2 + 0.055;
    box(0, 1.64, front, 1.45, 2.2, 0.11, surfaces.darkWood, group);
    box(0, 1.67, front + 0.065, 1.2, 1.96, 0.035, surfaces.glass, group);
    for (const side of [-1, 1]) {
      box(
        side * 0.29,
        1.62,
        front + 0.11,
        0.055,
        1.95,
        0.04,
        surfaces.wood,
        group,
      );
      box(
        side * 0.34,
        0.98,
        front + 0.14,
        0.5,
        0.48,
        0.045,
        surfaces.darkWood,
        group,
      );
      const handle = mesh(
        new T.TorusGeometry(0.047, 0.012, 6, 12),
        surfaces.bronze,
        side * 0.12,
        1.6,
        front + 0.18,
        group,
      );
    }
    archFrame(group, 0, 0.56, front + 0.1, 1.5, 2.25, surfaces.wood);
    for (const side of [-1, 1])
      windowPanel(group, side * w * 0.335, 1.86, front, 0.9, 1.22, station);
    if (floors === 2) {
      for (const side of [-1, 1])
        windowPanel(group, side * w * 0.25, 4.35, front, 1.05, 1.35);
      box(0, 3.32, front + 0.46, w - 0.4, 0.13, 0.95, surfaces.darkWood, group);
      for (const side of [-1, 1]) {
        box(
          side * (w / 2 - 0.25),
          3.85,
          front + 0.8,
          0.08,
          1.05,
          0.08,
          surfaces.darkWood,
          group,
        );
        box(
          side * (w / 2 - 0.25),
          3.85,
          front + 0.38,
          0.055,
          0.065,
          0.85,
          surfaces.darkWood,
          group,
        );
      }
      box(0, 3.99, front + 0.8, w - 0.4, 0.075, 0.07, surfaces.wood, group);
      for (let i = 0; i < 8; i++)
        box(
          (i / 7 - 0.5) * (w - 0.65),
          3.69,
          front + 0.8,
          0.045,
          0.6,
          0.045,
          surfaces.darkWood,
          group,
        );
      for (const side of [-1, 1])
        plantPot(side * (w / 2 - 0.6), 3.38, front + 0.43, 0.65, group);
    }
    // Facade return windows make rotating the camera reveal a complete building.
    for (const side of [-1, 1]) {
      const returns = new T.Group();
      returns.rotation.y = (side * Math.PI) / 2;
      returns.position.x = side * (w / 2 + 0.025);
      group.add(returns);
      for (let floor = 0; floor < floors; floor++)
        windowPanel(returns, 0, 1.85 + floor * 2.55, 0, 0.95, 1.18);
    }
    for (const frontSide of [-1, 1]) {
      const edge = [];
      for (let i = 0; i <= 12; i++) {
        const px = (i / 12 - 0.5) * (w + 1.05);
        edge.push(
          new T.Vector3(
            px,
            eaveY + 0.1 + 0.15 * Math.pow(Math.abs(px) / ((w + 1.05) / 2), 6),
            (frontSide * (d + 1)) / 2,
          ),
        );
      }
      mesh(
        new T.TubeGeometry(new T.CatmullRomCurve3(edge), 24, 0.065, 6, false),
        surfaces.darkWood,
        0,
        0,
        0,
        group,
      );
    }
    for (let i = 0; i < Math.ceil(w / 0.42); i++) {
      const cap = mesh(
        new T.CylinderGeometry(0.085, 0.085, 0.44, 10, 1, false, 0, Math.PI),
        surfaces.roof,
        -w / 2 + 0.2 + i * 0.42,
        4.49 + roofOffset,
        0,
        group,
      );
      cap.rotation.z = Math.PI / 2;
    }
    label(text, 0, 2.91, front + 0.22, id, station ? 0.77 : 0.57, group);
    if (!station && !options.quiet) {
      const stripes = 6,
        awningWidth = w - 0.65;
      for (let i = 0; i < stripes; i++) {
        const awning = box(
          ((i + 0.5) / stripes) * awningWidth - awningWidth / 2,
          2.72,
          front + 0.67,
          awningWidth / stripes,
          0.045,
          1.04,
          surfaces.fabric(i % 2 ? 0xddd3bb : 0x80978c),
          group,
        );
        awning.rotation.x = 0.13;
        box(
          ((i + 0.5) / stripes) * awningWidth - awningWidth / 2,
          2.6,
          front + 1.17,
          awningWidth / stripes,
          0.21,
          0.035,
          surfaces.fabric(i % 2 ? 0xddd3bb : 0x80978c),
          group,
        );
      }
    }
    for (const side of [-1, 1]) {
      lantern(side * (w / 2 - 0.45), 2.76, front + 0.36, group);
      if (!options.quiet)
        plantPot(side * (w / 2 + 0.22), 0.32, front + 0.14, 0.85, group);
    }
    if (station) {
      const clock = mesh(
        new T.CylinderGeometry(0.28, 0.28, 0.055, 24),
        surfaces.signWood,
        w * 0.42,
        2.72,
        front + 0.14,
        group,
      );
      clock.rotation.x = Math.PI / 2;
      box(
        w * 0.42,
        2.77,
        front + 0.18,
        0.024,
        0.18,
        0.015,
        surfaces.iron,
        group,
      );
      const hand = box(
        w * 0.42 + 0.06,
        2.7,
        front + 0.18,
        0.16,
        0.023,
        0.016,
        surfaces.iron,
        group,
      );
      hand.rotation.z = -0.35;
      box(
        -w * 0.3,
        1.45,
        front + 0.18,
        0.83,
        1.12,
        0.08,
        surfaces.darkWood,
        group,
      );
      box(
        -w * 0.3,
        1.45,
        front + 0.23,
        0.72,
        0.99,
        0.02,
        surfaces.signWood,
        group,
      );
      for (let row = 0; row < 7; row++)
        box(
          -w * 0.3,
          1.8 - row * 0.1,
          front + 0.25,
          0.57,
          0.012,
          0.012,
          surfaces.solid(0x7a8b83),
          group,
        );
      label("时刻表", -w * 0.3, 2.18, front + 0.26, null, 0.23, group);
      box(0, 0.43, front + 0.3, 2.5, 0.18, 0.62, surfaces.stone, group);
    }
    if (text === "书店") {
      box(
        w * 0.34,
        0.72,
        front + 0.55,
        1.1,
        0.12,
        0.46,
        surfaces.darkWood,
        group,
      );
      for (let i = 0; i < 8; i++)
        box(
          w * 0.34 + (i - 3.5) * 0.115,
          0.99,
          front + 0.54,
          0.09,
          0.4 + (i % 3) * 0.035,
          0.26,
          surfaces.solid([0x8b9f91, 0xc8ac78, 0xae7e64][i % 3]),
          group,
        );
    }
    architectures.push({ group, meshes: batchArtwork(group), alpha: 1 });
    if (!options.background) obstacles.push({ x, z, w: w + 0.5, d: d + 0.5 });
    return group;
  }
  function tree(x, z, size = 1, color = 0x769569) {
    const trunk = new T.CatmullRomCurve3([
      new T.Vector3(x, 0.2, z),
      new T.Vector3(x - 0.13 * size, 1.1 * size, z),
      new T.Vector3(x + 0.12 * size, 2.6 * size, z - 0.08 * size),
    ]);
    mesh(
      new T.TubeGeometry(trunk, 14, 0.16 * size, 10, false),
      surfaces.bark,
      0,
      0,
      0,
    );
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.3;
      const branch = new T.CatmullRomCurve3([
        new T.Vector3(x, 1.4 * size, z),
        new T.Vector3(
          x + Math.sin(angle) * 0.5 * size,
          2 * size,
          z + Math.cos(angle) * 0.4 * size,
        ),
        new T.Vector3(
          x + Math.sin(angle) * 0.85 * size,
          2.8 * size,
          z + Math.cos(angle) * 0.7 * size,
        ),
      ]);
      mesh(
        new T.TubeGeometry(branch, 8, 0.055 * size, 6, false),
        surfaces.bark,
        0,
        0,
        0,
      );
    }
    // Folded, solid leaves throughout a branching crown, with open gaps between clusters.
    const leafShape = new T.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.11, 0.12, 0, 0.3);
    leafShape.quadraticCurveTo(-0.11, 0.12, 0, 0);
    const leafGeometry = new T.ExtrudeGeometry(leafShape, {
      depth: 0.004,
      bevelEnabled: false,
      curveSegments: 2,
    });
    const positions = leafGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setZ(
        i,
        positions.getZ(i) +
          Math.sin((positions.getY(i) / 0.3) * Math.PI) * 0.025,
      );
    leafGeometry.computeVertexNormals();
    const leaves = new T.InstancedMesh(leafGeometry, material(color), 1200);
    const dummy = new T.Object3D(),
      tint = new T.Color();
    leaves.castShadow = leaves.receiveShadow = true;
    town.add(leaves);
    const fract = (value) => value - Math.floor(value);
    for (let i = 0; i < 1200; i++) {
      const cluster = i % 5,
        branchAngle = cluster * 2.4;
      const angle = i * 2.3999;
      const vertical = fract(i * 0.6180339) * 2 - 1;
      const radius = Math.cbrt(fract(i * 0.75487766)) * 0.8;
      const spread = Math.sqrt(1 - vertical * vertical) * radius;
      dummy.position.set(
        x + (Math.sin(branchAngle) * 0.57 + Math.sin(angle) * spread) * size,
        (2.65 + (cluster % 3) * 0.3 + vertical * radius * 0.85) * size,
        z + (Math.cos(branchAngle) * 0.57 + Math.cos(angle) * spread) * size,
      );
      dummy.rotation.set(
        Math.sin(i * 1.7) * Math.PI,
        angle,
        Math.sin(i * 2.3) * Math.PI,
      );
      dummy.scale.setScalar(size * (1.05 + (i % 4) * 0.13));
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
      tint.setHex(color).multiplyScalar(0.68 + (i % 7) * 0.075);
      leaves.setColorAt(i, tint);
    }
  }

  function person(x, z, color, id) {
    const group = new T.Group();
    town.add(group);
    group.position.set(x, 0.32, z);
    group.name = id || "passerby";
    group.userData.role = color === 0xcf8c4b ? "player" : id || "visitor";
    const kind =
      id === "friend" ||
      id === "resident" ||
      (!id && [0x718b79, 0x497b7b].includes(color))
        ? "lin"
        : id === "tea" || id === "guard"
          ? "lo"
          : "traveler";
    characters.attach(group, kind, id, (object) => hits.push(object));
    if (id) {
      obstacles.push({ x, z, w: 0.9, d: 0.9 });
      animated.push({ kind: "idle", o: group, phase: x + z });
    }
    return group;
  }
  function train() {
    const group = new T.Group();
    town.add(group);
    for (let i = 0; i < 3; i++) {
      const x = -13 + i * 8;
      box(x, 1.62, 8, 7.7, 1.95, 2.1, surfaces.paintedMetal, group);
      box(x, 0.65, 8, 7.5, 0.32, 1.75, surfaces.iron, group);
      const roofGeometry = new T.CylinderGeometry(
        1.18,
        1.18,
        7.8,
        32,
        1,
        false,
        0,
        Math.PI,
      );
      roofGeometry.scale(0.28, 1, 1);
      roofGeometry.rotateZ(Math.PI / 2);
      mesh(roofGeometry, surfaces.iron, x, 2.59, 8, group);
      for (const side of [-1, 1]) {
        box(
          x,
          1.03,
          8 + side * 1.065,
          7.6,
          0.055,
          0.025,
          surfaces.bronze,
          group,
        );
        for (let j = 0; j < 5; j++) {
          const wx = x - 2.5 + j * 1.25;
          box(
            wx,
            2.02,
            8 + side * 1.065,
            0.91,
            0.86,
            0.045,
            surfaces.iron,
            group,
          );
          box(
            wx,
            2.02,
            8 + side * 1.095,
            0.79,
            0.72,
            0.025,
            surfaces.glass,
            group,
          );
          box(
            wx,
            2.07,
            8 + side * 1.115,
            0.026,
            0.72,
            0.026,
            surfaces.bronze,
            group,
          );
        }
        for (const end of [-1, 1]) {
          box(
            x + end * 3.48,
            1.7,
            8 + side * 1.075,
            0.49,
            1.55,
            0.035,
            surfaces.iron,
            group,
          );
          box(
            x + end * 3.48,
            1.72,
            8 + side * 1.1,
            0.39,
            1.41,
            0.03,
            surfaces.paintedMetal,
            group,
          );
          box(
            x + end * 3.48,
            2.05,
            8 + side * 1.125,
            0.28,
            0.55,
            0.025,
            surfaces.glass,
            group,
          );
          box(
            x + end * 3.32,
            1.57,
            8 + side * 1.16,
            0.025,
            0.17,
            0.035,
            surfaces.bronze,
            group,
          );
        }
      }
      for (const end of [-1, 1]) {
        box(x + end * 2.55, 0.55, 8, 1.5, 0.35, 1.55, surfaces.iron, group);
        for (const axle of [-1, 1]) {
          const px = x + end * 2.55 + axle * 0.48;
          const shaft = mesh(
            new T.CylinderGeometry(0.08, 0.08, 2, 12),
            surfaces.iron,
            px,
            0.45,
            8,
            group,
          );
          shaft.rotation.x = Math.PI / 2;
          for (const side of [-1, 1]) {
            const wheel = mesh(
              new T.CylinderGeometry(0.34, 0.34, 0.16, 20),
              surfaces.iron,
              px,
              0.45,
              8 + side * 0.93,
              group,
            );
            wheel.rotation.x = Math.PI / 2;
            const hub = mesh(
              new T.CylinderGeometry(0.12, 0.12, 0.18, 16),
              surfaces.bronze,
              px,
              0.45,
              8 + side * 0.94,
              group,
            );
            hub.rotation.x = Math.PI / 2;
          }
        }
        box(x + end * 3.88, 0.87, 8, 0.25, 0.22, 0.7, surfaces.iron, group);
      }
    }
    group.position.x = -22;
    group.rotation.y = Math.PI / 2;
    batchArtwork(group, false);
    animated.push({ kind: "train", o: group });
  }
  function table(x, z) {
    mesh(new T.CylinderGeometry(0.9, 0.9, 0.13, 32), surfaces.wood, x, 1.1, z);
    mesh(
      new T.CylinderGeometry(0.12, 0.2, 0.92, 16),
      surfaces.darkWood,
      x,
      0.62,
      z,
    );
    for (let leg = 0; leg < 3; leg++) {
      const angle = (leg * Math.PI * 2) / 3,
        foot = box(
          x + Math.sin(angle) * 0.32,
          0.37,
          z + Math.cos(angle) * 0.32,
          0.12,
          0.12,
          0.65,
          surfaces.darkWood,
        );
      foot.rotation.y = angle;
    }
    for (const side of [-1, 1]) {
      mesh(
        new T.CylinderGeometry(0.34, 0.35, 0.11, 24),
        surfaces.wood,
        x + side * 1.3,
        0.72,
        z,
      );
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          box(
            x + side * 1.3 + a * 0.2,
            0.49,
            z + b * 0.2,
            0.07,
            0.4,
            0.07,
            surfaces.darkWood,
          );
    }
    const cupProfile = [
      [0.055, 0],
      [0.075, 0.025],
      [0.095, 0.16],
      [0.09, 0.175],
      [0.077, 0.16],
      [0.057, 0.035],
    ].map((p) => new T.Vector2(...p));
    mesh(
      new T.LatheGeometry(cupProfile, 24),
      surfaces.ceramic,
      x + 0.32,
      1.17,
      z + 0.2,
    );
    mesh(
      new T.CylinderGeometry(0.074, 0.074, 0.005, 24),
      0x4b3523,
      x + 0.32,
      1.31,
      z + 0.2,
    );
    mesh(
      new T.CylinderGeometry(0.14, 0.14, 0.018, 24),
      surfaces.ceramic,
      x + 0.32,
      1.18,
      z + 0.2,
    );
    const pot = orb(x - 0.2, 1.35, z, 1, surfaces.ceramic);
    pot.scale.set(0.24, 0.18, 0.2);
    mesh(
      new T.CylinderGeometry(0.13, 0.14, 0.045, 20),
      surfaces.ceramic,
      x - 0.2,
      1.51,
      z,
    );
    orb(x - 0.2, 1.56, z, 0.045, surfaces.ceramic);
    const handle = mesh(
      new T.TorusGeometry(0.17, 0.028, 10, 24, Math.PI * 1.6),
      surfaces.ceramic,
      x - 0.38,
      1.36,
      z,
    );
    handle.rotation.z = Math.PI * 0.2;
    const spout = new T.CatmullRomCurve3([
      new T.Vector3(x, 1.33, z),
      new T.Vector3(x + 0.1, 1.39, z),
      new T.Vector3(x + 0.13, 1.5, z),
    ]);
    mesh(
      new T.TubeGeometry(spout, 10, 0.045, 10, false),
      surfaces.ceramic,
      0,
      0,
      0,
    );
    for (let i = 0; i < 4; i++) {
      const puff = orb(x - 0.2, 1.65 + i * 0.22, z, 0.06, 0xeff2dc);
      puff.material = new T.MeshBasicMaterial({
        color: 0xf3f2de,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      });
      puff.material.userData.owned = true;
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
      scene.fog.color.setHex(0xc3c8c6);
      sunlight.color.setHex(0xffe7c6);
    }
  }
  const places = {
    guard: [-5, 3],
    entry: [-1, -1],
    exit: [4, -1],
    friend: [6, -3],
    tea: [-3, -5.4],
    resident: [3, 1],
    board: [-1, 1],
  };
  let time = 0,
    angle = 0.65,
    wanted = 0.65,
    zoom = 1,
    zoomTarget = 1;
  function removeProps(group) {
    if (!group) return;
    group.removeFromParent();
    group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (
        o.geometry &&
        !o.userData.sharedCharacter &&
        o.geometry !== cube &&
        o.geometry !== sphere
      )
        o.geometry.dispose();
      if (o.isSprite || o.material?.userData?.signFace) {
        o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
  function clearStudy() {
    removeProps(studyGroup);
    studyGroup = null;
    studyKey = "";
    hits = hits.filter((o) => o.userData.id !== "study");
    delete places.study;
    obstacles = obstacles.filter((o) => o.id !== "study");
  }
  function studyWord(word, index) {
    const key = index + ":" + word;
    if (studyKey === key) return;
    clearStudy();
    studyKey = key;
    route = [];
    arrival = null;
    const spots = [places.resident, places.friend, places.guard, [0, 0]];
    const [x, z] = spots[index % spots.length];
    places.study = [x, z];
    obstacles.push({ id: "study", x, z: z + 0.9, w: 1.05, d: 0.66 });
    studyGroup = new T.Group();
    town.add(studyGroup);
    // A small reading stand holds the current note in the physical scene.
    box(x, 0.72, z + 0.9, 1.05, 0.11, 0.66, surfaces.wood, studyGroup);
    for (const side of [-1, 1])
      box(
        x + side * 0.36,
        0.5,
        z + 0.9,
        0.1,
        0.5,
        0.1,
        surfaces.darkWood,
        studyGroup,
      );
    const page = box(x, 0.82, z + 0.9, 0.84, 0.035, 0.53, 0xf4e6c3, studyGroup);
    page.rotation.x = -0.12;
    box(x - 0.27, 0.85, z + 0.9, 0.045, 0.025, 0.44, 0xbca477, studyGroup);
    for (let i = 0; i < 3; i++)
      box(
        x + 0.05,
        0.86,
        z + 0.77 + i * 0.11,
        0.4,
        0.02,
        0.018,
        0x7a805e,
        studyGroup,
      );
    for (const side of [-1, 1])
      box(
        x + side * 0.43,
        1.01,
        z + 0.91,
        0.045,
        0.48,
        0.06,
        surfaces.wood,
        studyGroup,
      );
    label(word, x, 1.24, z + 0.91, "study", 0.34, studyGroup);
    studyGroup.traverse((o) => {
      if (o.isMesh) {
        o.userData.id = "study";
        hits.push(o);
      }
    });
    marker.position.set(x, 0.39, z);
    marker.visible = true;
  }
  function progress(count) {
    removeProps(rewardGroup);
    rewardGroup = new T.Group();
    town.add(rewardGroup);
    for (let i = 0; i < Math.min(6, count); i++) {
      const x = -10 + i * 3.5,
        z = 4.8;
      mesh(
        new T.CylinderGeometry(0.35, 0.24, 0.5, 10),
        0xa77554,
        x,
        0.49,
        z,
        rewardGroup,
      );
      for (let j = 0; j < 3; j++) {
        const flower = orb(
          x + Math.sin(j * 2.1) * 0.2,
          0.95 + j * 0.12,
          z + Math.cos(j * 2.1) * 0.16,
          0.25,
          [0xc29076, 0xe1c272, 0x9dab78][i % 3],
          rewardGroup,
        );
        flower.scale.y = 0.65;
      }
      box(x, 1.9, z, 0.07, 3.2, 0.07, 0x7d6f4e, rewardGroup);
      // Completed missions gradually light the route to the festival.
      const lamp = orb(x, 3.25, z, 0.32, 0xd69a58, rewardGroup);
      lamp.scale.y = 1.1;
      mesh(
        new T.CylinderGeometry(0.14, 0.14, 0.06, 8),
        0x684c37,
        x,
        3.62,
        z,
        rewardGroup,
      );
    }
  }
  function build(index = 0) {
    scene.remove(town);
    town.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (
        o.geometry &&
        !o.userData.sharedCharacter &&
        o.geometry !== cube &&
        o.geometry !== sphere
      )
        o.geometry.dispose();
      if (o.isSprite || o.material?.userData?.signFace) {
        o.material.map.dispose();
        o.material.dispose();
      }
      if (o.material?.userData?.owned) o.material.dispose();
      if (o.isSkinnedMesh && !o.userData.characterOutline) o.skeleton.dispose();
    });
    town = new T.Group();
    scene.add(town);
    studyGroup = null;
    studyKey = "";
    rewardGroup = null;
    delete places.study;
    hits = [];
    obstacles = [];
    animated = [];
    architectures = [];
    occluders = [];
    occlusionKey = "";
    covering = new Set();
    route = [];
    arrival = null;
    time = 0;
    const pal = palettes[index % palettes.length];
    // Continuous streets extend past the camera; no floating landscape plinth.
    box(0, 0.12, 0, 150, 0.4, 150, surfaces.stone);
    // The canal is a real channel along the far east street.
    box(14, 0.14, -1, 3.4, 0.05, 44, surfaces.water);
    for (const x of [12.1, 15.9]) box(x, 0.3, -1, 0.3, 0.4, 44, surfaces.stone);
    box(14, 0.41, -1, 4.1, 0.18, 3, surfaces.wood);
    if (index === 0) {
      places.tea = [-3, -5.4];
      places.friend = [6, -3];
      places.guard = [-5, 3];
      for (const x of [-14.8, -13.2])
        box(x, 0.38, -1, 0.1, 0.13, 55, surfaces.iron);
      for (let z = -28; z < 28; z++)
        box(-14, 0.3, z, 2.6, 0.12, 0.16, surfaces.darkWood);
      train();
      building(-7.7, -4.8, 7, 3.6, "山江站", "guard", pal);
      building(-5, -9, 5, 3.6, "茶馆", "tea", palettes[1]);
      building(5, -9, 4, 3.5, "客栈", "friend", pal);
      for (const [id, x, text] of [
        ["entry", -1, "入口"],
        ["exit", 4, "出口"],
      ]) {
        for (const side of [-1, 1]) {
          box(x + side * 1.3, 1.15, -1, 0.42, 1.66, 0.62, surfaces.plaster);
          obstacles.push({ x: x + side * 1.3, z: -1, w: 0.42, d: 0.62 });
        }
        mesh(
          new T.TorusGeometry(1.3, 0.23, 8, 24, Math.PI),
          surfaces.plaster,
          x,
          1.96,
          -1,
        );
        box(x, 3.52, -1, 3.35, 0.14, 0.84, surfaces.roof);
        label(text, x, 3.27, -0.64, id, 0.65);
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
            0.045,
            2,
            surfaces.fabric(j % 2 ? 0xb7684c : 0x68816b),
          );
          canopy.rotation.x = 0.08;
          for (const side of [-1, 1])
            for (const front of [-1, 1])
              box(
                -1 + j * 3.3 + side * 1.16,
                1.43,
                -5 + front * 0.75,
                0.065,
                2.25,
                0.065,
                surfaces.wood,
              );
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
      places.tea = [-3, -4.2];
      places.friend = [6, -3];
      places.guard = [-5, 3];
    }
    districtScenery(index);
    const guard = person(-5, 2, 0x466e7a, "guard");
    const friend = person(6, -4, 0xb46d52, "friend");
    if (index === 0) {
      mesh(
        new T.CylinderGeometry(0.025, 0.025, 1.8, 6),
        0x6d674e,
        0.33,
        1.3,
        0,
        friend,
      );
      const canopyProfile = [
        [0, 0.3],
        [0.3, 0.28],
        [0.65, 0.17],
        [1.02, 0.025],
      ].map((p) => new T.Vector2(...p));
      const umbrella = mesh(
        new T.LatheGeometry(canopyProfile, 48),
        surfaces.fabric(0x496c7a),
        0.33,
        2.08,
        0,
        friend,
      );
      umbrella.material.side = T.DoubleSide;
      umbrella.name = "umbrella";
      umbrella.userData.id = "friend";
      hits.push(umbrella);
      for (let rib = 0; rib < 8; rib++) {
        const angle = (rib * Math.PI) / 4,
          curve = new T.CatmullRomCurve3(
            canopyProfile.map(
              (p) =>
                new T.Vector3(
                  Math.sin(angle) * p.x,
                  p.y,
                  Math.cos(angle) * p.x,
                ),
            ),
          );
        mesh(
          new T.TubeGeometry(curve, 12, 0.009, 5, false),
          surfaces.bronze,
          0.33,
          2.075,
          0,
          friend,
        );
      }
    }
    person(3, 0, 0x7e9270, "resident");
    person(places.tea[0], places.tea[1] - 0.8, 0x94754f, "tea");

    for (let i = 0; i < 4; i++) {
      const x = -1 + i * 2.6;
      const p = person(x, 3.8, [0xab8e56, 0x718b79, 0x92786a, 0x497b7b][i]);
      animated.push({ kind: "walker", o: p, x, z: 3.8, phase: i * 2 });
    }
    table(-7, -0.8);
    table(8, 3.5);
    drawNeighborhood(
      T,
      {
        town,
        box,
        mesh,
        orb,
        building,
        tree,
        plantPot,
        surfaces,
        animated,
        obstacles,
        palettes,
        batchArtwork,
      },
      index,
    );
    player = person(-8, 3, 0xcf8c4b);
    player.name = "player";
    const suitcase = box(
      0.42,
      0.3,
      -0.08,
      0.3,
      0.53,
      0.2,
      surfaces.solid(0xb77b57),
      player,
    );
    for (const side of [-1, 1])
      orb(0.42 + side * 0.09, 0.06, -0.08, 0.045, surfaces.iron, player);
    box(0.42, 0.69, -0.08, 0.19, 0.29, 0.025, surfaces.iron, player);
    const halo = mesh(
      new T.RingGeometry(0.38, 0.41, 40),
      surfaces.solid(0xf4dc99),
      0,
      0.015,
      0,
      player,
    );
    halo.rotation.x = -Math.PI / 2;
    halo.castShadow = false;

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
    town.updateMatrixWorld(true);
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
    arrival = () => {
      const actor = town.getObjectByName(id);
      if (actor)
        player.rotation.y = Math.atan2(
          actor.position.x - player.position.x,
          actor.position.z - player.position.z,
        );
      else if (id === "study") player.rotation.y = 0;
      onVisit(id);
    };
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
      e = h < 550 ? (w >= 600 ? 8.5 : 14) : w < 700 ? 12.6 : 12;
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
      0.32 + (walking && !reduced ? Math.abs(Math.sin(time * 10)) * 0.018 : 0);
    characters.update(player, reduced ? 0 : dt, walking && !reduced);
    angle = reduced ? wanted : T.MathUtils.damp(angle, wanted, 8, dt);
    if (Math.abs(zoom - zoomTarget) > 0.001) {
      zoom = T.MathUtils.damp(zoom, zoomTarget, 9, dt);
      size();
    }
    const shortScreen = root.clientHeight < 550;
    const landscape = shortScreen && root.clientWidth >= 600;
    const mobile = root.clientWidth < 700 || shortScreen;
    focus.lerp(
      new T.Vector3(player.position.x, 0.85, player.position.z),
      1 - Math.exp(-dt * 4),
    );
    camera.position.set(
      focus.x + Math.sin(angle) * 30,
      35,
      focus.z + Math.cos(angle) * 30,
    );
    camera.lookAt(focus);
    // Reserve space for the bottom panel in portrait and the side panel in landscape.
    if (landscape) {
      camera.setViewOffset(
        root.clientWidth,
        root.clientHeight,
        -Math.min(190, root.clientWidth * 0.27),
        0,
        root.clientWidth,
        root.clientHeight,
      );
    } else if (mobile) {
      camera.setViewOffset(
        root.clientWidth,
        root.clientHeight,
        0,
        root.clientHeight * (shortScreen ? 0.11 : 0.14),
        root.clientWidth,
        root.clientHeight,
      );
    } else camera.clearViewOffset();
    // Recast only after the player or camera moves. Static facades need no per-frame work.
    const nextOcclusionKey = [
      player.position.x,
      player.position.z,
      camera.position.x,
      camera.position.z,
    ]
      .map((n) => n.toFixed(2))
      .join(":");
    if (nextOcclusionKey !== occlusionKey) {
      occlusionKey = nextOcclusionKey;
      const eyeTarget = new T.Vector3(
        player.position.x,
        player.position.y + 1.15,
        player.position.z,
      );
      const eyeDirection = eyeTarget.clone().sub(camera.position),
        eyeDistance = eyeDirection.length();
      occlusionRay.set(camera.position, eyeDirection.normalize());
      covering = new Set(
        occlusionRay
          .intersectObjects(occluders, false)
          .filter((hit) => hit.distance < eyeDistance - 0.35)
          .map((hit) => hit.object.userData.architecture),
      );
    }
    for (const art of architectures) {
      const target = covering.has(art.group) ? 0.16 : 1;
      if (art.alpha === target) continue;
      art.alpha = reduced ? target : T.MathUtils.damp(art.alpha, target, 8, dt);
      if (Math.abs(art.alpha - target) < 0.002) art.alpha = target;
      for (const object of art.meshes) {
        const mat = object.material;
        mat.opacity = art.alpha * (object.userData.baseOpacity ?? 1);
        const transparent =
          Boolean(mat.userData.signFace) ||
          art.alpha < 0.985 ||
          object.isLineSegments;
        if (mat.transparent !== transparent) {
          mat.transparent = transparent;
          mat.needsUpdate = true;
        }
        mat.depthWrite = !transparent;
        object.castShadow = art.alpha > 0.8 && !object.isLineSegments;
      }
    }
    for (const a of animated) {
      if (a.kind === "train")
        a.o.position.z = reduced
          ? 0
          : Math.min(75, Math.max(0, time - 7) * 1.5);
      if (reduced) continue;
      if (a.kind === "idle") {
        characters.update(a.o, dt, false);
        const distance = a.o.position.distanceTo(player.position);
        if (distance < 4) {
          const desired = Math.atan2(
            player.position.x - a.o.position.x,
            player.position.z - a.o.position.z,
          );
          const delta = Math.atan2(
            Math.sin(desired - a.o.rotation.y),
            Math.cos(desired - a.o.rotation.y),
          );
          a.o.rotation.y += delta * (1 - Math.exp(-dt * 2));
        }
      }
      if (a.kind === "walker") {
        a.o.position.x = a.x + Math.sin(time * 0.22 + a.phase) * 1.5;
        a.o.rotation.y =
          Math.cos(time * 0.22 + a.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
        a.o.position.y = 0.32 + Math.abs(Math.sin(time * 5 + a.phase)) * 0.015;
        characters.update(a.o, dt, true);
      }
      if (a.kind === "steam") {
        const t = (time * 0.35 + a.phase) % 1.5;
        a.o.position.y = a.base + t;
        a.o.position.x = a.x + Math.sin(time + a.phase) * 0.09;
        a.o.material.opacity = 0.32 * (1 - t / 1.5);
      }
      if (a.kind === "cloud")
        a.o.position.x = a.x + Math.sin(time * 0.035 + a.phase) * 2;
      if (a.kind === "cloth")
        a.o.rotation.z = Math.sin(time * 0.8 + a.phase) * 0.035;
      if (a.kind === "leaf") {
        const drift = (time * 0.32 + a.phase * 0.47) % 4;
        a.o.position.set(
          a.x + Math.sin(time * 0.45 + a.phase) * 0.6,
          4.3 - drift,
          a.z + Math.sin(time * 0.22 + a.phase) * 0.7,
        );
        a.o.rotation.set(
          time * 0.4 + a.phase,
          time * 0.3,
          Math.sin(time * 0.7 + a.phase) * 0.6,
        );
      }
      if (a.kind === "lantern")
        a.o.rotation.z = Math.sin(time * 1.2 + a.phase) * 0.055;
    }
    if (marker.visible && !reduced)
      marker.material.opacity = 0.6 + Math.sin(time * 3) * 0.3;
    renderer.render(scene, camera);
  });
  return {
    ready: Promise.all([surfaces.ready, characters.ready]),
    visit,
    studyWord,
    clearStudy,
    progress,
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
