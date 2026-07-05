/* =====================================================================
   main.js — game state, simulation ticks, input, and the main loop
   ===================================================================== */

"use strict";

let state = null;
let rng = Math.random;

// ---------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------

let difficulty = "normal";

function newGame() {
  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  rng = mulberry32(seed);
  NEXT_ID = 1;

  const world = genWorld(rng);
  const fog = new Uint8Array(world.w * world.h);
  const diff = DIFFICULTIES[difficulty];

  const leader = makeLeader(diff.leaderImmun);
  state = {
    seed, world, fog,
    difficulty, zombieMult: diff.zombieMult,
    tick: START_HOUR,
    hour: START_HOUR, day: 1, isNight: false,
    party: {
      x: world.startX, y: world.startY,
      members: [leader],
      food: 40, medkits: 1, serums: 0,
    },
    trail: [{ x: world.startX, y: world.startY }],
    zombies: [], npcs: [], loot: [], rising: [],
    stats: { zombieKills: 0, humanKills: 0, recruited: 0, lost: 0 },
    over: false,
  };

  // --- spawn zombies (scaled by difficulty) ---
  const zombieCount = Math.round(INITIAL_ZOMBIES * diff.zombieMult);
  for (let i = 0; i < zombieCount; i++) {
    const p = randomOpenTile(world, rng, { fromX: world.startX, fromY: world.startY, minDist: 7 });
    state.zombies.push(makeZombie(rng, p.x, p.y));
  }

  // --- spawn NPC survivors ---
  for (let i = 0; i < INITIAL_SURVIVORS; i++) {
    const p = randomOpenTile(world, rng, { fromX: world.startX, fromY: world.startY, minDist: 5 });
    const s = makeSurvivor(rng, { x: p.x, y: p.y });
    s.hostileRevealed = false;
    state.npcs.push(s);
  }

  // --- spawn serums first: buildings only, count scales with difficulty ---
  const floorPool = [...world.buildingFloors];
  for (let i = 0; i < diff.serums && floorPool.length > 0; i++) {
    const p = floorPool.splice(Math.floor(rng() * floorPool.length), 1)[0];
    state.loot.push({ x: p.x, y: p.y, kind: "serum", amt: 1 });
  }

  // --- spawn remaining loot: prefer building interiors and farms ---
  const lootSpots = [];
  for (const f of floorPool) if (rng() < 0.45) lootSpots.push(f);
  for (const c of world.cropCells) if (rng() < 0.20) lootSpots.push(c);
  const spot = () => {
    if (lootSpots.length && rng() < 0.65) {
      return lootSpots.splice(Math.floor(rng() * lootSpots.length), 1)[0];
    }
    return randomOpenTile(world, rng, { fromX: world.startX, fromY: world.startY, minDist: 4 });
  };
  for (let i = 0; i < INITIAL_FOOD_PILES; i++) {
    const p = spot();
    const r = rng();
    const amt = r > 0.95 ? randInt(rng, 30, 60) : r > 0.7 ? randInt(rng, 10, 20) : randInt(rng, 3, 8);
    state.loot.push({ x: p.x, y: p.y, kind: "food", amt });
  }
  for (let i = 0; i < INITIAL_MEDKITS; i++) {
    const p = spot();
    state.loot.push({ x: p.x, y: p.y, kind: "medkit", amt: 1 });
  }

  updateClock();
  updateFog();
  UI.clearLog();
  UI.setClockRef(state.day, state.hour);
  UI.log("You wake at dawn. The valley is quiet — too quiet.", "info");
  UI.log("Find food. Find people. Decide who to trust.", "info");
  refreshUI();
}

// ---------------------------------------------------------------------
// Fog of war
// ---------------------------------------------------------------------

function sightRadius() {
  const m = state.party.members;
  let r = state.isNight ? SIGHT_NIGHT : SIGHT_DAY;
  if (state.isNight && partyHasTrait(m, "NIGHT_OWL")) r = SIGHT_DAY;
  if (partyHasTrait(m, "SCOUT")) r += 2;
  return r;
}

function updateFog() {
  const { world, fog, party } = state;
  for (let i = 0; i < fog.length; i++) if (fog[i] === 2) fog[i] = 1;
  const r = sightRadius();
  for (let y = party.y - r; y <= party.y + r; y++) {
    if (y < 0 || y >= world.h) continue;
    for (let x = party.x - r; x <= party.x + r; x++) {
      if (x < 0 || x >= world.w) continue;
      if (Math.hypot(x - party.x, y - party.y) <= r + 0.5) fog[y * world.w + x] = 2;
    }
  }
}

