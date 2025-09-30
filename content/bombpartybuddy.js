function isBombPartyFrame() {
  return /https:\/\/[a-z]*\.jklm\.fun\/games\/bombparty\/$/.test(document.location);
}
function getInput() {
  const selfTurns = document.getElementsByClassName("selfTurn");
  if (!selfTurns.length) return document.querySelector("input") || null;
  return selfTurns[0].getElementsByTagName("input")[0];
}

// Clipboard fallback (permissions policy blocks navigator.clipboard)
async function copyPlain(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

function createOverlay(game) {
  // Top-anchored wrapper
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed", left: "12px", top: "12px",
    zIndex: "2147483647", userSelect: "none",
  });

  // HUD
  const box = document.createElement("div");
  Object.assign(box.style, {
    background: "rgba(13,17,23,0.96)",
    color: "#fff",
    fontFamily: "Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    fontSize: "14px",
    lineHeight: "1.45",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    padding: "12px 14px",
    boxShadow: "0 10px 28px rgba(0,0,0,0.40)",
    width: "520px",             // fixed width; notices wrap inside
    transformOrigin: "left top",
  });
  wrap.appendChild(box);

  // scale (NEW range 20–70; default ~45)
  let hudScale = 0.45;
  const applyScale = () => { box.style.transform = `scale(${hudScale})`; };
  applyScale();

  // header (drag + collapse)
  const header = document.createElement("div");
  header.textContent = "Bomb Party Buddy 🤝 LitShark Services";
  Object.assign(header.style, {
    fontWeight: 800, marginBottom: "10px", letterSpacing: "0.2px",
    cursor: "grab", borderBottom: "1px solid rgba(255,255,255,0.10)", paddingBottom: "8px",
    fontSize: "16px"
  });
  box.appendChild(header);

  // Tabs
  const tabs = document.createElement("div");
  Object.assign(tabs.style, { display:"flex", gap:"8px", marginBottom:"10px" });
  const mkTab = (name) => {
    const b = document.createElement("button");
    b.textContent = name;
    Object.assign(b.style, { padding:"6px 10px", borderRadius:"8px", cursor:"pointer",
      border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.06)", fontWeight:700 });
    b._setActive = (on)=> {
      b.style.background = on ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)";
      b.style.border = on ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.2)";
    };
    return b;
  };
  const mainTabBtn = mkTab("Main");
  const covTabBtn  = mkTab("Coverage");
  const wordsTabBtn= mkTab("Words");
  tabs.appendChild(mainTabBtn); tabs.appendChild(covTabBtn); tabs.appendChild(wordsTabBtn);
  box.appendChild(tabs);

  // sections
  const mainSec = document.createElement("div");
  const covSec  = document.createElement("div");
  const wordsSec= document.createElement("div");
  box.appendChild(mainSec); box.appendChild(covSec); box.appendChild(wordsSec);

  // default to Words
  let active = "Words";
  const setActive = (name) => {
    active = name;
    mainSec.style.display  = name==="Main" ? "block" : "none";
    covSec.style.display   = name==="Coverage" ? "block" : "none";
    wordsSec.style.display = name==="Words" ? "block" : "none";
    mainTabBtn._setActive(name==="Main");
    covTabBtn._setActive(name==="Coverage");
    wordsTabBtn._setActive(name==="Words");
  };
  mainTabBtn.onclick = () => setActive("Main");
  covTabBtn.onclick  = () => setActive("Coverage");
  wordsTabBtn.onclick= () => setActive("Words");
  setActive("Words");

  // helpers
  const applyToggleStyle = (btn, on) => {
    btn.textContent = on ? "ON" : "OFF";
    btn.style.background = on ? "rgba(22,163,74,0.22)" : "rgba(220,38,38,0.20)";
    btn.style.border = `1px solid ${on ? "rgba(22,163,74,0.55)" : "rgba(220,38,38,0.55)"}`;
    btn.style.color = on ? "#86efac" : "#fecaca";
    btn.style.fontWeight = "800";
    btn.style.borderRadius = "10px";
    btn.style.padding = "6px 10px";
    btn.style.cursor = "pointer";
    btn.style.minWidth = "64px";
    btn.style.textAlign = "center";
  };
  const applyToggleBtn = (btn, on) => applyToggleStyle(btn, !!on);

  const mkRow = (label, onClick, getOn) => {
    const r = document.createElement("div");
    Object.assign(r.style, { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", margin:"10px 0" });
    const span = document.createElement("span"); span.textContent = label; r.appendChild(span);
    const btn = document.createElement("button"); btn.onclick = () => { onClick(); render(); };
    r.appendChild(btn);
    r._btn = btn; r._get = getOn;
    return r;
  };

  function sliderRow(label, min, max, val, step, oninput){
    const row = document.createElement("div");
    Object.assign(row.style, { display:"grid", gridTemplateColumns:"auto 1fr auto", alignItems:"center", gap:"10px", margin:"8px 0" });
    const span = document.createElement("span"); span.textContent = label;
    const input = document.createElement("input");
    input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(val);
    const valEl = document.createElement("span"); valEl.textContent = String(val); valEl.style.opacity = "0.9"; valEl.style.fontWeight = "700";
    input.addEventListener("input", (e)=>{ const v = step===1?parseInt(input.value,10):parseFloat(input.value); oninput(v); valEl.textContent = String(v); e.stopPropagation(); });
    row.appendChild(span); row.appendChild(input); row.appendChild(valEl);
    row._range = input;
    return row;
  }
  function textInput(placeholder, value, oninput){
    const wrap = document.createElement("div");
    const inp = document.createElement("input");
    inp.type = "text"; inp.placeholder = placeholder; inp.value = value || "";
    Object.assign(inp.style, { width:"100%", padding:"6px 8px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:"600" });
    inp.addEventListener("input", (e)=>{ oninput(inp.value); e.stopPropagation(); });
    wrap.appendChild(inp);
    return wrap;
  }
  function sectionTitle(text){
    const t = document.createElement("div");
    t.textContent = text;
    Object.assign(t.style, { marginTop:"10px", fontWeight:800, fontSize:"15px" });
    return t;
  }
  function noticeBar(){
    const n = document.createElement("div");
    Object.assign(n.style, {
      height:"38px",
      width:"100%",
      overflow:"hidden",
      color:"#facc15",
      fontSize:"12px",
      display:"block",
      visibility:"hidden",
      paddingTop:"6px",
      wordWrap:"break-word",
      overflowWrap:"break-word",
      wordBreak:"break-word",
    });
    n._show = (text) => { n.textContent = text || ""; n.style.visibility = text ? "visible" : "hidden"; };
    return n;
  }
  function listBox(fontPx){
    const d = document.createElement("div");
    Object.assign(d.style, { marginTop:"6px", fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize:`${fontPx}px`, lineHeight:"1.55" });
    return d;
  }

  // DRAGGABLE (top-locked) + collapse without accidental clicks
  let dragging = false, dragMoved = false, px = 0, py = 0, left = 12, top = 12;
  header.addEventListener("mousedown", (e) => {
    dragging = true; dragMoved = false; header.style.cursor = "grabbing";
    px = e.clientX; py = e.clientY; e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    left = Math.max(4, left + dx); top  = Math.max(4,  top  + dy);
    wrap.style.left = `${left}px`; wrap.style.top  = `${top}px`;
    px = e.clientX; py = e.clientY;
  });
  window.addEventListener("mouseup", () => { dragging = false; header.style.cursor = "grab"; });
  let collapsed = false;
  header.addEventListener("click", () => {
    if (dragMoved) { dragMoved = false; return; }
    collapsed = !collapsed;
    mainSec.style.display  = collapsed ? "none" : (active==="Main"?"block":"none");
    covSec.style.display   = collapsed ? "none" : (active==="Coverage"?"block":"none");
    wordsSec.style.display = collapsed ? "none" : (active==="Words"?"block":"none");
    tabs.style.display     = collapsed ? "none" : "flex";
  });

  // =============== MAIN TAB =================
  const rows = [
    mkRow("AutoType", () => game.togglePause(), () => !game.paused),
    mkRow("Foul words (me)", () => game.toggleFoulMode(), () => game.foulMode),
    mkRow("Alphabet coverage", () => game.toggleCoverageMode(), () => game.coverageMode),
    mkRow("Butterfingers", () => game.toggleMistakes(), () => game.mistakesEnabled),
    mkRow("Auto /suicide", () => game.toggleAutoSuicide(), () => game.autoSuicide),
  ];
  rows.forEach(r => mainSec.appendChild(r));

  // NEW range 20–70
  mainSec.appendChild(sliderRow("HUD size", 20, 70, 45, 1, (v)=>{ hudScale = v/100; applyScale(); }));
  mainSec.appendChild(sliderRow("Speed", 1, 12, game.speed, 1, (v)=>game.setSpeed(v)));
  mainSec.appendChild(sliderRow("Thinking delay (s)", 0, 5, game.thinkingDelaySec, 0.1, (v)=>game.setThinkingDelaySec(v)));

  const lenRowMain = mkRow("Target length (me)", ()=>game.toggleLengthMode(), ()=>game.lengthMode);
  mainSec.appendChild(lenRowMain);
  const lenSliderMain = sliderRow("Length", 3, 20, game.targetLen, 1, (v)=>game.setTargetLen(v));
  mainSec.appendChild(lenSliderMain);
  const lenNoticeMain = noticeBar();
  mainSec.appendChild(lenNoticeMain);

  // Premessage/Postfix
  const preTop = mkRow("Premessage", ()=>game.setPreMsgEnabled(!game.preMsgEnabled), ()=>game.preMsgEnabled);
  mainSec.appendChild(preTop);
  mainSec.appendChild(textInput("Message to flash before your word", game.preMsgText, (v)=>game.setPreMsgText(v)));
  const postTop = mkRow("Postfix", ()=>game.setPostfixEnabled(!game.postfixEnabled), ()=>game.postfixEnabled);
  mainSec.appendChild(postTop);
  mainSec.appendChild(textInput("Characters to append (e.g., <3)", game.postfixText, (v)=>game.setPostfixText(v)));

  // =============== COVERAGE TAB =================
  const exTop = mkRow("A–Z goals / exclusions", ()=>game.setExcludeEnabled(!game.excludeEnabled), ()=>game.excludeEnabled);
  covSec.appendChild(exTop);

  const help = document.createElement("div");
  help.innerHTML = "Format examples: <b>a3 f2 c8 x0 z0</b> (0 = exclude). You can also set <b>majority5</b> to make all letters need 5 by default; any explicit tokens like <b>a3</b> override the majority.";
  Object.assign(help.style, { color:"rgba(255,255,255,0.85)", fontSize:"12px", marginTop:"4px" });
  covSec.appendChild(help);

  const exInput = textInput("a3 f2 c8 x0 z0  majority0", game.excludeSpec || "xz", (v)=>game.setExcludeSpec(v));
  covSec.appendChild(exInput);

  // vertical grid (length > width)
  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display:"grid",
    gridTemplateColumns:"repeat(6, minmax(0, 1fr))",
    gap:"6px",
    marginTop:"10px"
  });
  covSec.appendChild(grid);

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset A–Z progress";
  Object.assign(resetBtn.style,{ padding:"6px 10px", borderRadius:"10px", cursor:"pointer", background:"rgba(255,255,255,0.10)", color:"#fff", border:"1px solid rgba(255,255,255,0.2)", fontWeight:"700", marginTop:"8px" });
  resetBtn.onclick = ()=>game.resetCoverage();
  covSec.appendChild(resetBtn);

  // =============== WORDS TAB =================
  const suggRow = sliderRow("Suggestions", 1, 10, game.suggestionsLimit, 1, (v)=>game.setSuggestionsLimit(v));
  wordsSec.appendChild(suggRow);

  suggRow._range.addEventListener("input", () => {
    if (game.myTurn) {
      game.lastTopPicksSelf = game.getTopCandidates(game.syllable, game.suggestionsLimit, "self");
    } else if (game.lastSpectatorSyllable) {
      game.generateSpectatorSuggestions(game.lastSpectatorSyllable, game.suggestionsLimit);
    }
    render();
  });

  const specFoulRow = mkRow("Foul words (spectator)", ()=>game.toggleSpecFoul(), ()=>game.specFoulMode);
  wordsSec.appendChild(specFoulRow);
  const specLenRow = mkRow("Target length (spectator)", ()=>game.toggleSpecLength(), ()=>game.specLengthMode);
  wordsSec.appendChild(specLenRow);
  const specLenSlider = sliderRow("Length (spectator)", 3, 20, game.specTargetLen, 1, (v)=>game.setSpecTargetLen(v));
  wordsSec.appendChild(specLenSlider);

  const noteSelf = noticeBar();
  const noteSpec = noticeBar();
  wordsSec.appendChild(noteSelf);
  wordsSec.appendChild(noteSpec);

  const myTitle = sectionTitle("My top picks");
  const myPicks = listBox(19);
  wordsSec.appendChild(myTitle); wordsSec.appendChild(myPicks);

  const specTitle = sectionTitle("Spectator suggestions");
  const specList = listBox(19);
  wordsSec.appendChild(specTitle); wordsSec.appendChild(specList);

  function clickableWords(container, words, syllable) {
    container.innerHTML = "";
    if (!words || !words.length) { container.textContent = "(none)"; return; }
    const frag = document.createDocumentFragment();
    const syl = (syllable || "").toLowerCase();
    words.forEach((w, idx) => {
      const span = document.createElement("span");
      span.innerHTML = Game.highlightSyllable(w, syl);
      span.style.cursor = "pointer";
      span.title = "Click to copy";
      span.style.marginRight = idx < words.length - 1 ? "8px" : "0";
      span.addEventListener("click", async () => {
        const ok = await copyPlain(w);
        span.style.textDecoration = ok ? "underline" : "line-through";
        setTimeout(()=> span.style.textDecoration = "none", 400);
      });
      frag.appendChild(span);
      if (idx < words.length - 1) {
        const comma = document.createElement("span");
        comma.textContent = ", ";
        frag.appendChild(comma);
      }
    });
    container.appendChild(frag);
  }

  function renderCoverageGrid() {
    grid.innerHTML = "";
    for (let i = 0; i < 26; i++) {
      const box = document.createElement("div");
      Object.assign(box.style, {
        padding:"6px 6px 8px",
        borderRadius:"8px",
        border:"1px solid rgba(255,255,255,0.18)",
        background:"rgba(255,255,255,0.05)",
      });
      const top = document.createElement("div");
      const letter = String.fromCharCode(97+i);
      const target = game.excludeEnabled ? game.targetCounts[i] : 1;
      const have = Math.min(game.coverageCounts[i], target);
      top.textContent = target<=0 ? `${letter} (×)` : `${letter} ${have}/${target}`;
      Object.assign(top.style, { fontWeight:800, marginBottom:"4px", color: target<=0 ? "#9ca3af" : "#fff", textDecoration: target<=0 ? "line-through" : "none" });
      const bar = document.createElement("div");
      Object.assign(bar.style, { height:"6px", width:"100%", borderRadius:"999px", background:"rgba(255,255,255,0.1)", overflow:"hidden" });
      const fill = document.createElement("div");
      const pct = target>0 ? Math.round((have/target)*100) : 0;
      Object.assign(fill.style, { height:"100%", width:`${pct}%`, background: pct>=100 ? "rgba(34,197,94,0.9)" : "rgba(250,204,21,0.85)" });
      bar.appendChild(fill);
      box.appendChild(top); box.appendChild(bar);
      grid.appendChild(box);
    }
  }

  function buildNotice(context) {
    const roundNow = context==="self" ? game.selfRound : game.spectatorRound;
    const flagsRound = context==="self" ? game.flagsRoundSelf : game.flagsRoundSpectator;
    if (flagsRound !== roundNow) return "";

    const foulFallback   = context==="self" ? game.lastFoulFallbackSelf : game.lastFoulFallbackSpectator;
    const lenFallback    = context==="self" ? game.lastLenFallbackSelf : game.lastLenFallbackSpectator;
    const capApplied     = context==="self" ? game.lastLenCapAppliedSelf : game.lastLenCapAppliedSpectator;
    const capRelaxed     = context==="self" ? game.lastLenCapRelaxedSelf : game.lastLenCapRelaxedSpectator;
    const lenSuppressed  = context==="self" ? game.lastLenSuppressedByFoulSelf : game.lastLenSuppressedByFoulSpectator;

    const parts = [];
    if ((context==="self" && game.foulMode) || (context==="spectator" && game.specFoulMode)) {
      if (foulFallback) parts.push("No foul words matched this prompt — using the normal word list.");
    }
    if (context==="self" && game.lengthMode && game.coverageMode && capApplied)
      parts.push(`Limiting to words of ≤ ${game.targetLen} letters (while maximizing alphabet coverage).`);
    if (context==="self" && game.lengthMode && game.coverageMode && capRelaxed)
      parts.push(`No words of ≤ ${game.targetLen} letters found — using best coverage regardless of length.`);
    if ((context==="self" && game.lengthMode && !game.coverageMode) ||
        (context==="spectator" && game.specLengthMode)) {
      if (lenFallback) parts.push(`No words with exactly ${context==="self"?game.targetLen:game.specTargetLen} letters — trying nearby lengths.`);
      if (lenSuppressed) parts.push("Target length ignored because foul words are available for this prompt.");
    }
    return parts.join(" ");
  }

  function render() {
    rows.forEach(r => applyToggleBtn(r._btn, r._get()));
    applyToggleBtn(lenRowMain._btn, game.lengthMode);
    applyToggleBtn(preTop._btn, game.preMsgEnabled);
    applyToggleBtn(postTop._btn, game.postfixEnabled);
    applyToggleBtn(exTop._btn, game.excludeEnabled);
    applyToggleBtn(specFoulRow._btn, game.specFoulMode);
    applyToggleBtn(specLenRow._btn, game.specLengthMode);

    // length notice
    if (game.lengthMode && (game.coverageMode || game.foulMode)) {
      if (game.coverageMode && game.foulMode)
        lenNoticeMain._show(`Target Length: with Coverage ON it acts as a MAX (≤ ${game.targetLen}); with Foul ON it’s used only if no foul words match.`);
      else if (game.coverageMode)
        lenNoticeMain._show(`Target Length: acts as a MAX (≤ ${game.targetLen}) while optimizing alphabet coverage.`);
      else if (game.foulMode)
        lenNoticeMain._show(`Target Length: ignored when foul words are available; used only if no foul words match this prompt.`);
    } else {
      lenNoticeMain._show("");
    }

    renderCoverageGrid();

    const syl = (game.syllable || "").toLowerCase();
    clickableWords(myPicks, game.lastTopPicksSelf, syl);
    if (!game.myTurn) {
      clickableWords(specList, game.spectatorSuggestions, game.lastSpectatorSyllable || "");
    } else {
      specList.textContent = "(you are playing)";
    }

    noteSelf._show(buildNotice("self"));
    noteSpec._show(buildNotice("spectator"));
  }

  const iv = setInterval(render, 160);
  window.addEventListener("beforeunload", () => clearInterval(iv));

  document.body.appendChild(wrap);
  return { render };
}

async function setupBuddy() {
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("content/injected.js");
  s.onload = function () { this.remove(); };
  document.body.appendChild(s);

  const game = new Game(getInput());
  setTimeout(() => (game.input = getInput()), 1000);

  const { render } = createOverlay(game);

  window.addEventListener("message", async (event) => {
    if (!event.origin.endsWith("jklm.fun")) return;
    const data = event.data;

    if ("myTurn" in data) game.myTurn = data.myTurn;

    if (data.type === "setup") {
      await game.setLang(data.language);
      if (data.myTurn) {
        game.syllable = data.syllable;
        game.selfRound = (game.selfRound|0) + 1;
        game.lastTopPicksSelf = game.getTopCandidates(data.syllable, game.suggestionsLimit, "self");
        if (!game.paused) game.playTurn();
      } else {
        game.spectatorRound = (game.spectatorRound|0) + 1;
        game.generateSpectatorSuggestions(data.syllable, game.suggestionsLimit);
      }
      render();
    } else if (data.type === "correctWord") {
      game.onCorrectWord(data.word);
      render();
    } else if (data.type === "failWord") {
      game.onFailedWord(!!data.myTurn, data.word, data.reason);
      render();
    } else if (data.type === "nextTurn") {
      if (data.myTurn) {
        game.syllable = data.syllable;
        game.selfRound = (game.selfRound|0) + 1;
        game.lastTopPicksSelf = game.getTopCandidates(data.syllable, game.suggestionsLimit, "self");
        if (!game.paused) game.playTurn();
      } else {
        game.spectatorRound = (game.spectatorRound|0) + 1;
        game.generateSpectatorSuggestions(data.syllable, game.suggestionsLimit);
      }
      render();
    }
  });

  window.addEventListener("keydown", function (ev) {
    if (!ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (k === "w") game.togglePause();
    else if (k === "arrowup") game.setSpeed(Math.min(12, game.speed+1));
    else if (k === "arrowdown") game.setSpeed(Math.max(1, game.speed-1));
    else if (k === "f") game.toggleFoulMode();
    else if (k === "c") game.toggleCoverageMode();
    else if (k === "s") game.toggleAutoSuicide();
    else if (k === "b") game.toggleMistakes();
    else if (k === "r") game.resetCoverage();
    else if (k === "t") game.toggleLengthMode();
  });
}

if (isBombPartyFrame()) setupBuddy();
