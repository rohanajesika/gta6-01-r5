// Cars: the player's drivable car and the traffic that fills the avenues.
// A car is a small group of boxes (body, cabin, wheels) on shared geometries.
// Traffic follows the road grid: each car drives along one avenue or street and
// sometimes turns at an intersection. Driving is simple arcade physics: speed
// along the heading, steering that bites harder the faster the car goes.

import * as THREE from 'three';
import { CAR, TRAFFIC, CITY } from './config.js';

const BODY_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xecf0f1, 0x1a1a1a, 0x16a085];

const bodyGeo = new THREE.BoxGeometry(2.2, 0.75, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.9, 0.65, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x223344 });

function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.2, -0.2);
  group.add(cabin);
  if (isPolice) {
    const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.5), barMat);
    bar.position.set(0, 1.62, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
  }
  const wheelPositions = [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]];
  for (const [wx, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  return group;
}

function placeOnRoad(rng, axis) {
  const lines = [];
  for (let k = -CITY.blocks; k <= CITY.blocks; k += 1) lines.push(k * CITY.pitch);
  const line = rng.pick(lines);
  const along = rng.range(-CITY.bound + 20, CITY.bound - 20);
  const lane = rng.chance(0.5) ? 4 : -4;
  if (axis === 'z') return { x: line + lane, z: along, heading: lane > 0 ? 0 : Math.PI };
  return { x: along, z: line + lane, heading: lane > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

export function createVehicles(scene, city, rng) {
  const traffic = [];
  const bodyMats = BODY_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c }));

  function makeTrafficCar() {
    const axis = rng.chance(0.5) ? 'z' : 'x';
    const spot = placeOnRoad(rng, axis);
    const mesh = buildCarMesh(rng.pick(BODY_COLORS), false);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
    scene.add(mesh);
    const car = {
      mesh,
      x: spot.x,
      z: spot.z,
      heading: spot.heading,
      speed: TRAFFIC.speed + rng.range(-TRAFFIC.speedJitter, TRAFFIC.speedJitter),
      axis,
      line: axis === 'z' ? spot.x : spot.z,
      traffic: true,
      active: true,
    };
    traffic.push(car);
    return car;
  }

  for (let i = 0; i < TRAFFIC.count; i += 1) makeTrafficCar();

  /** Steer a traffic car toward its next road point; returns its new position. */
  function updateTraffic(dt) {
    for (const car of traffic) {
      if (!car.active) continue;
      const step = car.speed * dt;
      let nx = car.x + Math.sin(car.heading) * step;
      let nz = car.z + Math.cos(car.heading) * step;
      // At an intersection, sometimes turn onto the crossing road.
      const lines = [];
      for (let k = -CITY.blocks; k <= CITY.blocks; k += 1) lines.push(k * CITY.pitch);
      const nearLine = lines.find((l) => Math.abs((car.axis === 'z' ? car.z : car.x) - l) < 1.2);
      if (nearLine !== undefined && rng.chance(0.02)) {
        const cross = rng.pick(lines);
        if (car.axis === 'z') {
          car.axis = 'x';
          car.line = nearLine;
          car.heading = cross > car.x ? Math.PI / 2 : -Math.PI / 2;
          nz = nearLine;
          nx = car.x + Math.sin(car.heading) * step;
        } else {
          car.axis = 'z';
          car.line = nearLine;
          car.heading = cross > car.z ? 0 : Math.PI;
          nx = nearLine;
          nz = car.z + Math.cos(car.heading) * step;
        }
      }
      // Turn around at the city edge instead of driving off the map.
      if (nx > CITY.bound - 8 || nx < -CITY.bound + 8 || nz > CITY.bound - 8 || nz < -CITY.bound + 8) {
        car.heading += Math.PI;
        nx = car.x;
        nz = car.z;
      }
      car.x = nx;
      car.z = nz;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }

  /** A drivable car placed at (x, z); the caller owns its lifetime. */
  function makeDrivableCar(x, z, heading, color, isPolice) {
    const mesh = buildCarMesh(color, isPolice);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    return {
      mesh, x, z, heading, speed: 0, traffic: false, active: true,
      lightbar: isPolice ? mesh.getObjectByName('lightbar') : null,
    };
  }

  /** Arcade driving: throttle -1..1, steer -1..1; buildings push the car out. */
  function driveCar(car, throttle, steer, dt) {
    const target = throttle > 0 ? CAR.maxSpeed : throttle < 0 ? -CAR.reverseMax : 0;
    const accel = throttle !== 0 ? CAR.accel : CAR.brake;
    const diff = target * Math.abs(throttle) - car.speed;
    const change = Math.max(-accel * dt, Math.min(accel * dt, diff));
    car.speed += change;
    if (throttle === 0 && Math.abs(car.speed) < 0.4) car.speed = 0;
    const steerAmount = steer * CAR.steer * Math.min(1, Math.abs(car.speed) / 10) * (car.speed >= 0 ? 1 : -1);
    car.heading += steerAmount * dt * (car.speed >= 0 ? 1 : -1) * 0.9;
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // Two-circle collision: front and rear axle points against buildings.
    const fx = nx + Math.sin(car.heading) * 1.5;
    const fz = nz + Math.cos(car.heading) * 1.5;
    const rx = nx - Math.sin(car.heading) * 1.5;
    const rz = nz - Math.cos(car.heading) * 1.5;
    const front = { x: fx, z: fz };
    const rear = { x: rx, z: rz };
    city.collideCircle(front, CAR.radius);
    city.collideCircle(rear, CAR.radius);
    car.x = (front.x + rear.x) / 2;
    car.z = (front.z + rear.z) / 2;
    const newHeading = Math.atan2(front.x - rear.x, front.z - rear.z);
    if (Number.isFinite(newHeading)) car.heading = newHeading;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }

  /** Simple circle push between two cars; returns true when they touched. */
  function carsTouch(a, b, minDist) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minDist * minDist || d2 < 0.0001) return false;
    const d = Math.sqrt(d2);
    const push = (minDist - d) / 2;
    const ux = dx / d;
    const uz = dz / d;
    a.x += ux * push;
    a.z += uz * push;
    b.x -= ux * push;
    b.z -= uz * push;
    return true;
  }

  return {
    traffic,
    updateTraffic,
    makeDrivableCar,
    driveCar,
    carsTouch,
    bodyMats,
  };
}
