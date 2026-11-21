// Solmar Bay — Open-World Crime. Boot and the one loop: input is read every
// frame, the world advances in fixed 1/60 s steps, and the renderer paints
// what is there. Screens: title, play, paused, busted, wasted. On foot the
// player walks and punches; E gets in and out of cars; driving, traffic,
// pedestrians, police, wanted stars and three story missions run on top.
//
// ?seed=N fixes the city. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import * as THREE from 'three';
import { STEP, CITY, PLAYER, PALETTE, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createPlayer } from './player.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SAFEHOUSE = { x: -60, z: 60 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// --- Renderer, scene, camera, lights --------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 120, 420);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
sun.position.set(120, 180, 60);
scene.add(sun);

// --- World modules ---------------------------------------------------------
const rng = createRandom(seed);
const city = createCity(scene, rng);
const vehicles = createVehicles(scene, city, rng);
const peds = createPedestrians(scene, city, rng);
const police = createPolice(scene, city, vehicles, rng);
const player = createPlayer(scene, city);
const audio = createAudio();
const hud = createHud(document, city);
const missions = createMissions(scene, city, rng, {
  message: (text) => hud.pushMessage(text),
  reward: (amount, text) => {
    hud.pushMessage(text);
    saveGame();
  },
  sound: (name) => audio[name] && audio[name](),
  onAllComplete: () => saveGame(),
});

// --- Shared game state ------------------------------------------------------
const G = {
  time: 0,
  money: 0,
  bestMoney: 0,
  screen: 'title',
  missionsStarted: false,
  player,
  vehicles,
  peds,
  police,
  missions,
  city,
  audio,
  hud,
  camYaw: 0,
  orbitOffset: 0,
  camDist: 14,
  camHeight: 8,
};

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    if (typeof save.money === 'number') G.money = save.money;
    if (typeof save.bestMoney === 'number') G.bestMoney = save.bestMoney;
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

function saveGame() {
  G.bestMoney = Math.max(G.bestMoney, G.money);
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ money: G.money, bestMoney: G.bestMoney }));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

loadSave();
player.reset(0, 60, 0);

const status = document.getElementById('status');
function announce(message) {
  status.textContent = message;
}

// --- Car enter / exit -------------------------------------------------------
function nearestCar(maxDist) {
  const p = player.state;
  let best = null;
  let bestDist = maxDist;
  const consider = (car) => {
    if (!car || !car.active) return;
    const d = Math.sqrt((car.x - p.x) ** 2 + (car.z - p.z) ** 2);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  };
  consider(missions.state.sedan);
  for (const car of vehicles.traffic) consider(car);
  for (const car of police.cars) consider(car);
  return best;
}

function enterCar() {
  const p = player.state;
  if (p.inCar) {
    const car = p.inCar;
    const sideX = car.x + Math.cos(car.heading) * 2.6;
    const sideZ = car.z - Math.sin(car.heading) * 2.6;
    const pos = { x: sideX, z: sideZ };
    city.collideCircle(pos, PLAYER.radius);
    p.inCar = null;
    p.x = pos.x;
    p.z = pos.z;
    p.heading = car.heading;
    car.speed = 0;
    player.state.mesh.visible = true;
    player.state.mesh.position.set(p.x, 0, p.z);
    audio.engine(null);
    hud.pushMessage('Out of the car.');
    return;
  }
  const car = nearestCar(4.5);
  if (!car) return;
  p.inCar = car;
  player.state.mesh.visible = false;
  audio.engineStart();
  if (car.traffic) {
    car.traffic = false;
    car.active = false;
    if (!car.stolen) {
      car.stolen = true;
      police.addWanted(1);
      hud.pushMessage('You jacked the car! Wanted level up.');
    }
  } else if (car === missions.state.sedan) {
    if (!car.stolen) {
      car.stolen = true;
      police.addWanted(1);
      hud.pushMessage('Sedan taken — the cops noticed.');
    }
  } else if (police.cars.includes(car)) {
    police.addWanted(2);
    hud.pushMessage('You stole a police cruiser! Wanted level up.');
  }
}

