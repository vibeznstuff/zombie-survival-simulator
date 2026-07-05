/* =====================================================================
   entities.js — survivors, zombies, loot, and combat math
   ===================================================================== */

"use strict";

let NEXT_ID = 1;

const IMMUNITY_LABELS = ["None", "Low", "Moderate", "Immune"];
const INFECTION_CHANCE = [0.30, 0.16, 0.06, 0];

function rollTraits(rng) {
  const n = rng() < 0.35 ? 2 : 1;
  const traits = [];
  while (traits.length < n) {
    const t = pick(rng, TRAIT_KEYS);
    if (!traits.includes(t)) traits.push(t);
  }
  return traits;
}

function makeSurvivor(rng, opts = {}) {
  const sex = rng() < 0.5 ? "Male" : "Female";
  const first = pick(rng, sex === "Male" ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
  const last = pick(rng, LAST_NAMES);
  const age = randInt(rng, 12, 65);
  // Younger = stronger baseline, same spirit as the original formula
  const str = Math.max(25, Math.min(100, Math.round(rng() * 100 * (1 - age / 90) + rng() * age * 0.5 + 20)));
  const maxhp = Math.round(100 - Math.pow(rng(), 2) * age * 0.6);
  const r = rng();
  const immun = r > 0.92 ? 3 : r > 0.72 ? 2 : r > 0.4 ? 1 : 0;
  const traits = rollTraits(rng);

  const s = {
    id: NEXT_ID++,
    name: first + " " + last,
    sex, age, str,
    trust: opts.trust != null ? opts.trust : randInt(rng, 0, 5),
    hp: maxhp, maxhp,
    immun, traits,
    level: 1, kills: 0, xp: 0, nextLvl: 3,
    infected: false, infTimer: 0,
    trustKnown: !!opts.trustKnown,
    tagline: pick(rng, TAGLINES),
    // NPC-only fields
    x: opts.x | 0, y: opts.y | 0,
    cooldown: 0,          // ticks before they'll talk to you again
    pacified: false,      // charmed hostiles won't attack again
    foodCarried: randInt(rng, 3, 15),
  };
  if (traits.includes("TOUGH")) { s.maxhp += 20; s.hp += 20; }
  return s;
}

function makeLeader(immun = 1) {
  return {
    id: 0,
    name: "James Carregan",
    sex: "Male", age: 32, str: 70,
    trust: 5,
    hp: 100, maxhp: 100,
    immun, traits: ["LOYAL"],
    level: 1, kills: 0, xp: 0, nextLvl: 3,
    infected: false, infTimer: 0,
    trustKnown: true,
    tagline: "",
    x: 0, y: 0, cooldown: 0, pacified: false, foodCarried: 0,
    isLeader: true,
  };
}

function makeZombie(rng, x, y) {
  const hp = randInt(rng, 40, 70);
  return {
    id: NEXT_ID++,
    x, y,
    hp,
    maxhp: hp,
    str: randInt(rng, 10, 26),
  };
}

function hasTrait(member, key) { return member.traits.includes(key); }
function partyHasTrait(members, key) { return members.some(m => hasTrait(m, key)); }

// --- Combat math -----------------------------------------------------------

function memberDamage(m, rng) {
  if (hasTrait(m, "COWARD") && rng() < 0.35) return 0; // flinched
  let dmg = Math.round(m.str * 0.35) + m.level * 3 + randInt(rng, 0, 6);
  if (hasTrait(m, "BRAWLER")) dmg = Math.round(dmg * 1.3);
  return dmg;
}

function zombieDamage(z, target, rng) {
  return Math.max(1, z.str - Math.round(target.str * 0.15) + randInt(rng, 0, 4));
}

function humanDamage(attacker, target, rng) {
  return Math.max(1, Math.round(attacker.str * 0.3) - Math.round(target.str * 0.1) + randInt(rng, 0, 5));
}

function rollInfection(member, rng) {
  return !member.infected && rng() < INFECTION_CHANCE[member.immun];
}

// Award XP toward the next level. Returns true if the member leveled up.
// (Kill credit is a separate stat — every member engaged in the fight
// earns XP when an enemy dies, not just whoever landed the final blow.)
function gainXP(member, amount = 1) {
  member.xp += amount;
  if (member.xp >= member.nextLvl) {
    member.level++;
    member.nextLvl += member.level * 3;
    member.str = Math.min(120, Math.round(member.str * 1.1));
    member.maxhp = Math.round(member.maxhp * 1.1);
    member.hp = Math.min(member.maxhp, member.hp + Math.round(member.maxhp * 0.2));
    return true;
  }
  return false;
}

// Daily ration cost for one member (called at dawn). Base is RATION_PER_MEMBER;
// Iron Gut only eats every other day, Glutton eats double.
function rationCost(member, day) {
  if (hasTrait(member, "IRON_GUT")) return day % 2 === 0 ? RATION_PER_MEMBER : 0;
  if (hasTrait(member, "GLUTTON")) return RATION_PER_MEMBER * 2;
  return RATION_PER_MEMBER;
}
