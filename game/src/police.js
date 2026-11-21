// The wanted system: stars 0-5, police cars that spawn at the city edge and
// chase the player, ram damage, and the bust timer when a police car pins the
// player down. Wanted decays after a quiet spell with no police nearby.

import * as THREE from 'three';
import { CITY, POLICE, WANTED } from './config.js';

export function createPolice(scene, city, vehicles, rng) {
  const cars = [];
  let wanted = 0;
  let quietTimer = 0;
  let bustTimer = 0;
  let ramCooldown = 0;
  let flash = 0;

  function wantedCarCount() {
    if (wanted <= 0) return 0;
    if (wanted === 1) return 1;
    if (wanted === 2) return 2;
    if (wanted === 3) return 3;
    return 4;
  }

  function spawnPoliceCar(nearX, nearZ) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(55, 80);
    const spot = city.snapToRoad(nearX + Math.sin(angle) * dist, nearZ + Math.cos(angle) * dist);
    const car = vehicles.makeDrivableCar(spot.x, spot.z, rng.range(0, Math.PI * 2), 0x1c4ed8, true);
    car.speed = 10;
    cars.push(car);
    return car;
  }

  function addWanted(amount) {
    wanted = Math.max(0, Math.min(WANTED.max, wanted + amount));
    quietTimer = 0;
    bustTimer = 0;
  }

  function setWanted(value) {
    wanted = Math.max(0, Math.min(WANTED.max, value));
    quietTimer = 0;
    bustTimer = 0;
  }

  /** Advance the chase. Returns 'busted' when the player is caught. */
  function update(dt, player, onRam) {
    ramCooldown = Math.max(0, ramCooldown - dt);
    flash += dt;
    const needed = wantedCarCount();
    while (cars.length < needed) spawnPoliceCar(player.x, player.z);
    while (cars.length > needed) {
      const car = cars.pop();
      scene.remove(car.mesh);
    }
    let nearestDist = Infinity;
    for (const car of cars) {
      // Steer toward the player, with a little wobble so the chase looks alive.
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      nearestDist = Math.min(nearestDist, dist);
      const targetHeading = Math.atan2(dx, dz) + Math.sin(flash * 0.7 + car.x) * 0.08;
      let turn = targetHeading - car.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const speedFactor = Math.min(1, dist / 30);
      const wantSpeed = POLICE.maxSpeed * (0.55 + 0.45 * speedFactor);
      car.speed += Math.max(-POLICE.accel * dt, Math.min(POLICE.accel * dt, wantSpeed - car.speed));
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, turn));
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const pos = { x: nx, z: nz };
      city.collideCircle(pos, 1.7);
      car.x = pos.x;
      car.z = pos.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      if (car.lightbar) {
        car.lightbar.material = car.lightbar.material || new THREE.MeshBasicMaterial({ color: 0xffffff });
        car.lightbar.material.color.setHex(Math.floor(flash * 4) % 2 === 0 ? 0xef4444 : 0x3b82f6);
      }
      // Ram: touching the player hurts and shoves them.
      if (dist < 4.2 && ramCooldown <= 0) {
        ramCooldown = POLICE.ramCooldown;
        onRam(POLICE.ramDamage);
      }
    }
    // Bust: pinned down slow, with police close, for bustSeconds.
    const playerSpeed = Math.abs(player.speed || 0);
    if (wanted > 0 && nearestDist < POLICE.bustRange && playerSpeed < 2.5) {
      bustTimer += dt;
      if (bustTimer >= POLICE.bustSeconds) {
        bustTimer = 0;
        return 'busted';
      }
    } else {
      bustTimer = Math.max(0, bustTimer - dt * 2);
    }
    // Decay: quiet for a while, and no police close, drops a star.
    if (wanted > 0) {
      quietTimer += dt;
      if (quietTimer > WANTED.decayQuietSeconds && nearestDist > 45) {
        quietTimer = WANTED.decayQuietSeconds - WANTED.decayStepSeconds;
        wanted = Math.max(0, wanted - 1);
      }
    }
    return null;
  }

  function clear() {
    for (const car of cars) scene.remove(car.mesh);
    cars.length = 0;
    wanted = 0;
    bustTimer = 0;
  }

  return {
    cars,
    get wanted() { return wanted; },
    get bustProgress() { return Math.min(1, bustTimer / POLICE.bustSeconds); },
    addWanted,
    setWanted,
    update,
    clear,
  };
}
