const LANGS = {
  "Brazilian Portuguese": "pt-br",
  Breton: "br",
  English: "en",
  French: "fr",
  German: "de",
  Nahuatl: "nah",
  "Pokemon": "pok-en",
  "Pokémon (French)": "pok-fr",
  "Pokemon (German)": "pok-de",
  Spanish: "es",
};

class Game {
  static getKeyNeighbours(lang) {
    const keyNeighbours = {
      en: {
        a:["q","w","s","z"], b:["g","h","v","n"], c:["d","f","x","v"],
        d:["e","r","s","f","x","c"], e:["w","r","s","d"],
        f:["r","t","d","g","c","v"], g:["t","y","f","h","v","b"],
        h:["y","u","g","j","b","n"], i:["u","o","j","k"],
        j:["u","i","h","k","n","m"], k:["i","o","j","l","m"],
        l:["o","p","k"], m:["j","k","n"], n:["h","j","b","m"],
        o:["i","p","k","l"], p:["o","l"], q:["w","a"],
        r:["e","t","d","f"], s:["w","e","a","d","z","x"],
        t:["r","y","f","g"], u:["y","i","h","j"],
        v:["f","g","c","b"], w:["q","e","a","s"],
        x:["s","d","z","c"], y:["t","u","g","h"], z:["a","s","x"],
      },
    };
    return keyNeighbours[lang] || keyNeighbours.en;
  }

  constructor(inputNode) {
    this.input = inputNode;

    // core
    this.paused = false;        // AutoType
    this.speed = 3;             // 1..12
    this.myTurn = false;

    // self modes
    this.coverageMode = false;
    this.mistakesEnabled = true;
    this.foulMode = false;
    this.autoSuicide = false;

    // target length (self)
    this.lengthMode = false;
    this.targetLen = 8;

    // spectator options (independent)
    this.specFoulMode = false;
    this.specLengthMode = false;
    this.specTargetLen = 8;

    // suggestions + delay
    this.suggestionsLimit = 5;    // 1..10
    this.thinkingDelaySec = 0;    // 0..5

    // weighted coverage goals (0 = exclude)
    this.coverageCounts = new Array(26).fill(0);
    this.targetCounts   = new Array(26).fill(1);
    this.excludeEnabled = false;
    this.excludeSpec    = "xz";
    this.updateTargetsFromSpec(this.excludeSpec);

    // words
    this.words = [];
    this.wordMask = new Map();
    this.foulWords = [];
    this.foulSet = new Set();

    // caches
    this.lastChosenWord = "";
    this.currentBaseWord = "";
    this.lastSubmittedWord = "";
    this.lastTopPicksSelf = [];
    this.spectatorSuggestions = [];
    this.lastTopPicksSpectator = [];
    this.lastSpectatorSyllable = "";

    // notices (round-scoped)
    this.selfRound = 0;
    this.spectatorRound = 0;
    this.flagsRoundSelf = -1;
    this.flagsRoundSpectator = -1;
    this.lastFoulFallbackSelf = false;
    this.lastFoulFallbackSpectator = false;
    this.lastLenFallbackSelf = false;
    this.lastLenFallbackSpectator = false;
    this.lastLenSuppressedByFoulSelf = false;
    this.lastLenSuppressedByFoulSpectator = false;
    this.lastLenCapAppliedSelf = false;
    this.lastLenCapAppliedSpectator = false;
    this.lastLenCapRelaxedSelf = false;
    this.lastLenCapRelaxedSpectator = false;

    // premessage / postfix
    this.preMsgEnabled = false;
    this.preMsgText = "";
    this.postfixEnabled = false;
    this.postfixText = "";

    // typing cancel token
    this.turnToken = 0;

    this.#updateIcon();
  }

