import "./model-fixture.mjs";
import { createSurfaces } from "../materials.js";
import { createCharacters } from "../characters.js";
import { inkMaterial, copyInk, inkEdges } from "../art.js";
import { drawNeighborhood } from "../neighborhood.js";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import * as Three from "../vendor/three.module.js";
import { parseHTML } from "linkedom";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
const { document, window } = parseHTML("<html></html>");
const original = document.createElement.bind(document);
document.createElement = (tag) => {
  const el = original(tag);
  if (tag === "canvas")
    el.getContext = () => ({
      fillRect() {},
      strokeRect() {},
      fillText() {},
      clearRect() {},
    });
  return el;
};
let lastScene, lastCamera, resize, canvas;
let animate,
  visited = [];
const T = {
  ...Three,
  TextureLoader: class {
    constructor(manager) {
      this.manager = manager;
    }
    load(url) {
      this.manager.itemStart(url);
      queueMicrotask(() => this.manager.itemEnd(url));
      const texture = new Three.Texture();
      texture.name = url;
      return texture;
    }
  },
  Clock: class {
    getDelta() {
      return 0.05;
    }
  },
  WebGLRenderer: class {
    constructor() {
      this.domElement = document.createElement("canvas");
      canvas = this.domElement;
      canvas.setPointerCapture = () => {};
      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 4 };
    }
    setPixelRatio() {}
    setSize() {}
    setAnimationLoop(cb) {
      animate = cb;
    }
    render(scene, camera) {
      lastScene = scene;
      lastCamera = camera;
    }
  },
};
const source = (await readFile(new URL("../world.js", import.meta.url), "utf8"))
  .replace(/^import[^\n]*\n/gm, "")
  .replace("export function", "function");
const create = runInNewContext(source + "\ncreateWorld", {
  T,
  mergeGeometries,
  createSurfaces,
  createCharacters,
  inkMaterial,
  copyInk,
  inkEdges,
  drawNeighborhood,
  document,
  console,
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false }),
  ResizeObserver: class {
    constructor(callback) {
      resize = callback;
    }
    observe() {}
  },
  Math,
  Map,
});
const viewport = { clientWidth: 390, clientHeight: 844, prepend() {} };
const world = create(viewport, (id) => visited.push(id));
await world.ready;
// Signs are physical objects: rotating the camera must never change their world orientation.
animate();
lastScene.updateMatrixWorld(true);
const sign = lastScene.getObjectByName("sign-exit");
assert.ok(sign?.userData.physicalSign);
const signRotation = sign.getWorldQuaternion(new Three.Quaternion());
const signBounds = new Three.Box3().setFromObject(sign);
assert.ok(
  signBounds.max.z - signBounds.min.z > 0.1,
  "Sign must have actual thickness",
);
world.rotate(Math.PI / 2);
for (let frame = 0; frame < 80; frame++) animate();
assert.ok(
  signRotation.angleTo(sign.getWorldQuaternion(new Three.Quaternion())) < 1e-6,
);
lastScene.traverse((o) =>
  assert.ok(!o.isSprite, "World must not contain camera-facing signs"),
);
const human = lastScene.getObjectByName("friend").userData.human;
assert.equal(human.walk.getClip().name, "Walk");
assert.equal(human.idle.getClip().name, "Idle");
console.log("PASS fixed volumetric signs and actual skinned character assets");
// Buildings that cover the traveler should fade independently at every camera orientation.
world.visit("tea");
for (let frame = 0; frame < 400; frame++) animate();
visited.pop();
let observedFade = false;
for (let angle = 0; angle < 8; angle++) {
  world.rotate(Math.PI / 4);
  for (let frame = 0; frame < 80; frame++) animate();
  let opaque = 0,
    faded = 0;
  lastScene.traverse((o) => {
    if (o.userData.architecture) {
      if (o.material.opacity < 0.3) faded++;
      if (o.material.opacity > 0.99) opaque++;
      assert.ok(
        o.material.isMeshToonMaterial,
        "Facade must use the illustrated lighting",
      );
    }
  });
  if (faded) {
    observedFade = true;
    assert.ok(opaque > 0, "Occlusion must not fade all buildings");
  }
}
assert.ok(observedFade, "No obstructing facade faded during camera rotation");
console.log("PASS independent architectural occlusion and toon materials");

