/* =====================================================================
   data.js — constants, palettes, sprites, traits, names, RNG helpers
   ===================================================================== */

"use strict";

// --- Core dimensions -------------------------------------------------
const TILE = 16;            // pixels per tile in the low-res buffer
const VIEW_W = 21;          // viewport width in tiles
const VIEW_H = 13;          // viewport height in tiles
const WORLD_W = 96;         // world width in tiles
const WORLD_H = 96;         // world height in tiles

// --- Time -------------------------------------------------------------
const START_HOUR = 8;       // day 1 begins at 08:00
const NIGHT_FROM = 21;      // 21:00 → night
const NIGHT_TO = 6;         // ...until 06:00

// --- Balance ----------------------------------------------------------
const PARTY_MAX = 8;
const FOOD_CAP_BASE = 30;          // food the party can haul regardless of size
const FOOD_CAP_PER_MEMBER = 20;    // extra carry capacity per member
const SIGHT_DAY = 6;
const SIGHT_NIGHT = 3;
const ZOMBIE_CHASE_DAY = 5;
const ZOMBIE_CHASE_NIGHT = 8;
const INFECTION_TICKS = 48;        // hours until an infected member turns
const RISE_TICKS = 6;              // hours until a corpse rises
const ZOMBIE_CAP = 320;
const BRAWLER_PROVOKE_CHANCE = 0.15; // chance a Brawler turns a stranger hostile

// Difficulty scales the horde (initial count, cap, night spawns), the serum
// supply, and how resistant James is to infection (immunity tier 0-3).
const DIFFICULTIES = {
  easy:   { name: "Easy",   zombieMult: 0.25, serums: 8, leaderImmun: 3,
            desc: "A quarter of the horde. James is immune to the virus." },
  normal: { name: "Normal", zombieMult: 0.5,  serums: 6, leaderImmun: 2,
            desc: "The standard apocalypse. Half the horde." },
  hard:   { name: "Hard",   zombieMult: 1,    serums: 4, leaderImmun: 1,
            desc: "The full horde, and every bite is a gamble. Good luck." },
};

const INITIAL_ZOMBIES = 230;
const INITIAL_SURVIVORS = 80;
const INITIAL_FOOD_PILES = 55;
const RATION_PER_MEMBER = 5;       // food each member eats at the dawn meal
const INITIAL_MEDKITS = 22;

// --- Tile ids -----------------------------------------------------------
const T = {
  GRASS: 0, GRASS2: 1, TREE: 2, WATER: 3, ROAD: 4,
  WALL: 5, FLOOR: 6, DOOR: 7, CROP: 8, RUBBLE: 9,
};

const PASSABLE = new Set([T.GRASS, T.GRASS2, T.ROAD, T.FLOOR, T.DOOR, T.CROP, T.RUBBLE]);

// --- Palette (NES-ish) ---------------------------------------------------
const PAL = {
  black: "#0d0d12",
  white: "#f2f2e6",
  grassA: "#3e7a35", grassB: "#468a3c", grassSpeck: "#57a04a", grassDark: "#316328",
  treeA: "#1e5c22", treeB: "#2c7a30", treeTrunk: "#5b3a1e",
  waterA: "#1d4f8f", waterB: "#2a66b3", waterGlint: "#7db8e8",
  road: "#4a4a52", roadCrack: "#3a3a40", roadLine: "#8f8f5a",
  wall: "#8a4a35", wallDark: "#63311f", wallLight: "#a86242",
  floor: "#8a6b42", floorDark: "#6e5433",
  door: "#5b3a1e",
  crop: "#b89b3a", cropDark: "#8f7326",
  rubble: "#6a6a72", rubbleDark: "#44444c",
  skin1: "#e8b08a", skin2: "#b57e52", skin3: "#8a5a33",
  zskin: "#8fb26a", zskinDark: "#6d8f4a",
  blood: "#c62f22",
};

