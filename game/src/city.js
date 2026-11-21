// The city of Solmar Bay: a road grid of avenues (along z) and streets (along x),
// building blocks between them, sidewalks, lamps, palms and a pier plaza at the
// north edge. Everything is plain coloured geometry, no textures and no files.
// The module also owns the collision shapes (building footprints) the rest of
// the game pushes circles out of.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

const { pitch, roadHalf, sidewalk, blocks, bound } = CITY;

/** The centre lines of the avenues and streets, from -blocks to +blocks. */
export function roadLines() {
  const lines = [];
  for (let k = -blocks; k <= blocks; k += 1) lines.push(k * pitch);
  return lines;
}

function nearestLine(value) {
  let best = roadLines()[0];
  for (const line of roadLines()) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

function material(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export function createCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const buildings = [];
  const lamps = [];

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(bound * 2 + 80, bound * 2 + 80),
    material(PALETTE.ground),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // Sidewalk slabs: one per block, slightly raised, with a road-coloured gap
  // between neighbours that reads as the street itself.
  const slabGeo = new THREE.BoxGeometry(pitch - roadHalf * 2, 0.3, pitch - roadHalf * 2);
  const slabMat = material(PALETTE.sidewalk);
  const slabMeshes = [];
  for (let bx = -blocks; bx < blocks; bx += 1) {
    for (let bz = -blocks; bz < blocks; bz += 1) {
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set((bx + 0.5) * pitch, 0.1, (bz + 0.5) * pitch);
      group.add(slab);
      slabMeshes.push(slab);
    }
  }

  // Buildings: one to three boxes per block, varied heights and colours, with a
  // darker roof cap and a row of lit windows on the tallest face.
  const paletteMats = PALETTE.building.map((c) => material(c));
  const roofMat = material(PALETTE.roof);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -blocks; bx < blocks; bx += 1) {
    for (let bz = -blocks; bz < blocks; bz += 1) {
      // Keep the marina plaza (north-east corner block) open for missions.
      if (bx === blocks - 1 && bz === blocks - 1) continue;
      const x0 = bx * pitch + roadHalf + sidewalk + 2;
      const z0 = bz * pitch + roadHalf + sidewalk + 2;
      const x1 = (bx + 1) * pitch - roadHalf - sidewalk - 2;
      const z1 = (bz + 1) * pitch - roadHalf - sidewalk - 2;
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(10, (x1 - x0) / count - 2);
        const d = rng.range(10, (z1 - z0) - 4);
        const h = rng.range(9, 42);
        const cx = x0 + ((x1 - x0) / count) * (i + 0.5) + rng.range(-2, 2);
        const cz = (z0 + z1) / 2 + rng.range(-4, 4);
        const mesh = new THREE.Mesh(boxGeo, rng.pick(paletteMats));
        mesh.scale.set(w, h, d);
        mesh.position.set(cx, h / 2 + 0.2, cz);
        group.add(mesh);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(cx, h + 0.6, cz);
        group.add(roof);
        // Lit windows: a thin bright strip on the south face, every few floors.
        const floors = Math.max(1, Math.floor(h / 6));
        for (let f = 0; f < floors; f += 1) {
          const win = new THREE.Mesh(boxGeo, windowMat);
          win.scale.set(w * 0.7, 0.9, 0.2);
          win.position.set(cx, 3 + f * 6, cz + d / 2 + 0.1);
          group.add(win);
        }
        buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      }
    }
  }

  // Street lamps along every avenue, alternating sides, and palms along the
  // pier plaza edge.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  const poleMat = material(PALETTE.lamp);
  const headGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const line of roadLines()) {
    for (let k = -blocks; k < blocks; k += 1) {
      const z = (k + 0.5) * pitch;
      const side = ((k + blocks) % 2 === 0 ? 1 : -1) * (roadHalf + 1.2);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(line + side, 3.5, z);
      group.add(pole);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(line + side, 7.1, z);
      group.add(head);
      lamps.push({ x: line + side, z });
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
  const trunkMat = material(PALETTE.palmTrunk);
  const leafGeo = new THREE.ConeGeometry(2.2, 3.2, 6);
  const leafMat = material(PALETTE.palmLeaf);
  for (let i = 0; i < 8; i += 1) {
    const x = (blocks - 1) * pitch + 12 + i * 7;
    const z = (blocks - 1) * pitch + 12;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3, z);
    group.add(trunk);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(x, 7.4, z);
    group.add(leaf);
  }

  // Road centre dashes: one instanced mesh for the whole grid.
  const dashGeo = new THREE.BoxGeometry(0.6, 0.06, 4);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d90a });
  const dashCount = roadLines().length * 24;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const dummy = new THREE.Object3D();
  let di = 0;
  for (const line of roadLines()) {
    for (let k = 0; k < 12; k += 1) {
      const t = -bound + 18 + k * 36;
      dummy.position.set(line, 0.05, t);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dashes.setMatrixAt(di, dummy.matrix);
      di += 1;
      dummy.position.set(t, 0.05, line);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      dashes.setMatrixAt(di, dummy.matrix);
      di += 1;
    }
  }
  dashes.count = di;
  group.add(dashes);

  // The pier plaza: a pale open square in the north-east corner block.
  const plaza = new THREE.Mesh(
    new THREE.BoxGeometry(pitch - roadHalf * 2, 0.4, pitch - roadHalf * 2),
    material(0xd9c9a3),
  );
  plaza.position.set((blocks - 0.5) * pitch, 0.15, (blocks - 0.5) * pitch);
  group.add(plaza);

  return {
    group,
    buildings,
    lamps,
    plazaCentre: { x: (blocks - 0.5) * pitch, z: (blocks - 0.5) * pitch },
    bound,
    /** Push a circle (x, z, radius) out of every building it overlaps. */
    collideCircle(pos, radius) {
      for (const b of buildings) {
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          pos.x = b.maxX + radius;
        }
      }
      pos.x = Math.max(-bound, Math.min(bound, pos.x));
      pos.z = Math.max(-bound, Math.min(bound, pos.z));
    },
    /** True when (x, z) is on a road (not inside a block). */
    onRoad(x, z) {
      const fx = Math.abs(x - nearestLine(x));
      const fz = Math.abs(z - nearestLine(z));
      return fx <= roadHalf + sidewalk || fz <= roadHalf + sidewalk;
    },
    nearestLine,
    /** A point on the nearest road centre line to (x, z). */
    snapToRoad(x, z) {
      const lx = nearestLine(x);
      const lz = nearestLine(z);
      if (Math.abs(x - lx) <= Math.abs(z - lz)) return { x: lx, z };
      return { x, z: lz };
    },
  };
}