// ---------------------------------------------------------------------
// Clock helpers
// ---------------------------------------------------------------------

function updateClock() {
  state.hour = state.tick % 24;
  state.day = Math.floor(state.tick / 24) + 1;
  state.isNight = state.hour >= NIGHT_FROM || state.hour < NIGHT_TO;
  UI.setClockRef(state.day, state.hour);
}

// ---------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------

function frontMember() { return state.party.members[0]; }

function foodCap() { return FOOD_CAP_BASE + state.party.members.length * FOOD_CAP_PER_MEMBER; }

function zombieAt(x, y) { return state.zombies.find(z => z.x === x && z.y === y); }
function npcAt(x, y) { return state.npcs.find(n => n.x === x && n.y === y); }
function lootAt(x, y) { return state.loot.find(l => l.x === x && l.y === y); }

function handleMove(dx, dy) {
  if (state.over || UI.isDialogOpen()) return;
  const nx = state.party.x + dx, ny = state.party.y + dy;

  const z = zombieAt(nx, ny);
  if (z) { attackZombie(z); advanceWorld(); return; }

  const n = npcAt(nx, ny);
  if (n) {
    if (n.hostileRevealed || n.trust <= 1) { engageHostile(n); advanceWorld(); return; }
    if (n.cooldown > 0) { UI.log(`${n.name} keeps their distance.`); return; }
    // A Brawler in the party may pick a fight with a perfectly decent stranger
    const brawler = state.party.members.find(m => hasTrait(m, "BRAWLER"));
    if (brawler && rng() < BRAWLER_PROVOKE_CHANCE) {
      UI.log(`${brawler.name}'s taunting provokes ${n.name} — weapons drawn!`, "bad");
      n.trust = Math.min(n.trust, 1); // no talking your way back from this
      engageHostile(n);
      advanceWorld();
      return;
    }
    openEncounter(n); // free action, world paused while dialog is open
    return;
  }

  if (!isPassableAt(state.world, nx, ny)) return; // bump wall: no time cost

  state.party.x = nx; state.party.y = ny;
  state.trail.unshift({ x: nx, y: ny });
  if (state.trail.length > PARTY_MAX + 2) state.trail.pop();

  const l = lootAt(nx, ny);
  if (l) collectLoot(l);

  advanceWorld();
}

function collectLoot(l) {
  const p = state.party;
  if (l.kind === "food") {
    let amt = l.amt;
    if (partyHasTrait(p.members, "LIGHT_FINGERS")) amt = Math.round(amt * 1.5);
    const cap = foodCap();
    const taken = Math.min(amt, Math.max(0, cap - p.food));
    if (taken <= 0) { UI.log("You can't carry any more food.", "warn"); return; }
    p.food += taken;
    l.amt -= Math.min(l.amt, taken);
    Render.addFloater(l.x, l.y, "+" + taken, "#ffd24e");
    UI.log(`Scavenged ${taken} food.`, "good");
    Sfx.pickup();
    if (l.amt <= 0) state.loot.splice(state.loot.indexOf(l), 1);
  } else if (l.kind === "medkit") {
    p.medkits++;
    state.loot.splice(state.loot.indexOf(l), 1);
    Render.addFloater(l.x, l.y, "+MEDKIT", "#ff5a4e");
    UI.log("Found a medkit!", "good");
    Sfx.medkit();
  } else if (l.kind === "serum") {
    p.serums++;
    state.loot.splice(state.loot.indexOf(l), 1);
    Render.addFloater(l.x, l.y, "+SERUM", "#39e8c8");
    UI.log("Found a vial of experimental serum — it can cure infection!", "purple");
    Sfx.cure();
  }
}

// ---------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------

// An enemy died: every member engaged in the fight earns 1 XP toward their
// next level. The member who landed the killing blow also gets kill credit.
function awardPartyXP(killer) {
  killer.kills++;
  let leveled = false;
  for (const m of state.party.members) {
    if (gainXP(m, 1)) {
      leveled = true;
      UI.log(`${m.name} reached level ${m.level}! Stats increased.`, "purple");
    }
  }
  if (leveled) {
    Render.addFloater(state.party.x, state.party.y, "LVL UP!", "#7cff6b");
    Sfx.levelUp();
  }
}