// Shirt / hair color options for civilians (picked by survivor id)
const SHIRTS = ["#3b6fd1", "#c9622f", "#8a3bd1", "#2fa89b", "#c23b6f", "#7a7a2f"];
const HAIRS = ["#1c1c1c", "#5b3a1e", "#c9a53a", "#7a3520", "#666670"];
const PANTS = ["#2b3a5c", "#3a3a3a", "#4a3526"];

/* --- Character sprite templates (16x16) -------------------------------
   Chars: . transparent  H hair  S skin  E eye  T shirt  P pants  K boot
          B bandana (leader)  M mask (bandit)  Z zombie skin  R red eye
*/
const SPR_HUMAN_0 = [
  "................",
  "......HHHH......",
  ".....HHHHHH.....",
  ".....HSSSSH.....",
  ".....SESSES.....",
  ".....SSSSSS.....",
  "......SSSS......",
  ".....TTTTTT.....",
  "....STTTTTTS....",
  "....STTTTTTS....",
  ".....TTTTTT.....",
  ".....PPPPPP.....",
  ".....PP..PP.....",
  ".....PP..PP.....",
  ".....KK..KK.....",
  "................",
];
const SPR_HUMAN_1 = [
  "................",
  "......HHHH......",
  ".....HHHHHH.....",
  ".....HSSSSH.....",
  ".....SESSES.....",
  ".....SSSSSS.....",
  "......SSSS......",
  ".....TTTTTT.....",
  "....STTTTTTS....",
  "....STTTTTTS....",
  ".....TTTTTT.....",
  ".....PPPPPP.....",
  "....PPP..PP.....",
  "....PP...PPP....",
  "....KK....KK....",
  "................",
];
const SPR_LEADER_0 = [
  "................",
  "......BBBB......",
  ".....BBBBBB.....",
  ".....BSSSSB.....",
  ".....SESSES.....",
  ".....SSSSSS.....",
  "......SSSS......",
  ".....TTTTTT.....",
  "....STTTTTTS....",
  "....STTTTTTS....",
  ".....TTTTTT.....",
  ".....PPPPPP.....",
  ".....PP..PP.....",
  ".....PP..PP.....",
  ".....KK..KK.....",
  "................",
];
const SPR_LEADER_1 = [
  "................",
  "......BBBB......",
  ".....BBBBBB.....",
  ".....BSSSSB.....",
  ".....SESSES.....",
  ".....SSSSSS.....",
  "......SSSS......",
  ".....TTTTTT.....",
  "....STTTTTTS....",
  "....STTTTTTS....",
  ".....TTTTTT.....",
  ".....PPPPPP.....",
  "....PPP..PP.....",
  "....PP...PPP....",
  "....KK....KK....",
  "................",
];
const SPR_BANDIT_0 = [
  "................",
  "......HHHH......",
  ".....HHHHHH.....",
  ".....HSSSSH.....",
  ".....MEMMEM.....",
  ".....SSSSSS.....",
  "......SSSS......",
  ".....TTTTTT.....",
  "....STTTTTTS....",
  "....STTTTTTS....",
  ".....TTTTTT.....",
  ".....PPPPPP.....",
  ".....PP..PP.....",
  ".....PP..PP.....",
  ".....KK..KK.....",
  "................",
];
const SPR_BANDIT_1 = [
  "................",
  "......HHHH......",
  ".....HHHHHH.....",
  ".....HSSSSH.....",
  ".....MEMMEM.....",
  ".....SSSSSS.....",
  "......SSSS......",
  ".....TTTTTT.....",
  "....STTTTTTS....",
  "....STTTTTTS....",
  ".....TTTTTT.....",
  ".....PPPPPP.....",
  "....PPP..PP.....",
  "....PP...PPP....",
  "....KK....KK....",
  "................",
];
const SPR_ZOMBIE_0 = [
  "................",
  "......HHHH......",
  ".....HZZZZH.....",
  ".....ZRZZRZ.....",
  ".....ZZZZZZ.....",
  "......ZZZZ......",
  ".....TTTTTT.....",
  "..ZZZTT.TTTZZ...",
  "..Z..TTTT.T..Z..",
  ".....TT.TTT.....",
  ".....T.TTTT.....",
  ".....PPPPPP.....",
  ".....PP..PP.....",
  ".....P...PP.....",
  ".....K...KK.....",
  "................",
];
const SPR_ZOMBIE_1 = [
  "................",
  "......HHHH......",
  ".....HZZZZH.....",
  ".....ZRZZRZ.....",
  ".....ZZZZZZ.....",
  "......ZZZZ......",
  ".....TTTTTT.....",
  "...ZZTT.TTTZZZ..",
  "..Z..TTTT.T..Z..",
  ".....TT.TTT.....",
  ".....T.TTTT.....",
  ".....PPPPPP.....",
  "....PPP..PP.....",
  "....PP...P......",
  "....KK...K......",
  "................",
];

