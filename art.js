// Shared graphic-novel shading. Texture coordinates are wrapped inside the atlas
// quadrant in the shader so seams never sample a neighboring material.
export function inkMaterial(T, options = {}) {
  const { atlasRegion, gradientMap = null, ...parameters } = options;
  const material = new T.MeshToonMaterial({
    gradientMap,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    ...parameters,
  });
  material.userData.illustrated = true;
  if (atlasRegion) material.userData.atlasRegion = atlasRegion;
  material.onBeforeCompile = (shader) => {
    if (atlasRegion) {
      shader.uniforms.paintOrigin = { value: new T.Vector2(...atlasRegion) };
      shader.fragmentShader =
        "uniform vec2 paintOrigin;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #ifdef USE_MAP
          vec2 brushUv = paintOrigin + vec2(.007) + fract(vMapUv) * .486;
          vec4 sampledDiffuseColor = textureGrad(map, brushUv, dFdx(vMapUv) * .486, dFdy(vMapUv) * .486);
          diffuseColor *= sampledDiffuseColor;
        #endif
      `,
      );
    }
    // A very slight blue bias in shadow keeps the drawn palette cohesive.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      float inkShade = clamp(1.0 - dot(outgoingLight, vec3(.2126,.7152,.0722)), 0.0, 1.0);
      outgoingLight = mix(outgoingLight, outgoingLight * vec3(.91,.96,1.05), inkShade * .22);
      #include <opaque_fragment>
    `,
    );
  };
  material.customProgramCacheKey = () =>
    "illustrated-v1-" + (atlasRegion?.join(",") || "solid");
  return material;
}
export function copyInk(material) {
  const copy = material.clone();
  copy.onBeforeCompile = material.onBeforeCompile;
  copy.customProgramCacheKey = material.customProgramCacheKey;
  return copy;
}
export function inkEdges(T, object, opacity = 0.38, angle = 36) {
  const geometry = new T.EdgesGeometry(object.geometry, angle);
  const material = new T.LineBasicMaterial({
    color: 0x333c40,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  material.userData.owned = true;
  const edge = new T.LineSegments(geometry, material);
  edge.name = "drawn-contour";
  edge.userData.ink = true;
  object.add(edge);
  return edge;
}