// The whole party piles onto one zombie: every member swings once per tick,
// in formation order, until it drops. The killing blow earns the kill.
function attackZombie(z) {
  for (const m of state.party.members) {
    if (z.hp <= 0) break;
    const dmg = memberDamage(m, rng);
    if (dmg === 0) {
      UI.log(`${m.name} flinches and misses!`, "warn");
      Render.addFloater(z.x, z.y, "MISS", "#8a92a0");
      continue;
    }
    z.hp -= dmg;
    Render.addFloater(z.x, z.y, "-" + dmg, "#f2f2e6");
    Sfx.hit();
    if (z.hp <= 0) {
      state.zombies.splice(state.zombies.indexOf(z), 1);
      state.stats.zombieKills++;
      Sfx.zombieDie();
      UI.log(`${m.name} destroys a zombie!`, "good");
      awardPartyXP(m);
    }
  }
}

function zombieStrikesParty(z) {
  const m = frontMember();
  if (!m) return;
  const dmg = zombieDamage(z, m, rng);
  m.hp -= dmg;
  Render.addFloater(state.party.x, state.party.y, "-" + dmg, "#ff5a4e");
  Sfx.hurt();
  if (m.hp <= 0) {
    killMember(m, "was torn apart by a zombie");
  } else if (rollInfection(m, rng)) {
    m.infected = true;
    m.infTimer = INFECTION_TICKS;
    UI.log(`☣ ${m.name} was bitten... and the wound looks bad.`, "bad");
    Sfx.infected();
  }
}

function engageHostile(n) {
  if (!n.hostileRevealed) {
    n.hostileRevealed = true;
    UI.log(`${n.name} pulls a weapon on you!`, "bad");
    if (partyHasTrait(state.party.members, "CHARMER") && !n.pacified && rng() < 0.5) {
      n.pacified = true;
      n.cooldown = 60;
      n.trust = Math.max(2, n.trust);
      n.hostileRevealed = false;
      UI.log("...but your Charmer talks them down. They back away.", "info");
      return;
    }
  }
  // The whole party attacks, once each per tick. No instant retaliation —
  // the hostile hits back on the world tick, like a zombie would.
  for (const m of state.party.members) {
    if (n.hp <= 0) break;
    const dmg = memberDamage(m, rng);
    if (dmg === 0) {
      Render.addFloater(n.x, n.y, "MISS", "#8a92a0");
      continue;
    }
    n.hp -= dmg;
    Render.addFloater(n.x, n.y, "-" + dmg, "#f2f2e6");
    Sfx.hit();
    if (n.hp <= 0) {
      state.npcs.splice(state.npcs.indexOf(n), 1);
      state.stats.humanKills++;
      UI.log(`${m.name} put down ${n.name}.`, "good");
      if (n.foodCarried > 0) {
        state.party.food = Math.min(state.party.food + n.foodCarried, foodCap());
        UI.log(`You take their ${n.foodCarried} food.`, "warn");
      }
      awardPartyXP(m);
    }
  }
}

function killMember(m, how) {
  const p = state.party;
  const idx = p.members.indexOf(m);
  if (idx >= 0) p.members.splice(idx, 1);
  state.stats.lost++;
  UI.log(`✝ ${m.name} ${how}.`, "bad");
  Sfx.memberDie();
  state.rising.push({ x: p.x, y: p.y, at: state.tick + RISE_TICKS, name: m.name });
  UI.log(`${m.name}'s body lies still... for now.`, "warn");
  checkGameOver();
}

// ---------------------------------------------------------------------
// Encounters (dialogs)
// ---------------------------------------------------------------------

