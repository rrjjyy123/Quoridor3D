import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { updateTweens } from './anim.js';

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140c08);
  scene.fog = new THREE.FogExp2(0x140c08, 0.018);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight || 1, 0.5, 200);
  camera.position.set(0, 18, 16);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 48;
  controls.maxPolarAngle = 1.32;
  controls.target.set(0, 0.4, 0);

  // 조명: 따뜻한 키 라이트 + 은은한 필 + 차가운 림
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x2a1a10, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffd8a8, 2.6);
  key.position.set(9, 20, 11);
  key.castShadow = true;
  key.shadow.camera.left = key.shadow.camera.bottom = -13;
  key.shadow.camera.right = key.shadow.camera.top = 13;
  key.shadow.camera.near = 5;
  key.shadow.camera.far = 50;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fb8ff, 0.55);
  rim.position.set(-14, 8, -12);
  scene.add(rim);

  const warmSpot = new THREE.PointLight(0xffa860, 30, 40, 1.6);
  warmSpot.position.set(0, 9, 0);
  scene.add(warmSpot);

  const quality = { high: true };
  function setQuality(high) {
    quality.high = high;
    renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    key.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    key.shadow.radius = high ? 4 : 1;
    if (key.shadow.map) {
      key.shadow.map.dispose();
      key.shadow.map = null;
    }
    renderer.shadowMap.needsUpdate = true;
  }
  setQuality(true);

  const onFrame = new Set();
  const resizeHandlers = new Set();
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return; // 숨겨진 탭 등 크기 0 이면 무시 (NaN 방지)
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const fn of resizeHandlers) fn(w, h);
  }
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(container);

  const timer = new THREE.Timer();
  const loop = () => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const time = timer.getElapsed();
    updateTweens(dt);
    for (const fn of onFrame) fn(dt, time);
    controls.update();
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(loop);

  return { loop, renderer, scene, camera, controls, lights: { key, hemi, rim, warmSpot }, onFrame, resizeHandlers, setQuality, quality };
}
