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
    hideTitle, showTitle, showGameOver, hideGameOver,
  };
})();
