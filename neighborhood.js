// The playable square is framed by a continuous neighborhood rather than a slab.
export function drawNeighborhood(T, api, district) {
  const {
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
  } = api;
  const pal = palettes[district % palettes.length];
  const suburb = [
    [-18, -19, 6, 4, 2],
    [-10, -20, 6, 4, 2],
    [-2, -19, 5, 4, 1],
    [7, -19, 6, 4, 2],
    [16, -18, 5, 5, 2],
    [-19, -10, 5, 5, 2],
    [18, -8, 5, 5, 2],
    [-19, 1, 5, 5, 1],
    [18, 2, 5, 5, 2],
    [-17, 15, 6, 4, 2],
    [-8, 16, 6, 4, 1],
    [2, 17, 6, 4, 2],
    [12, 15, 5, 4, 2],
  ];
  for (let i = 0; i < suburb.length; i++) {
    const [x, z, w, d, floors] = suburb[i];
    const home = building(
      x,
      z,
      w,
      d,
      ["家", "书店", "茶馆", "商店"][i % 4],
      null,
      palettes[(district + i) % palettes.length],
      { floors, background: true, quiet: true },
    );
    if (i % 3 === 0) home.rotation.y = Math.PI / 2;
  }
  // Side streets, curbs and channels stay at the same walkable height.
  for (const x of [-11.7, 11.7])
    box(x, 0.35, -1, 0.16, 0.055, 26, surfaces.stone);
  for (const z of [-11.9, 6.15])
    box(0, 0.35, z, 23.4, 0.055, 0.16, surfaces.stone);
  // A staircase and courtyard arch are visible beyond the playable north lane.
  for (let i = 0; i < 12; i++)
    box(
      9,
      0.36 + i * 0.15,
      -10.8 - i * 0.48,
      2.6,
      0.3 + i * 0.3,
      0.48,
      surfaces.stone,
    );
  for (const x of [7.5, 10.5])
    box(x, 2.25, -16.5, 0.45, 4, 0.6, surfaces.plaster);
  mesh(
    new T.TorusGeometry(1.5, 0.24, 8, 20, Math.PI),
    surfaces.plaster,
    9,
    4.0,
    -16.5,
  );
  box(9, 5.62, -16.5, 3.85, 0.18, 0.95, surfaces.roof);
  // Central planter, with an irregular crown rather than geometric foliage blobs.
  if (district !== 2 && district !== 9) {
    mesh(
      new T.CylinderGeometry(0.94, 1.04, 0.38, 8),
      surfaces.stone,
      -0.5,
      0.49,
      -3.25,
    );
    tree(-0.5, -3.25, 1.2, district === 8 ? 0xa89150 : 0x8a9862);
    obstacles.push({ x: -0.5, z: -3.25, w: 2.05, d: 2.05 });
  }
  for (const [x, z] of [
    [-10, -11],
    [12, -11],
    [-11, 8],
    [11, 9],
    [-16, -7],
    [16, 5],
  ])
    tree(x, z, 1.0, pal.leaf);
  // Station benches: individual painted timber slats on metal supports.
  for (const [x, z] of [
    [-7.3, 4.5],
    [5.3, 5.5],
  ]) {
    for (let i = 0; i < 4; i++)
      box(x, 0.85, z + (i - 1.5) * 0.12, 2.05, 0.055, 0.09, surfaces.wood);
    for (let i = 0; i < 3; i++)
      box(x, 1.12 + i * 0.15, z + 0.28, 2.05, 0.09, 0.065, surfaces.wood);
    for (const side of [-1, 1]) {
      box(x + side * 0.76, 0.61, z, 0.065, 0.57, 0.43, surfaces.iron);
      box(x + side * 0.76, 1.05, z + 0.3, 0.055, 1.05, 0.055, surfaces.iron);
    }
    obstacles.push({ x, z, w: 2.2, d: 0.65 });
  }
  for (const [x, z] of [
    [-9.6, 1.2],
    [9.8, -5.5],
  ]) {
    mesh(
      new T.CylinderGeometry(0.045, 0.075, 3.25, 10),
      surfaces.iron,
      x,
      1.94,
      z,
    );
    const arm = new T.CatmullRomCurve3([
      new T.Vector3(x, 3.45, z),
      new T.Vector3(x + 0.24, 3.7, z),
      new T.Vector3(x + 0.5, 3.54, z),
    ]);
    mesh(new T.TubeGeometry(arm, 10, 0.035, 6, false), surfaces.iron, 0, 0, 0);
    mesh(new T.ConeGeometry(0.24, 0.12, 16), surfaces.iron, x + 0.5, 3.51, z);
    orb(x + 0.5, 3.42, z, 0.08, 0xe9bc72);
    obstacles.push({ x, z, w: 0.3, d: 0.3 });
  }
  // A recognisable bicycle: wheels, frame, handlebar and a small wicker basket.
  const bicycle = new T.Group();
  bicycle.position.set(2.4, 0.35, -3.1);
  bicycle.rotation.y = 0.3;
  town.add(bicycle);
  for (const x of [-0.55, 0.55])
    mesh(
      new T.TorusGeometry(0.38, 0.025, 8, 24),
      surfaces.iron,
      x,
      0.4,
      0,
      bicycle,
    );
  const tube = (points) =>
    mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        10,
        0.025,
        6,
        false,
      ),
      surfaces.paintedMetal,
      0,
      0,
      0,
      bicycle,
    );
  tube([
    [-0.55, 0.4, 0],
    [-0.2, 0.9, 0],
    [0.05, 0.4, 0],
    [-0.55, 0.4, 0],
  ]);
  tube([
    [-0.2, 0.9, 0],
    [0.37, 0.94, 0],
    [0.05, 0.4, 0],
  ]);
  tube([
    [0.55, 0.4, 0],
    [0.33, 1.08, 0],
    [0.15, 1.12, 0],
  ]);
  box(-0.23, 0.98, 0, 0.3, 0.07, 0.17, surfaces.darkWood, bicycle);
  box(0.48, 1.01, 0, 0.3, 0.24, 0.3, surfaces.wood, bicycle);
  batchArtwork(bicycle, false);
  obstacles.push({ x: 2.4, z: -3.1, w: 1.6, d: 0.6 });
  // Small food stall, open counter and drawn striped awning.
  const cart = new T.Group();
  cart.position.set(8.7, 0.32, 0.9);
  town.add(cart);
  box(0, 0.68, 0, 1.6, 0.9, 0.8, surfaces.wood, cart);
  box(0, 1.17, 0, 1.82, 0.09, 0.96, surfaces.darkWood, cart);
  for (const side of [-1, 1]) {
    const wheel = mesh(
      new T.TorusGeometry(0.25, 0.045, 8, 18),
      surfaces.iron,
      side * 0.63,
      0.25,
      0.45,
      cart,
    );
    box(side * 0.72, 1.77, 0.34, 0.045, 1.35, 0.045, surfaces.wood, cart);
  }
  for (let i = 0; i < 6; i++) {
    const shade = box(
      (i - 2.5) * 0.32,
      2.46,
      0,
      0.325,
      0.04,
      1.3,
      surfaces.fabric(i % 2 ? 0xc7b89b : 0xe8dcc2),
      cart,
    );
    shade.rotation.x = 0.1;
  }
  for (let i = 0; i < 3; i++)
    mesh(
      new T.CylinderGeometry(0.22, 0.22, 0.1, 16),
      surfaces.wood,
      -0.48 + i * 0.48,
      1.27,
      0,
      cart,
    );
  batchArtwork(cart, false);
  plantPot(9.75, 0.32, 1.1, 0.8);
  obstacles.push({ x: 8.7, z: 0.9, w: 1.9, d: 1.2 });
  // Dappled, restrained puddles; all heights are distinct to avoid z-fighting.
  for (let i = 0; i < 11; i++) {
    const shape = new T.Shape(),
      r = 0.25 + (i % 3) * 0.17;
    for (let j = 0; j <= 12; j++) {
      const a = (j * Math.PI) / 6,
        reach = r * (1 + Math.sin(j * 1.7 + i) * 0.17),
        x = Math.cos(a) * reach * 1.65,
        y = Math.sin(a) * reach;
      if (j === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const mat = new T.MeshPhongMaterial({
      color: i % 2 ? 0x99aeb2 : 0xb3b9ad,
      transparent: true,
      opacity: 0.32,
      shininess: 110,
      depthWrite: false,
    });
    mat.userData.owned = true;
    const puddle = mesh(
      new T.ShapeGeometry(shape, 12),
      mat,
      -8 + (i % 5) * 3.65,
      0.338,
      -7 + Math.floor(i / 5) * 4.1,
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.castShadow = false;
  }
  // Laundry bridges the upper floors without obstructing the player's ground route.
  const line = new T.CatmullRomCurve3([
    new T.Vector3(-9, 6, -12),
    new T.Vector3(-5, 5.6, -12),
    new T.Vector3(-1, 6, -12),
  ]);
  mesh(new T.TubeGeometry(line, 24, 0.012, 4, false), surfaces.iron, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const cloth = box(
      -8.4 + i * 1.15,
      5.3,
      -12,
      0.62,
      0.8,
      0.025,
      surfaces.fabric([0xc9bca1, 0x899c99, 0xb9957d][i % 3]),
    );
    cloth.userData.baseRotation = cloth.rotation.z;
    animated.push({ kind: "cloth", o: cloth, phase: i });
  }
  // Slow falling leaves provide depth and motion without covering text or controls.
  const leafShape = new T.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.12, 0.08, 0, 0.27);
  leafShape.quadraticCurveTo(-0.12, 0.08, 0, 0);
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(
      new T.ShapeGeometry(leafShape, 3),
      surfaces.solid(0xb5a05e),
      -6 + i * 1.5,
      3 + i * 0.2,
      -3 + (i % 3) * 2,
    );
    leaf.material.side = T.DoubleSide;
    leaf.castShadow = false;
    animated.push({
      kind: "leaf",
      o: leaf,
      x: leaf.position.x,
      z: leaf.position.z,
      phase: i,
    });
  }
}
