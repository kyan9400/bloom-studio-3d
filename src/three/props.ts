/*
  The studio around the plinth: real photogrammetry scans from Poly Haven (CC0, see CREDITS.md), a potted
  succulent and a glazed ceramic vase. Meshopt-compressed .glb files with WebP textures, served from this site's
  own /models folder and loaded together with the 3D chunk. They stand on the floor behind the plinth, softly lit
  and a little out of focus (blurrier texture mips plus a blush haze), so the polish bottle stays the hero.
*/

import { Color, Group, Box3, Vector3, type Material, type Mesh, type MeshStandardMaterial, type Texture, type BufferGeometry } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// the GitHub Pages mirror is served under a base path
const BASE = process.env.NEXT_PUBLIC_GH_PAGES === "1" ? "/bloom-studio-3d" : "";

/** [file, height in scene units, x, z, turn] — the plinth is 3.9 units across, its top at y = 0, the floor at -0.78 */
const PROPS: [string, number, number, number, number][] = [
  ["potted_plant_04", 2.6, -2.2, -2.6, 0.6],
  ["ceramic_vase_01", 3.4, 1.95, -3.3, -0.4],
];
const FLOOR_Y = -0.779;

export type StudioProps = {
  group: Group;
  /** the haze colour the props fade toward (the scene keeps it in step with the shade-tinted backdrop) */
  haze: Color;
  textures: Texture[];
  dispose: () => void;
};

export async function loadStudioProps(): Promise<StudioProps> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const scenes = await Promise.all(PROPS.map(([file]) => loader.loadAsync(`${BASE}/models/${file}.glb`)));

  const group = new Group();
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const box = new Box3();
  const size = new Vector3();
  const center = new Vector3();
  // shared by every prop material: one program, and one place to tune the haze
  const haze = { uHaze: { value: new Color("#f4d6dc") }, uHazeAmount: { value: 0.3 } };

  scenes.forEach((gltf, i) => {
    const [, height, x, z, turn] = PROPS[i];
    const model = gltf.scene;
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      const m = mesh.material as MeshStandardMaterial;
      materials.add(m);
      for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.aoMap]) if (t) textures.add(t);
      m.customProgramCacheKey = () => "bloom-prop";
      m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, haze);
        shader.fragmentShader = shader.fragmentShader
          .replace("void main() {", "uniform vec3 uHaze;\nuniform float uHazeAmount;\nvoid main() {")
          // depth of field, faked: sample the colour from blurrier mip levels
          .replace("vec4 sampledDiffuseColor = texture2D( map, vMapUv );", "vec4 sampledDiffuseColor = texture2D( map, vMapUv, 2.2 );")
          // and let the blush backdrop wash over it a little (aerial perspective)
          .replace("#include <opaque_fragment>", "outgoingLight = mix(outgoingLight, uHaze, uHazeAmount);\n#include <opaque_fragment>");
      };
    });
    box.setFromObject(model);
    box.getSize(size);
    box.getCenter(center);
    const s = height / size.y;
    model.scale.setScalar(s);
    model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const holder = new Group();
    holder.position.set(x, FLOOR_Y, z);
    holder.rotation.y = turn;
    holder.add(model);
    group.add(holder);
  });

  return {
    group,
    haze: haze.uHaze.value,
    textures: [...textures],
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
