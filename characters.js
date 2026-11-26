import * as T from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { clone } from "./vendor/SkeletonUtils.js";

import { inkMaterial } from "./art.js?v=7";

// Rigged humans rendered with a limited painted palette and drawn silhouettes.
export function createCharacters(renderer, gradientMap) {
  const styles = new Map();
  function drawn(source, kind, role) {
    const key = source.uuid + kind + role;
    if (styles.has(key)) return styles.get(key);
    const result = inkMaterial(T, {
      map: source.map,
      color: 0xffffff,
      gradientMap,
      alphaMap: source.alphaMap,
      alphaTest: source.transparent ? 0.45 : 0,
      side: source.side,
    });
    result.name = "illustrated-" + source.name;
    const compile = result.onBeforeCompile;
    result.onBeforeCompile = (shader) => {
      compile(shader);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor=texture2D(map,vMapUv,2.4);
          diffuseColor*=sampledDiffuseColor;
          vec3 painted=diffuseColor.rgb;
          float luma=dot(painted,vec3(.299,.587,.114));
          painted=mix(vec3(luma),painted,.72);
          ${
            source.name.includes("body")
              ? `
            float blueCloth=smoothstep(.02,.14,painted.b-painted.r);
            ${kind === "lin" ? "blueCloth=max(blueCloth,smoothstep(.025,.11,painted.b-painted.g)*smoothstep(.025,.11,painted.r-painted.g));" : ""}
            painted=mix(painted,vec3(luma)*${role === "player" ? "vec3(1.52,.93,.61)" : kind === "lin" ? "vec3(.70,1.12,1.05)" : "vec3(.92,1.06,1.12)"},blueCloth*.85);
          `
              : ""
          }
          ${
            kind === "traveler" && source.name.includes("head")
              ? `
            float yellowHair=smoothstep(.08,.2,painted.g-painted.b)*(1.0-smoothstep(.08,.22,painted.r-painted.g));
            painted=mix(painted,vec3(.10,.12,.13),yellowHair*.85);
          `
              : ""
          }
          diffuseColor.rgb=floor(painted*9.0+.5)/9.0;
        #endif
      `,
      );
    };
    result.customProgramCacheKey = () => "painted-human-" + key;
    styles.set(key, result);
    return result;
  }
  const loader = new GLTFLoader();
  const templates = new Map();
  const waiting = [];
  function attach(root, kind, id, onMesh) {
    root.userData.characterKind = kind;
    const template = templates.get(kind);
    if (!template) {
      waiting.push([root, kind, id, onMesh]);
      return;
    }
    const model = clone(template.scene);
    const bounds = new T.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y;
    model.scale.multiplyScalar(1.82 / height);
    model.position.y = (-bounds.min.y * 1.82) / height;
    root.add(model);
    const bodyMeshes = [];
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = true;
      object.material = drawn(object.material, kind, root.userData.role);
      bodyMeshes.push(object);
      object.userData.sharedCharacter = true;
      object.userData.id = id;
      if (id) onMesh(object);
    });
    for (const body of bodyMeshes) {
      const hull = body.clone(false);
      body.geometry.computeBoundingBox();
      const thickness =
        (body.geometry.boundingBox.max.y - body.geometry.boundingBox.min.y) *
        0.0045;
      const outline = new T.MeshBasicMaterial({
        color: 0x303b41,
        side: T.BackSide,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      outline.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n transformed += normalize(objectNormal) * " +
            thickness.toFixed(5) +
            ";",
        );
      };
      outline.customProgramCacheKey = () =>
        "drawn-human-edge-" + thickness.toFixed(5);
      outline.userData.owned = true;
      hull.material = outline;
      hull.castShadow = false;
      hull.name = "character-contour";
      hull.userData.sharedCharacter = true;
      hull.userData.characterOutline = true;
      hull.renderOrder = 1;
      body.parent.add(hull);
    }
    const head = model
      .getObjectsByProperty("isBone", true)
      .find((b) => /Head$/.test(b.name));
    const mixer = new T.AnimationMixer(model);
    const idle = mixer.clipAction(
      template.animations.find((a) => a.name === "Idle"),
    );
    const walk = mixer.clipAction(
      template.animations.find((a) => a.name === "Walk"),
    );
    idle.play();
    walk.play();
    walk.setEffectiveWeight(0);
    mixer.update(0);
    root.userData.human = { mixer, idle, walk, head, walking: false };
  }
  const ready = Promise.all(
    ["lin", "traveler", "lo"].map(async (kind) => {
      const asset = await loader.loadAsync("./models/" + kind + ".glb");
      asset.scene.traverse((object) => {
        if (!object.isMesh) return;
        for (const mat of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (mat.map)
            mat.map.anisotropy = Math.min(
              8,
              renderer.capabilities.getMaxAnisotropy(),
            );
        }
      });
      templates.set(kind, asset);
    }),
  ).then(() => {
    for (const request of waiting.splice(0)) attach(...request);
  });
  return {
    ready,
    attach,
    update(root, dt, walking) {
      const human = root.userData.human;
      if (!human) return;
      if (walking !== human.walking) {
        human.walking = walking;
        const active = walking ? human.walk : human.idle;
        const previous = walking ? human.idle : human.walk;
        active.reset().setEffectiveWeight(1).play();
        previous.crossFadeTo(active, 0.22, false);
      }
      human.mixer.update(dt);
      if (human.head) human.head.scale.setScalar(1.08);
    },
  };
}