for (let district = 0; district < 12; district++) {
  world.district(district);
  for (const id of ["guard", "exit", "friend", "tea", "resident"]) {
    world.visit(id);
    for (let i = 0; i < 400; i++) animate();
    if (id !== "exit") {
      const actor = lastScene.getObjectByName(id),
        player = lastScene.getObjectByName("player");
      assert.ok(
        actor.position.distanceTo(player.position) >= 0.7,
        "Player overlaps " + id,
      );
      lastScene.updateMatrixWorld(true);
      assert.ok(
        new Three.Box3().setFromObject(actor).min.y >= 0.319,
        "Actor below the platform " + id,
      );
    }
    assert.equal(
      visited.pop(),
      id,
      "Could not reach " + id + " in district " + district,
    );
  }
  world.progress(6);
  for (let index = 0; index < 8; index++) {
    world.studyWord("旅行计划", index);
    world.visit("study");
    for (let frame = 0; frame < 400; frame++) animate();
    assert.equal(
      visited.pop(),
      "study",
      "Could not reach word " + index + " in district " + district,
    );
  }
  world.clearStudy();
  world.rotate(Math.PI / 4);
  world.zoom(-0.15);
  animate();
}
console.log(
  "PASS all district scene constructors, mobile camera math and 156 destinations without WebGL rendering",
);

// Project real scene geometry through the orthographic camera while WebGL stays stubbed.
function actorScreenBounds(id) {
  lastScene.updateMatrixWorld(true);
  lastCamera.updateMatrixWorld(true);
  const box = new Three.Box3().setFromObject(lastScene.getObjectByName(id)),
    points = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new Three.Vector3(x, y, z).project(lastCamera);
        points.push([(p.x + 1) / 2, (1 - p.y) / 2]);
      }
  return {
    left: Math.min(...points.map((p) => p[0])),
    right: Math.max(...points.map((p) => p[0])),
    top: Math.min(...points.map((p) => p[1])),
    bottom: Math.max(...points.map((p) => p[1])),
  };
}
let cameraCases = 0;
for (const [width, height] of [
  [390, 844],
  [375, 667],
  [320, 568],
  [844, 390],
  [667, 375],
  [375, 300],
  [1024, 768],
  [1440, 900],
]) {
  viewport.clientWidth = width;
  viewport.clientHeight = height;
  resize();
  world.district(0);
  for (const zoom of [0.6, 1, 1.6]) {
    world.zoom(10);
    world.zoom(zoom - 1.6);
    for (const id of ["guard", "friend", "tea", "resident"]) {
      world.visit(id);
      for (let frame = 0; frame < 400; frame++) animate();
      visited.pop();
      for (let angle = 0; angle < 8; angle++) {
        for (let frame = 0; frame < 100; frame++) animate();
        const bounds = actorScreenBounds(id),
          landscape = height < 550 && width >= 600,
          compact = width < 700 || height < 550;
        const context = JSON.stringify({
          width,
          height,
          zoom,
          id,
          angle,
          bounds,
        });
        assert.ok(
          bounds.left >= 0 && bounds.right <= 1 && bounds.bottom <= 1,
          context,
        );
        assert.ok(
          bounds.top >= (compact ? (width >= 700 ? 78 : 58) : 88) / height,
          context,
        );
        if (landscape) {
          const panelRight = ((width < 700 ? 12 : 32) + 350) / width,
            panelTop = (height * 0.3 - 30) / height;
          assert.ok(
            bounds.left >= panelRight || bounds.bottom <= panelTop,
            context,
          );
        } else if (compact) {
          assert.ok(bounds.bottom <= (height < 550 ? 0.52 : 0.53), context);
        }
        cameraCases++;
        world.rotate(Math.PI / 4);
      }
    }
  }
}
console.log(
  "PASS " +
    cameraCases +
    " camera views keep conversation partners clear of the header and mobile task panel",
);

// Use the normal pointer handlers to select the umbrella itself.
viewport.clientWidth = 390;
viewport.clientHeight = 844;
resize();
world.district(0);
world.zoom(10);
world.zoom(-0.6);
world.visit("friend");
for (let frame = 0; frame < 400; frame++) animate();
visited.pop();
lastScene.updateMatrixWorld(true);
lastCamera.updateMatrixWorld(true);
const umbrella = lastScene.getObjectByName("umbrella");
const point = umbrella
  .getWorldPosition(new Three.Vector3())
  .project(lastCamera);
for (const type of ["pointerdown", "pointerup"]) {
  const event = new window.Event(type);
  event.pointerId = 1;
  event.clientX = ((point.x + 1) * viewport.clientWidth) / 2;
  event.clientY = ((1 - point.y) * viewport.clientHeight) / 2;
  canvas.dispatchEvent(event);
}
for (let frame = 0; frame < 400; frame++) animate();
assert.equal(
  visited.pop(),
  "friend",
  "Tapping the umbrella should meet its owner",
);
console.log("PASS umbrella pointer interaction");
