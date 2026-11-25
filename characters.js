import * as T from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { clone } from "./vendor/SkeletonUtils.js";

// Authored, rigged humans with local photographic texture atlases. No billboards.
export function createCharacters(renderer) {
  const loader = new GLTFLoader();
  const templates = new Map();
  const waiting = [];
  function attach(root, kind, id, onMesh) {
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
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = true;
      object.userData.sharedCharacter = true;
      object.userData.id = id;
      if (id) onMesh(object);
    });
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
    root.userData.human = { mixer, idle, walk, walking: false };
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
    },
  };
}
