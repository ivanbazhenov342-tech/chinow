// Local, photographed CC0 surface maps. All texture requests stay on the Pages origin.
export function createSurfaces(T, renderer) {
  const manager = new T.LoadingManager();
  const failed = [];
  const ready = new Promise((resolve) => {
    manager.onLoad = () => resolve(failed);
    manager.onError = (url) => failed.push(url);
  });
  const loader = new T.TextureLoader(manager);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function maps(name, repeat = 1) {
    const load = (kind, color = false) => {
      const texture = loader.load("./textures/" + name + "-" + kind + ".jpg");
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.repeat.set(repeat, repeat);
      texture.anisotropy = anisotropy;
      if (color) texture.colorSpace = T.SRGBColorSpace;
      return texture;
    };
    return {
      map: load("color", true),
      normalMap: load("normal"),
      roughnessMap: load("roughness"),
    };
  }
  function surface(name, color, scale, normalStrength = 0.55) {
    const result = new T.MeshStandardMaterial({
      ...maps(name),
      color,
      roughness: 1,
      normalScale: new T.Vector2(normalStrength, normalStrength),
    });
    result.userData.uvScale = scale;
    return result;
  }
  const wood = surface("wood", 0xb59672, 0.8);
  const darkWood = wood.clone();
  darkWood.color.setHex(0x66503b);
  const signWood = wood.clone();
  signWood.color.setHex(0x344d44);
  const plaster = surface("plaster", 0xf0e4cd, 0.55, 0.38);
  const roof = surface("roof", 0x8b9188, 0.7, 0.85);
  const stone = surface("stone", 0xbbb5a1, 0.65, 0.8);
  const bark = surface("bark", 0xa89a80, 1.2, 0.8);
  const ground = surface("ground", 0xa6aa7e, 0.32, 0.6);
  const clothMaps = maps("cloth", 3);
  const clothes = new Map();
  const walls = new Map();
  return {
    paintedMetal: new T.MeshStandardMaterial({
      color: 0x36544a,
      roughness: 0.38,
      metalness: 0.38,
    }),
    iron: new T.MeshStandardMaterial({
      color: 0x343c38,
      roughness: 0.55,
      metalness: 0.7,
    }),
    ready,
    wood,
    darkWood,
    signWood,
    plaster,
    roof,
    stone,
    bark,
    ground,
    skin: new T.MeshPhysicalMaterial({
      color: 0xcfa786,
      roughness: 0.64,
      clearcoat: 0.08,
      clearcoatRoughness: 0.7,
    }),
    bronze: new T.MeshStandardMaterial({
      color: 0x8c6a38,
      roughness: 0.45,
      metalness: 0.72,
    }),
    ceramic: new T.MeshPhysicalMaterial({
      color: 0xc6d5c3,
      roughness: 0.2,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25,
    }),
    water: new T.MeshStandardMaterial({
      color: 0x597e78,
      roughness: 0.18,
      metalness: 0.3,
    }),
    glass: new T.MeshPhysicalMaterial({
      color: 0x8bafa2,
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.72,
    }),
    fabric(color) {
      if (!clothes.has(color)) {
        const material = new T.MeshPhysicalMaterial({
          ...clothMaps,
          color,
          roughness: 1,
          normalScale: new T.Vector2(0.3, 0.3),
          sheen: 0.35,
          sheenRoughness: 0.8,
          sheenColor: new T.Color(0xd8cbb4),
        });
        clothes.set(color, material);
      }
      return clothes.get(color);
    },
    wall(color) {
      if (!walls.has(color)) {
        const material = plaster.clone();
        material.color.setHex(color);
        walls.set(color, material);
      }
      return walls.get(color);
    },
  };
}