  #updateIcon() {
    chrome.runtime.sendMessage({
      type: "updateIcon",
      status: this.paused ? "OFF" : "ON",
    });
  }

  // settings/toggles
  togglePause(){ this.paused = !this.paused; this.#updateIcon(); if (!this.paused && this.myTurn) this.playTurn(); }
  setSpeed(n){ this.speed = Math.max(1, Math.min(12, n|0)); }

  toggleCoverageMode(){ this.coverageMode = !this.coverageMode; }
  toggleMistakes(){ this.mistakesEnabled = !this.mistakesEnabled; }
  toggleFoulMode(){ this.foulMode = !this.foulMode; }
  toggleAutoSuicide(){ this.autoSuicide = !this.autoSuicide; }

  toggleLengthMode(){ this.lengthMode = !this.lengthMode; }
  setTargetLen(n){ this.targetLen = Math.max(1, Math.min(30, n|0)); }

  toggleSpecFoul(){ this.specFoulMode = !this.specFoulMode; }
  toggleSpecLength(){ this.specLengthMode = !this.specLengthMode; }
  setSpecTargetLen(n){ this.specTargetLen = Math.max(1, Math.min(30, n|0)); }

  setSuggestionsLimit(n){ this.suggestionsLimit = Math.max(1, Math.min(10, n|0)); }
  setThinkingDelaySec(x){ this.thinkingDelaySec = Math.max(0, Math.min(5, Number(x) || 0)); }

  setExcludeEnabled(v){ this.excludeEnabled = !!v; }
  setExcludeSpec(str){ this.excludeSpec = String(str || ""); this.updateTargetsFromSpec(this.excludeSpec); }
  resetCoverage(){ this.coverageCounts.fill(0); }

  setPreMsgEnabled(v){ this.preMsgEnabled = !!v; }
  setPreMsgText(s){ this.preMsgText = s || ""; }
  setPostfixEnabled(v){ this.postfixEnabled = !!v; }
  setPostfixText(s){ this.postfixText = s || ""; }

  // coverage parsing
  updateTargetsFromSpec(specText) {
    // default: every letter needs 1
    this.targetCounts.fill(1);

    const spec = (specText || "").toLowerCase().trim();
    if (!spec) return;

    const parts = spec.split(/[\s,]+/).filter(Boolean);

    // majorityN / mojorityN (typo tolerated)
    const majTok = parts.find(t => /^maj(or)?ity\d{1,2}$/.test(t) || /^mojority\d{1,2}$/.test(t));
    if (majTok) {
      const m = majTok.match(/\d{1,2}$/);
      const def = Math.max(0, Math.min(99, parseInt(m[0], 10)));
      this.targetCounts.fill(def);
    }

    // tokens with explicit counts (a3, f2, z0)
    for (const tok of parts) {
      const m = tok.match(/^([a-z])(\d{1,2})$/);
      if (m) {
        const idx = m[1].charCodeAt(0) - 97;
        const times = Math.max(0, Math.min(99, parseInt(m[2],10)));
        if (idx >= 0 && idx < 26) this.targetCounts[idx] = times;
      }
    }

    // legacy exclude letters (just letters => 0)
    for (const tok of parts) {
      if (/^[a-z]+$/.test(tok)) {
        for (const ch of tok) {
          const i = ch.charCodeAt(0) - 97;
          if (i >= 0 && i < 26) this.targetCounts[i] = 0;
        }
      }
    }
  }

  static lettersMask(word) {
    let mask = 0;
    for (let i = 0; i < word.length; i++) {
      const ch = word.charCodeAt(i);
      if (ch >= 97 && ch <= 122) mask |= 1 << (ch - 97);
    }
    return mask;
  }

  coveredLettersList() {
    const out = [];
    for (let i = 0; i < 26; i++) {
      const target = this.excludeEnabled ? this.targetCounts[i] : 1;
      if (target <= 0) continue;
      const have = Math.min(this.coverageCounts[i], target);
      if (have > 0) out.push(`${String.fromCharCode(97+i)}(${have}/${target})`);
    }
    return out;
  }
  remainingLettersList() {
    const out = [];
    for (let i = 0; i < 26; i++) {
      const target = this.excludeEnabled ? this.targetCounts[i] : 1;
      if (target <= 0) continue;
      const have = Math.min(this.coverageCounts[i], target);
      if (have < target) out.push(`${String.fromCharCode(97+i)}(${have}/${target})`);
    }
    return out;
  }

  // wordlists
  async setLang(language) {
    if (!(language in LANGS)) { this.lang = ""; return; }
    this.used = {};
    if (this.words.length && this.lang === LANGS[language]) return;

    this.lang = LANGS[language];
    this.words = await Game.getWords(this.lang);

    this.wordMask.clear();
    for (const w of this.words) this.wordMask.set(w, Game.lettersMask(w.toLowerCase()));

    this.foulWords = [];
    this.foulSet.clear();
    if (this.lang === "en") {
      try {
        const foulUrl = chrome.runtime.getURL("words/foul-words-en.txt");
        const fres = await fetch(foulUrl);
        if (fres.ok) {
          const ftext = await fres.text();
          this.foulWords = ftext.split("\n").map(x => x.trim()).filter(Boolean);
          this.foulSet = new Set(this.foulWords);
        }
      } catch (e) {
        console.warn("[Buddy] Could not load foul-words-en.txt", e);
      }
    }
  }

  static async getWords(lang) {
    try {
      const url = chrome.runtime.getURL(`words/${lang}.txt`);
      const res = await fetch(url);
      const text = await res.text();
      return text.split("\n").map(w => w.trim()).filter(Boolean);
    } catch { return []; }
  }

  // candidate pools
  baseCandidatesForPrompt(syllable) {
    const list = this.words || [];
    const syl = (syllable || "").toLowerCase();
    return list.filter(w => !this.used[w] && w.toLowerCase().includes(syl));
  }
  foulCandidatesForPrompt(syllable) {
    if (!(this.lang === "en" && this.foulWords.length)) return [];
    const syl = (syllable || "").toLowerCase();
    return this.foulWords.filter(w => !this.used[w] && w.toLowerCase().includes(syl));
  }

  static tieBreakScore(word, seed) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < word.length; i++) { h ^= word.charCodeAt(i); h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); }
    h ^= seed * 2654435761;
    return h >>> 0;
  }

  coverageScore(word) {
    const mask = this.wordMask.get(word) || 0;
    let score = 0;
    for (let i = 0; i < 26; i++) {
      const need = (this.excludeEnabled ? this.targetCounts[i] : 1);
      if (need <= 0) continue;
      if (!(mask & (1 << i))) continue;
      if (this.coverageCounts[i] < need) score++;
    }
    return score;
  }

  applyLengthFilterWithProgressiveFallback(pool, target) {
    const tl = target|0;
    const tryLen = (L) => pool.filter(w => w.length === L);
    let found = tryLen(tl);
    let delta = 1;
    while (!found.length && (tl - delta > 0 || tl + delta <= 30)) {
      const a = tl - delta > 0 ? tryLen(tl - delta) : [];
      const b = tryLen(tl + delta);
      found = [...a, ...b];
      delta++;
    }
    return found.length ? found : pool;
  }

  getTopCandidates(syllable, limit, context /* 'self'|'spectator' */) {
    const round = (context === "self") ? this.selfRound : this.spectatorRound;
    const seed = round || 1;

    // reset per-round flags
    if (context === "self") {
      this.flagsRoundSelf = round;
      this.lastFoulFallbackSelf = false;
      this.lastLenFallbackSelf = false;
      this.lastLenSuppressedByFoulSelf = false;
      this.lastLenCapAppliedSelf = false;
      this.lastLenCapRelaxedSelf = false;
    } else {
      this.flagsRoundSpectator = round;
      this.lastFoulFallbackSpectator = false;
      this.lastLenFallbackSpectator = false;
      this.lastLenSuppressedByFoulSpectator = false;
      this.lastLenCapAppliedSpectator = false;
      this.lastLenCapRelaxedSpectator = false;
    }

    const base = this.baseCandidatesForPrompt(syllable);
    const foulAvail = this.foulCandidatesForPrompt(syllable);

    // precedence: Foul → Coverage → Normal (length rules per context)
    let pool = base;
    let foulUsed = false;

    if (context === "self") {
      if (this.foulMode && foulAvail.length) { pool = foulAvail; foulUsed = true; }
      else if (this.foulMode && !foulAvail.length) { this.lastFoulFallbackSelf = true; }

      if (this.lengthMode) {
        if (this.coverageMode) {
          const capped = pool.filter(w => w.length <= this.targetLen);
          const hasCap = capped.length > 0;
          this.lastLenCapAppliedSelf = hasCap;
          this.lastLenCapRelaxedSelf = !hasCap;
          pool = hasCap ? capped : pool;
        } else {
          if (!foulUsed) {
            const lenApplied = this.applyLengthFilterWithProgressiveFallback(pool, this.targetLen);
            const hadExact = lenApplied.some(w => w.length === this.targetLen);
            if (!hadExact) this.lastLenFallbackSelf = true;
            pool = lenApplied.length ? lenApplied : pool;
          } else {
            this.lastLenSuppressedByFoulSelf = true;
          }
        }
      }

      if (this.coverageMode && !foulUsed) {
        pool = [...pool].sort((a, b) => {
          const sa = this.coverageScore(a), sb = this.coverageScore(b);
          if (sb !== sa) return sb - sa;
          if (b.length !== a.length) return b.length - a.length;
          return Game.tieBreakScore(b,seed) - Game.tieBreakScore(a,seed);
        });
      } else {
        pool = [...pool].sort((a, b) => {
          if (b.length !== a.length) return b.length - a.length;
          return Game.tieBreakScore(b,seed) - Game.tieBreakScore(a,seed);
        });
      }
    } else {
      // spectator: own foul/length; (no coverage here)
      if (this.specFoulMode && foulAvail.length) { pool = foulAvail; foulUsed = true; }
      else if (this.specFoulMode && !foulAvail.length) { this.lastFoulFallbackSpectator = true; }

      if (this.specLengthMode) {
        if (!foulUsed) {
          const lenApplied = this.applyLengthFilterWithProgressiveFallback(pool, this.specTargetLen);
          const hadExact = lenApplied.some(w => w.length === this.specTargetLen);
          if (!hadExact) this.lastLenFallbackSpectator = true;
          pool = lenApplied.length ? lenApplied : pool;
        } else {
          this.lastLenSuppressedByFoulSpectator = true;
        }
      }

      pool = [...pool].sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return Game.tieBreakScore(b,seed) - Game.tieBreakScore(a,seed);
      });
    }

    return pool.slice(0, limit);
  }

  // NEW: spectator suggestions helper
  generateSpectatorSuggestions(syllable, limit) {
    this.lastSpectatorSyllable = syllable || "";
    this.lastTopPicksSpectator = this.getTopCandidates(syllable, limit, "spectator");
    this.spectatorSuggestions = this.lastTopPicksSpectator.slice();
    return this.spectatorSuggestions;
  }

  sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  async typeCharWithMistakes(correctCh) {
    const ch = correctCh;
    const neighbours = Game.getKeyNeighbours(this.lang)[ch];
    const delay = () => Math.random() * 800 / this.speed;

    const mistake = this.mistakesEnabled && neighbours && Math.random() < 0.10;
    if (mistake) {
      const wrong = neighbours[Math.floor(Math.random()*neighbours.length)];
      this.input.value += wrong;
      this.input.dispatchEvent(new InputEvent("input"));
      await this.sleep(delay());
      this.input.value = this.input.value.slice(0, -1);
      this.input.dispatchEvent(new InputEvent("input"));
      await this.sleep(delay());
    }

    this.input.value += ch;
    this.input.dispatchEvent(new InputEvent("input"));
    await this.sleep(delay());
  }

  async typeSequenceText(text) {
    const s = String(text || "");
    for (let i = 0; i < s.length; i++) {
      await this.typeCharWithMistakes(s[i]);
    }
  }

  // main turn
  async playTurn() {
    if (this.paused || !this.lang) return;

    const token = ++this.turnToken;

    if (this.autoSuicide) {
      this.lastTopPicksSelf = ["/suicide"];
      this.lastChosenWord = "/suicide";
      const d = Math.max(0, Math.min(5, this.thinkingDelaySec));
      if (d) await this.sleep(d*1000);
      if (this.turnToken !== token) return;
      await this.typeSequenceText("/suicide");
      if (this.turnToken !== token) return;
      this.lastSubmittedWord = "/suicide";
      this.input.parentNode.requestSubmit();
      return;
    }

    // picks
    this.lastTopPicksSelf = this.getTopCandidates(this.syllable, this.suggestionsLimit, "self");
    const word = this.lastTopPicksSelf[0];
    if (!word) return;

    this.lastChosenWord = word;
    this.currentBaseWord = word;

    // premessage: type now (speed+mistakes), then wait thinking delay, clear at once
    if (this.preMsgEnabled && this.preMsgText) {
      await this.typeSequenceText(this.preMsgText);
      if (this.turnToken !== token) return;
    }

    const d = Math.max(0, Math.min(5, this.thinkingDelaySec));
    if (d) { await this.sleep(d*1000); if (this.turnToken !== token) return; }

    if (this.preMsgEnabled && this.preMsgText) {
      this.input.value = "";
      this.input.dispatchEvent(new InputEvent("input"));
      await this.sleep(30);
      if (this.turnToken !== token) return;
    }

    // type the word
    this.used[word] = 1;
    await this.sleep(Math.random() * 100 + 1000 / this.speed);
    if (this.turnToken !== token) return;
    await this.typeSequenceText(word);
    if (this.turnToken !== token) return;

    if (this.postfixEnabled && this.postfixText) {
      await this.typeSequenceText(this.postfixText);
      if (this.turnToken !== token) return;
    }

    this.lastSubmittedWord = String(this.currentBaseWord || "").trim().toLowerCase();
    this.input.parentNode.requestSubmit();
  }

  onCorrectWord(word) {
    if (!word) return;
    const accepted = String(word).trim().toLowerCase();
    if (accepted !== this.lastSubmittedWord) return;

    if (this.coverageMode) {
      const mask = this.wordMask.get(word) ?? Game.lettersMask(accepted);
      for (let i = 0; i < 26; i++) {
        const need = (this.excludeEnabled ? this.targetCounts[i] : 1);
        if (need <= 0) continue;
        if (mask & (1<<i)) {
          this.coverageCounts[i] = Math.min(need, this.coverageCounts[i] + 1);
        }
      }
      // all goals satisfied? reset
      let allDone = true;
      for (let i = 0; i < 26; i++) {
        const need = (this.excludeEnabled ? this.targetCounts[i] : 1);
        if (need > 0 && this.coverageCounts[i] < need) { allDone = false; break; }
      }
      if (allDone) this.coverageCounts.fill(0);
    }
  }

  async onFailedWord(myTurn, failedWord, reason) {
    try {
      if (this.words && this.words.includes(failedWord) && reason == "notInDictionary") {
        const invalids = (await chrome.storage.local.get(`invalid:${this.lang}`))[`invalid:${this.lang}`] || [];
        invalids.push(failedWord);
        await chrome.storage.local.set({ [`invalid:${this.lang}`]: invalids });
        const lastSent = (await chrome.storage.local.get("lastSent:invalid"))["lastSent:invalid"];
        if (!lastSent || Date.now() - lastSent > 24 * 60 * 60 * 1000) {
          await chrome.storage.local.set({ "lastSent:invalid": Date.now() });
          fetch("https://api.nitrofun.eu/bombpartybuddy/report/invalid", {
            method: "POST",
            body: JSON.stringify({ [this.lang]: Array.from(new Set(invalids)) }),
            headers: { "Content-Type": "application/json" },
          }).catch(()=>{});
        }
      }
    } catch {}
    if (myTurn) this.playTurn();
  }

  static highlightSyllable(word, syllable) {
    if (!word) return "";
    const w = String(word);
    const syl = String(syllable || "");
    if (!syl) return w;
    const idx = w.toLowerCase().indexOf(syl.toLowerCase());
    if (idx < 0) return w;
    const pre = w.slice(0, idx);
    const mid = w.slice(idx, idx + syl.length);
    const post = w.slice(idx + syl.length);
    return `${pre}<b style="font-size:110%">${mid.toUpperCase()}</b>${post}`;
  }
}
