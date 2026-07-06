/* =====================================================================
   ui.js — HUD, party roster, event log, dialogs, overlays
   ===================================================================== */

"use strict";

const UI = (() => {
  const el = (id) => document.getElementById(id);
  const logBox = el("log");

  let logDay = 0, logHour = 0;

  function setClockRef(day, hour) { logDay = day; logHour = hour; }

  function log(msg, cls = "") {
    const div = document.createElement("div");
    div.className = "entry";
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = `D${logDay} ${String(logHour).padStart(2, "0")}h`;
    div.appendChild(t);
    const span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = msg;
    div.appendChild(span);
    logBox.prepend(div);
    while (logBox.children.length > 70) logBox.removeChild(logBox.lastChild);
  }
  function clearLog() { logBox.innerHTML = ""; }

  // ---- HUD -------------------------------------------------------------
  function renderHUD(state) {
    el("hud-day").textContent = "DAY " + state.day;
    el("hud-time").textContent = String(state.hour).padStart(2, "0") + ":00";
    el("hud-phase").textContent = state.isNight ? "☾" : "☀";
    el("hud-food").textContent = Math.floor(state.party.food);
    el("hud-med").textContent = state.party.medkits;
    el("hud-serum").textContent = state.party.serums;
    el("btn-med").disabled = state.party.medkits <= 0;
    el("btn-serum").disabled = state.party.serums <= 0 || !state.party.members.some(m => m.infected);
    el("btn-eat").disabled = state.party.food < 1;
  }

  // ---- party roster -------------------------------------------------------
  function traitChips(member) {
    return member.traits.map(k => {
      const t = TRAITS[k];
      return `<span class="trait-chip ${t.kind === "pos" ? "pos" : t.kind === "neg" ? "neg" : ""}" title="${t.desc}">${t.name}</span>`;
    }).join("");
  }

  function renderParty(state, onKick) {
    const list = el("party-list");
    list.innerHTML = "";
    el("party-count").textContent = `${state.party.members.length}/${PARTY_MAX}`;
    state.party.members.forEach((m, idx) => {
      const card = document.createElement("div");
      card.className = "member" + (m.isLeader ? " leader" : "") + (m.infected ? " infected" : "");
      const hpPct = Math.max(0, Math.round(m.hp / m.maxhp * 100));
      const hpCls = hpPct < 30 ? "crit" : hpPct < 60 ? "hurt" : "";
      const trustTxt = m.trustKnown ? "★".repeat(m.trust) + "☆".repeat(5 - m.trust) : "?????";
      card.innerHTML = `
        <div class="member-top">
          <span class="member-name">${idx + 1}. ${m.name}<span class="lvl">LV${m.level}</span></span>
          ${m.isLeader ? "" : `<button class="member-kick" title="Kick from party">✕</button>`}
        </div>
        <div class="member-stats">
          <span>STR <b>${m.str}</b></span>
          <span>IMM <b>${IMMUNITY_LABELS[m.immun]}</b></span>
          <span>KILLS <b>${m.kills}</b></span>
          <span title="Experience toward next level">XP <b>${m.xp}/${m.nextLvl}</b></span>
          <span title="Trust">${trustTxt}</span>
        </div>
        <div class="bar"><div class="bar-fill ${hpCls}" style="width:${hpPct}%"></div></div>
        <div>${traitChips(m)}</div>
        ${m.infected ? `<div class="inf-warning">☣ INFECTED — turns in ${m.infTimer}h</div>` : ""}
      `;
      const kickBtn = card.querySelector(".member-kick");
      if (kickBtn) kickBtn.addEventListener("click", () => onKick(m));
      list.appendChild(card);
    });
  }

  // ---- encounter dialog ------------------------------------------------------
  let dialogOpen = false;

  function showEncounter({ npc, kindShown, statsKnown, tagline, text, buttons }) {
    dialogOpen = true;
    el("encounter").classList.remove("hidden");
    Render.drawPortrait(el("enc-portrait"), kindShown, npc.id);
    el("enc-name").textContent = npc.name;
    el("enc-tagline").textContent = tagline || "";
    const trustTxt = statsKnown ? "★".repeat(npc.trust) + "☆".repeat(5 - npc.trust) : "?????";
    el("enc-stats").innerHTML = `
      <span>AGE <b>${npc.age}</b></span>
      <span>SEX <b>${npc.sex}</b></span>
      <span>STR <b>${npc.str}</b></span>
      <span>HP <b>${npc.hp}/${npc.maxhp}</b></span>
      <span>IMMUNITY <b>${IMMUNITY_LABELS[npc.immun]}</b></span>
      <span>TRUST <b>${trustTxt}</b></span>
    `;
    el("enc-traits").innerHTML = traitChips(npc);
    el("enc-text").textContent = text;
    const btnBox = el("enc-buttons");
    btnBox.innerHTML = "";
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.className = "pxbtn " + (b.cls || "");
      btn.textContent = b.label;
      if (b.disabled) btn.disabled = true;
      btn.addEventListener("click", () => { hideEncounter(); b.onClick(); });
      btnBox.appendChild(btn);
    }
  }

  function hideEncounter() {
    dialogOpen = false;
    el("encounter").classList.add("hidden");
  }

  // ---- help / field manual -------------------------------------------------
  let helpOpen = false;
  let helpBuilt = false;

  function buildHelp() {
    const traitRows = Object.values(TRAITS)
      .map(t => `<tr><td class="${t.kind}">${t.name}</td><td>${t.desc}</td></tr>`).join("");
    const diffRows = Object.entries(DIFFICULTIES)
      .map(([, d]) => `<tr><td>${d.name}</td><td>${Math.round(d.zombieMult * 100)}%</td><td>${d.serums}</td><td>${IMMUNITY_LABELS[d.leaderImmun]}</td></tr>`).join("");
    const immRows = IMMUNITY_LABELS
      .map((l, i) => `<tr><td>${l}</td><td>${Math.round(INFECTION_CHANCE[i] * 100)}%</td></tr>`).join("");

    el("help-body").innerHTML = `
      <h3>THE GOAL</h3>
      <p>Survive as many days as you can. The world only moves when you do — every step or
      wait is <b>one in-game hour</b>. When the last member of your party falls, the run ends.</p>

      <h3>RESOURCES</h3>
      <p><span class="warn">🍖 Food</span> — the engine of survival. The party eats at dawn
      (5 rations each; no food = everyone starves for -12 HP). Between meals, EAT <kbd>E</kbd>
      spends 1 food to heal a wounded member +20 HP. Carry capacity grows with party size.</p>
      <p><span class="bad">✚ Medkits</span> — instant +40 HP to your most wounded member
      <kbd>M</kbd>. No food cost, but rare.</p>
      <p><span class="info">◉ Serums</span> — the <b>only cure for infection</b> <kbd>C</kbd>.
      Found exclusively inside buildings, and only a handful exist per run. Choosing who gets
      one is the hardest call in the game.</p>

      <h3>ZOMBIE ENCOUNTERS</h3>
      <p>Walk into a zombie to fight. <b>Your entire party attacks</b> — every member swings
      once, in formation order, until the zombie drops. The zombie answers by striking
      <b>only your front member</b>, once per hour.</p>
      <p><b>Initiative matters:</b> if you charge a zombie, your party swings first. If a
      zombie hunts you down and makes contact, it strikes first. Several zombies in contact
      each get a strike — all on your front member — while your party can only bring down one
      target per hour. Don't get surrounded.</p>
      <p>Surviving a zombie hit risks <b>infection</b> (see below). Every kill earns
      <b>1 XP for every member engaged in the fight</b> — the whole party levels up together,
      gaining strength and max HP. The killing blow also earns personal kill credit.</p>

      <h3>SURVIVOR ENCOUNTERS</h3>
      <p>Walk into a stranger to interact. Depending on their hidden <b>trust</b> (0-5 stars):</p>
      <p>★★★+ they ask to <b>join</b> · ★★ they may <b>shake you down</b> for food (pay or
      fight) · ★ or less they <b>attack on sight</b>.</p>
      <p>Trust is hidden (<b>?????</b>) unless a <i>Judge of Character</i> travels with you.
      Recruits bring their carried food and their traits — but low-trust members may rob you
      at 3 a.m. and vanish. Killing hostiles earns XP and their food.</p>
      <p><b>Casting someone out</b> (✕ on their card) leaves them behind in the world as a
      wandering survivor — they lose a point of trust for the betrayal, and if they were
      infected, you'll see them turn into a zombie where they roam when their timer runs out.</p>

      <h3>INFECTION</h3>
      <p>A bitten member turns into a zombie in <b>48 hours — inside your camp</b>. Cure them
      with a serum, or kick them from the party (✕ on their card) before it's too late.
      Anyone who dies in combat leaves a <b>corpse where they fell</b> — it lies there for
      6 hours, twitching near the end, then rises as a zombie. Infection risk per surviving
      hit, by immunity:</p>
      <table><tr><th>Immunity</th><th>Infection / hit</th></tr>${immRows}</table>

      <h3>FORMATION</h3>
      <p>The roster order is your battle line. The <b>front member</b> (slot 1) takes every
      enemy hit. Sort with <kbd>1</kbd> strongest first · <kbd>2</kbd> healthiest first ·
      <kbd>3</kbd> most immune first · <kbd>4</kbd> shield the weakest.</p>

      <h3>TRAITS</h3>
      <p>Every survivor carries 1-2 personality traits. Green helps, red hurts, blue cuts
      both ways. Party-wide traits (Scout, Night Owl, Judge, Charmer, Light Fingers' bonus)
      work if <i>anyone</i> alive in the party has them.</p>
      <table><tr><th>Trait</th><th>Effect</th></tr>${traitRows}</table>

      <h3>DAY & NIGHT</h3>
      <p>At night (21:00-06:00) your sight shrinks, zombies chase from farther away, and new
      ones rise. Buildings hold the best loot — and sometimes something worse.</p>

      <h3>DIFFICULTY</h3>
      <table><tr><th>Mode</th><th>Horde</th><th>Serums</th><th>James's immunity</th></tr>${diffRows}</table>

      <h3>CONTROLS</h3>
      <p><kbd>←↑↓→</kbd>/<kbd>WASD</kbd> move & fight & talk · <kbd>SPACE</kbd> wait 1 hour ·
      <kbd>E</kbd> eat · <kbd>M</kbd> medkit · <kbd>C</kbd> serum · <kbd>1-4</kbd> formation ·
      <kbd>?</kbd> this manual. On touch screens, use the on-screen D-pad (hold to keep
      walking, ✦ to wait).</p>
    `;
    helpBuilt = true;
  }

  function showHelp() {
    if (!helpBuilt) buildHelp();
    helpOpen = true;
    el("help-screen").classList.remove("hidden");
  }
  function hideHelp() {
    helpOpen = false;
    el("help-screen").classList.add("hidden");
  }

  // ---- overlays ----------------------------------------------------------------
  function hideTitle() { el("title-screen").classList.add("hidden"); }
  function showTitle() { el("title-screen").classList.remove("hidden"); }

  function showGameOver(stats) {
    const diffName = DIFFICULTIES[stats.difficulty]?.name || "Normal";
    const bestKey = "zss8_best_days_" + (stats.difficulty || "normal");
    let best = 0, isRecord = false;
    try {
      best = Number(localStorage.getItem(bestKey) || 0);
      isRecord = stats.days > best;
      if (isRecord) localStorage.setItem(bestKey, String(stats.days));
    } catch (e) { /* storage unavailable — records just don't persist */ }
    el("go-stats").innerHTML = `
      Survived <b>${stats.days}</b> day${stats.days === 1 ? "" : "s"} in the valley (${diffName})<br>
      Zombies destroyed: <b>${stats.zombieKills}</b> · Hostiles put down: <b>${stats.humanKills}</b><br>
      Survivors recruited: <b>${stats.recruited}</b> · Lost along the way: <b>${stats.lost}</b><br>
      ${isRecord ? `<span style="color:var(--accent)">★ NEW ${diffName.toUpperCase()} RECORD ★</span>` : `Best ${diffName} run: <b>${Math.max(best, stats.days)}</b> days`}
    `;
    el("gameover-screen").classList.remove("hidden");
  }
  function hideGameOver() { el("gameover-screen").classList.add("hidden"); }

  return {
    log, clearLog, setClockRef,
    renderHUD, renderParty,
    showEncounter, hideEncounter,
    isDialogOpen: () => dialogOpen,
    showHelp, hideHelp,
    isHelpOpen: () => helpOpen,
    hideTitle, showTitle, showGameOver, hideGameOver,
  };
})();
