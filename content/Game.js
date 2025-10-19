/* Game.js - Bomb Party Shark
   - Loads word lists from LitShark API via background proxy (no CORS)
   - Coverage scoring prefers words that complete the most tallies:
       * counts how many still-needed letters a word covers
       * extra bonus for letters that are one-away (need==1)
       * rarity weighting (letters that appear in fewer words are weighted higher)
   - Exclusion/goals only affect tallying (not candidate filtering)
   - Retry next best candidate on invalid word (my turn)
   - Submit is robust (focus + input + keydown/keypress/keyup Enter)
   - Postfix ignored when auto-suicide is on
   - Butterfingers aggressiveness slider controls typo probability
   - Speed slider: slowest is slower now, fastest unchanged-ish
*/
const WORD_CACHE = new Map();
const WORD_CACHE_LOADING = new Map();
const WORD_CACHE_TTL_MS = 5 * 60 * 1000;

const LANGUAGE_LABELS = Object.freeze({
  "en": { short: "EN", name: "English" },
  "de": { short: "DE", name: "Deutsch" },
  "fr": { short: "FR", name: "Français" },
  "es": { short: "ES", name: "Español" },
  "pt-br": { short: "PT", name: "Português (Brasil)" },
  "nah": { short: "NAH", name: "Nahuatl" },
  "pok-en": { short: "PokEN", name: "Pokémon (EN)" },
  "pok-fr": { short: "PokFR", name: "Pokémon (FR)" },
  "pok-de": { short: "PokDE", name: "Pokémon (DE)" }
});

function pushWordCandidate(output, seen, candidate) {
  const word = (candidate ?? "").toString().trim().toLowerCase();
  if (!word || seen.has(word)) return;
  seen.add(word);
  output.push(word);
}

function toWordArrayFromText(text) {
  const out = [];
  const seen = new Set();
  if (!text) return out;
  const trimmed = text.trim();
  if (!trimmed) return out;
  const firstChar = trimmed[0];
  if (firstChar === '[' || firstChar === '{') {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.words)
          ? parsed.words
          : [];
      for (const candidate of arr) pushWordCandidate(out, seen, candidate);
      if (out.length) return out;
    } catch (err) {
      console.warn('[BombPartyShark] Failed to parse word payload as JSON, falling back to newline list.', err);
    }
  }
  for (const line of text.split(/\r?\n/)) {
    pushWordCandidate(out, seen, line);
  }
  return out;
}

class Game {
  constructor(inputEl) {
    this.input = inputEl;

    // Word data
    this.lang = "en";
    this.words = [];
    this.foulWords = [];
    this.foulSet = new Set();
    this.pokemonWords = [];
    this.mineralWords = [];
    this.rareWords = [];

    // Per-letter rarity weights for coverage scoring
    this.letterWeights = new Array(26).fill(1);

    // Modes
    this.paused = false;
    this.instantMode = false;
    this.foulMode = false;
    this.coverageMode = false;
    this.mistakesEnabled = false;
    this.superRealisticEnabled = false;
    this.autoSuicide = false;
    this.autoJoinAlways = false;
    this.hyphenMode = false;
    this.containsMode = false;
    this.containsText = "";
    this.pokemonMode = false;
    this.mineralsMode = false;
    this.rareMode = false;

    // Length (self)
    this.lengthMode = false;
    this.targetLen = 8;
    this.targetLenPref = 8;

    // Spectator modes
    this.specLengthMode = false;
    this.specTargetLen = 8;
    this.specTargetLenPref = 8;
    this.specFoulMode = false;
    this.specHyphenMode = false;
    this.specContainsMode = false;
    this.specContainsText = "";
    this.specPokemonMode = false;
    this.specMineralsMode = false;
    this.specRareMode = false;

    // Suggestions
    this.suggestionsLimit = 5;

    // Priority order (highest priority first)
    this.priorityOrder = ["contains", "foul", "coverage", "hyphen", "length"];

    // Timing
    this.speed = 5;               // 1..12 (fastest unchanged; slowest slower)
    this.thinkingDelaySec = 0.0;  // 0..5
    this.superRealisticAggression = 0.25; // 0..1 probability per word
    this.superRealisticPauseSec = 0.6;    // pause duration for realistic stop

    // Butterfingers
    this.mistakesProb = 0.08;     // 0..0.30 (set by slider)

    // Messages
    this.preMsgEnabled = false;
    this.preMsgText = "";
    this.postfixEnabled = false;
    this.postfixText = "";

    // Turn state
    this.myTurn = false;
    this.syllable = "";
    this.selfRound = 0;
    this.spectatorRound = 0;

    // Round-local failure blacklist + last pool
    this._roundFailed = new Set();
    this._roundPool = [];
    this._roundCandidatesDetailed = [];
    this._roundSelectionContext = null;

    // Notice flags (for HUD messages)
    this.flagsRoundSelf = 0;
    this.flagsRoundSpectator = 0;
    this.lastFoulFallbackSelf = false;
    this.lastLenFallbackSelf = false;
    this.lastLenCapAppliedSelf = false;
    this.lastLenCapRelaxedSelf = false;
    this.lastLenSuppressedByFoulSelf = false;
    this.lastContainsFallbackSelf = false;
    this.lastHyphenFallbackSelf = false;
    this.lastPokemonFallbackSelf = false;
    this.lastMineralsFallbackSelf = false;
    this.lastRareFallbackSelf = false;
    this.lastReuseFilteredSelf = false;
    this.lastReuseFallbackSelf = false;
    this.lastFoulFallbackSpectator = false;
    this.lastLenFallbackSpectator = false;
    this.lastLenCapAppliedSpectator = false;
    this.lastLenCapRelaxedSpectator = false;
    this.lastLenSuppressedByFoulSpectator = false;
    this.lastContainsFallbackSpectator = false;
    this.lastHyphenFallbackSpectator = false;
    this.lastPokemonFallbackSpectator = false;
    this.lastMineralsFallbackSpectator = false;
    this.lastRareFallbackSpectator = false;
    this.lastReuseFilteredSpectator = false;
    this.lastReuseFallbackSpectator = false;

    // Coverage / goals
    this.coverageCounts = new Array(26).fill(0);
    this.excludeEnabled = false;
    this.excludeSpec = "x0 z0";       // default goals: treat x,z as 0
    this.targetCounts = new Array(26).fill(1);
    this._targetsManualOverride = false;

    // Tallies persistence hook
    this._onTalliesChanged = null;

    // HUD lists
    this.lastTopPicksSelf = [];
    this.lastTopPicksSelfDisplay = [];
    this.spectatorSuggestions = [];
    this.spectatorSuggestionsDisplay = [];
    this.lastSpectatorSyllable = "";

    // Word reuse prevention
    this.preventReuseEnabled = true;
    this.usedWordSet = new Set();
    this.usedWordLog = [];
    this.maxWordLogEntries = 200;

    this.maxWordLength = 0;

    // Submission watchdog (retries when the game swallows a word)
    this._pendingSubmission = null;
    this._pendingSubmissionTimer = null;
    this._pendingSubmissionRetryDelayMs = 1000;

    // Event hooks
    this._onWordLogChanged = null;

    // Typing coordination
    this._activeTypingToken = null;

    // Back-compat
    this._typeAndSubmit = this.typeAndSubmit.bind(this);

    this._lastLoadedLang = null;
  }

  setMyTurn(isMine) {
    const prev = !!this.myTurn;
    const next = !!isMine;
    this.myTurn = next;
    if (prev && !next) {
      this._clearPendingSubmission();
    }
  }

  apiBase() { return "https://extensions.litshark.ca/api"; }

