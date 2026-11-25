// Decode the actual shipped GLBs. Only bitmap decoding is stubbed: route tests do not render.
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({
  width: 1024,
  height: 1024,
  close() {},
});
const loader = new GLTFLoader();
export const models = new Map();
for (const name of ["lin", "traveler", "lo"]) {
  const data = await readFile(
    new URL("../models/" + name + ".glb", import.meta.url),
  );
  models.set(
    name,
    await loader.parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      "",
    ),
  );
}
GLTFLoader.prototype.loadAsync = async function (path) {
  return models.get(path.split("/").pop().replace(".glb", ""));
};
