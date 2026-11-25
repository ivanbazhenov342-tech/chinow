import * as Three from "../vendor/three.module.js";
import { parseHTML } from "linkedom";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
const { document } = parseHTML("<html></html>");
const original = document.createElement.bind(document);
document.createElement = (tag) => {
  const el = original(tag);
  if (tag === "canvas")
    el.getContext = () => ({ fillRect() {}, strokeRect() {}, fillText() {} });
  return el;
};
let animate,
  visited = [];
const T = {
  ...Three,
  Clock: class {
    getDelta() {
      return 0.05;
    }
  },
  WebGLRenderer: class {
    constructor() {
      this.domElement = document.createElement("canvas");
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 4 };
    }
    setPixelRatio() {}
    setSize() {}
    setAnimationLoop(cb) {
      animate = cb;
    }
    render() {}
  },
};
const source = (await readFile(new URL("../world.js", import.meta.url), "utf8"))
  .replace(/^import[^\n]*\n/, "")
  .replace("export function", "function");
const create = runInNewContext(source + "\ncreateWorld", {
  T,
  document,
  console,
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false }),
  ResizeObserver: class {
    observe() {}
  },
  Math,
  Map,
});
const world = create(
  { clientWidth: 390, clientHeight: 844, prepend() {} },
  (id) => visited.push(id),
);
for (let district = 0; district < 12; district++) {
  world.district(district);
  for (const id of ["guard", "exit", "friend", "tea", "resident"]) {
    world.visit(id);
    for (let i = 0; i < 400; i++) animate();
    assert.equal(
      visited.pop(),
      id,
      "Could not reach " + id + " in district " + district,
    );
  }
  world.rotate(Math.PI / 4);
  world.zoom(-0.15);
  animate();
}
console.log(
  "PASS all district scene constructors, mobile camera math and 60 destinations without WebGL rendering",
);
