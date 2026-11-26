import * as T from "../vendor/three.module.js";
import { inkMaterial } from "../art.js";
import { writeFile } from "node:fs/promises";
const macros = `
#define USE_MAP
#define USE_UV
#define MAP_UV uv
#define USE_GRADIENTMAP
#define USE_FOG
#define FOG_EXP2
#define USE_SHADOWMAP
#define SHADOWMAP_TYPE_PCF_SOFT
#define NUM_DIR_LIGHTS 1
#define NUM_HEMI_LIGHTS 1
#define NUM_POINT_LIGHTS 0
#define NUM_SPOT_LIGHTS 0
#define NUM_RECT_AREA_LIGHTS 0
#define NUM_DIR_LIGHT_SHADOWS 1
#define NUM_POINT_LIGHT_SHADOWS 0
#define NUM_SPOT_LIGHT_SHADOWS 0
#define NUM_SPOT_LIGHT_MAPS 0
#define NUM_SPOT_LIGHT_COORDS 0
#define NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS 0
#define NUM_LIGHT_PROBES 0
#define NUM_CLIPPING_PLANES 0
#define UNION_CLIPPING_PLANES 0
`;
const vertexPrefix = `#version 300 es
precision highp float;precision highp int;
#define attribute in
#define varying out
#define texture2D texture
${macros}
uniform mat4 modelMatrix;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform mat4 viewMatrix;
uniform mat3 normalMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;
in vec3 position;in vec3 normal;in vec2 uv;
`;
const fragmentPrefix = `#version 300 es
precision highp float;precision highp int;
#define varying in
#define texture2D texture
#define textureCube texture
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define HIGH_PRECISION
${macros}
uniform mat4 viewMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;
vec4 linearToOutputTexel(vec4 value){return value;}
`;
function expand(s) {
  s = s.replace(/#include <(\w+)>/g, (_, name) => {
    if (!T.ShaderChunk[name]) throw Error(name);
    return expand(T.ShaderChunk[name]);
  });
  s = s.replace(
    /#pragma unroll_loop_start\s+for\s*\(\s*int i = (\d+); i < (\d+); i \+\+ \)\s*\{([\s\S]+?)\}\s+#pragma unroll_loop_end/g,
    (_, a, b, body) =>
      Array.from({ length: Number(b) - Number(a) }, (_, j) =>
        body
          .replace(/\[\s*i\s*\]/g, "[" + (j + Number(a)) + "]")
          .replace(/UNROLLED_LOOP_INDEX/g, String(j + Number(a))),
      ).join(""),
  );
  // The engine substitutes light counts before unrolling its fixed-size light loops.
  for (const [key, val] of Object.entries({
    NUM_DIR_LIGHTS: 1,
    NUM_HEMI_LIGHTS: 1,
    NUM_DIR_LIGHT_SHADOWS: 1,
    NUM_POINT_LIGHTS: 0,
    NUM_SPOT_LIGHTS: 0,
    NUM_RECT_AREA_LIGHTS: 0,
    NUM_POINT_LIGHT_SHADOWS: 0,
    NUM_SPOT_LIGHT_SHADOWS: 0,
    NUM_SPOT_LIGHT_MAPS: 0,
    NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS: 0,
    NUM_LIGHT_PROBES: 0,
  }))
    s = s.replaceAll(key, String(val));
  s = s.replace(
    /#pragma unroll_loop_start\s+for\s*\(\s*int i = (\d+); i < (\d+); i \+\+ \)\s*\{([\s\S]+?)\}\s+#pragma unroll_loop_end/g,
    (_, a, b, body) =>
      Array.from({ length: Number(b) - Number(a) }, (_, j) =>
        body
          .replace(/\[\s*i\s*\]/g, "[" + (j + Number(a)) + "]")
          .replace(/UNROLLED_LOOP_INDEX/g, String(j + Number(a))),
      ).join(""),
  );
  return s;
}
const mat = inkMaterial(T, { atlasRegion: [0.5, 0.5] });
const shader = {
  uniforms: {},
  vertexShader: T.ShaderLib.toon.vertexShader,
  fragmentShader: T.ShaderLib.toon.fragmentShader,
};
mat.onBeforeCompile(shader);
const cases = [
  {
    name: "atlas-toon",
    vertex: vertexPrefix + expand(shader.vertexShader),
    fragment: fragmentPrefix + expand(shader.fragmentShader),
  },
];
const instanced =
  "#define USE_INSTANCING\n#define USE_INSTANCING_COLOR\nin mat4 instanceMatrix;in vec3 instanceColor;\n";
cases.push({
  name: "instanced-foliage",
  vertex: vertexPrefix + instanced + expand(shader.vertexShader),
  fragment:
    fragmentPrefix +
    "#define USE_INSTANCING_COLOR\n" +
    expand(shader.fragmentShader),
});
await import("../tests/model-fixture.mjs");
const { createCharacters } = await import("../characters.js");
const library = createCharacters(
  { capabilities: { getMaxAnisotropy: () => 4 } },
  new T.DataTexture(),
);
await library.ready;
for (const [kind, role] of [
  ["traveler", "player"],
  ["lin", "friend"],
  ["lo", "guard"],
]) {
  const root = new T.Group();
  root.userData.role = role;
  library.attach(root, kind, role, () => {});
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  for (const [i, mesh] of meshes.entries()) {
    const base = mesh.material.isMeshToonMaterial
      ? T.ShaderLib.toon
      : T.ShaderLib.basic;
    const shader = {
      uniforms: {},
      vertexShader: base.vertexShader,
      fragmentShader: base.fragmentShader,
    };
    mesh.material.onBeforeCompile(shader);
    const skin =
      "#define USE_SKINNING\nin vec4 skinIndex;in vec4 skinWeight;\n";
    cases.push({
      name: kind + "-" + i,
      vertex: vertexPrefix + skin + expand(shader.vertexShader),
      fragment: fragmentPrefix + expand(shader.fragmentShader),
    });
  }
}
await writeFile("/tmp/shanjiang-shaders.json", JSON.stringify(cases));
