// The story of Solmar Bay: three jobs from Mira the fixer, in order. Each
// mission is a list of steps; a step is a place to reach (on foot or by car),
// a car to steal, or a set of enforcers to put down. A light beacon marks the
// current target, and the HUD shows the objective and the distance to it.

import * as THREE from 'three';
import { MISSIONS } from './config.js';

const CASH_SPOTS = [
  { x: 76, z: -124 }, { x: -116, z: 76 }, { x: 140, z: 12 },
  { x: -12, z: -116 }, { x: -140, z: -12 }, { x: 12, z: 140 },
];

function beaconMesh() {
  const group = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  column.position.y = 17;
  group.add(column);
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }),
  );
  marker.position.y = 8;
  marker.name = 'diamond';
  group.add(marker);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  group.add(ring);
  return group;
}

function enforcerMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 1.2, 10),
    new THREE.MeshLambertMaterial({ color: 0x7c2d12 }),
  );
  body.position.y = 1.1;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xd9a066 }),
  );
  head.position.y = 1.95;
  group.add(head);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.18, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
  );
  bar.position.y = 2.45;
  group.add(bar);
  return group;
}

export function createMissions(scene, city, rng, hooks) {
  const beacon = beaconMesh();
  beacon.visible = false;
  scene.add(beacon);

  const cashGroup = new THREE.Group();
  scene.add(cashGroup);
  const cashMeshes = [];
  const cashGeo = new THREE.BoxGeometry(0.9, 0.5, 0.6);
  const cashMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  for (const spot of CASH_SPOTS) {
    const mesh = new THREE.Mesh(cashGeo, cashMat);
    mesh.position.set(spot.x, 0.6, spot.z);
    cashGroup.add(mesh);
    cashMeshes.push({ mesh, x: spot.x, z: spot.z, taken: false });
  }

  const state = {
    index: 0,
    step: 0,
    done: false,
    target: null,
    sedan: null,
    enforcers: [],
    enforcersLeft: 0,
    banner: '',
    bannerUntil: 0,
  };

  function setTarget(x, z, label, radius) {
    state.target = { x, z, label, radius };
    beacon.position.set(x, 0, z);
    beacon.visible = true;
  }

  function hideBeacon() {
    beacon.visible = false;
    state.target = null;
  }

  function spawnEnforcers(cx, cz) {
    for (const e of state.enforcers) scene.remove(e.mesh);
    state.enforcers = [];
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2;
      const mesh = enforcerMesh();
      const x = cx + Math.sin(angle) * 14;
      const z = cz + Math.cos(angle) * 14;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      state.enforcers.push({
        mesh, x, z, health: 100, cooldown: 0, alive: true, name: ['Dario’s muscle', 'Dario’s muscle', 'Dario’s muscle'][i],
      });
    }
    state.enforcersLeft = 3;
  }

  /** Begin mission `index` at its first step. Called by main at start. */
  function startMission(index, G) {
    state.index = index;
    state.step = 0;
    if (index === 0) {
      const sedan = G.vehicles.makeDrivableCar(68, -60, Math.PI / 2, 0xc0392b, false);
      state.sedan = sedan;
      setTarget(68, -60, 'Take the marked sedan (press E)', 4);
      hooks.message('Mira: "Raka, I need wheels. The red sedan by Coral Ave is yours. Take it."');
    } else if (index === 1) {
      setTarget(160, 150, 'Pick up the package at the pier', 5);
      hooks.message('Mira: "Package is waiting at the pier. Grab it, then run it north."');
    } else if (index === 2) {
      spawnEnforcers(160, 160);
      setTarget(160, 160, 'Put down Dario’s 3 enforcers at the marina (press F to punch)', 999);
      hooks.message('Mira: "Dario’s crew owns the marina. Clear them out, Raka."');
    }
  }

  function completeMission(G) {
    const mission = MISSIONS[state.index];
    G.money += mission.reward;
    hooks.reward(mission.reward, `${mission.name} complete: +$${mission.reward}`);
    hooks.sound('missionComplete');
    state.banner = `${mission.name.toUpperCase()} — COMPLETE  +$${mission.reward}`;
    state.bannerUntil = G.time + 4;
    hideBeacon();
    if (state.index + 1 < MISSIONS.length) {
      startMission(state.index + 1, G);
    } else {
      state.done = true;
      state.banner = 'SOLMAR LEGEND — All jobs done. The Bay is yours.';
      state.bannerUntil = G.time + 8;
      hooks.sound('missionComplete');
      hooks.onAllComplete();
    }
  }

  function distToTarget(G) {
    if (!state.target) return 0;
    const px = G.player.state.inCar ? G.player.state.inCar.x : G.player.state.x;
    const pz = G.player.state.inCar ? G.player.state.inCar.z : G.player.state.z;
    return Math.sqrt((state.target.x - px) ** 2 + (state.target.z - pz) ** 2);
  }

  function objectiveText(G) {
    if (state.done) return 'All jobs done — cruise Solmar Bay, Raka.';
    if (!G.missionsStarted || !state.target) return 'Press Enter to start your first job.';
    const mission = MISSIONS[state.index];
    const dist = Math.round(distToTarget(G));
    return `${mission.name}: ${state.target ? state.target.label : ''} — ${dist}m`;
  }

  /** Advance the current step. `G` is the shared game object from main.js. */
  function update(dt, G) {
    if (!state.target && !state.done) return;
    // Beacon diamond bobs and spins.
    const diamond = beacon.getObjectByName('diamond');
    if (diamond && beacon.visible) {
      diamond.position.y = 8 + Math.sin(G.time * 2) * 0.6;
      diamond.rotation.y += dt * 1.5;
    }
    // Cash bundles: walk or drive over one to collect it.
    const px = G.player.state.inCar ? G.player.state.inCar.x : G.player.state.x;
    const pz = G.player.state.inCar ? G.player.state.inCar.z : G.player.state.z;
    for (const cash of cashMeshes) {
      if (cash.taken) continue;
      cash.mesh.rotation.y += dt;
      cash.mesh.position.y = 0.6 + Math.sin(G.time * 3 + cash.x) * 0.15;
      const d = Math.sqrt((cash.x - px) ** 2 + (cash.z - pz) ** 2);
      if (d < 3) {
        cash.taken = true;
        cash.mesh.visible = false;
        G.money += 50;
        hooks.message('Cash bundle: +$50');
        hooks.sound('cash');
      }
    }
    if (state.done || !state.target) return;
    const dist = distToTarget(G);
    if (state.index === 0 && state.step === 0) {
      // Step 0 completes when the player is driving the sedan.
      if (G.player.state.inCar === state.sedan) {
        state.step = 1;
        setTarget(124, 124, 'Drive the sedan to Mira’s garage', 7);
        hooks.message('Mira: "Nice. Now bring it to my garage on Palm Row."');
      }
      return;
    }
    if (state.index === 1 && state.step === 0) {
      if (dist < state.target.radius) {
        state.step = 1;
        setTarget(-124, -124, 'Deliver the package north — the heat is on', 7);
        G.police.setWanted(2);
        hooks.message('Mira: "Package secured. North drop, and shake the cops."');
        hooks.sound('pickup');
      }
      return;
    }
    if (state.index === 2 && state.step === 0) {
      if (state.enforcersLeft <= 0) {
        state.step = 1;
        setTarget(-60, 60, 'Reach the safehouse on Coral Ave', 7);
        hooks.message('Mira: "Marina’s clear. Get to the safehouse, Raka."');
      }
      return;
    }
    if (dist < state.target.radius) completeMission(G);
  }

  /** Enforcer AI: chase the player on foot and swing when close. */
  function updateEnforcers(dt, G) {
    for (const e of state.enforcers) {
      if (!e.alive) continue;
      e.cooldown = Math.max(0, e.cooldown - dt);
      const p = G.player.state;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (p.inCar || dist > 45) {
        // Idle patrol around the plaza when the player is far or driving.
        const px = 160 + Math.sin(G.time * 0.3 + e.x) * 8;
        const pz = 160 + Math.cos(G.time * 0.3 + e.z) * 8;
        const ex = px - e.x;
        const ez = pz - e.z;
        const ed = Math.sqrt(ex * ex + ez * ez);
        if (ed > 0.5) {
          e.x += (ex / ed) * 2.5 * dt;
          e.z += (ez / ed) * 2.5 * dt;
          e.mesh.rotation.y = Math.atan2(ex, ez);
        }
      } else if (dist > 2) {
        e.x += (dx / dist) * 4.6 * dt;
        e.z += (dz / dist) * 4.6 * dt;
        e.mesh.rotation.y = Math.atan2(dx, dz);
        city.collideCircle(e, 0.7);
      } else if (e.cooldown <= 0) {
        e.cooldown = 1.1;
        G.player.hurt(6, G.time);
        hooks.sound('punch');
        hooks.message('An enforcer lands a hit! (-6 HP)');
      }
      e.mesh.position.set(e.x, 0, e.z);
    }
  }

  /** Punch resolution: nearest living enforcer in range, else null. */
  function nearestEnforcer(x, z, range) {
    let best = null;
    let bestDist = range;
    for (const e of state.enforcers) {
      if (!e.alive) continue;
      const d = Math.sqrt((e.x - x) ** 2 + (e.z - z) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  function damageEnforcer(e, amount, G) {
    e.health -= amount;
    if (e.health > 0) return;
    e.alive = false;
    e.mesh.rotation.z = Math.PI / 2;
    e.mesh.position.y = 0.5;
    state.enforcersLeft -= 1;
    hooks.message(`Enforcer down! ${state.enforcersLeft} left.`);
    hooks.sound('punch');
  }

  return {
    state,
    startMission,
    update,
    updateEnforcers,
    nearestEnforcer,
    damageEnforcer,
    objectiveText,
    distToTarget,
  };
}
