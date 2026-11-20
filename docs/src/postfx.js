// Postprocesado: resplandor (bloom) en lo más brillante y una viñeta suave en los bordes.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.35 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.25, length(d * vec2(1.0, 0.85)));
      c.rgb *= mix(1.0 - strength, 1.0, v);
      gl_FragColor = c;
    }`,
};

export function createPost(renderer, scene, camera, { bloom = true } = {}) {
  if (!bloom) {
    return { render: () => renderer.render(scene, camera), setSize: () => {}, enabled: false };
  }
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // solo brilla lo que supera el umbral: fuego, chispas, especiales y ojos brillantes
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 2.0);
  composer.addPass(bloomPass);
  composer.addPass(new ShaderPass(VignetteShader));
  composer.addPass(new OutputPass());
  return {
    enabled: true,
    bloomPass,
    render: () => composer.render(),
    setSize: (w, h) => {
      composer.setSize(w, h);
      bloomPass.resolution.set(w / 2, h / 2); // a media resolución: suficiente y más ligero
    },
  };
}
