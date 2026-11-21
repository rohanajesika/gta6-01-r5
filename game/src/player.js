// Raka, the player on foot: a yellow-jacketed figure who walks, runs, punches
// and gets in and out of cars. Movement is camera-relative, so W always moves
// away from the camera. Punching hits the nearest enforcer or pedestrian in
// front of the player.

import * as THREE from 'three';
import { PLAYER, PALETTE } from './config.js';

const bodyGeo = new THREE.CylinderGeometry(0.45, 0.55, 1.15, 10);
const headGeo = new THREE.SphereGeometry(0.36, 12, 10);
const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
const armGeo = new THREE.BoxGeometry(0.2, 0.85, 0.2);

export function createPlayer(scene, city) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: PALETTE.player });
  const dark = new THREE.MeshLambertMaterial({ color: PALETTE.playerDark });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const body = new THREE.Mesh(bodyGeo, jacket);
  body.position.y = 1.1;
  group.add(body);
  const head = new THREE.Mesh(headGeo, skin);
  head.position.y = 1.95;
  group.add(head);
  const legL = new THREE.Mesh(legGeo, dark);
  legL.position.set(-0.15, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, dark);
  legR.position.set(0.15, 0.38, 0);
  group.add(legR);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.62, 1.15, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.62, 1.15, 0);
  armR.name = 'punchArm';
  group.add(armR);
  scene.add(group);

  const state = {
    mesh: group,
    x: 0, z: 60,
    heading: 0,
    vx: 0, vz: 0,
    speed: 0,
    health: PLAYER.health,
    punchCooldown: 0,
    punchAnim: 0,
    lastHurtAt: -99,
    inCar: null,
  };

  function reset(x, z, heading) {
    state.x = x;
    state.z = z;
    state.heading = heading;
    state.vx = 0;
    state.vz = 0;
    state.speed = 0;
    state.health = PLAYER.health;
    state.punchCooldown = 0;
    state.inCar = null;
    group.visible = true;
    group.position.set(x, 0, z);
    group.rotation.y = heading;
  }

  /** Move on foot. `moveX/moveY` are camera-relative axes; returns speed. */
  function stepOnFoot(dt, moveX, moveY, running, time) {
    state.punchCooldown = Math.max(0, state.punchCooldown - dt);
    state.punchAnim = Math.max(0, state.punchAnim - dt * 3);
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.sqrt(moveX * moveX + moveY * moveY);
    let tx = 0;
    let tz = 0;
    if (len > 0.01) {
      tx = (moveX / len) * speed;
      tz = (moveY / len) * speed;
      state.heading = Math.atan2(tx, tz);
    }
    const k = Math.min(1, PLAYER.accel * dt / Math.max(1, speed));
    state.vx += (tx - state.vx) * k;
    state.vz += (tz - state.vz) * k;
    const pos = { x: state.x + state.vx * dt, z: state.z + state.vz * dt };
    city.collideCircle(pos, PLAYER.radius);
    state.x = pos.x;
    state.z = pos.z;
    state.speed = Math.sqrt(state.vx * state.vx + state.vz * state.vz);
    group.position.set(state.x, 0, state.z);
    group.rotation.y = state.heading;
    // Walk cycle: legs swing, punch arm swings forward while punching.
    const swing = Math.sin(time * 10) * Math.min(1, state.speed / PLAYER.walkSpeed) * 0.5;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armR.rotation.x = state.punchAnim > 0 ? -1.6 * state.punchAnim : -swing * 0.6;
    armL.rotation.x = swing * 0.6;
    // Slow health regen after a quiet spell.
    if (time - state.lastHurtAt > PLAYER.regenDelay && state.health < PLAYER.health) {
      state.health = Math.min(PLAYER.health, state.health + PLAYER.regenRate * dt);
    }
    return state.speed;
  }

  function hurt(amount, time) {
    state.health = Math.max(0, state.health - amount);
    state.lastHurtAt = time;
  }

  /** Swing at whatever is in front within punch range. Returns the victim. */
  function punch(findVictim) {
    if (state.punchCooldown > 0) return null;
    state.punchCooldown = PLAYER.punchCooldown;
    state.punchAnim = 1;
    const fx = state.x + Math.sin(state.heading) * 1.2;
    const fz = state.z + Math.cos(state.heading) * 1.2;
    return findVictim(fx, fz, PLAYER.punchRange);
  }

  return { state, reset, stepOnFoot, hurt, punch };
}