function openEncounter(n) {
  const judged = partyHasTrait(state.party.members, "JUDGE");
  const full = state.party.members.length >= PARTY_MAX;

  // trust 2: might try to shake you down
  if (n.trust === 2 && !n.pacified && rng() < 0.5) {
    const demand = Math.max(5, Math.round(state.party.food * 0.25));
    UI.showEncounter({
      npc: n, kindShown: "civ", statsKnown: judged, tagline: n.tagline,
      text: `"Nothing personal. Hand over ${demand} food and nobody gets hurt."`,
      buttons: [
        {
          label: "Hand it over", onClick: () => {
            state.party.food = Math.max(0, state.party.food - demand);
            n.cooldown = 80;
            UI.log(`You gave up ${demand} food. ${n.name} melts away into the ruins.`, "warn");
            Sfx.steal();
            refreshUI();
          },
        },
        {
          label: "Refuse", cls: "bad", onClick: () => {
            UI.log(`You refuse. ${n.name} attacks!`, "bad");
            n.trust = 0;
            engageHostile(n);
            advanceWorld();
          },
        },
      ],
    });
    return;
  }

  // trustworthy enough to ask to join
  UI.showEncounter({
    npc: n, kindShown: "civ", statsKnown: judged, tagline: n.tagline,
    text: judged
      ? `"Mind if I tag along? Strength in numbers." (Your Judge of Character sizes them up: trust ${n.trust}/5.)`
      : `"Mind if I tag along? Strength in numbers." (You have no way to know if they can be trusted...)`,
    buttons: [
      {
        label: full ? "Party full" : "Recruit", cls: "good", disabled: full, onClick: () => {
          n.trustKnown = judged;
          state.npcs.splice(state.npcs.indexOf(n), 1);
          state.party.members.push(n);
          state.stats.recruited++;
          state.party.food = Math.min(state.party.food + n.foodCarried, foodCap());
          UI.log(`${n.name} joined the party (+${n.foodCarried} food they carried).`, "good");
          Sfx.recruit();
          refreshUI();
        },
      },
      {
        label: "Turn away", onClick: () => {
          n.cooldown = 60;
          UI.log(`${n.name} nods and walks on alone.`);
          Sfx.decline();
        },
      },
    ],
  });
}

function kickMember(m) {
  if (m.isLeader) return;
  const p = state.party;
  const idx = p.members.indexOf(m);
  if (idx < 0) return;
  p.members.splice(idx, 1);
  m.x = p.x; m.y = p.y;
  m.cooldown = 120;
  if (!m.infected) state.npcs.push(m); // the infected wander off to their fate
  UI.log(m.infected
    ? `You left ${m.name} behind. They didn't argue. They knew.`
    : `${m.name} was kicked from the party.`, m.infected ? "warn" : "");
  refreshUI();
}

// ---------------------------------------------------------------------
// Party care actions (free actions)
// ---------------------------------------------------------------------

function actionEat() {
  const p = state.party;
  if (p.food < 1) { UI.log("No food left!", "bad"); return; }
  let fed = 0;
  const hungry = [...p.members].sort((a, b) => (a.hp / a.maxhp) - (b.hp / b.maxhp));
  for (const m of hungry) {
    if (p.food < 1) break;
    if (m.hp <= m.maxhp - 15) {
      p.food--;
      m.hp = Math.min(m.maxhp, m.hp + 20);
      fed++;
    }
  }
  if (fed) { UI.log(`Shared a meal — ${fed} member${fed > 1 ? "s" : ""} recovered HP.`, "good"); Sfx.eat(); }
  else UI.log("Nobody is hungry enough to need it right now.");
  refreshUI();
}

function actionMedkit() {
  const p = state.party;
  if (p.medkits < 1) return;
  const target = [...p.members].sort((a, b) => (a.hp / a.maxhp) - (b.hp / b.maxhp))[0];
  if (!target || target.hp >= target.maxhp) { UI.log("Everyone is at full health."); return; }
  p.medkits--;
  target.hp = Math.min(target.maxhp, target.hp + 40);
  UI.log(`Used a medkit on ${target.name} (+40 HP).`, "good");
  Sfx.medkit();
  refreshUI();
}

function actionSerum() {
  const p = state.party;
  if (p.serums < 1) return;
  const infected = p.members.filter(m => m.infected).sort((a, b) => a.infTimer - b.infTimer)[0];
  if (!infected) { UI.log("Nobody is infected."); return; }
  p.serums--;
  infected.infected = false;
  infected.infTimer = 0;
  UI.log(`◉ The serum works — ${infected.name} is cured!`, "purple");
  Sfx.cure();
  refreshUI();
}

const SORTS = {
  str: { fn: (a, b) => b.str - a.str, msg: "Formation: strongest fight first." },
  hp: { fn: (a, b) => b.hp - a.hp, msg: "Formation: healthiest fight first." },
  imm: { fn: (a, b) => b.immun - a.immun, msg: "Formation: most immune fight first." },
  weak: { fn: (a, b) => (b.hp / b.maxhp) - (a.hp / a.maxhp), msg: "Formation: shielding the weakest." },
};
function actionSort(key) {
  state.party.members.sort(SORTS[key].fn);
  UI.log(SORTS[key].msg, "info");
  refreshUI();
}

