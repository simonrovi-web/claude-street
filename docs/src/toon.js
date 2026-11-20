// Estilo "dibujo animado": sombreado por bandas y contorno oscuro alrededor de las figuras.
import * as THREE from 'three';

// 3 bandas de luz: sombra, medio tono y luz
export const gradientMap = (() => {
  const d = new Uint8Array([110, 190, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

export function toonMat(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
}

// Hace un color más vivo y algo más claro (para el escenario exportado de Blender).
export function vivid(color, sat = 0.18, light = 0.06) {
  const c = color.clone();
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s + sat), Math.min(0.92, hsl.l + light));
  return c;
}

// Contorno por "casco invertido": una copia de cada pieza, un poco hinchada y vista por detrás.
const outlineMats = new Map();
function outlineMat(thickness, color) {
  const key = thickness + ':' + color;
  if (!outlineMats.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${thickness.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => 'outline' + key;
    outlineMats.set(key, m);
  }
  return outlineMats.get(key);
}

export function addOutlines(root, thickness = 0.011, color = 0x1a0f24) {
  const targets = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) targets.push(o); });
  for (const mesh of targets) {
    const o = new THREE.Mesh(mesh.geometry, outlineMat(thickness, color));
    o.userData.isOutline = true;
    o.castShadow = false;
    o.receiveShadow = false;
    mesh.add(o);
  }
}
