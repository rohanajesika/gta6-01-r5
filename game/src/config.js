// Every tuning number and colour in one place for Solmar Bay, a sun-soaked
// open-world crime game. The city is a road grid: avenues run along z, streets
// along x, spaced PITCH apart, with building blocks between them.

export const STEP = 1 / 60;

export const CITY = {
  pitch: 64,
  roadHalf: 8,
  sidewalk: 4,
  blocks: 3,
  bound: 224,
};

export const PLAYER = {
  radius: 0.9,
  walkSpeed: 7,
  runSpeed: 11,
  accel: 60,
  health: 100,
  punchRange: 2.4,
  punchDamage: 34,
  punchCooldown: 0.45,
  regenDelay: 5,
  regenRate: 4,
};

export const CAR = {
  radius: 1.7,
  maxSpeed: 40,
  reverseMax: 12,
  accel: 26,
  brake: 42,
  steer: 1.9,
  grip: 6,
};

export const POLICE = {
  maxSpeed: 42,
  accel: 30,
  ramDamage: 6,
  ramCooldown: 1.2,
  bustSeconds: 3,
  bustRange: 5,
};

export const TRAFFIC = {
  count: 12,
  speed: 11,
  speedJitter: 4,
};

export const PEDS = {
  count: 16,
  walkSpeed: 2.2,
  fleeSpeed: 5.5,
};

export const WANTED = {
  max: 5,
  decayQuietSeconds: 25,
  decayStepSeconds: 15,
};

export const MISSIONS = [
  {
    id: 'keys',
    name: 'First Keys',
    brief: 'Mira needs wheels. Take the marked sedan and bring it to her garage.',
    reward: 300,
  },
  {
    id: 'package',
    name: 'Bay Package',
    brief: 'Pick up the package at the pier, then deliver it north while the heat is on.',
    reward: 600,
  },
  {
    id: 'boss',
    name: 'Shore Boss',
    brief: 'Three of Dario’s enforcers guard the marina. Put them down, then reach the safehouse.',
    reward: 1200,
  },
];

export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xa8d4ea,
  sun: 0xfff2d0,
  ground: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  building: [0xd8c9a8, 0xb8c4cc, 0xe0b48f, 0xa8b8a0, 0xc9a0a0, 0x8fa8c8, 0xd0d0d0, 0xe8dcc0],
  roof: 0x6b6f75,
  lamp: 0x2c2f33,
  palmTrunk: 0x7a5c38,
  palmLeaf: 0x3f8f4f,
  player: 0xffd23f,
  playerDark: 0x2b3a55,
  police: 0x1c4ed8,
  policeLight: 0xef4444,
  beacon: 0xffd23f,
  cash: 0x22c55e,
  enforcer: 0x7c2d12,
  text: '#f4f7fa',
  muted: '#c3ccd4',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (money, missions done, best) is kept between visits. */
export const SAVE_KEY = 'solmar-bay.save.v1';