// ---------------------------------------------------------------------
// World simulation (one tick = one hour)
// ---------------------------------------------------------------------

const ACTIVE_RADIUS = 26;

function advanceWorld() {
  if (state.over) return;
  state.tick++;
  updateClock();

  const { world, party } = state;

  // occupancy set for zombie/npc collision
  const occ = new Set();
  for (const z of state.zombies) occ.add(z.x + "," + z.y);
  for (const n of state.npcs) occ.add(n.x + "," + n.y);

  const tryStep = (e, dx, dy) => {
    const nx = e.x + dx, ny = e.y + dy;
    if (!isPassableAt(world, nx, ny)) return false;
    if (nx === party.x && ny === party.y) return false;
    const k = nx + "," + ny;
    if (occ.has(k)) return false;
    occ.delete(e.x + "," + e.y);
    e.x = nx; e.y = ny;
    occ.add(k);
    return true;
  };
  const stepToward = (e, tx, ty) => {
    const dx = Math.sign(tx - e.x), dy = Math.sign(ty - e.y);
    if (Math.abs(tx - e.x) >= Math.abs(ty - e.y)) {
      if (dx && tryStep(e, dx, 0)) return;
      if (dy && tryStep(e, 0, dy)) return;
    } else {
      if (dy && tryStep(e, 0, dy)) return;
      if (dx && tryStep(e, dx, 0)) return;
    }
  };
  const stepRandom = (e) => {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dx, dy] = dirs[Math.floor(rng() * 4)];
    tryStep(e, dx, dy);
  };

  // --- infected party members: the clock ticks ---
  for (const m of [...party.members]) {
    if (m.infected) {
      m.infTimer--;
      if (m.infTimer === 12) UI.log(`${m.name} is pale and shaking. Not long now.`, "warn");
      if (m.infTimer <= 0) {
        const idx = party.members.indexOf(m);
        party.members.splice(idx, 1);
        state.stats.lost++;
        const z = makeZombie(rng, party.x, party.y);
        z.str = Math.max(z.str, Math.round(m.str * 0.6));
        state.zombies.push(z);
        UI.log(`☣ ${m.name} turned! They're one of them now!`, "bad");
        Sfx.memberDie();
      }
    }
  }

  // --- rising corpses ---
  for (const r of [...state.rising]) {
    if (state.tick >= r.at) {
      state.rising.splice(state.rising.indexOf(r), 1);
      state.zombies.push(makeZombie(rng, r.x, r.y));
      const d = chebyshev(r.x, r.y, party.x, party.y);
      if (d <= sightRadius() + 2) UI.log(`${r.name} rises from the dead...`, "bad");
    }
  }

  // --- zombies act (snapshot: the array is mutated during the loop) ---
  const chaseR = state.isNight ? ZOMBIE_CHASE_NIGHT : ZOMBIE_CHASE_DAY;
  for (const z of [...state.zombies]) {
    if (z.hp <= 0 || !state.zombies.includes(z)) continue;
    const dP = chebyshev(z.x, z.y, party.x, party.y);
    if (dP > ACTIVE_RADIUS) continue;

    if (dP <= 1) {
      zombieStrikesParty(z);
      if (state.over) return;
      continue;
    }

    // nearest NPC within 4 tiles?
    let prey = null, preyD = 5;
    for (const n of state.npcs) {
      const d = chebyshev(z.x, z.y, n.x, n.y);
      if (d < preyD) { prey = n; preyD = d; }
    }

    if (preyD <= 1 && prey) {
      // zombie vs NPC skirmish (abstracted)
      prey.hp -= zombieDamage(z, prey, rng);
      z.hp -= Math.round(prey.str * 0.3);
      if (z.hp <= 0) {
        state.zombies.splice(state.zombies.indexOf(z), 1);
        continue;
      }
      if (prey.hp <= 0) {
        state.npcs.splice(state.npcs.indexOf(prey), 1);
        occ.delete(prey.x + "," + prey.y);
        state.zombies.push(makeZombie(rng, prey.x, prey.y));
        if (chebyshev(prey.x, prey.y, party.x, party.y) <= sightRadius() + 4)
          UI.log("You hear a scream cut short nearby...", "warn");
      }
      continue;
    }

    if (dP <= chaseR) {
      stepToward(z, party.x, party.y);
      // Collided with the party while hunting: the zombie has initiative
      // and strikes immediately (its one attack this tick).
      if (chebyshev(z.x, z.y, party.x, party.y) <= 1) {
        zombieStrikesParty(z);
        if (state.over) return;
      }
    }
    else if (prey && preyD <= 4) stepToward(z, prey.x, prey.y);
    else if (rng() < 0.4) stepRandom(z);
  }

  // --- NPCs act ---
  for (const n of state.npcs) {
    if (n.cooldown > 0) n.cooldown--;
    const dP = chebyshev(n.x, n.y, party.x, party.y);
    if (dP > ACTIVE_RADIUS) continue;
    // revealed hostiles fight back: one strike per tick at the front member
    if (n.hostileRevealed && dP <= 1) {
      const m = frontMember();
      if (m) {
        const dmg = humanDamage(n, m, rng);
        m.hp -= dmg;
        Render.addFloater(party.x, party.y, "-" + dmg, "#ff5a4e");
        Sfx.hurt();
        if (m.hp <= 0) {
          killMember(m, `was killed by ${n.name}`);
          if (state.over) return;
        }
      }
      continue; // attacking is their action for this tick
    }
    // flee nearby zombies
    let threat = null, threatD = 4;
    for (const z of state.zombies) {
      const d = chebyshev(n.x, n.y, z.x, z.y);
      if (d < threatD) { threat = z; threatD = d; }
    }
    if (threat) {
      stepToward(n, n.x + (n.x - threat.x), n.y + (n.y - threat.y));
    } else if (rng() < 0.5) {
      stepRandom(n);
    }
  }

  // --- hourly events ---
  if (state.hour === 6) dawnMeal();
  if (state.hour === 3) nightTreachery();
  if (state.isNight && state.hour % 2 === 0 &&
      state.zombies.length < Math.round(ZOMBIE_CAP * state.zombieMult) &&
      rng() < state.zombieMult) {
    const p = randomOpenTile(world, rng, { fromX: party.x, fromY: party.y, minDist: 12, maxDist: 30 });
    state.zombies.push(makeZombie(rng, p.x, p.y));
  }

  updateFog();
  refreshUI();
  checkGameOver();
}