// A fallen survivor, lying in a pool of blood, waiting to rise.
// r blood pool  S skin  E closed eye  T shirt  P pants  K boots
const SPR_CORPSE = [
  "................",
  "................",
  "................",
  "................",
  "....rrrrrrrr....",
  "...rrrrrrrrrr...",
  "..rSSrTTTTrrrr..",
  "..SESTTTTTPPKK..",
  "..SSSTTTTTPPKK..",
  "..rSSrTTTTrrrr..",
  "...rrrrrrrrrr...",
  "....rrrrrrrr....",
  "................",
  "................",
  "................",
  "................",
];

// --- Loot sprites -------------------------------------------------------
const SPR_CRATE = [
  "................",
  "................",
  "................",
  "................",
  "....aaaaaaaa....",
  "...abbbbbbbba...",
  "...abccccccba...",
  "...abcbbbbcba...",
  "...abcbbbbcba...",
  "...abccccccba...",
  "...abbbbbbbba...",
  "...aaaaaaaaaa...",
  "................",
  "................",
  "................",
  "................",
];
const SPR_MEDKIT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "...wwwwwwwwww...",
  "...w~~~rr~~~w...",
  "...w~~~rr~~~w...",
  "...w~rrrrrr~w...",
  "...w~rrrrrr~w...",
  "...w~~~rr~~~w...",
  "...w~~~rr~~~w...",
  "...wwwwwwwwww...",
  "................",
  "................",
  "................",
];
const SPR_SERUM = [
  "................",
  "................",
  "................",
  "......gg........",
  "......gg........",
  ".....cccc.......",
  ".....c**c.......",
  ".....c**c.......",
  ".....c**c.......",
  ".....c**c.......",
  ".....cccc.......",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const LOOT_PAL = {
  a: "#3d2812", b: "#7a5228", c: "#a87840",       // crate
  w: "#e8e8e0", r: "#d13b27", "~": "#c8c8c0",     // medkit
  g: "#556", c2: "#8fd8e8", "*": "#39e8c8", c3: "", // serum (c handled per-sprite)
};

// --- Personality traits ---------------------------------------------------
// kind: pos (helpful), neg (liability), mixed (trade-off)
const TRAITS = {
  BRAWLER: { name: "Brawler", kind: "mixed", desc: "+30% damage, but may provoke strangers into a fight." },
  MEDIC: { name: "Medic", kind: "pos", desc: "Patches the whole party +3 HP every dawn." },
  SCOUT: { name: "Scout", kind: "pos", desc: "+2 sight radius while alive." },
  COWARD: { name: "Coward", kind: "neg", desc: "35% chance to flinch and skip their attack." },
  GLUTTON: { name: "Glutton", kind: "neg", desc: "Eats 2 rations at every dawn meal." },
  IRON_GUT: { name: "Iron Gut", kind: "pos", desc: "Only needs a ration every other day." },
  CHARMER: { name: "Charmer", kind: "pos", desc: "Hostile strangers may back down instead of attacking." },
  JUDGE: { name: "Judge of Character", kind: "pos", desc: "Reveals the true trust level of strangers you meet." },
  NIGHT_OWL: { name: "Night Owl", kind: "pos", desc: "The party keeps full sight radius at night." },
  LIGHT_FINGERS: { name: "Light Fingers", kind: "mixed", desc: "+50% scavenged food, but untrustworthy types may rob you and vanish." },
  LOYAL: { name: "Loyal", kind: "pos", desc: "Will never steal from you or desert the party." },
  TOUGH: { name: "Tough", kind: "pos", desc: "+20 max HP." },
};
const TRAIT_KEYS = Object.keys(TRAITS);

// --- Names (from the original game, expanded) -----------------------------
const LAST_NAMES = ["Donovan","Suarez","Vibbit","Johnson","Kendrick","Watterson","Kim","Lee","Ekuelle","Barry","Souvignet","Valls","Dominguez","Nelson","Barnett","Eddington","Wilson","Edison","Gupta","Henderson","Chandrasekar","Gandhi","Peterson","Jameson","Montand","Jean-Francois","Grey","Vasta","Ignacolla","Bunyea","Hallenbeck","Daniels","Hicks","Salline","Garret","Shabalala","Henry","Sakho","Acquah","Ronaldo","Palma","Lima","Nielsen","Cole","Courdry","Stewart","Sadgic","Kelso","Temeng","Barto","Koch","Sinese"];
const FIRST_NAMES_MALE = ["Derrick","John","Bobby","Richard","Thomas","Tyrone","Willis","William","Jack","Garret","Bill","Cedric","Matt","Matthew","Eric","Kwame","Yves","Jerry","Akash","Murali","Siqiang","Ye","Nigel","Rory","Christian","Chris","Nick","Nicholas","Maurice","Rick","Peter","Pete","Quade","Dwayne","Milhouse","Victor","Charlie","Xavier","Juan","Jose","Sebastian","Jesus","Ollie","Fernando","Zachary","Geoffery","Ned","Nathan","Frederick","Wilson"];
const FIRST_NAMES_FEMALE = ["Donna","Carey","Malvika","Swati","Sweta","Keisha","LaTondra","Jane","Janet","Helga","Barbara","Karen","Rita","Julia","Lily","Lillian","Junwen","Zihe","Juanita","Evelyn","Janine","Genevieve","Candy","Patricia","Elaine","Mona","Tess","Molina","Vicky","Vickie","Christa","Chris","Lisa","Lisette","Gia","Marta","Christin","Layla","Zasha","Brittney","Norah","Nayla","Deanna","Diana","Aba","Abby","Abigail"];

// Flavor lines shown when meeting a stranger (no mechanical meaning)
const TAGLINES = [
  "wipes ash from their brow",
  "keeps glancing over their shoulder",
  "carries a dented baseball bat",
  "hums an old radio jingle",
  "eyes your supplies for a moment",
  "has seen better days",
  "offers a tired half-smile",
  "stands a careful distance away",
  "looks like they haven't slept in days",
  "clutches a faded photograph",
];

// --- RNG helpers ------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
function chebyshev(x1, y1, x2, y2) { return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)); }

// --- 3x5 pixel font (for in-canvas floaters / labels) ----------------------
// Each glyph is 15 bits, rows top→bottom, 3 columns per row.
const FONT3X5 = {
  "0":"111101101101111","1":"010110010010111","2":"111001111100111","3":"111001111001111",
  "4":"101101111001001","5":"111100111001111","6":"111100111101111","7":"111001001010010",
  "8":"111101111101111","9":"111101111001111",
  "A":"111101111101101","B":"110101110101110","C":"011100100100011","D":"110101101101110",
  "E":"111100110100111","F":"111100110100100","G":"011100101101011","H":"101101111101101",
  "I":"111010010010111","J":"001001001101010","K":"101101110101101","L":"100100100100111",
  "M":"101111111101101","N":"110101101101101","O":"010101101101010","P":"110101110100100",
  "Q":"010101101011001","R":"110101110101101","S":"011100010001110","T":"111010010010010",
  "U":"101101101101111","V":"101101101101010","W":"101101111111101","X":"101101010101101",
  "Y":"101101010010010","Z":"111001010100111",
  "+":"000010111010000","-":"000000111000000","!":"010010010000010",".":"000000000000010",
  "?":"111001011000010","/":"001001010100100"," ":"000000000000000",
};
