/* =====================================================================
   render.js — pixel-art rendering: tiles, sprites, fog, minimap, floaters
   ===================================================================== */

"use strict";

const Render = (() => {
  const screen = document.getElementById("screen");
  const sctx = screen.getContext("2d");
  sctx.imageSmoothingEnabled = false;

  const minimap = document.getElementById("minimap");
  const mmctx = minimap.getContext("2d");
  mmctx.imageSmoothingEnabled = false;

  // ---- tile atlas ----------------------------------------------------
  const tileCache = {}; // key -> canvas

  function newTileCanvas() {
    const c = document.createElement("canvas");
    c.width = TILE; c.height = TILE;
    return c;
  }

  function speckle(ctx, base, speck, dark, seedA, density = 0.13) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, TILE, TILE);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const r = hash2(x + seedA * 31, y + seedA * 57);
        if (r < density) { ctx.fillStyle = speck; ctx.fillRect(x, y, 1, 1); }
        else if (r > 1 - density * 0.6) { ctx.fillStyle = dark; ctx.fillRect(x, y, 1, 1); }
      }
  }

  function bakeTiles() {
    let c, ctx;

    // grass A / B
    for (const [key, base] of [["grass0", PAL.grassA], ["grass1", PAL.grassB]]) {
      c = newTileCanvas(); ctx = c.getContext("2d");
      speckle(ctx, base, PAL.grassSpeck, PAL.grassDark, key === "grass0" ? 1 : 2);
      tileCache[key] = c;
    }

    // tree: grass base + canopy + trunk
    c = newTileCanvas(); ctx = c.getContext("2d");
    ctx.drawImage(tileCache.grass0, 0, 0);
    ctx.fillStyle = PAL.treeTrunk; ctx.fillRect(7, 11, 2, 4);
    ctx.fillStyle = PAL.treeA;
    ctx.beginPath();
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < TILE; x++) {
        const d = Math.hypot(x - 7.5, y - 6);
        if (d < 6.4) { ctx.fillStyle = hash2(x, y) > 0.72 ? PAL.treeB : PAL.treeA; ctx.fillRect(x, y, 1, 1); }
      }
    tileCache.tree = c;

    // water: 2 animation frames
    for (let f = 0; f < 2; f++) {
      c = newTileCanvas(); ctx = c.getContext("2d");
      speckle(ctx, PAL.waterA, PAL.waterB, PAL.waterA, 5 + f, 0.22);
      for (let i = 0; i < 4; i++) {
        const gx = Math.floor(hash2(i * 7 + f * 3, i * 13) * 13) + 1;
        const gy = Math.floor(hash2(i * 11, i * 5 + f * 9) * 13) + 1;
        ctx.fillStyle = PAL.waterGlint;
        ctx.fillRect(gx, gy, 2, 1);
      }
      tileCache["water" + f] = c;
    }

    // road
    c = newTileCanvas(); ctx = c.getContext("2d");
    speckle(ctx, PAL.road, PAL.roadCrack, PAL.roadCrack, 8, 0.10);
    tileCache.road = c;

    // wall (brick)
    c = newTileCanvas(); ctx = c.getContext("2d");
    ctx.fillStyle = PAL.wall; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = PAL.wallDark;
    for (let y = 0; y < TILE; y += 4) {
      ctx.fillRect(0, y + 3, TILE, 1);
      const off = (y / 4) % 2 === 0 ? 3 : 8;
      for (let x = off; x < TILE; x += 8) ctx.fillRect(x, y, 1, 3);
    }
    ctx.fillStyle = PAL.wallLight;
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(hash2(i, 3) * 15), y = Math.floor(hash2(5, i) * 15);
      ctx.fillRect(x, y, 1, 1);
    }
    tileCache.wall = c;

    // floor (planks)
    c = newTileCanvas(); ctx = c.getContext("2d");
    ctx.fillStyle = PAL.floor; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = PAL.floorDark;
    for (let y = 3; y < TILE; y += 4) ctx.fillRect(0, y, TILE, 1);
    for (let i = 0; i < 5; i++)
      ctx.fillRect(Math.floor(hash2(i, 9) * 15), Math.floor(hash2(9, i) * 3) * 4, 1, 3);
    tileCache.floor = c;

    // door
    c = newTileCanvas(); ctx = c.getContext("2d");
    ctx.drawImage(tileCache.floor, 0, 0);
    ctx.fillStyle = PAL.door; ctx.fillRect(2, 1, 12, 14);
    ctx.fillStyle = PAL.floorDark; ctx.fillRect(3, 2, 10, 12);
    ctx.fillStyle = PAL.crop; ctx.fillRect(11, 8, 2, 2); // handle
    tileCache.door = c;

    // crop rows
    c = newTileCanvas(); ctx = c.getContext("2d");
    ctx.fillStyle = "#5c4423"; ctx.fillRect(0, 0, TILE, TILE);
    for (let y = 1; y < TILE; y += 4) {
      ctx.fillStyle = PAL.cropDark; ctx.fillRect(0, y, TILE, 2);
      ctx.fillStyle = PAL.crop;
      for (let x = 1; x < TILE; x += 3) ctx.fillRect(x, y, 1, 2);
    }
    tileCache.crop = c;

    // rubble
    c = newTileCanvas(); ctx = c.getContext("2d");
    ctx.drawImage(tileCache.road, 0, 0);
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(hash2(i * 3, 17) * 13), y = Math.floor(hash2(17, i * 5) * 13);
      ctx.fillStyle = i % 2 ? PAL.rubble : PAL.rubbleDark;
      ctx.fillRect(x, y, 2 + (i % 2), 2);
    }
    tileCache.rubble = c;
  }

  function tileCanvasFor(t, animFrame) {
    switch (t) {
      case T.GRASS: return tileCache.grass0;
      case T.GRASS2: return tileCache.grass1;
      case T.TREE: return tileCache.tree;
      case T.WATER: return tileCache["water" + animFrame];
      case T.ROAD: return tileCache.road;
      case T.WALL: return tileCache.wall;
      case T.FLOOR: return tileCache.floor;
      case T.DOOR: return tileCache.door;
      case T.CROP: return tileCache.crop;
      case T.RUBBLE: return tileCache.rubble;
    }
    return tileCache.grass0;
  }

  // ---- sprite baking ---------------------------------------------------
  const spriteCache = new Map(); // key -> canvas

  function bakeSprite(map, colors) {
    const c = newTileCanvas();
    const ctx = c.getContext("2d");
    for (let y = 0; y < 16; y++) {
      const row = map[y];
      for (let x = 0; x < 16; x++) {
        const ch = row[x];
        if (ch === ".") continue;
        const col = colors[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  function civColors(id) {
    return {
      H: HAIRS[id % HAIRS.length],
      S: [PAL.skin1, PAL.skin2, PAL.skin3][id % 3],
      E: PAL.black,
      T: SHIRTS[id % SHIRTS.length],
      P: PANTS[id % PANTS.length],
      K: "#1c1c1c",
      B: "#c62f22",
      M: "#2a2a2a",
    };
  }

  function getSprite(kind, id, frame) {
    const key = kind + ":" + (id % 30) + ":" + frame;
    if (spriteCache.has(key)) return spriteCache.get(key);
    let canvas;
    if (kind === "leader") {
      canvas = bakeSprite(frame ? SPR_LEADER_1 : SPR_LEADER_0, civColors(id));
    } else if (kind === "civ") {
      canvas = bakeSprite(frame ? SPR_HUMAN_1 : SPR_HUMAN_0, civColors(id));
    } else if (kind === "bandit") {
      canvas = bakeSprite(frame ? SPR_BANDIT_1 : SPR_BANDIT_0, civColors(id));
    } else if (kind === "zombie") {
      canvas = bakeSprite(frame ? SPR_ZOMBIE_1 : SPR_ZOMBIE_0, {
        H: "#3a4a2a", Z: id % 2 ? PAL.zskin : PAL.zskinDark, R: "#ff3a2a",
        T: id % 2 ? "#4a4a3a" : "#5a4a5a", P: "#3a3a3a", K: "#1c1c1c",
      });
    } else if (kind === "corpse") {
      canvas = bakeSprite(SPR_CORPSE, {
        r: "#6e1c12", S: PAL.skin2, E: PAL.black,
        T: "#4a4a3a", P: "#3a3a3a", K: "#1c1c1c",
      });
    } else if (kind === "crate") {
      canvas = bakeSprite(SPR_CRATE, { a: LOOT_PAL.a, b: LOOT_PAL.b, c: LOOT_PAL.c });
    } else if (kind === "medkit") {
      canvas = bakeSprite(SPR_MEDKIT, { w: LOOT_PAL.w, r: LOOT_PAL.r, "~": LOOT_PAL["~"] });
    } else if (kind === "serum") {
      canvas = bakeSprite(SPR_SERUM, { g: "#556677", c: "#8fd8e8", "*": "#39e8c8" });
    }
    spriteCache.set(key, canvas);
    return canvas;
  }

  // ---- pixel font ------------------------------------------------------
  function drawPixelText(ctx, text, px, py, color, scale = 1) {
    ctx.fillStyle = color;
    let cx = px;
    for (const chRaw of String(text).toUpperCase()) {
      const bits = FONT3X5[chRaw];
      if (bits) {
        for (let i = 0; i < 15; i++) {
          if (bits[i] === "1") {
            const gx = i % 3, gy = Math.floor(i / 3);
            ctx.fillRect(cx + gx * scale, py + gy * scale, scale, scale);
          }
        }
      }
      cx += 4 * scale;
    }
  }
  function pixelTextWidth(text, scale = 1) { return String(text).length * 4 * scale - scale; }

  // ---- floaters (damage numbers etc.) -----------------------------------
  const floaters = [];
  function addFloater(wx, wy, text, color) {
    floaters.push({ wx, wy, text, color, born: performance.now() });
  }

  // ---- night tint --------------------------------------------------------
  function nightAlpha(hour) {
    if (hour >= 22 || hour < 5) return 0.55;
    if (hour === 21 || hour === 5) return 0.38;
    if (hour === 20 || hour === 6) return 0.18;
    return 0;
  }

  // ---- main frame ----------------------------------------------------------
  function drawFrame(state, now) {
    const { world, party, fog } = state;
    const animFrame = Math.floor(now / 400) % 2;

    // camera centered on party, clamped
    let camX = party.x - Math.floor(VIEW_W / 2);
    let camY = party.y - Math.floor(VIEW_H / 2);
    camX = Math.max(0, Math.min(world.w - VIEW_W, camX));
    camY = Math.max(0, Math.min(world.h - VIEW_H, camY));
    state.camX = camX; state.camY = camY;

    sctx.fillStyle = PAL.black;
    sctx.fillRect(0, 0, screen.width, screen.height);

    // tiles
    for (let vy = 0; vy < VIEW_H; vy++) {
      for (let vx = 0; vx < VIEW_W; vx++) {
        const wx = camX + vx, wy = camY + vy;
        const f = fog[wy * world.w + wx];
        if (f === 0) continue; // unseen: leave black
        sctx.drawImage(tileCanvasFor(tileAt(world, wx, wy), animFrame), vx * TILE, vy * TILE);
        if (f === 1) { // explored but not currently visible
          sctx.fillStyle = "rgba(5,5,15,0.62)";
          sctx.fillRect(vx * TILE, vy * TILE, TILE, TILE);
        }
      }
    }

    const inView = (x, y) =>
      x >= camX && x < camX + VIEW_W && y >= camY && y < camY + VIEW_H &&
      fog[y * world.w + x] === 2;
    const px = (x) => (x - camX) * TILE;
    const py = (y) => (y - camY) * TILE;

    // fallen party members, waiting to rise (drawn beneath the living)
    for (const r of state.rising) {
      if (!inView(r.x, r.y)) continue;
      // in its final hour the body twitches...
      const twitch = (r.at - state.tick <= 1) ? animFrame : 0;
      sctx.drawImage(getSprite("corpse", 0, 0), px(r.x) + twitch, py(r.y));
    }

    // loot
    for (const l of state.loot) {
      if (!inView(l.x, l.y)) continue;
      const kind = l.kind === "food" ? "crate" : l.kind;
      sctx.drawImage(getSprite(kind, 0, 0), px(l.x), py(l.y));
    }

    // NPC survivors
    for (const n of state.npcs) {
      if (!inView(n.x, n.y)) continue;
      const kind = (n.hostileRevealed) ? "bandit" : "civ";
      const bob = (n.id + animFrame) % 2;
      sctx.drawImage(getSprite(kind, n.id, bob), px(n.x), py(n.y) - (bob ? 1 : 0));
      if (n.infected && animFrame) {
        sctx.fillStyle = "#ff3a2a";
        sctx.fillRect(px(n.x) + 7, py(n.y) - 4, 2, 2);
      }
    }

    // zombies
    for (const z of state.zombies) {
      if (!inView(z.x, z.y)) continue;
      const bob = (z.id + animFrame) % 2;
      sctx.drawImage(getSprite("zombie", z.id, bob), px(z.x), py(z.y) - (bob ? 1 : 0));
      if (z.hp < z.maxhp) {
        sctx.fillStyle = "#000";
        sctx.fillRect(px(z.x) + 3, py(z.y) - 3, 10, 2);
        sctx.fillStyle = PAL.blood;
        sctx.fillRect(px(z.x) + 3, py(z.y) - 3, Math.max(1, Math.round(10 * z.hp / z.maxhp)), 2);
      }
    }

    // party followers along the movement trail
    const followers = party.members.slice(1);
    for (let i = followers.length - 1; i >= 0; i--) {
      const pos = state.trail[i + 1] || state.trail[state.trail.length - 1];
      if (!pos) continue;
      if (pos.x < camX || pos.x >= camX + VIEW_W || pos.y < camY || pos.y >= camY + VIEW_H) continue;
      const m = followers[i];
      const bob = (m.id + animFrame) % 2;
      sctx.drawImage(getSprite("civ", m.id, bob), px(pos.x), py(pos.y) - (bob ? 1 : 0));
      if (m.infected && animFrame) {
        sctx.fillStyle = "#ff3a2a";
        sctx.fillRect(px(pos.x) + 7, py(pos.y) - 4, 2, 2);
      }
    }

    // leader
    {
      const bob = animFrame;
      sctx.drawImage(getSprite("leader", 0, bob), px(party.x), py(party.y) - (bob ? 1 : 0));
    }

    // night tint
    const na = nightAlpha(state.hour);
    if (na > 0) {
      sctx.fillStyle = `rgba(10,12,45,${na})`;
      sctx.fillRect(0, 0, screen.width, screen.height);
    }

    // floaters
    const FLOAT_MS = 950;
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      const age = now - f.born;
      if (age > FLOAT_MS) { floaters.splice(i, 1); continue; }
      const fx = (f.wx - camX) * TILE + TILE / 2 - pixelTextWidth(f.text) / 2;
      const fy = (f.wy - camY) * TILE - 4 - Math.round(age / 70);
      if (fx < -40 || fx > screen.width + 40) continue;
      drawPixelText(sctx, f.text, Math.round(fx) + 1, fy + 1, "rgba(0,0,0,0.7)");
      drawPixelText(sctx, f.text, Math.round(fx), fy, f.color);
    }
  }

  // ---- minimap -----------------------------------------------------------
  const MM_COLORS = {
    [T.GRASS]: "#2e5c28", [T.GRASS2]: "#2e5c28", [T.TREE]: "#1c421e",
    [T.WATER]: "#1d4f8f", [T.ROAD]: "#55555c", [T.WALL]: "#8a4a35",
    [T.FLOOR]: "#8a6b42", [T.DOOR]: "#8a6b42", [T.CROP]: "#a08a30", [T.RUBBLE]: "#55555c",
  };

  function drawMinimap(state) {
    const { world, fog, party } = state;
    mmctx.fillStyle = "#05050c";
    mmctx.fillRect(0, 0, world.w, world.h);
    for (let y = 0; y < world.h; y++)
      for (let x = 0; x < world.w; x++) {
        const f = fog[y * world.w + x];
        if (f === 0) continue;
        mmctx.fillStyle = MM_COLORS[tileAt(world, x, y)];
        mmctx.fillRect(x, y, 1, 1);
        if (f === 1) {
          mmctx.fillStyle = "rgba(5,5,12,0.55)";
          mmctx.fillRect(x, y, 1, 1);
        }
      }
    // visible zombies / npcs / loot pips
    for (const z of state.zombies)
      if (fog[z.y * world.w + z.x] === 2) { mmctx.fillStyle = "#9adb6b"; mmctx.fillRect(z.x, z.y, 1, 1); }
    for (const n of state.npcs)
      if (fog[n.y * world.w + n.x] === 2) { mmctx.fillStyle = "#6bb8ff"; mmctx.fillRect(n.x, n.y, 1, 1); }
    for (const l of state.loot)
      if (fog[l.y * world.w + l.x] === 2) { mmctx.fillStyle = "#ffd24e"; mmctx.fillRect(l.x, l.y, 1, 1); }
    for (const r of state.rising)
      if (fog[r.y * world.w + r.x] === 2) { mmctx.fillStyle = "#8a3020"; mmctx.fillRect(r.x, r.y, 1, 1); }
    // party
    mmctx.fillStyle = "#ff3a2a";
    mmctx.fillRect(party.x - 1, party.y - 1, 3, 3);
  }

  // portrait for the encounter dialog
  function drawPortrait(canvasEl, kind, id) {
    const ctx = canvasEl.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(getSprite(kind, id, 0), 0, 0);
  }

  bakeTiles();

  return { drawFrame, drawMinimap, addFloater, drawPortrait };
})();