function dawnMeal() {
  const p = state.party;
  let need = 0;
  for (const m of p.members) need += rationCost(m, state.day);
  if (p.food >= need) {
    p.food -= need;
    if (need > 0) UI.log(`Dawn. The party eats ${need} food.`, "info");
  } else {
    p.food = 0;
    for (const m of p.members) {
      m.hp -= 12;
      if (m.hp <= 0) killMember(m, "starved to death");
    }
    UI.log("Dawn. Not enough food — the party is starving! (-12 HP each)", "bad");
  }
  // medics patch everyone up
  const medics = p.members.filter(m => hasTrait(m, "MEDIC")).length;
  if (medics > 0) {
    for (const m of p.members) m.hp = Math.min(m.maxhp, m.hp + 3 * medics);
    UI.log(`Your medic${medics > 1 ? "s" : ""} tends the party's wounds (+${3 * medics} HP).`, "good");
  }
}

function nightTreachery() {
  const p = state.party;
  for (const m of [...p.members]) {
    if (m.isLeader || hasTrait(m, "LOYAL")) continue;
    const sticky = hasTrait(m, "LIGHT_FINGERS") ? 0.35 : 0.22;
    if (m.trust <= 1 && rng() < sticky) {
      const stolen = Math.min(p.food, Math.max(4, Math.round(p.food * 0.25)));
      p.food -= stolen;
      const idx = p.members.indexOf(m);
      p.members.splice(idx, 1);
      state.stats.lost++;
      UI.log(`In the night, ${m.name} stole ${stolen} food and vanished. You misjudged them.`, "bad");
      Sfx.steal();
    }
  }
}

function checkGameOver() {
  if (state.over) return;
  if (state.party.members.length === 0) {
    state.over = true;
    Sfx.gameOver();
    UI.showGameOver({
      days: state.day,
      difficulty: state.difficulty,
      zombieKills: state.stats.zombieKills,
      humanKills: state.stats.humanKills,
      recruited: state.stats.recruited,
      lost: state.stats.lost,
    });
  }
}

