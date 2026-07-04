/* =====================================================================
   world.js — procedural tile map: roads, buildings, farms, forests, lakes
   ===================================================================== */

"use strict";

function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return T.WATER;
  return world.tiles[y * world.w + x];
}
function setTile(world, x, y, t) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return;
  world.tiles[y * world.w + x] = t;
}
function isPassableAt(world, x, y) {
  return x >= 0 && y >= 0 && x < world.w && y < world.h && PASSABLE.has(tileAt(world, x, y));
}

function genWorld(rng) {
  const w = WORLD_W, h = WORLD_H;
  const tiles = new Uint8Array(w * h);
  const world = { w, h, tiles, buildingFloors: [], cropCells: [], roadCells: [] };

  // Base grass with two variants
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      tiles[y * w + x] = hash2(x, y) > 0.5 ? T.GRASS : T.GRASS2;

  // Lakes: random-walk blobs
  for (let l = 0; l < 5; l++) {
    let x = randInt(rng, 8, w - 8), y = randInt(rng, 8, h - 8);
    for (let i = 0; i < randInt(rng, 60, 140); i++) {
      for (let dy = 0; dy <= 1; dy++)
        for (let dx = 0; dx <= 1; dx++)
          setTile(world, x + dx, y + dy, T.WATER);
      x += randInt(rng, -1, 1); y += randInt(rng, -1, 1);
      x = Math.max(2, Math.min(w - 3, x)); y = Math.max(2, Math.min(h - 3, y));
    }
  }

  // Forests: clustered trees
  for (let f = 0; f < 10; f++) {
    const cx = randInt(rng, 6, w - 6), cy = randInt(rng, 6, h - 6);
    const r = randInt(rng, 4, 9);
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r && rng() > d / r * 0.85 && tileAt(world, x, y) <= T.GRASS2)
          setTile(world, x, y, T.TREE);
      }
  }

  // Roads: two horizontal + two vertical strips, 2 tiles wide
  const roadRows = [randInt(rng, 20, 40), randInt(rng, 58, 78)];
  const roadCols = [randInt(rng, 20, 40), randInt(rng, 58, 78)];
  for (const ry of roadRows)
    for (let x = 0; x < w; x++)
      for (let d = 0; d < 2; d++) setTile(world, x, ry + d, T.ROAD);
  for (const rx of roadCols)
    for (let y = 0; y < h; y++)
      for (let d = 0; d < 2; d++) setTile(world, rx + d, y, T.ROAD);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (tiles[y * w + x] === T.ROAD) {
        world.roadCells.push({ x, y });
        if (hash2(x * 3, y * 7) > 0.93) tiles[y * w + x] = T.RUBBLE;
      }
    }

  // Buildings near roads
  const placed = [];
  let attempts = 0;
  while (placed.length < 26 && attempts++ < 600) {
    const road = pick(rng, world.roadCells);
    const bw = randInt(rng, 5, 9), bh = randInt(rng, 4, 7);
    const side = randInt(rng, 0, 3);
    let bx, by;
    if (side === 0) { bx = road.x - Math.floor(bw / 2); by = road.y - bh - 1; }
    else if (side === 1) { bx = road.x - Math.floor(bw / 2); by = road.y + 2; }
    else if (side === 2) { bx = road.x - bw - 1; by = road.y - Math.floor(bh / 2); }
    else { bx = road.x + 2; by = road.y - Math.floor(bh / 2); }
    if (bx < 2 || by < 2 || bx + bw >= w - 2 || by + bh >= h - 2) continue;

    // check space (allow grass/tree only, no overlap with roads/water/other buildings)
    let ok = true;
    for (let y = by - 1; y <= by + bh && ok; y++)
      for (let x = bx - 1; x <= bx + bw && ok; x++) {
        const t = tileAt(world, x, y);
        if (t !== T.GRASS && t !== T.GRASS2 && t !== T.TREE) ok = false;
      }
    if (!ok) continue;

    // walls + floor
    const floors = [];
    for (let y = by; y < by + bh; y++)
      for (let x = bx; x < bx + bw; x++) {
        const isEdge = (x === bx || y === by || x === bx + bw - 1 || y === by + bh - 1);
        setTile(world, x, y, isEdge ? T.WALL : T.FLOOR);
        if (!isEdge) floors.push({ x, y });
      }
    // door on the road-facing side
    let dx, dy;
    if (side === 0) { dx = bx + Math.floor(bw / 2); dy = by + bh - 1; }
    else if (side === 1) { dx = bx + Math.floor(bw / 2); dy = by; }
    else if (side === 2) { dx = bx + bw - 1; dy = by + Math.floor(bh / 2); }
    else { dx = bx; dy = by + Math.floor(bh / 2); }
    setTile(world, dx, dy, T.DOOR);

    placed.push({ bx, by, bw, bh });
    world.buildingFloors.push(...floors);
  }

  // Farms: crop patches on open grass
  for (let f = 0; f < 8; f++) {
    const cx = randInt(rng, 6, w - 12), cy = randInt(rng, 6, h - 12);
    const fw = randInt(rng, 4, 7), fh = randInt(rng, 4, 6);
    let ok = true;
    for (let y = cy; y < cy + fh && ok; y++)
      for (let x = cx; x < cx + fw && ok; x++) {
        const t = tileAt(world, x, y);
        if (t !== T.GRASS && t !== T.GRASS2) ok = false;
      }
    if (!ok) continue;
    for (let y = cy; y < cy + fh; y++)
      for (let x = cx; x < cx + fw; x++) {
        setTile(world, x, y, T.CROP);
        world.cropCells.push({ x, y });
      }
  }

  // Player start: center of map, force a clear pocket of grass
  const sx = Math.floor(w / 2), sy = Math.floor(h / 2);
  for (let y = sy - 2; y <= sy + 2; y++)
    for (let x = sx - 2; x <= sx + 2; x++)
      if (!PASSABLE.has(tileAt(world, x, y)) || tileAt(world, x, y) === T.WALL)
        setTile(world, x, y, T.GRASS);
  world.startX = sx;
  world.startY = sy;

  return world;
}

// Find a random passable tile, optionally at some distance from a point
function randomOpenTile(world, rng, opts = {}) {
  for (let i = 0; i < 400; i++) {
    const x = randInt(rng, 1, world.w - 2);
    const y = randInt(rng, 1, world.h - 2);
    if (!isPassableAt(world, x, y)) continue;
    if (opts.minDist && chebyshev(x, y, opts.fromX, opts.fromY) < opts.minDist) continue;
    if (opts.maxDist && chebyshev(x, y, opts.fromX, opts.fromY) > opts.maxDist) continue;
    return { x, y };
  }
  return { x: world.startX, y: world.startY };
}
