// Pedestrians: people walking the sidewalks of Solmar Bay. Each one picks a
// point on the sidewalk network, walks to it, and picks another. When the
// player speeds past in a car, or starts swinging, nearby pedestrians flee.

import * as THREE from 'three';
import { CITY, PEDS } from './config.js';

const SKIN = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac];
const SHIRT = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xecf0f1];

const bodyGeo = new THREE.CylinderGeometry(0.42, 0.5, 1.1, 8);
const headGeo = new THREE.SphereGeometry(0.34, 10, 8);
const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);

function randomSidewalkPoint(rng) {
  const lines = [];
  for (let k = -CITY.blocks; k <= CITY.blocks; k += 1) lines.push(k * CITY.pitch);
  const line = rng.pick(lines);
  const along = rng.range(-CITY.bound + 12, CITY.bound - 12);
  const side = rng.chance(0.5) ? 1 : -1;
  if (rng.chance(0.5)) return { x: line + side * (CITY.roadHalf + 2), z: along };
  return { x: along, z: line + side * (CITY.roadHalf + 2) };
}

export function createPedestrians(scene, city, rng) {
  const peds = [];
  const skinMats = SKIN.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const shirtMats = SHIRT.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });

  function makePed() {
    const spot = randomSidewalkPoint(rng);
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, rng.pick(shirtMats));
    body.position.y = 1.05;
    group.add(body);
    const head = new THREE.Mesh(headGeo, rng.pick(skinMats));
    head.position.y = 1.9;
    group.add(head);
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.14, 0.35, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.14, 0.35, 0);
    group.add(legR);
    group.position.set(spot.x, 0, spot.z);
    scene.add(group);
    const ped = {
      mesh: group, x: spot.x, z: spot.z, target: randomSidewalkPoint(rng),
      speed: PEDS.walkSpeed * rng.range(0.8, 1.3), fleeing: false, hit: false,
    };
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < PEDS.count; i += 1) makePed();

  /** Move every pedestrian; `danger` is {x, z, active} (player car / punch). */
  function update(dt, danger) {
    for (const ped of peds) {
      let tx = ped.target.x;
      let tz = ped.target.z;
      let speed = ped.speed;
      const ddx = ped.x - danger.x;
      const ddz = ped.z - danger.z;
      const dangerDist = Math.sqrt(ddx * ddx + ddz * ddz);
      if (danger.active && dangerDist < 14) {
        ped.fleeing = true;
        tx = ped.x + (ddx / Math.max(1, dangerDist)) * 20;
        tz = ped.z + (ddz / Math.max(1, dangerDist)) * 20;
        speed = PEDS.fleeSpeed;
      } else if (dangerDist > 20) {
        ped.fleeing = false;
      }
      const dx = tx - ped.x;
      const dz = tz - ped.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.5 && !ped.fleeing) {
        ped.target = randomSidewalkPoint(rng);
        continue;
      }
      if (dist > 0.01) {
        const step = Math.min(dist, speed * dt);
        ped.x += (dx / dist) * step;
        ped.z += (dz / dist) * step;
        ped.mesh.rotation.y = Math.atan2(dx, dz);
      }
      city.collideCircle(ped, 0.6);
      ped.mesh.position.set(ped.x, 0, ped.z);
    }
  }

  /** The nearest pedestrian within `range` of (x, z), or null. */
  function nearest(x, z, range) {
    let best = null;
    let bestDist = range;
    for (const ped of peds) {
      const dx = ped.x - x;
      const dz = ped.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestDist) {
        bestDist = d;
        best = ped;
      }
    }
    return best;
  }

  return { peds, update, nearest };
}