// ---------------------------------------------------------------------
// UI refresh & main loop
// ---------------------------------------------------------------------

function refreshUI() {
  UI.renderHUD(state);
  UI.renderParty(state, kickMember);
  Render.drawMinimap(state);
}

function frame(now) {
  if (state) Render.drawFrame(state, now);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------

let started = false;

function startGame() {
  started = true;
  Sfx.unlock();
  Sfx.start();
  UI.hideTitle();
  UI.hideGameOver();
  newGame();
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.key;

  // Help works everywhere and swallows all other input while open
  if (UI.isHelpOpen()) {
    if (k === "Escape" || k === "?") { e.preventDefault(); UI.hideHelp(); }
    return;
  }
  if (k === "?") { e.preventDefault(); UI.showHelp(); return; }

  if (!started || (state && state.over)) {
    if (k === "Enter") { e.preventDefault(); startGame(); }
    return;
  }
  if (UI.isDialogOpen()) return;

  const moves = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };
  if (moves[k]) { e.preventDefault(); handleMove(...moves[k]); return; }

  switch (k) {
    case " ": e.preventDefault(); advanceWorld(); break; // wait
    case "e": case "E": actionEat(); break;
    case "m": case "M": actionMedkit(); break;
    case "c": case "C": actionSerum(); break;
    case "1": actionSort("str"); break;
    case "2": actionSort("hp"); break;
    case "3": actionSort("imm"); break;
    case "4": actionSort("weak"); break;
  }
});

// Buttons
document.getElementById("btn-eat").addEventListener("click", () => state && !state.over && actionEat());
document.getElementById("btn-med").addEventListener("click", () => state && !state.over && actionMedkit());
document.getElementById("btn-serum").addEventListener("click", () => state && !state.over && actionSerum());
document.getElementById("btn-sort-str").addEventListener("click", () => state && !state.over && actionSort("str"));
document.getElementById("btn-sort-hp").addEventListener("click", () => state && !state.over && actionSort("hp"));
document.getElementById("btn-sort-imm").addEventListener("click", () => state && !state.over && actionSort("imm"));
document.getElementById("btn-sort-weak").addEventListener("click", () => state && !state.over && actionSort("weak"));
document.getElementById("btn-restart").addEventListener("click", () => startGame());

document.getElementById("btn-sound").addEventListener("click", (e) => {
  Sfx.setMuted(!Sfx.isMuted());
  e.target.textContent = "SOUND: " + (Sfx.isMuted() ? "OFF" : "ON");
});
document.getElementById("btn-crt").addEventListener("click", (e) => {
  const stage = document.getElementById("stage");
  stage.classList.toggle("crt");
  e.target.textContent = "CRT: " + (stage.classList.contains("crt") ? "ON" : "OFF");
});

// Difficulty picker (title screen)
for (const btn of document.querySelectorAll(".diff-btn")) {
  btn.addEventListener("click", () => {
    difficulty = btn.dataset.diff;
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.toggle("selected", b === btn));
    document.getElementById("diff-desc").textContent = DIFFICULTIES[difficulty].desc;
  });
}
document.getElementById("btn-start").addEventListener("click", () => startGame());
document.getElementById("btn-retry").addEventListener("click", () => startGame());
document.getElementById("btn-help").addEventListener("click", () => UI.showHelp());
document.getElementById("btn-help-close").addEventListener("click", () => UI.hideHelp());

// ---------------------------------------------------------------------
// Touch D-pad (tap = one action, hold = repeat)
// ---------------------------------------------------------------------

const DPAD_ACTS = {
  up: () => handleMove(0, -1),
  down: () => handleMove(0, 1),
  left: () => handleMove(-1, 0),
  right: () => handleMove(1, 0),
  wait: () => advanceWorld(),
};

let dpadTimer = null;
function dpadStop() {
  if (dpadTimer) { clearInterval(dpadTimer); dpadTimer = null; }
}

for (const btn of document.querySelectorAll(".dpad-btn")) {
  const act = () => {
    if (!started || !state || state.over || UI.isDialogOpen() || UI.isHelpOpen()) return;
    DPAD_ACTS[btn.dataset.act]();
  };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    act();
    dpadStop();
    dpadTimer = setInterval(act, 180);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
    btn.addEventListener(ev, dpadStop);
  }
  // block long-press context menu / double-tap zoom on the pad
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}

requestAnimationFrame(frame);
