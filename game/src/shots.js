// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot that drives the road grid, so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 8;
const END_SECONDS = 3;
const IDLE_DRIVER = { forward: 0, strafe: 0, run: false, actions: 0 };

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Drive `car` along `waypoints` ([x, z] pairs on roads) for one step. */
function autopilotDriver(car, waypoints, current) {
  const target = waypoints[current.index];
  if (!target) return { forward: 0, strafe: 0, run: false, actions: 0 };
  const dx = target[0] - car.x;
  const dz = target[1] - car.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 4) {
    current.index += 1;
    return autopilotDriver(car, waypoints, current);
  }
  const desired = Math.atan2(dx, dz);
  const turn = wrapAngle(desired - car.heading);
  const steer = Math.max(-1, Math.min(1, turn * 2));
  const last = current.index === waypoints.length - 1;
  const forward = last && dist < 14 ? 0.35 : 1;
  return { forward, strafe: steer, run: false, actions: 0 };
}

/**
 * Set the game `G` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw and whether the camera should orbit.
 * `stepWorld` and `updateCamera` are main.js's own functions, passed in so
 * this file stays free of the loop.
 */
export function stageShot(name, G, stepWorld, updateCamera) {
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(STEP, IDLE_DRIVER);
    return { screen: 'title', orbit: true };
  }

  if (name === 'play') {
    // A chase in progress: Raka driving the sedan up Coral Ave toward Mira's
    // garage, two stars of heat and police cars closing in behind him.
    G.missionsStarted = true;
    G.missions.startMission(0, G);
    const sedan = G.missions.state.sedan;
    const p = G.player.state;
    p.inCar = sedan;
    p.mesh.visible = false;
    sedan.stolen = true;
    G.police.setWanted(2);
    // Stepping once lets the mission see Raka in the sedan and point at the garage.
    stepWorld(STEP, IDLE_DRIVER);
    // Drive north up the avenue, then east along Palm Row to the garage. The
    // frame is taken just as the car arrives, still moving, mission complete.
    const waypoints = [[68, 124], [124, 124]];
    const current = { index: 0 };
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      stepWorld(STEP, autopilotDriver(sedan, waypoints, current));
      updateCamera(STEP, false);
    }
    return { screen: 'play', orbit: false };
  }

  // The end: every job done, Raka on foot at the marina plaza beside his car,
  // facing back toward the city skyline, the palms behind the camera.
  G.missionsStarted = true;
  G.missions.state.done = true;
  G.money = 2100;
  G.bestMoney = Math.max(G.bestMoney, 2100);
  G.player.reset(160, 168, Math.PI);
  G.vehicles.makeDrivableCar(150, 162, Math.PI / 2, 0x16a085, false);
  // Snap the camera behind the player now: the shot only paints two frames,
  // far too few for the follow yaw to swing around on its own.
  G.camYaw = Math.PI;
  G.orbitOffset = 0;
  // Look far past the player so the city skyline, not just the plaza, is in frame.
  G.camLookAhead = 50;
  G.missions.state.banner = 'SOLMAR LEGEND — All jobs done. The Bay is yours.';
  G.missions.state.bannerUntil = G.time + 8;
  G.police.setWanted(0);
  for (let i = 0; i < END_SECONDS / STEP; i += 1) stepWorld(STEP, IDLE_DRIVER);
  return { screen: 'play', orbit: false };
}