  normalizeLang(name) {
    const rawValue = (name ?? "").toString().trim();
    if (!rawValue) return "en";

    const lowered = rawValue.toLowerCase();
    const cleaned = lowered.replace(/[<>]/g, "").replace(/_/g, "-").replace(/\s+/g, " ").trim();
    const withoutTrailing = cleaned.replace(/\s*(?:\(main\)|main|default|list)$/g, "").trim();

    const map = {
      "english": "en", "en": "en",
      "german": "de", "de": "de",
      "french": "fr", "fr": "fr",
      "spanish": "es", "es": "es",
      "espanol": "es", "español": "es",
      "portuguese": "pt-br", "português": "pt-br",
      "portuguese (br)": "pt-br", "portuguese (brasil)": "pt-br",
      "português (br)": "pt-br", "português (brasil)": "pt-br",
      "portugues (brasil)": "pt-br", "portugues brasil": "pt-br",
      "portugues brasileiro": "pt-br", "português brasileiro": "pt-br",
      "portuguese (brazil)": "pt-br", "portuguese brazil": "pt-br",
      "portuguese brazilian": "pt-br", "brazilian portuguese": "pt-br",
      "pt-br": "pt-br", "pt": "pt-br", "ptbr": "pt-br", "pt-brasil": "pt-br",
      "pt br": "pt-br",
      "br": "pt-br", "brasil": "pt-br", "brazil": "pt-br",
      "nahuatl": "nah", "nah": "nah",
      "pokemon (en)": "pok-en", "pok-en": "pok-en",
      "pokemon (fr)": "pok-fr", "pok-fr": "pok-fr",
      "pokemon (de)": "pok-de", "pok-de": "pok-de"
    };

    const candidates = [cleaned, withoutTrailing, lowered.replace(/_/g, "-"), lowered];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const hit = map[candidate];
      if (hit) return hit;
    }

    if (/^pt(?:\b|-)/.test(cleaned) || cleaned.includes("portugu")) return "pt-br";
    if (cleaned.includes("brazil") && cleaned.includes("portu")) return "pt-br";

