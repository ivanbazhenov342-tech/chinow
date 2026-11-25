import * as T from "./vendor/three.module.js";
import { createSurfaces } from "./materials.js?v=6";
import { createCharacters } from "./characters.js?v=6";

const palettes = [
  { wall: 0xe8d6b3, roof: 0x3a625b, leaf: 0x536b42 },
  { wall: 0xe9d6b8, roof: 0x42665a, leaf: 0x667742 },
  { wall: 0xe8c8ab, roof: 0x776256, leaf: 0x506941 },
  { wall: 0xf0d6b3, roof: 0x4c6d6c, leaf: 0x476c46 },
];
export function createWorld(root, onVisit) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  root.prepend(renderer.domElement);
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xb8c6be, 0.008);
  const camera = new T.OrthographicCamera(-15, 15, 12, -12, 0.1, 160);
  const sunlight = new T.DirectionalLight(0xffeccf, 3.2);
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
  scene.add(sunlight, new T.HemisphereLight(0xdce8ee, 0x71664c, 0.85));
  const cube = new T.BoxGeometry(),
    sphere = new T.SphereGeometry(1, 24, 16);
  const materials = new Map();
  const surfaces = createSurfaces(T, renderer);
  const characters = createCharacters(renderer);
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
    ctx.strokeStyle = "#d6bd83";
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, 484, 164);
    ctx.font = Math.min(76, 440 / Array.from(text).length) + "px serif";
    ctx.fillStyle = "#f0e2bd";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 102);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const paint = new T.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.06,
      roughness: 0.85,
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
        uv.push(x * 0.7, Math.abs(z) * 0.7);
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
    box(0, 0.42, 0, w + 0.65, 0.3, d + 0.65, surfaces.stone, group);
    box(0, 0.62, 0, w + 0.12, 0.12, d + 0.12, surfaces.darkWood, group);
    box(0, 1.87, 0, w, 2.48, d, surfaces.wall(palette.wall), group);
    for (const side of [-1, 1]) {
      for (const front of [-1, 1]) {
        const column = mesh(
          new T.CylinderGeometry(0.115, 0.14, 2.7, 16),
          surfaces.wood,
          side * (w / 2 - 0.12),
          1.91,
          front * (d / 2 + 0.035),
          group,
        );
        mesh(
          new T.CylinderGeometry(0.17, 0.18, 0.22, 16),
          surfaces.stone,
          column.position.x,
          0.68,
          column.position.z,
          group,
        );
      }
      box(
        0,
        3.14,
        side * (d / 2 + 0.08),
        w + 0.22,
        0.2,
        0.2,
        surfaces.darkWood,
        group,
      );
      box(side * (w / 2 + 0.02), 1.85, 0, 0.1, 0.14, d, surfaces.wood, group);
    }
    // Recessed double doors, raised panels and small brass pulls.
    box(0, 1.61, d / 2 + 0.045, 1.25, 2.16, 0.09, surfaces.darkWood, group);
    for (const side of [-1, 1]) {
      box(
        side * 0.29,
        1.56,
        d / 2 + 0.12,
        0.55,
        1.94,
        0.07,
        surfaces.wood,
        group,
      );
      for (const y of [1.02, 1.81])
        box(
          side * 0.29,
          y,
          d / 2 + 0.17,
          0.43,
          0.64,
          0.035,
          surfaces.darkWood,
          group,
        );
      const handle = mesh(
        new T.TorusGeometry(0.047, 0.013, 8, 16),
        surfaces.bronze,
        side * 0.12,
        1.59,
        d / 2 + 0.22,
        group,
      );
    }
    for (const side of [-1, 1]) {
      const wx = side * w * 0.33;
      box(wx, 2.03, d / 2 + 0.055, 0.98, 1.23, 0.06, surfaces.darkWood, group);
      box(wx, 2.03, d / 2 + 0.095, 0.84, 1.08, 0.035, surfaces.glass, group);
      for (let bar = -1; bar <= 1; bar++)
        box(
          wx + bar * 0.27,
          2.03,
          d / 2 + 0.15,
          0.034,
          1.1,
          0.045,
          surfaces.wood,
          group,
        );
      for (const y of [1.67, 2.04, 2.4])
        box(wx, y, d / 2 + 0.165, 0.87, 0.032, 0.05, surfaces.wood, group);
      box(wx, 1.39, d / 2 + 0.11, 1.04, 0.11, 0.21, surfaces.wood, group);
    }
    const roof = mesh(
      roofGeometry(w + 1.4, d + 1.25),
      surfaces.roof,
      0,
      0,
      0,
      group,
    );
    roof.material.side = T.DoubleSide;
    // Solid eaves and individual ridge caps catch light at the roof silhouette.
    for (const front of [-1, 1]) {
      const edge = [];
      for (let i = 0; i <= 12; i++) {
        const px = (i / 12 - 0.5) * (w + 1.4),
          v = Math.abs(px) / ((w + 1.4) / 2);
        edge.push(
          new T.Vector3(
            px,
            3.23 + 0.17 * Math.pow(v, 6),
            (front * (d + 1.25)) / 2,
          ),
        );
      }
      mesh(
        new T.TubeGeometry(new T.CatmullRomCurve3(edge), 24, 0.085, 8, false),
        surfaces.darkWood,
        0,
        0,
        0,
        group,
      );
    }
    for (let i = 0; i < Math.ceil(w / 0.32); i++) {
      const px = -w / 2 + 0.16 + i * 0.32;
      const cap = mesh(
        new T.CylinderGeometry(0.105, 0.105, 0.34, 12, 1, false, 0, Math.PI),
        surfaces.roof,
        px,
        4.49,
        0,
        group,
      );
      cap.rotation.z = Math.PI / 2;
    }
    for (const side of [-1, 1])
      lantern(side * (w / 2 - 0.45), 2.87, d / 2 + 0.42, group);
    label(text, x, 2.71, z + d / 2 + 0.24, id, 0.65);
    obstacles.push({ x, z, w: w + 0.5, d: d + 0.5 });
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
    const kind =
      id === "friend" || id === "resident"
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
      scene.fog.color.setHex(0xb8cfc5);
      sunlight.color.setHex(0xffedc6);
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
      if (o.isSkinnedMesh) o.skeleton.dispose();
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
    route = [];
    arrival = null;
    time = 0;
    const pal = palettes[index % palettes.length];
    box(0, -0.6, -2, 34, 1.4, 28, surfaces.ground);
    box(0, 0.12, 0, 24, 0.4, 19, surfaces.stone);
    box(0, 0.34, 0, 21, 0.035, 5, surfaces.stone);
    box(4, 0.34, -4, 4, 0.035, 13, surfaces.stone);
    for (let i = 0; i < 28; i++) {
      const x = -10 + (i % 7) * 3.3,
        z = -8 + Math.floor(i / 7) * 4.8;
      box(x, 0.35, z, 1.5, 0.03, 0.035, surfaces.stone);
    }
    // Canal and embankment are raised separately to prevent coplanar surfaces.
    box(14, -0.05, -1, 3.8, 0.2, 27, surfaces.water);
    for (let z = -13; z < 13; z += 2)
      box(11.9, 0.3, z, 0.32, 0.7, 1.8, surfaces.stone);
    box(14, 0.7, -1, 4, 0.24, 3, surfaces.wood);
    for (const z of [-2.3, 0.3]) {
      box(14, 1.23, z, 4, 0.13, 0.12, surfaces.darkWood);
      for (let x = 12.3; x < 16; x += 1)
        box(x, 1, z, 0.13, 0.9, 0.13, surfaces.wood);
    }
    if (index === 0) {
      places.tea = [-3, -5.4];
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
          box(x + side * 1.5, 1.8, -1, 0.22, 3, 0.25, surfaces.wood);
        box(x, 3.5, -1, 3.5, 0.25, 0.85, surfaces.roof);
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
    for (let i = 0; i < 18; i++) {
      const x = -14 + (i % 9) * 3.3,
        z = i < 9 ? -13 : 12;
      tree(x, z, 0.7 + (i % 3) * 0.2, [pal.leaf, 0x6e7c48, 0x496849][i % 3]);
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
    player.name = "player";

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
      26,
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
        root.clientHeight * (shortScreen ? 0.1 : 0.14),
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
