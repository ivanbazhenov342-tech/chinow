import { inkMaterial, copyInk } from "./art.js?v=7";

export function createSurfaces(T, renderer) {
  const manager = new T.LoadingManager();
  const ready = new Promise((resolve, reject) => {
    manager.onLoad = resolve;
    manager.onError = (url) =>
      reject(new Error("Material unavailable: " + url));
  });
  const atlas = new T.TextureLoader(manager).load(
    "./textures/painted-atlas.webp",
  );
  atlas.colorSpace = T.SRGBColorSpace;
  atlas.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  atlas.wrapS = atlas.wrapT = T.ClampToEdgeWrapping;
  // Four deliberately broad light bands, with a soft illustrated shadow color.
  const gradient = new T.DataTexture(
    new Uint8Array([105, 161, 211, 248]),
    4,
    1,
    T.RedFormat,
  );
  gradient.minFilter = gradient.magFilter = T.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  const colors = new Map(),
    fabrics = new Map(),
    walls = new Map();
  const solid = (color) => {
    if (!colors.has(color))
      colors.set(color, inkMaterial(T, { color, gradientMap: gradient }));
    return colors.get(color);
  };
  function surface(region, color, scale) {
    const result = inkMaterial(T, {
      map: atlas,
      color,
      gradientMap: gradient,
      atlasRegion: region,
    });
    result.userData.uvScale = scale;
    return result;
  }
  // Texture origin is at the bottom-left in WebGL; all regions share one image.
  const wood = surface([0, 0], 0xf3ddbc, 0.28);
  const darkWood = copyInk(wood);
  darkWood.color.setHex(0x806d5d);
  const signWood = surface([0, 0.5], 0xf6e9c8, 0.1);
  const plaster = surface([0, 0.5], 0xfff1d6, 0.2);
  const roof = surface([0.5, 0.5], 0xe0e5e4, 0.5);
  const stone = surface([0.5, 0], 0xe8e0d2, 0.34);
  const bark = copyInk(wood);
  bark.color.setHex(0x9d9179);
  bark.userData.uvScale = 0.5;
  return {
    ready,
    gradient,
    solid,
    wood,
    darkWood,
    signWood,
    plaster,
    roof,
    stone,
    bark,
    ground: solid(0x9d9c80),
    paintedMetal: solid(0x4f716c),
    iron: solid(0x39474b),
    skin: solid(0xd5ac8d),
    bronze: solid(0xb69462),
    ceramic: solid(0xacc0af),
    water: new T.MeshPhongMaterial({
      color: 0x73928c,
      shininess: 65,
      transparent: true,
      opacity: 0.8,
    }),
    glass: new T.MeshBasicMaterial({ color: 0xcda76b }),
    windowDark: solid(0x465c5e),
    fabric(color) {
      if (!fabrics.has(color)) fabrics.set(color, solid(color));
      return fabrics.get(color);
    },
    wall(color) {
      if (!walls.has(color)) {
        const mat = copyInk(plaster);
        mat.color.setHex(color);
        walls.set(color, mat);
      }
      return walls.get(color);
    },
  };
}