function punch() {
  const p = player.state;
  if (p.inCar || p.punchCooldown > 0) return;
  audio.punch();
  const victim = player.punch((fx, fz, range) => {
    const enforcer = missions.nearestEnforcer(fx, fz, range);
    if (enforcer) return { kind: 'enforcer', target: enforcer };
    const ped = peds.nearest(fx, fz, range);
    if (ped) return { kind: 'ped', target: ped };
    return null;
  });
  if (!victim) return;
  if (victim.kind === 'enforcer') {
    missions.damageEnforcer(victim.target, 34, G);
  } else {
    const ped = victim.target;
    ped.target = { x: ped.x + (ped.x - p.x) * 4, z: ped.z + (ped.z - p.z) * 4 };
    ped.fleeing = true;
    police.addWanted(1);
    hud.pushMessage('You clocked a pedestrian! Wanted level up.');
  }
}

// --- One fixed world step ----------------------------------------------------
function stepWorld(dt, driver) {
  G.time += dt;
  const p = player.state;

  if (p.inCar) {
    const car = p.inCar;
    vehicles.driveCar(car, driver.forward, driver.strafe, dt);
    // Running a pedestrian over: wanted up, the pedestrian flees.
    const frontX = car.x + Math.sin(car.heading) * 2;
    const frontZ = car.z + Math.cos(car.heading) * 2;
    const hit = peds.nearest(frontX, frontZ, 2.6);
    if (hit && Math.abs(car.speed) > 4 && (hit.hitAt === undefined || G.time - hit.hitAt > 5)) {
      hit.hitAt = G.time;
      hit.fleeing = true;
      hit.target = { x: hit.x + (hit.x - car.x) * 4, z: hit.z + (hit.z - car.z) * 4 };
      car.speed *= 0.85;
      police.addWanted(2);
      audio.punch();
      hud.pushMessage('You hit a pedestrian! Wanted level up.');
    }
    // Shove traffic cars out of the way.
    for (const other of vehicles.traffic) {
      if (other.active && vehicles.carsTouch(car, other, 3.4)) car.speed *= 0.7;
    }
    audio.engine(Math.abs(car.speed) / 40);
  } else {
    // Camera-relative movement: W moves away from the camera.
    const sin = Math.sin(G.camYaw);
    const cos = Math.cos(G.camYaw);
    const moveX = driver.forward * sin + driver.strafe * cos;
    const moveY = driver.forward * cos - driver.strafe * sin;
    player.stepOnFoot(dt, moveX, moveY, driver.run, G.time);
    audio.engine(null);
  }

  if (driver.actions & ACTION_ENTER_CAR) enterCar();
  if (driver.actions & ACTION_PUNCH) punch();

  vehicles.updateTraffic(dt);
  const danger = {
    x: p.inCar ? p.inCar.x : p.x,
    z: p.inCar ? p.inCar.z : p.z,
    active: Boolean(p.inCar && Math.abs(p.inCar.speed) > 6) || p.punchAnim > 0,
  };
  peds.update(dt, danger);
  const bust = police.update(dt, p, (damage) => {
    player.hurt(damage, G.time);
    hud.pushMessage(`Police ram! (-${damage} HP)`);
  });
  missions.updateEnforcers(dt, G);
  missions.update(dt, G);
  audio.siren(police.wanted > 0 && G.screen === 'play');

  if (bust === 'busted') {
    G.screen = 'busted';
    G.money = Math.max(0, G.money - 100);
    saveGame();
    audio.busted();
    audio.siren(false);
    audio.engine(null);
    hud.showScreen('busted');
    announce('Busted! The police caught you. $100 bail.');
  } else if (p.health <= 0 && G.screen === 'play') {
    G.screen = 'wasted';
    G.money = Math.max(0, G.money - 150);
    saveGame();
    audio.wasted();
    audio.siren(false);
    audio.engine(null);
    hud.showScreen('wasted');
    announce('Wasted! You are down. $150 hospital bill.');
  }
}