    return map[cleaned] || map[lowered] || "en";
  }

  languageInfo(lang = this.lang) {
    const key = (lang || "en").toLowerCase();
    return LANGUAGE_LABELS[key] || LANGUAGE_LABELS.en;
  }

  languageDisplayName(lang = this.lang) {
    return this.languageInfo(lang).name;
  }

  languageShortCode(lang = this.lang) {
    return this.languageInfo(lang).short;
  }

  async setLang(lang) {
    const normalized = this.normalizeLang(lang);
    const previousLang = this._lastLoadedLang;
    const previousActive = this.lang;
    const changed = !previousLang || previousLang !== normalized;
    this.lang = normalized;

    try {
      await this.loadWordlists();
      if (changed) {
        this.resetCoverage();
        this.resetWordLog();
      }
    } catch (err) {
      console.error('[BombPartyShark] Failed to load word lists for', normalized, err);
      const fallback = this.normalizeLang(previousLang || previousActive || 'en');
      this.lang = fallback;
      throw err;
    }
  }

  // ---- background fetch/post (avoids CORS) ----
  async extFetch(url) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: "extFetch", url }, (resp) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          if (!resp || resp.error) return reject(new Error(resp?.error || "No response"));
          resolve(resp.text || "");
        });
      } catch (e) { reject(e); }
    });
  }
  async extPost(url, body) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: "extPost", url, body }, (resp) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          if (!resp || resp.error) return reject(new Error(resp?.error || "No response"));
          resolve(resp.text || "");
        });
      } catch (e) { reject(e); }
    });
  }


  async loadWordlists() {
    const lang = this.lang;
    const cached = WORD_CACHE.get(lang);
    const now = Date.now();
    if (cached && (now - cached.fetchedAt) < WORD_CACHE_TTL_MS) {
      this._applyWordData(cached);
      return;
    }

    let loadPromise = WORD_CACHE_LOADING.get(lang);
    if (!loadPromise) {
      loadPromise = this._fetchWordData(lang)
        .then((data) => {
          WORD_CACHE.set(lang, data);
          WORD_CACHE_LOADING.delete(lang);
          return data;
        })
        .catch((err) => {
          WORD_CACHE_LOADING.delete(lang);
          throw err;
        });
      WORD_CACHE_LOADING.set(lang, loadPromise);
    }

    try {
      const data = await loadPromise;
      this._applyWordData(data);
    } catch (err) {
      if (cached) {
        console.warn('[BombPartyShark] Falling back to cached word data for', lang, err);
        this._applyWordData(cached);
        return;
      }
      throw err;
    }
  }
  async _fetchWordData(lang) {
    const base = this.apiBase();
    const mainUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=main`;
    const foulUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=foul`;
    const pokemonUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=pok`;
    const mineralsUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=minerals`;
    const rareUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=rare`;

    let mainTxt = '';
    let foulTxt = '';
    let pokemonTxt = '';
    let mineralsTxt = '';
    let rareTxt = '';

    try {
      mainTxt = await this.extFetch(mainUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load main word list from API for', lang, err);
    }

    try {
      foulTxt = await this.extFetch(foulUrl);
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err || '');
      if (msg.includes('404')) {
        console.info(`[BombPartyShark] No foul word list available from API for ${lang}; continuing with main list suggestions.`);
      } else {
        console.warn('[BombPartyShark] Failed to load foul word list from API for', lang, err, '; continuing with main list suggestions.');
      }
    }

    try {
      pokemonTxt = await this.extFetch(pokemonUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load Pokémon word list from API for', lang, err, '; continuing with main list suggestions.');
    }

    try {
      mineralsTxt = await this.extFetch(mineralsUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load minerals word list from API for', lang, err, '; continuing with main list suggestions.');
    }

    try {
      rareTxt = await this.extFetch(rareUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load rare word list from API for', lang, err, '; continuing with main list suggestions.');
    }

    const words = toWordArrayFromText(mainTxt);
    if (!words.length) {
      throw new Error(`No word list available for language ${lang}`);
    }

    const foulWords = toWordArrayFromText(foulTxt);
    const pokemonWords = toWordArrayFromText(pokemonTxt);
    const mineralWords = toWordArrayFromText(mineralsTxt);
    const rareWords = toWordArrayFromText(rareTxt);

    const letterWeights = Game.computeLetterWeights(words);
    return {
      lang,
      words,
      foulWords,
      pokemonWords,
      mineralWords,
      rareWords,
      letterWeights,
      fetchedAt: Date.now()
    };
  }

  _applyWordData(data) {
    if (!data || !Array.isArray(data.words)) {
      throw new Error('Invalid word cache payload');
    }
    this.words = data.words.slice();
    this.foulWords = (data.foulWords || []).slice();
    this.pokemonWords = (data.pokemonWords || []).slice();
    this.mineralWords = (data.mineralWords || []).slice();
    this.rareWords = (data.rareWords || []).slice();
    this.foulSet = new Set(this.foulWords);
    this.letterWeights = (data.letterWeights || new Array(26).fill(1)).slice(0, 26);
    if (this.letterWeights.length < 26) {
      while (this.letterWeights.length < 26) this.letterWeights.push(1);
    }
    this._lastLoadedLang = data.lang;
    this.maxWordLength = this.words.reduce((max, word) => Math.max(max, (word || '').length || 0), 0);
    this.setTargetLen(this.targetLenPref ?? this.targetLen);
    this.setSpecTargetLen(this.specTargetLenPref ?? this.specTargetLen);
  }

  static computeLetterWeights(words) {
    const docFreq = new Array(26).fill(0);
    const totalWords = words.length || 1;
    for (const word of words) {
      const seen = new Set();
      for (let i = 0; i < word.length; i++) {
        const code = word.charCodeAt(i);
        if (code >= 97 && code <= 122) {
          const idx = code - 97;
          if (!seen.has(idx)) {
            docFreq[idx]++;
            seen.add(idx);
          }
        }
      }
    }

    const weights = new Array(26).fill(1);
    let sum = 0;
    for (let i = 0; i < 26; i++) {
      const freq = docFreq[i] / totalWords;
      const weight = 1 / Math.max(0.001, freq);
      weights[i] = weight;
      sum += weight;
    }
    const mean = sum / 26 || 1;
    for (let i = 0; i < 26; i++) {
      weights[i] = weights[i] / mean;
    }
    return weights;
  }
  // ---------- setters used by HUD ----------
  setSpeed(v) { this.speed = Math.max(1, Math.min(12, Math.floor(v))); }
  setThinkingDelaySec(v) { const n = Math.max(0, Math.min(5, Number(v))); this.thinkingDelaySec = isFinite(n) ? n : 0; }
  setSuggestionsLimit(v) { this.suggestionsLimit = Math.max(1, Math.min(20, Math.floor(v))); }
  toggleSuperRealistic() { this.superRealisticEnabled = !this.superRealisticEnabled; }
  setSuperRealisticAggression(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    this.superRealisticAggression = Math.max(0, Math.min(1, n));
  }
  setSuperRealisticPauseSec(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    this.superRealisticPauseSec = Math.max(0, Math.min(5, n));
  }

  togglePause() { this.paused = !this.paused; }
  toggleInstantMode() { this.instantMode = !this.instantMode; }
  toggleFoulMode() { this.foulMode = !this.foulMode; }
  toggleCoverageMode() { this.coverageMode = !this.coverageMode; }
  toggleMistakes() { this.mistakesEnabled = !this.mistakesEnabled; }
  toggleAutoSuicide() { this.autoSuicide = !this.autoSuicide; }
  toggleAutoJoinAlways() { this.autoJoinAlways = !this.autoJoinAlways; }
  setAutoJoinAlways(v) { this.autoJoinAlways = !!v; }
  toggleHyphenMode() { this.hyphenMode = !this.hyphenMode; }
  togglePokemonMode() { this.pokemonMode = !this.pokemonMode; }
  toggleMineralsMode() { this.mineralsMode = !this.mineralsMode; }
  toggleRareMode() { this.rareMode = !this.rareMode; }

  toggleLengthMode() { this.lengthMode = !this.lengthMode; }
  _normalizeTargetLenPref(value) {
    const pref = Math.max(3, Math.min(21, Math.floor(value)));
    if (pref === 21) {
      const fallback = Math.max(3, this.maxWordLength || 0);
      return { pref, actual: fallback > 0 ? fallback : 20 };
    }
    return { pref, actual: pref };
  }
  setTargetLen(n) {
    const { pref, actual } = this._normalizeTargetLenPref(Number.isFinite(n) ? n : this.targetLenPref);
    this.targetLenPref = pref;
    this.targetLen = actual;
  }
  toggleContainsMode() { this.containsMode = !this.containsMode; }
  setContainsText(t) { this.containsText = (t ?? ""); }

  toggleSpecLength() { this.specLengthMode = !this.specLengthMode; }
  setSpecTargetLen(n) {
    const { pref, actual } = this._normalizeTargetLenPref(Number.isFinite(n) ? n : this.specTargetLenPref);
    this.specTargetLenPref = pref;
    this.specTargetLen = actual;
  }
  toggleSpecFoul() { this.specFoulMode = !this.specFoulMode; }
  toggleSpecHyphenMode() { this.specHyphenMode = !this.specHyphenMode; }
  toggleSpecContainsMode() { this.specContainsMode = !this.specContainsMode; }
  setSpecContainsText(t) { this.specContainsText = (t ?? ""); }
  toggleSpecPokemonMode() { this.specPokemonMode = !this.specPokemonMode; }
  toggleSpecMineralsMode() { this.specMineralsMode = !this.specMineralsMode; }
  toggleSpecRareMode() { this.specRareMode = !this.specRareMode; }

  setPreMsgEnabled(b) { this.preMsgEnabled = !!b; }
  setPreMsgText(t) { this.preMsgText = (t || ""); }
  setPostfixEnabled(b) { this.postfixEnabled = !!b; }
  setPostfixText(t) { this.postfixText = (t || ""); }

  setMistakesProb(p) { // p is 0..0.30
    const n = Math.max(0, Math.min(0.30, Number(p)));
    this.mistakesProb = isFinite(n) ? n : 0.08;
  }

  priorityFeatures() { return ["contains", "foul", "coverage", "hyphen", "length"]; }

  _ensurePriorityOrder(order = this.priorityOrder) {
    const base = this.priorityFeatures();
    const seen = new Set();
    const final = [];
    if (Array.isArray(order)) {
      for (const key of order) {
        if (typeof key !== "string") continue;
        const lower = key.toLowerCase();
        if (!base.includes(lower)) continue;
        if (seen.has(lower)) continue;
        final.push(lower);
        seen.add(lower);
      }
    }
    for (const key of base) {
      if (!seen.has(key)) {
        final.push(key);
        seen.add(key);
      }
    }
    this.priorityOrder = final;
    return final;
  }

  setPriorityOrder(order) {
    this._ensurePriorityOrder(order);
  }

  setPriorityPosition(key, position) {
    const base = this.priorityFeatures();
    const normalized = (typeof key === "string" && base.includes(key.toLowerCase())) ? key.toLowerCase() : base[0];
    const order = this._ensurePriorityOrder().filter(item => item !== normalized);
    const idx = Math.max(0, Math.min(base.length - 1, Number.isFinite(position) ? Math.floor(position) : 0));
    order.splice(idx, 0, normalized);
    this.priorityOrder = order;
  }

  setExcludeEnabled(b) {
    this.excludeEnabled = !!b;
    if (!this._targetsManualOverride) this.recomputeTargets();
  }
  setExcludeSpec(spec) {
    this.excludeSpec = (spec || "");
    this._targetsManualOverride = false;
    this.recomputeTargets();
  }

  setTalliesChangedCallback(fn) {
    this._onTalliesChanged = typeof fn === 'function' ? fn : null;
  }

  _emitTalliesChanged() {
    if (typeof this._onTalliesChanged === 'function') {
      try { this._onTalliesChanged(); } catch (err) { console.warn('[BombPartyShark] tally listener failed', err); }
    }
  }

  setWordLogChangedCallback(fn) {
    this._onWordLogChanged = typeof fn === 'function' ? fn : null;
  }

  _emitWordLogChanged() {
    if (typeof this._onWordLogChanged === 'function') {
      try { this._onWordLogChanged(); } catch (err) { console.warn('[BombPartyShark] word log listener failed', err); }
    }
  }

  setPreventReuseEnabled(value) {
    this.preventReuseEnabled = !!value;
    this._emitWordLogChanged();
  }

  togglePreventReuse() {
    this.setPreventReuseEnabled(!this.preventReuseEnabled);
  }

  resetWordLog() {
    this.usedWordSet.clear();
    this.usedWordLog = [];
    this._emitWordLogChanged();
  }

  getRecentWordLog(limit = 20) {
    const lim = Math.max(1, Math.floor(limit));
    if (!this.usedWordLog.length) return [];
    return this.usedWordLog.slice(-lim);
  }

  _normalizeWordForLog(word) {
    const raw = (word || '').toString();
    const trimmed = raw.trim();
    if (!trimmed) return null;
    let display = trimmed;
    let lower = trimmed.toLowerCase();
    if (this.postfixEnabled && this.postfixText) {
      const postfix = this.postfixText;
      const postfixLower = postfix.toLowerCase();
      if (postfixLower && lower.endsWith(postfixLower)) {
        const sliced = trimmed.slice(0, trimmed.length - postfix.length).trim();
        if (sliced) {
          display = sliced;
          lower = sliced.toLowerCase();
        }
      }
    }
    return { normalized: lower, display };
  }

  _rememberWordUsage(word, meta = {}) {
    const raw = (word || '').toString();
    const normalized = raw.trim().toLowerCase();
    if (!normalized) return;
    this.usedWordSet.add(normalized);
    const entry = {
      word: meta.displayWord !== undefined ? meta.displayWord : raw,
      lower: normalized,
      fromSelf: !!meta.fromSelf,
      outcome: meta.outcome || 'unknown',
      ts: Date.now()
    };
    this.usedWordLog.push(entry);
    if (this.usedWordLog.length > this.maxWordLogEntries) {
      this.usedWordLog.splice(0, this.usedWordLog.length - this.maxWordLogEntries);
    }
    this._emitWordLogChanged();
  }
  resetCoverage() { this.coverageCounts.fill(0); this._roundFailed.clear(); this._emitTalliesChanged(); }

  setCoverageCount(idx, value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return;
    if (idx < 0 || idx >= 26) return;
    const target = Math.max(0, this.targetCounts[idx] || 0);
    const max = target;
    const clamped = Math.max(0, Math.min(max, n));
    this.coverageCounts[idx] = clamped;
    this._emitTalliesChanged();
  }

  adjustCoverageCount(idx, delta) {
    const current = this.coverageCounts[idx] || 0;
    this.setCoverageCount(idx, current + delta);
  }

  setTargetCount(idx, value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return;
    if (idx < 0 || idx >= 26) return;
    const clamped = Math.max(0, Math.min(99, n));
    this.targetCounts[idx] = clamped;
    if ((this.coverageCounts[idx] || 0) > clamped) {
      this.coverageCounts[idx] = clamped;
    }
    this._targetsManualOverride = true;
    this._emitTalliesChanged();
  }

  adjustTargetCount(idx, delta) {
    const current = this.targetCounts[idx] || 0;
    this.setTargetCount(idx, current + delta);
  }

  setAllTargetCounts(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(0, Math.min(99, n));
    for (let i = 0; i < 26; i++) {
      this.targetCounts[i] = clamped;
      if ((this.coverageCounts[i] || 0) > clamped) {
        this.coverageCounts[i] = clamped;
      }
    }
    this._targetsManualOverride = true;
    this._emitTalliesChanged();
  }

  recomputeTargets() {
    const tgt = new Array(26).fill(1);
    // Supported:
    //  - tokens "a3 f2 x0"
    //  - bare letters "xz" (means x0 z0)
    //  - "majorityN" sets all to N before overrides
    const s = (this.excludeSpec || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (s) {
      const maj = s.match(/majority(\d{1,2})/);
      if (maj) {
        const base = Math.max(0, Math.min(99, parseInt(maj[1], 10)));
        for (let i = 0; i < 26; i++) tgt[i] = base;
      }
      const pairRe = /([a-z])\s*(\d{1,2})/g;
      let m;
      while ((m = pairRe.exec(s))) {
        const idx = m[1].charCodeAt(0) - 97;
        const val = Math.max(0, Math.min(99, parseInt(m[2], 10)));
        if (idx >= 0 && idx < 26) tgt[idx] = val;
      }
      const bare = s.replace(/majority\d{1,2}/g, "")
                    .replace(/([a-z])\s*\d{1,2}/g, "")
                    .replace(/\s+/g, "");
      for (const ch of bare) {
        const idx = ch.charCodeAt(0) - 97;
        if (idx >= 0 && idx < 26) tgt[idx] = 0;
      }
    }
    this.targetCounts = tgt;
    this._targetsManualOverride = false;
  }


  static highlightSyllable(word, syl) {
    if (!syl) return word;
    const i = word.indexOf(syl);
    if (i < 0) return word;
    const pre = word.slice(0, i);
    const mid = word.slice(i, i + syl.length);
    const post = word.slice(i + syl.length);
    return `${pre}<b style="font-weight:900;text-transform:uppercase;font-size:1.15em">${mid}</b>${post}`;
  }

  _lettersOf(word) {
    const counts = new Map();
    for (let i = 0; i < word.length; i++) {
      const c = word[i];
      const code = c.charCodeAt(0);
      if (code < 97 || code > 122) continue;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return counts;
  }

  _maybeResetCoverageOnComplete() {
    let hasPositiveTarget = false;
    for (let i = 0; i < 26; i++) {
      const target = this.targetCounts[i] || 0;
      if (target > 0) {
        hasPositiveTarget = true;
        if ((this.coverageCounts[i] || 0) < target) {
          return;
        }
      }
    }
    if (!hasPositiveTarget) return;
    this.resetCoverage();
  }

  // Coverage score:
  //  - 1 * weight for each still-needed letter
  //  - +1 * weight extra if that letter is one-away (have == target-1)
  //  - small noise for tie-breaks
  _coverageScore(word) {
    const letters = this._lettersOf(word);
    let score = 0;
    letters.forEach((count, c) => {
      const idx = c.charCodeAt(0) - 97;
      const have = this.coverageCounts[idx] || 0;
      const want = this.targetCounts[idx] || 0;
      if (want <= 0) return;            // excluded/ignored
      if (have >= want) return;
      const need = Math.max(0, want - have);
      const contribution = Math.min(count, need);
      if (contribution <= 0) return;
      const w = this.letterWeights[idx] || 1;
      score += contribution * w;
      if (have + contribution >= want) {
        score += 1 * w; // finishing this letter
      }
    });
    return score;
  }

  _pickCandidatesBase(syllable, pool) {
    const syl = (syllable || "").toLowerCase();
    if (!syl) return [];
    // exclusions do NOT filter here - only affect tally later
    return pool.filter(w => w.includes(syl));
  }

  _generateCandidates(context, syllable, limit) {
    const lim = Math.max(1, Math.min(20, limit | 0));
    const syl = (syllable || "").toLowerCase();
    if (!syl) {
      return { orderedWords: [], limitedWords: [], displayEntries: [], flags: {} };
    }

    const isSelf = context === 'self';
    const coverageMode = isSelf ? this.coverageMode : false;
    const lengthMode = isSelf ? this.lengthMode : this.specLengthMode;
    const targetLen = isSelf ? this.targetLen : this.specTargetLen;
    const foulMode = isSelf ? this.foulMode : this.specFoulMode;
    const pokemonMode = isSelf ? this.pokemonMode : this.specPokemonMode;
    const mineralsMode = isSelf ? this.mineralsMode : this.specMineralsMode;
    const rareMode = isSelf ? this.rareMode : this.specRareMode;
    const hyphenMode = isSelf ? this.hyphenMode : this.specHyphenMode;
    const containsMode = isSelf ? this.containsMode : this.specContainsMode;
    const containsNeedleRaw = (isSelf ? this.containsText : this.specContainsText) || '';
    const containsNeedle = containsNeedleRaw.trim().toLowerCase();
    const containsActive = containsMode && containsNeedle.length > 0;

    const foulPool = foulMode ? this._pickCandidatesBase(syllable, this.foulWords) : [];
    const pokemonPool = pokemonMode ? this._pickCandidatesBase(syllable, this.pokemonWords) : [];
    const mineralsPool = mineralsMode ? this._pickCandidatesBase(syllable, this.mineralWords) : [];
    const rarePool = rareMode ? this._pickCandidatesBase(syllable, this.rareWords) : [];
    const mainPool = this._pickCandidatesBase(syllable, this.words);

    const candidateMap = new Map();
    const addWords = (words, source) => {
      if (!Array.isArray(words)) return;
      for (const rawWord of words) {
        const word = (rawWord || '').toString().trim();
        if (!word) continue;
        const key = word.toLowerCase();
        if (!candidateMap.has(key)) {
          candidateMap.set(key, { word, sources: new Set([source]) });
        } else {
          candidateMap.get(key).sources.add(source);
        }
      }
    };

    addWords(mainPool, 'main');
    if (foulMode) addWords(foulPool, 'foul');
    if (pokemonMode) addWords(pokemonPool, 'pokemon');
    if (mineralsMode) addWords(mineralsPool, 'minerals');
    if (rareMode) addWords(rarePool, 'rare');

    const flags = {
      foulFallback: foulMode && foulPool.length === 0,
      pokemonFallback: pokemonMode && pokemonPool.length === 0,
      mineralsFallback: mineralsMode && mineralsPool.length === 0,
      rareFallback: rareMode && rarePool.length === 0,
      lenFallback: false,
      lenCapApplied: false,
      lenCapRelaxed: false,
      lenSuppressed: false,
      containsFallback: false,
      hyphenFallback: false,
      reuseFiltered: false,
      reuseFallback: false
    };

    const priority = this._ensurePriorityOrder();

    if (!candidateMap.size) {
      return {
        orderedWords: [],
        limitedWords: [],
        displayEntries: [],
        flags,
        candidateDetails: [],
        selectionContext: {
          coverageMode,
          lengthMode,
          hyphenMode,
          containsActive,
          foulMode,
          pokemonMode,
          mineralsMode,
          rareMode,
          priority
        }
      };
    }

    const specialPriority = ['foul', 'pokemon', 'minerals', 'rare'];
    const specialRanks = { foul: 4, pokemon: 3, minerals: 2, rare: 1 };

    const candidates = Array.from(candidateMap.values()).map(info => {
      const word = info.word;
      const lower = word.toLowerCase();
      let specialType = null;
      let specialRank = 0;
      for (const type of specialPriority) {
        const enabled = (type === 'foul' ? foulMode : type === 'pokemon' ? pokemonMode : type === 'minerals' ? mineralsMode : rareMode);
        if (!enabled) continue;
        if (info.sources.has(type)) {
          specialType = type;
          specialRank = specialRanks[type];
          break;
        }
      }

      const containsIdx = containsActive ? lower.indexOf(containsNeedle) : -1;
      const containsMatch = containsIdx >= 0 ? 1 : 0;

      const hyphenMatch = hyphenMode && word.includes('-') ? 1 : 0;

      let lengthCategory = 0;
      let lengthTone = null;
      let lengthDistance = Math.abs(word.length - targetLen);
      if (lengthMode) {
        if (coverageMode) {
          if (word.length <= targetLen) {
            lengthCategory = 2;
          }
        } else {
          if (word.length === targetLen) {
            lengthCategory = 2;
            lengthTone = 'lengthExact';
          } else if (Math.abs(word.length - targetLen) <= 6) {
            lengthCategory = 1;
            lengthTone = 'lengthFlex';
          }
        }
      }

      const coverageScore = coverageMode ? this._coverageScore(lower) : 0;

      return {
        word,
        lower,
        specialType,
        specialRank,
        containsMatch,
        containsIdx,
        hyphenMatch,
        lengthCategory,
        lengthTone,
        lengthDistance,
        coverageScore,
        tone: 'default'
      };
    });

    let workingCandidates = candidates;
    if (this.preventReuseEnabled) {
      const unseen = candidates.filter(c => !this.usedWordSet.has(c.lower));
      if (unseen.length) {
        if (unseen.length !== candidates.length) {
          flags.reuseFiltered = true;
        }
        workingCandidates = unseen;
      } else if (candidates.length) {
        flags.reuseFallback = true;
      }
    }

    if (!workingCandidates.length && candidates.length) {
      workingCandidates = candidates;
    }

    if (containsActive && !workingCandidates.some(c => c.containsMatch)) {
      flags.containsFallback = true;
    }
    if (hyphenMode && !workingCandidates.some(c => c.hyphenMatch)) {
      flags.hyphenFallback = true;
    }

    if (coverageMode && lengthMode) {
      const withinCap = workingCandidates.filter(c => c.word.length <= targetLen);
      if (withinCap.length) {
        workingCandidates = withinCap;
        flags.lenCapApplied = true;
      } else {
        flags.lenCapRelaxed = true;
      }
    }

    const comparators = {
      contains: (a, b) => {
        if (!containsActive) return 0;
        const diff = b.containsMatch - a.containsMatch;
        if (diff !== 0) return diff;
        if (a.containsMatch && b.containsMatch) {
          return a.containsIdx - b.containsIdx;
        }
        return 0;
      },
      foul: (a, b) => {
        if (!foulMode && !pokemonMode && !mineralsMode && !rareMode) return 0;
        return (b.specialRank - a.specialRank);
      },
      coverage: (a, b) => {
        if (!coverageMode) return 0;
        const diff = b.coverageScore - a.coverageScore;
        if (diff !== 0) return diff;
        return a.word.length - b.word.length;
      },
      hyphen: (a, b) => {
        if (!hyphenMode) return 0;
        return (b.hyphenMatch - a.hyphenMatch);
      },
      length: (a, b) => {
        if (!lengthMode) return 0;
        const diff = b.lengthCategory - a.lengthCategory;
        if (diff !== 0) return diff;
        if (!coverageMode && a.lengthCategory > 0 && b.lengthCategory > 0) {
          const closeDiff = a.lengthDistance - b.lengthDistance;
          if (closeDiff !== 0) return closeDiff;
        }
        if (coverageMode && a.word.length !== b.word.length) {
          return a.word.length - b.word.length;
        }
        return 0;
      }
    };

    workingCandidates = workingCandidates.sort((a, b) => {
      for (const feature of priority) {
        const cmp = (comparators[feature] || (() => 0))(a, b);
        if (cmp !== 0) return cmp;
      }
      if (b.coverageScore !== a.coverageScore) return b.coverageScore - a.coverageScore;
      if (a.word.length !== b.word.length) return a.word.length - b.word.length;
      return a.word.localeCompare(b.word);
    });

    for (const candidate of workingCandidates) {
      let tone = null;
      for (const feature of priority) {
        if (feature === 'contains' && containsActive && candidate.containsMatch) { tone = 'contains'; break; }
        if (feature === 'foul' && candidate.specialRank > 0) { tone = candidate.specialType || 'default'; break; }
        if (feature === 'hyphen' && hyphenMode && candidate.hyphenMatch) { tone = 'hyphen'; break; }
        if (feature === 'length' && lengthMode && !coverageMode) {
          if (candidate.lengthCategory === 2) { tone = 'lengthExact'; break; }
          if (candidate.lengthCategory === 1) { tone = 'lengthFlex'; break; }
        }
      }
      if (!tone) {
        if (candidate.specialRank > 0) tone = candidate.specialType;
        else if (lengthMode && !coverageMode) {
          if (candidate.lengthCategory === 2) tone = 'lengthExact';
          else if (candidate.lengthCategory === 1) tone = 'lengthFlex';
        }
      }
      candidate.tone = tone || 'default';
    }

    if (lengthMode && !coverageMode) {
      const exactMatches = workingCandidates.filter(c => c.lengthCategory === 2).length;
      const flexUsed = workingCandidates.some(c => c.lengthCategory === 1);
      if (exactMatches === 0 || (exactMatches < lim && flexUsed)) {
        flags.lenFallback = true;
      }
    }

    if (lengthMode && (foulMode || pokemonMode || mineralsMode || rareMode)) {
      const specialCount = workingCandidates.filter(c => c.specialRank > 0).length;
      if (specialCount >= lim && !coverageMode) {
        flags.lenSuppressed = true;
      }
    }

    workingCandidates.forEach((c, idx) => {
      c.rank = idx;
    });

    const orderedWords = workingCandidates.map(c => c.word);
    const displayEntries = workingCandidates.slice(0, lim).map(c => ({ word: c.word, tone: c.tone }));
    const candidateDetails = workingCandidates.map(c => ({
      word: c.word,
      lower: c.lower,
      rank: c.rank,
      specialType: c.specialType,
      specialRank: c.specialRank,
      containsMatch: c.containsMatch,
      containsIdx: c.containsIdx,
      hyphenMatch: c.hyphenMatch,
      lengthCategory: c.lengthCategory,
      lengthDistance: c.lengthDistance,
      coverageScore: c.coverageScore,
      tone: c.tone
    }));

    const selectionContext = {
      coverageMode,
      lengthMode,
      hyphenMode,
      containsActive,
      foulMode,
      pokemonMode,
      mineralsMode,
      rareMode,
      priority
    };

    return {
      orderedWords,
      limitedWords: orderedWords.slice(0, lim),
      displayEntries,
      flags,
      candidateDetails,
      selectionContext
    };
  }

  // -------- candidate selection (self) --------
  getTopCandidates(syllable, limit) {
    const result = this._generateCandidates('self', syllable, limit);
    this.flagsRoundSelf = this.selfRound;
    this.lastFoulFallbackSelf = !!result.flags.foulFallback;
    this.lastPokemonFallbackSelf = !!result.flags.pokemonFallback;
    this.lastMineralsFallbackSelf = !!result.flags.mineralsFallback;
    this.lastRareFallbackSelf = !!result.flags.rareFallback;
    this.lastLenFallbackSelf = !!result.flags.lenFallback;
    this.lastLenCapAppliedSelf = !!result.flags.lenCapApplied;
    this.lastLenCapRelaxedSelf = !!result.flags.lenCapRelaxed;
    this.lastLenSuppressedByFoulSelf = !!result.flags.lenSuppressed;
    this.lastContainsFallbackSelf = !!result.flags.containsFallback;
    this.lastHyphenFallbackSelf = !!result.flags.hyphenFallback;
    this.lastReuseFilteredSelf = !!result.flags.reuseFiltered;
    this.lastReuseFallbackSelf = !!result.flags.reuseFallback;

    this._roundPool = result.orderedWords.slice();
    this._roundCandidatesDetailed = Array.isArray(result.candidateDetails) ? result.candidateDetails.slice() : [];
    this._roundSelectionContext = result.selectionContext || null;
    this.lastTopPicksSelf = result.limitedWords.slice();
    this.lastTopPicksSelfDisplay = result.displayEntries.slice();
    return this.lastTopPicksSelf;
  }

  // -------- spectator suggestions --------
  generateSpectatorSuggestions(syllable, limit) {
    const result = this._generateCandidates('spectator', syllable, limit);
    this.flagsRoundSpectator = this.spectatorRound;
    this.lastSpectatorSyllable = syllable;

    this.lastFoulFallbackSpectator = !!result.flags.foulFallback;
    this.lastPokemonFallbackSpectator = !!result.flags.pokemonFallback;
    this.lastMineralsFallbackSpectator = !!result.flags.mineralsFallback;
    this.lastRareFallbackSpectator = !!result.flags.rareFallback;
    this.lastLenFallbackSpectator = !!result.flags.lenFallback;
    this.lastLenCapAppliedSpectator = !!result.flags.lenCapApplied;
    this.lastLenCapRelaxedSpectator = !!result.flags.lenCapRelaxed;
    this.lastLenSuppressedByFoulSpectator = !!result.flags.lenSuppressed;
    this.lastContainsFallbackSpectator = !!result.flags.containsFallback;
    this.lastHyphenFallbackSpectator = !!result.flags.hyphenFallback;
    this.lastReuseFilteredSpectator = !!result.flags.reuseFiltered;
    this.lastReuseFallbackSpectator = !!result.flags.reuseFallback;

    this.spectatorSuggestionsDisplay = result.displayEntries.slice();
    this.spectatorSuggestions = result.limitedWords.slice();
    return this.spectatorSuggestions;
  }

  // -------- typing / submitting --------
  _ensureInput() {
    if (this.input && document.body.contains(this.input)) return this.input;
    const selfTurns = document.getElementsByClassName("selfTurn");
    if (selfTurns.length) {
      this.input = selfTurns[0].getElementsByTagName("input")[0] || null;
    } else {
      this.input = document.querySelector("input") || null;
    }
    return this.input;
  }

  // Map speed(1..12) -> per-char delay ms (slowest much slower; fastest ~8ms)
  _charDelayMs() {
    const t = (this.speed - 1) / 11;               // 0..1
    const slow = 300;                               // ms at speed 1 (slower than before)
    const fast = 8;                                 // ms at speed 12 (fast as before)
    return Math.round(slow + (fast - slow) * t);    // linear
  }

  _sleep(ms) {
    if (!ms || ms <= 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _emitInputEvent(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  _inputMaxLength(input) {
    if (!input) return null;
    const attr = input.getAttribute?.("maxlength");
    if (!attr) return null;
    const max = Number(attr);
    return Number.isFinite(max) && max > 0 ? max : null;
  }

  _truncateToMax(input, text) {
    const raw = text ?? "";
    const max = this._inputMaxLength(input);
    if (max === null) return raw;
    if (raw.length <= max) return raw;
    return raw.slice(0, max);
  }

  _setInputValueRespectingMax(input, text) {
    if (!input) return "";
    const finalValue = this._truncateToMax(input, text);
    input.value = finalValue;
    this._emitInputEvent(input);
    return finalValue;
  }

  _cancelPendingSubmissionTimer() {
    if (this._pendingSubmissionTimer) {
      clearTimeout(this._pendingSubmissionTimer);
      this._pendingSubmissionTimer = null;
    }
  }

  _clearPendingSubmission() {
    this._cancelPendingSubmissionTimer();
    this._pendingSubmission = null;
  }

  clearPendingSubmission() {
    this._clearPendingSubmission();
  }

  _trackPendingSubmission(word, ignorePostfix, baseAttempt = 0) {
    this._cancelPendingSubmissionTimer();
    const attemptBase = Math.max(0, Number(baseAttempt) || 0);
    this._pendingSubmission = {
      word: word,
      ignorePostfix: !!ignorePostfix,
      syllable: this.syllable,
      round: this.selfRound,
      attempt: attemptBase + 1,
      submittedAt: Date.now(),
    };
    this._pendingSubmissionTimer = setTimeout(() => {
      this._handlePendingSubmissionTimeout();
    }, this._pendingSubmissionRetryDelayMs);
  }

  _handlePendingSubmissionTimeout() {
    this._pendingSubmissionTimer = null;
    const pending = this._pendingSubmission;
    if (!pending) return;

    if (!pending.word) {
      this._clearPendingSubmission();
      return;
    }

    if (!this.myTurn || this.selfRound !== pending.round || (this.syllable || "") !== (pending.syllable || "")) {
      this._clearPendingSubmission();
      return;
    }

    if (this.paused) {
      this._pendingSubmissionTimer = setTimeout(() => {
        this._handlePendingSubmissionTimeout();
      }, this._pendingSubmissionRetryDelayMs);
      return;
    }

    const attempt = Math.max(0, Number(pending.attempt) || 0);
    console.debug('[BombPartyShark] Resubmitting word after missing game response', {
      word: pending.word,
      attempt: attempt + 1,
    });
    this.typeAndSubmit(pending.word, pending.ignorePostfix, { attempt }).catch((err) => {
      console.warn('[BombPartyShark] Failed to retry submission', err);
    });
  }

  _scheduleTypingRetry(word, ignorePostfix, attemptSeed = 0) {
    const baseAttempt = Math.max(0, Number(attemptSeed) || 0);
    if (!word || baseAttempt >= 5) return;
    const delay = 180 + baseAttempt * 140;
    setTimeout(() => {
      if (!this.myTurn || this.paused) return;
      if (!this.syllable || !this._ensureInput()) return;
      this.typeAndSubmit(word, ignorePostfix, { attempt: baseAttempt + 1 }).catch(() => {});
    }, delay);
  }

  async _waitForInput(timeoutMs = 6000) {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    let input = this._ensureInput();
    if (input) return input;

    while (!input && Date.now() < deadline) {
      await this._sleep(25);
      input = this._ensureInput();
      if (input) return input;
    }

    if (input || !document?.body) return input || null;

    return await new Promise((resolve) => {
      let finished = false;
      let observer = null;
      let timer = null;
      const done = (node) => {
        if (finished) return;
        finished = true;
        try { observer && observer.disconnect(); } catch (_) {}
        if (timer) clearTimeout(timer);
        resolve(node || null);
      };

      observer = new MutationObserver(() => {
        const node = this._ensureInput();
        if (node) done(node);
      });
      try {
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (_) {
        done(this._ensureInput());
        return;
      }
      const remaining = Math.max(0, deadline - Date.now());
      timer = setTimeout(() => done(this._ensureInput()), remaining || 0);
    });
  }

  _randomLetterExcept(correct) {
    const pool = 'abcdefghijklmnopqrstuvwxyz';
    const lowerCorrect = (correct || '').toLowerCase();
    let idx = Math.floor(Math.random() * pool.length);
    let ch = pool[idx];
    if (ch === lowerCorrect) {
      ch = pool[(idx + 7) % pool.length];
    }
    return ch;
  }

  async _backspaceChars(input, count, delayMs, typingToken) {
    if (!input || !count || count <= 0) return;
    const delay = Math.max(30, Math.floor(delayMs || 0));
    for (let i = 0; i < count; i++) {
      if (typingToken && this._activeTypingToken !== typingToken) return;
      input.value = input.value.slice(0, -1);
      this._emitInputEvent(input);
      await this._sleep(delay);
      if (typingToken && this._activeTypingToken !== typingToken) return;
    }
  }

  async _typeTextSequence(input, text, perCharDelay, options = {}, typingToken) {
    if (!input || text === undefined || text === null) return;
    const seq = typeof text === "string" ? text : String(text);
    if (!seq.length) return;
    const allowMistakes = options.allowMistakes !== false;
    const maxLen = this._inputMaxLength(input);
    const canTypeChar = () => maxLen === null || input.value.length < maxLen;
    for (let i = 0; i < seq.length; i++) {
      if (typingToken && this._activeTypingToken !== typingToken) return;
      const ch = seq[i];
      if (!canTypeChar()) break;
      if (allowMistakes && this.mistakesEnabled && !this.autoSuicide && Math.random() < this.mistakesProb && canTypeChar()) {
        if (typingToken && this._activeTypingToken !== typingToken) return;
        input.value += ch;
        this._emitInputEvent(input);
        await this._sleep(perCharDelay);
        if (typingToken && this._activeTypingToken !== typingToken) return;
        input.value = input.value.slice(0, -1);
        this._emitInputEvent(input);
        await this._sleep(perCharDelay);
        if (typingToken && this._activeTypingToken !== typingToken) return;
      }
      if (!canTypeChar()) break;
      input.value += ch;
      this._emitInputEvent(input);
      await this._sleep(perCharDelay);
      if (typingToken && this._activeTypingToken !== typingToken) return;
    }
  }


  async _typeWordWithRealism(input, word, perCharDelay, typingToken) {
    const raw = typeof word === 'string' ? word : String(word ?? '');
    if (!raw.length) return;
    const realismActive = this.superRealisticEnabled && !this.instantMode && !this.autoSuicide && !raw.startsWith('/');
    if (!realismActive) {
      await this._typeTextSequence(input, raw, perCharDelay, undefined, typingToken);
      return;
    }

    const aggression = Math.max(0, Math.min(1, this.superRealisticAggression || 0));
    const pauseMsConfigured = Math.max(0, (this.superRealisticPauseSec || 0) * 1000);
    const scenarioPool = [];
    if (raw.length >= 4 && pauseMsConfigured > 10) scenarioPool.push('pause');
    if (raw.length >= 3) scenarioPool.push('overrun');
    if (raw.length >= 2) scenarioPool.push('stutter');

    const shouldAddFlair = Math.random() < aggression && scenarioPool.length > 0;
    const typingOpts = { allowMistakes: false };
    if (!shouldAddFlair) {
      await this._typeTextSequence(input, raw, perCharDelay, typingOpts, typingToken);
      return;
    }

    const scenario = scenarioPool[Math.floor(Math.random() * scenarioPool.length)];
    const baseDelay = Math.max(35, perCharDelay | 0);
    try {
      if (scenario === 'pause') {
        const pivot = Math.max(1, Math.floor(raw.length / 2));
        await this._typeTextSequence(input, raw.slice(0, pivot), perCharDelay, typingOpts, typingToken);
        if (typingToken && this._activeTypingToken !== typingToken) return;
        const jitter = pauseMsConfigured * (0.35 + Math.random() * 0.4);
        if (pauseMsConfigured > 0) {
          await this._sleep(pauseMsConfigured + jitter);
        }
        if (typingToken && this._activeTypingToken !== typingToken) return;
        await this._typeTextSequence(input, raw.slice(pivot), perCharDelay, typingOpts, typingToken);
      } else if (scenario === 'overrun') {
        const maxIdx = raw.length - 2;
        const minIdx = 1;
        const idx = minIdx + Math.floor(Math.random() * Math.max(1, maxIdx - minIdx + 1));
        const before = raw.slice(0, idx);
        const correct = raw[idx];
        const after = raw.slice(idx + 1);
        const wrong = this._randomLetterExcept(correct);

        await this._typeTextSequence(input, before, perCharDelay, typingOpts, typingToken);
        if (typingToken && this._activeTypingToken !== typingToken) return;
        await this._typeTextSequence(input, wrong, perCharDelay, { allowMistakes: false }, typingToken);
        if (typingToken && this._activeTypingToken !== typingToken) return;
        await this._sleep(Math.max(baseDelay * 0.6, 40));
        if (typingToken && this._activeTypingToken !== typingToken) return;
        await this._backspaceChars(input, 1, Math.max(baseDelay * 0.8, 40), typingToken);
        if (typingToken && this._activeTypingToken !== typingToken) return;
        await this._sleep(Math.max(baseDelay * 0.75, 45));
        if (typingToken && this._activeTypingToken !== typingToken) return;
        await this._typeTextSequence(input, correct, perCharDelay, typingOpts, typingToken);
        if (after.length) {
          if (typingToken && this._activeTypingToken !== typingToken) return;
          await this._typeTextSequence(input, after, perCharDelay, typingOpts, typingToken);
        }
      } else if (scenario === 'stutter') {
        const idx = Math.floor(Math.random() * raw.length);
        const before = raw.slice(0, idx);
        const target = raw[idx];
        const after = raw.slice(idx + 1);
        await this._typeTextSequence(input, before, perCharDelay, typingOpts, typingToken);
        if (typingToken && this._activeTypingToken !== typingToken) return;
        const repeats = 2 + Math.floor(Math.random() * 2);
        for (let attempt = 0; attempt < repeats - 1; attempt++) {
          await this._typeTextSequence(input, target, perCharDelay, typingOpts, typingToken);
          if (typingToken && this._activeTypingToken !== typingToken) return;
          await this._sleep(Math.max(baseDelay * 0.6, 35));
          if (typingToken && this._activeTypingToken !== typingToken) return;
          await this._backspaceChars(input, 1, Math.max(baseDelay * 0.75, 40), typingToken);
          if (typingToken && this._activeTypingToken !== typingToken) return;
        }
        await this._typeTextSequence(input, target, perCharDelay, typingOpts, typingToken);
        if (after.length) {
          if (typingToken && this._activeTypingToken !== typingToken) return;
          await this._typeTextSequence(input, after, perCharDelay, typingOpts, typingToken);
        }
      }
    } catch (err) {
      console.debug('[BombPartyShark] super realistic typing fell back', err);
      await this._typeTextSequence(input, raw, perCharDelay, typingOpts, typingToken);
      if (typingToken && this._activeTypingToken !== typingToken) return;
      return;
    }

    const targetValue = this._truncateToMax(input, raw);
    if (typingToken && this._activeTypingToken !== typingToken) return;
    if (input.value !== targetValue) {
      input.value = targetValue;
      this._emitInputEvent(input);
    }
    await this._sleep(Math.max(baseDelay * 0.6, 40));
    if (typingToken && this._activeTypingToken !== typingToken) return;
  }


  async playTurn() {
    if (this.autoSuicide) {
      await this.typeAndSubmit("/suicide", /*ignorePostfix=*/true);
      return;
    }
    if (this.thinkingDelaySec > 0) {
      await new Promise(r => setTimeout(r, this.thinkingDelaySec * 1000));
    }
    this._roundFailed.clear();
    const picks = this.getTopCandidates(this.syllable, this.suggestionsLimit);
    this.lastTopPicksSelf = picks;
    const word = this._pickNextNotFailed();
    if (word) await this.typeAndSubmit(word);
  }

  _pickNextNotFailed() {
    const detailed = Array.isArray(this._roundCandidatesDetailed) ? this._roundCandidatesDetailed : [];
    const context = this._roundSelectionContext || {};
    if (detailed.length) {
      const available = detailed.filter(c => !this._roundFailed.has(c.lower));
      if (available.length) {
        const priority = Array.isArray(context.priority) ? context.priority : this._ensurePriorityOrder();
        let pool = available.slice();
        for (const feature of priority) {
          if (feature === 'contains' && context.containsActive) {
            const matches = pool.filter(c => c.containsMatch > 0);
            if (matches.length) { pool = matches; continue; }
          }
          if (feature === 'foul' && (context.foulMode || context.pokemonMode || context.mineralsMode || context.rareMode)) {
            const bestRank = Math.max(...pool.map(c => c.specialRank || 0));
            const matches = pool.filter(c => (c.specialRank || 0) === bestRank);
            if (matches.length) { pool = matches; continue; }
          }
          if (feature === 'coverage' && context.coverageMode) {
            const maxScore = Math.max(...pool.map(c => c.coverageScore || 0));
            const matches = pool.filter(c => (c.coverageScore || 0) === maxScore);
            if (matches.length) { pool = matches; continue; }
          }
          if (feature === 'hyphen' && context.hyphenMode) {
            const matches = pool.filter(c => c.hyphenMatch > 0);
            if (matches.length) { pool = matches; continue; }
          }
          if (feature === 'length' && context.lengthMode) {
            const bestCategory = Math.max(...pool.map(c => c.lengthCategory || 0));
            if (bestCategory > 0) {
              let matches = pool.filter(c => (c.lengthCategory || 0) === bestCategory);
              if (context.coverageMode) {
                const bestLen = Math.min(...matches.map(c => c.word.length));
                matches = matches.filter(c => c.word.length === bestLen);
              } else {
                const bestDistance = Math.min(...matches.map(c => c.lengthDistance ?? Number.POSITIVE_INFINITY));
                matches = matches.filter(c => (c.lengthDistance ?? Number.POSITIVE_INFINITY) === bestDistance);
              }
              if (matches.length) { pool = matches; continue; }
            }
          }
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) return pick.word;
      }
    }

    for (const w of this._roundPool) {
      if (!this._roundFailed.has(w)) return w;
    }
    return null;
  }

  async typeAndSubmit(word, ignorePostfix=false, retryMeta=null) {
    this._cancelPendingSubmissionTimer();
    const attemptSeed = retryMeta && Number.isFinite(retryMeta.attempt)
      ? retryMeta.attempt
      : (this._pendingSubmission && this._pendingSubmission.word === word
        ? this._pendingSubmission.attempt || 0
        : 0);

    const typingToken = Symbol('typing');
    this._activeTypingToken = typingToken;

    const input = await this._waitForInput();
    if (!input || this._activeTypingToken !== typingToken) {
      this._clearPendingSubmission();
      if (this._activeTypingToken === typingToken) {
        this._activeTypingToken = null;
      }
      if (!input && this.myTurn) {
        this._scheduleTypingRetry(word, ignorePostfix, attemptSeed);
      }
      return;
    }

    input.focus();
    await Promise.resolve();
    if (this._activeTypingToken !== typingToken) {
      this._activeTypingToken = null;
      return;
    }
    this._setInputValueRespectingMax(input, "");
    if (this._activeTypingToken !== typingToken) {
      this._activeTypingToken = null;
      return;
    }

    const perCharDelay = this._charDelayMs();
    const instant = !!this.instantMode;
    const plainTypingOpts = this.superRealisticEnabled ? { allowMistakes: false } : undefined;

    if (this.preMsgEnabled && this.preMsgText && !this.autoSuicide) {
      if (instant) {
        this._setInputValueRespectingMax(input, this.preMsgText);
        if (this._activeTypingToken !== typingToken) { this._activeTypingToken = null; return; }
        await this._sleep(Math.max(40, perCharDelay));
        if (this._activeTypingToken !== typingToken) { this._activeTypingToken = null; return; }
        this._setInputValueRespectingMax(input, "");
      } else {
        await this._typeTextSequence(input, this.preMsgText, perCharDelay, plainTypingOpts, typingToken);
        if (this._activeTypingToken !== typingToken) { this._activeTypingToken = null; return; }
        await this._sleep(Math.max(80, perCharDelay * 4));
        if (this._activeTypingToken !== typingToken) { this._activeTypingToken = null; return; }
        this._setInputValueRespectingMax(input, "");
      }
      if (this._activeTypingToken !== typingToken) { this._activeTypingToken = null; return; }
    }

    if (instant) {
      this._setInputValueRespectingMax(input, word);
    } else {
      await this._typeWordWithRealism(input, word, perCharDelay, typingToken);
      if (this._activeTypingToken !== typingToken) { this._activeTypingToken = null; return; }
    }

    let expectedValue = this._truncateToMax(input, word);

    if (this.postfixEnabled && this.postfixText && !this.autoSuicide && !ignorePostfix) {
      if (instant) {
        this._setInputValueRespectingMax(input, `${input.value}${this.postfixText}`);
      } else {
        await this._typeTextSequence(input, this.postfixText, perCharDelay, plainTypingOpts, typingToken);
      }
      if (this._activeTypingToken !== typingToken) { this._activeTypingToken = null; return; }
      expectedValue = this._truncateToMax(input, `${expectedValue}${this.postfixText}`);
    }

    if (this._activeTypingToken !== typingToken) {
      this._activeTypingToken = null;
      return;
    }

    if (input.value !== expectedValue) {
      this._setInputValueRespectingMax(input, expectedValue);
      if (this._activeTypingToken !== typingToken) { this._activeTypingToken = null; return; }
    }

    if (!expectedValue) {
      this._activeTypingToken = null;
      return;
    }
    const enterOpts = { key: "Enter", code: "Enter", which: 13, keyCode: 13, bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
    input.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
    input.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
    await new Promise(r => setTimeout(r, 10));

    if (document.activeElement !== input) input.focus();
    const form = input.closest("form");
    if (form && typeof form.requestSubmit === "function") {
      form.requestSubmit();
    }

    this._trackPendingSubmission(word, ignorePostfix, attemptSeed);
    this._activeTypingToken = null;
  }


  onCorrectWord(word, myTurn = false) {
    this._clearPendingSubmission();
    const normalizedInfo = this._normalizeWordForLog(word);
    if (normalizedInfo) {
      this._rememberWordUsage(normalizedInfo.normalized, {
        displayWord: normalizedInfo.display,
        fromSelf: !!myTurn,
        outcome: 'correct'
      });
    }
    if (!myTurn) return;
    // Only tally toward goals with target > 0
    const letters = this._lettersOf((word || "").toLowerCase());
    letters.forEach((count, c) => {
      const idx = c.charCodeAt(0) - 97;
      if (idx >= 0 && idx < 26 && this.targetCounts[idx] > 0) {
        this.coverageCounts[idx] += count;
      }
    });
    this._maybeResetCoverageOnComplete();
    this._emitTalliesChanged();
  }

  onFailedWord(myTurn, word, reason) {
    this._reportInvalid(word, reason, myTurn).catch(() => {});
    this._clearPendingSubmission();
    const normalizedInfo = this._normalizeWordForLog(word);
    if (normalizedInfo) {
      this._rememberWordUsage(normalizedInfo.normalized, {
        displayWord: normalizedInfo.display,
        fromSelf: !!myTurn,
        outcome: 'fail'
      });
    }
    if (!myTurn) return;
    if (word) {
      const normalizedRaw = (word || "").toLowerCase();
      const normalized = normalizedRaw.trim();
      if (normalized) this._roundFailed.add(normalized);
      if (normalizedInfo && normalizedInfo.normalized) {
        this._roundFailed.add(normalizedInfo.normalized);
      }
    }
    if (this.paused) return;
    const next = this._pickNextNotFailed();
    if (next) this.typeAndSubmit(next).catch(() => {});
  }

  async _reportInvalid(word, reason, myTurn) {
    const normalizedWord = (word || "").toLowerCase().trim();
    if (!normalizedWord) return;
    const payload = {
      lang: this.lang,
      syllable: this.syllable || "",
      word: normalizedWord,
      reason: reason || "",
      ts: Date.now(),
      self: !!myTurn
    };
    const url = `${this.apiBase()}/report_invalid.php`;
    await this.extPost(url, payload);
  }
}

window.Game = Game;
