// --- Camera ------------------------------------------------------------------
function updateCamera(dt, orbitMode) {
  const p = player.state;
  const tx = p.inCar ? p.inCar.x : p.x;
  const tz = p.inCar ? p.inCar.z : p.z;
  const heading = p.inCar ? p.inCar.heading : p.heading;
  if (orbitMode) {
    const angle = G.time * 0.08;
    camera.position.set(Math.sin(angle) * 150, 70, Math.cos(angle) * 150);
    camera.lookAt(0, 0, 0);
    return;
  }
  let targetYaw = heading + G.orbitOffset;
  let diff = targetYaw - G.camYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  G.camYaw += diff * Math.min(1, 3.5 * dt);
  const dist = G.camDist;
  const height = G.camHeight;
  camera.position.set(
    tx - Math.sin(G.camYaw) * dist,
    height,
    tz - Math.cos(G.camYaw) * dist,
  );
  camera.lookAt(tx + Math.sin(G.camYaw) * (G.camLookAhead ?? 3), 2, tz + Math.cos(G.camYaw) * (G.camLookAhead ?? 3));
}

// --- Screens -------------------------------------------------------------------
function startGame() {
  audio.unlock();
  if (!G.missionsStarted) {
    G.missionsStarted = true;
    missions.startMission(0, G);
  }
  G.screen = 'play';
  hud.showScreen(null);
  announce('Playing Solmar Bay. Follow the yellow beacon.');
}

function respawn() {
  police.clear();
  player.reset(SAFEHOUSE.x, SAFEHOUSE.z, 0);
  G.camYaw = 0;
  G.screen = 'play';
  hud.showScreen(null);
  announce('Back on the streets of Solmar Bay.');
}

// --- Shot mode -----------------------------------------------------------------
function runShot(name) {
  const staged = stageShot(name, G, stepWorld, updateCamera);
  G.screen = staged.screen;
  hud.showScreen(staged.screen === 'title' ? 'title' : null, { bestMoney: G.bestMoney });
  hud.update(G);
  let painted = 0;
  function paint() {
    updateCamera(STEP, staged.orbit);
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// --- Live game loop --------------------------------------------------------------
function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function handleActions() {
    const actions = input.takeActions();
    const orbit = input.takeOrbit();
    G.orbitOffset += orbit.dx * 0.005;
    const zoom = input.takeZoom();
    if (zoom !== 0) {
      G.camDist = Math.max(8, Math.min(22, G.camDist + zoom * 0.01));
      G.camHeight = Math.max(5, Math.min(14, G.camHeight + zoom * 0.005));
    }
    if (actions & ACTION_CONFIRM) {
      if (G.screen === 'title') startGame();
      else if (G.screen === 'busted' || G.screen === 'wasted') respawn();
    }
    if (actions & ACTION_PAUSE) {
      if (G.screen === 'play') {
        G.screen = 'paused';
        hud.showScreen('paused');
        announce('Paused.');
      } else if (G.screen === 'paused') {
        G.screen = 'play';
        hud.showScreen(null);
        announce('Playing.');
      }
    }
    // Only the step-level actions (enter car, punch) go to the world; the
    // screen-level ones above are already handled here.
    return actions & (ACTION_ENTER_CAR | ACTION_PUNCH);
  }

  // Step-level actions a slow frame never got to run are carried to the next
  // frame instead of being lost, and an action runs on the first fixed step
  // of its frame only — never once per step of a long catch-up.
  let pendingStepActions = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions() | pendingStepActions;
    pendingStepActions = 0;
    if (G.screen === 'play') {
      let stepped = false;
      let first = true;
      while (accumulator >= STEP) {
        stepWorld(STEP, {
          forward: input.forward(),
          strafe: input.strafe(),
          run: input.run(),
          actions: first ? actions : 0,
        });
        first = false;
        stepped = true;
        accumulator -= STEP;
        if (G.screen !== 'play') break;
      }
      if (!stepped) pendingStepActions = actions;
    } else {
      accumulator = 0;
      if (G.screen === 'title') {
        // The city stays alive behind the title: traffic and pedestrians move.
        vehicles.updateTraffic(STEP);
        peds.update(STEP, { x: 0, z: 0, active: false });
        G.time += STEP;
      }
    }
    updateCamera(STEP, G.screen === 'title');
    renderer.render(scene, camera);
    if (G.screen === 'play') hud.update(G);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveGame();
      if (G.screen === 'play') {
        G.screen = 'paused';
        hud.showScreen('paused');
        announce('Paused.');
      }
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  hud.showScreen('title', { bestMoney: G.bestMoney });
  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

// Debug handle for automated playtesting (read-only state inspection).
window.__solmar = G;
window.__solmarDebug = { renderer, scene, camera };

if (shot) runShot(shot);
else runGame();
