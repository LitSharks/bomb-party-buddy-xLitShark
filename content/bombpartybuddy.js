// content/bombpartybuddy.js
// Overlay/HUD + event wire-up for Bomb Party Shark

function isBombPartyFrame() {
  try {
    const url = new URL(document.location.href);
    return url.hostname.endsWith(".jklm.fun") && url.pathname.startsWith("/games/bombparty");
  } catch (_) {
    return false;
  }
}

function getInput() {
  const selfTurns = document.getElementsByClassName("selfTurn");
  if (!selfTurns.length) return document.querySelector("input") || null;
  return selfTurns[0].getElementsByTagName("input")[0];
}

function canUseAsyncClipboard() {
  if (!(navigator?.clipboard?.writeText)) return false;
  try {
    const policy = document?.permissionsPolicy || document?.featurePolicy;
    if (policy && typeof policy.allowsFeature === "function") {
      let allowed = true;
      try {
        allowed = policy.allowsFeature.length >= 2
          ? policy.allowsFeature("clipboard-write", window?.location?.origin || "")
          : policy.allowsFeature("clipboard-write");
      } catch (_) {
        allowed = false;
      }
      if (!allowed) return false;
    }
  } catch (_) {
    // Ignore feature policy errors and fall back to execCommand
    return false;
  }
  return true;
}

// Clipboard fallback (permissions policy may block navigator.clipboard)
async function copyPlain(text) {
  const payload = text ?? "";
  if (canUseAsyncClipboard()) {
    try {
      await navigator.clipboard.writeText(payload);
      return true;
    } catch (_) { /* fall through to execCommand */ }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = payload;
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

  const STORAGE_KEY = "bombpartybuddy.settings.v1";
  const SESSION_KEY = "bombpartybuddy.session.v1";

  const safeParse = (text) => {
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) { return null; }
  };

  const loadSettings = () => {
    try { return safeParse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (err) { console.warn("[BombPartyShark] Failed to load settings", err); return {}; }
  };
  const saveSettingsNow = (payload) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }
    catch (err) { console.warn("[BombPartyShark] Failed to save settings", err); }
  };
  const loadTallies = () => {
    try { return safeParse(sessionStorage.getItem(SESSION_KEY)) || {}; }
    catch (_) { return {}; }
  };
  const saveTalliesNow = (payload) => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload)); }
    catch (_) { /* ignore */ }
  };

  const savedSettings = loadSettings();
  const sessionData = loadTallies();

  const UI_TEXT = {};
  const addText = (entries) => Object.assign(UI_TEXT, entries);

  addText({
    title: { en: "Bomb Party Shark", de: "Bomb Party Shark", es: "Bomb Party Shark", fr: "Bomb Party Shark", "pt-br": "Bomb Party Shark" },
    forceSave: { en: "Force save settings", de: "Einstellungen jetzt speichern", es: "Guardar configuración ahora", fr: "Forcer l'enregistrement", "pt-br": "Salvar configurações agora" },
    forceSaveSaved: { en: "Saved!", de: "Gespeichert!", es: "¡Guardado!", fr: "Enregistré !", "pt-br": "Salvo!" },
    currentLanguage: { en: "Current language: {{language}}", de: "Aktuelle Sprache : {{language}}", es: "Idioma actual: {{language}}", fr: "Langue actuelle : {{language}}", "pt-br": "Idioma atual: {{language}}" },
    tabMain: { en: "Main", de: "Haupt", es: "Principal", fr: "Principal", "pt-br": "Principal" },
    tabCoverage: { en: "Coverage", de: "Abdeckung", es: "Cobertura", fr: "Couverture", "pt-br": "Cobertura" },
    tabWords: { en: "Words", de: "Wörter", es: "Palabras", fr: "Mots", "pt-br": "Palavras" },
    toggleOn: { en: "On", de: "An", es: "Activado", fr: "Activé", "pt-br": "Ligado" },
    toggleOff: { en: "Off", de: "Aus", es: "Desactivado", fr: "Désactivé", "pt-br": "Desligado" },
    sectionAutomation: { en: "Automation", de: "Automatisierung", es: "Automatización", fr: "Automatisation", "pt-br": "Automação" },
    toggleAutoType: { en: "AutoType", de: "Auto-Tippen", es: "Escritura automática", fr: "Saisie automatique", "pt-br": "Digitação automática" },
    toggleInstantMode: { en: "Instant mode", de: "Sofortmodus", es: "Modo instantáneo", fr: "Mode instantané", "pt-br": "Modo instantâneo" },
    toggleButterfingers: { en: "Butterfingers", de: "Vertipper", es: "Errores aleatorios", fr: "Fautes réalistes", "pt-br": "Erros aleatórios" },
    toggleAutoSuicide: { en: "Auto /suicide", de: "Auto-/suicide", es: "Auto /suicide", fr: "Auto /suicide", "pt-br": "Auto /suicide" },
    toggleAutoJoin: { en: "Always auto-join", de: "Immer automatisch beitreten", es: "Unirse siempre automáticamente", fr: "Toujours rejoindre automatiquement", "pt-br": "Sempre entrar automaticamente" },
    toggleSuperRealistic: { en: "Super realistic", de: "Superrealistisch", es: "Súper realista", fr: "Ultra réaliste", "pt-br": "Super realista" },
    placeholderPreMessage: { en: "Message to flash before your word", de: "Nachricht vor deinem Wort anzeigen", es: "Mensaje para mostrar antes de tu palabra", fr: "Message à afficher avant votre mot", "pt-br": "Mensagem para mostrar antes da sua palavra" },
    placeholderPostfix: { en: "Characters to append (e.g., <3)", de: "Zeichen anhängen (z. B. <3)", es: "Caracteres para añadir (p. ej., <3)", fr: "Caractères à ajouter (ex. : <3)", "pt-br": "Caracteres para adicionar (ex.: <3)" },
    sectionCoverage: { en: "Alphabet mastery", de: "Alphabet-Training", es: "Dominio del alfabeto", fr: "Maîtrise de l'alphabet", "pt-br": "Domínio do alfabeto" },
    sectionWordTargeting: { en: "Word targeting", de: "Wortzielsuche", es: "Objetivo de palabras", fr: "Ciblage de mots", "pt-br": "Alvo de palavras" },
    sectionWordHistory: { en: "Word history", de: "Wortverlauf", es: "Historial de palabras", fr: "Historique des mots", "pt-br": "Histórico de palavras" },
    sectionWordModes: { en: "Word modes", de: "Wortmodi", es: "Modos de palabras", fr: "Modes de mots", "pt-br": "Modos de palavras" },
    lenSliderMax: { en: "Max", de: "Max", es: "Máx.", fr: "Max", "pt-br": "Máx." },
    coverageEditModeLabel: { en: "Editing mode", de: "Bearbeitungsmodus", es: "Modo de edición", fr: "Mode d'édition", "pt-br": "Modo de edição" },
    coverageEditOff: { en: "Off", de: "Aus", es: "Apagado", fr: "Arrêt", "pt-br": "Desligado" },
    coverageEditTallies: { en: "Edit tallies", de: "Zählwerte bearbeiten", es: "Editar conteos", fr: "Modifier les comptes", "pt-br": "Editar contagens" },
    coverageEditGoals: { en: "Edit goals", de: "Ziele bearbeiten", es: "Editar metas", fr: "Modifier les objectifs", "pt-br": "Editar metas" },
    coverageSetAllLabel: { en: "Set all goals to:", de: "Alle Ziele setzen auf :", es: "Establecer todas las metas en:", fr: "Définir toutes les cibles sur :", "pt-br": "Definir todas as metas como:" },
    coverageSetAllApply: { en: "Apply", de: "Übernehmen", es: "Aplicar", fr: "Appliquer", "pt-br": "Aplicar" },
    copyTooltip: { en: "Copy word to clipboard", de: "Wort in Zwischenablage kopieren", es: "Copiar palabra al portapapeles", fr: "Copier le mot dans le presse-papiers", "pt-br": "Copiar palavra para a área de transferência" },
    noticeReuseFiltered: { en: "Prevent reuse: removed words already played this match.", de: "Keine Wiederverwendung: Wörter aus dieser Runde wurden entfernt.", es: "Evitar reutilizar: se quitaron las palabras ya jugadas en esta partida.", fr: "Anti-répétition : mots déjà joués retirés pour cette partie.", "pt-br": "Evitar reutilização: palavras já jogadas nesta partida foram removidas." },
    noticeReuseFallback: { en: "Prevent reuse: every option was used already — showing best matches anyway.", de: "Keine Wiederverwendung: Alle Optionen wurden schon benutzt – beste Treffer trotzdem anzeigen.", es: "Evitar reutilizar: todas las opciones ya se usaron — mostrando las mejores igualmente.", fr: "Anti-répétition : toutes les options déjà utilisées — meilleures propositions affichées quand même.", "pt-br": "Evitar reutilização: todas as opções já foram usadas — mostrando as melhores mesmo assim." }
  });

  addText({
    sliderSuperAggression: { en: "Aggressiveness (%)", de: "Aggressivität (%)", es: "Agresividad (%)", fr: "Agressivité (%)", "pt-br": "Agressividade (%)" },
    sliderSuperPause: { en: "Mid-word pause (s)", de: "Pause im Wort (s)", es: "Pausa a mitad de palabra (s)", fr: "Pause en plein mot (s)", "pt-br": "Pausa no meio da palavra (s)" },
    sectionHud: { en: "HUD & Rhythm", de: "HUD & Rhythmus", es: "HUD y ritmo", fr: "HUD & rythme", "pt-br": "HUD e ritmo" },
    sliderHudScale: { en: "HUD size", de: "HUD-Größe", es: "Tamaño del HUD", fr: "Taille du HUD", "pt-br": "Tamanho do HUD" },
    sliderSpeed: { en: "Speed", de: "Geschwindigkeit", es: "Velocidad", fr: "Vitesse", "pt-br": "Velocidade" },
    sliderThinkingDelay: { en: "Thinking delay (s)", de: "Denkpause (s)", es: "Retraso para pensar (s)", fr: "Temps de réflexion (s)", "pt-br": "Atraso para pensar (s)" },
    sliderMistakes: { en: "Butterfingers (%)", de: "Vertipper (%)", es: "Errores (%)", fr: "Fautes (%)", "pt-br": "Erros (%)" },
    sectionMessages: { en: "Messages", de: "Nachrichten", es: "Mensajes", fr: "Messages", "pt-br": "Mensagens" },
    togglePreMessage: { en: "Pre-message", de: "Vor-Nachricht", es: "Mensaje previo", fr: "Pré-message", "pt-br": "Mensagem prévia" },
    inputPreMessage: { en: "Message to flash before your word", de: "Nachricht vor deinem Wort anzeigen", es: "Mensaje para mostrar antes de tu palabra", fr: "Message à afficher avant votre mot", "pt-br": "Mensagem para mostrar antes da sua palavra" },
    togglePostfix: { en: "Postfix", de: "Suffix", es: "Posfijo", fr: "Suffixe", "pt-br": "Sufixo" },
    inputPostfix: { en: "Characters to append (e.g., <3)", de: "Zeichen anhängen (z. B. <3)", es: "Caracteres para añadir (p. ej., <3)", fr: "Caractères à ajouter (ex. : <3)", "pt-br": "Caracteres para adicionar (ex.: <3)" },
    sectionAlphabet: { en: "Alphabet mastery", de: "Alphabet-Training", es: "Dominio del alfabeto", fr: "Maîtrise de l'alphabet", "pt-br": "Domínio do alfabeto" },
    toggleCoverage: { en: "Alphabet coverage", de: "Alphabet-Abdeckung", es: "Cobertura del alfabeto", fr: "Couverture de l'alphabet", "pt-br": "Cobertura do alfabeto" },
    toggleExclude: { en: "A-Z goals / exclusions", de: "A-Z-Ziele / Ausschlüsse", es: "Objetivos/exclusiones A-Z", fr: "Objectifs/exclusions A-Z", "pt-br": "Metas/exclusões A-Z" },
    labelEditingMode: { en: "Editing mode", de: "Bearbeitungsmodus", es: "Modo de edición", fr: "Mode d'édition", "pt-br": "Modo de edição" },
    editOff: { en: "Off", de: "Aus", es: "Apagado", fr: "Arrêt", "pt-br": "Desligado" },
    editTallies: { en: "Edit tallies", de: "Zählwerte bearbeiten", es: "Editar conteos", fr: "Modifier les comptes", "pt-br": "Editar contagens" },
    editGoals: { en: "Edit goals", de: "Ziele bearbeiten", es: "Editar metas", fr: "Modifier les objectifs", "pt-br": "Editar metas" },
    labelSetAllGoals: { en: "Set all goals to:", de: "Alle Ziele setzen auf :", es: "Establecer todas las metas en:", fr: "Définir toutes les cibles sur :", "pt-br": "Definir todas as metas como:" },
    buttonApply: { en: "Apply", de: "Übernehmen", es: "Aplicar", fr: "Appliquer", "pt-br": "Aplicar" },
    buttonResetCoverage: { en: "Reset A-Z progress", de: "A-Z-Fortschritt zurücksetzen", es: "Restablecer progreso A-Z", fr: "Réinitialiser la progression A-Z", "pt-br": "Redefinir progresso A-Z" }
  });

  addText({
    sectionWords: { en: "Word targeting", de: "Wortzielsuche", es: "Objetivo de palabras", fr: "Ciblage de mots", "pt-br": "Alvo de palavras" },
    sliderSuggestions: { en: "Suggestions", de: "Vorschläge", es: "Sugerencias", fr: "Suggestions", "pt-br": "Sugestões" },
    wordModesToggle: { en: "Word modes", de: "Wortmodi", es: "Modos de palabras", fr: "Modes de mots", "pt-br": "Modos de palavras" },
    dualFoul: { en: "Foul words", de: "Schimpfwörter", es: "Palabras malsonantes", fr: "Mots grossiers", "pt-br": "Palavrões" },
    dualPokemon: { en: "Pokémon words", de: "Pokémon-Wörter", es: "Palabras Pokémon", fr: "Mots Pokémon", "pt-br": "Palavras Pokémon" },
    dualMinerals: { en: "Minerals", de: "Mineralien", es: "Minerales", fr: "Minéraux", "pt-br": "Minerais" },
    dualRare: { en: "Rare words", de: "Seltene Wörter", es: "Palabras raras", fr: "Mots rares", "pt-br": "Palavras raras" },
    dualTargetLength: { en: "Target length", de: "Ziellänge", es: "Longitud objetivo", fr: "Longueur cible", "pt-br": "Comprimento alvo" },
    labelMe: { en: "Me", de: "Ich", es: "Yo", fr: "Moi", "pt-br": "Eu" },
    labelSpectator: { en: "Spectator", de: "Zuschauer", es: "Espectador", fr: "Spectateur", "pt-br": "Espectador" },
    lenMax: { en: "Max", de: "Max", es: "Máx.", fr: "Max", "pt-br": "Máx." },
    dualHyphen: { en: "Hyphen only", de: "Nur Bindestrich", es: "Solo guiones", fr: "Tirets uniquement", "pt-br": "Somente hífen" },
    dualContains: { en: "Contains", de: "Enthält", es: "Contiene", fr: "Contient", "pt-br": "Contém" },
    inputContainsMe: { en: "Letters or fragment (me)", de: "Buchstaben oder Fragment (ich)", es: "Letras o fragmento (yo)", fr: "Lettres ou fragment (moi)", "pt-br": "Letras ou fragmento (eu)" },
    inputContainsSpectator: { en: "Letters or fragment (spectator)", de: "Buchstaben oder Fragment (Zuschauer)", es: "Letras o fragmento (espectador)", fr: "Lettres ou fragment (spectateur)", "pt-br": "Letras ou fragmento (espectador)" },
    sectionSuggestions: { en: "Live suggestions", de: "Live-Vorschläge", es: "Sugerencias en vivo", fr: "Suggestions en direct", "pt-br": "Sugestões ao vivo" },
    dynamicTitleSelf: { en: "My top picks", de: "Meine Favoriten", es: "Mis mejores opciones", fr: "Mes meilleures propositions", "pt-br": "Minhas melhores opções" },
    dynamicTitleSpectator: { en: "Spectator suggestions", de: "Vorschläge für Zuschauer", es: "Sugerencias para espectadores", fr: "Suggestions spectateur", "pt-br": "Sugestões para espectadores" },
    listEmpty: { en: "(none)", de: "(keine)", es: "(ninguna)", fr: "(aucune)", "pt-br": "(nenhuma)" },
    copySuccess: { en: "Copied", de: "Kopiert", es: "Copiado", fr: "Copié", "pt-br": "Copiado" },
    copyFail: { en: "Copy failed", de: "Kopieren fehlgeschlagen", es: "Error al copiar", fr: "Échec de la copie", "pt-br": "Falha ao copiar" }
  });

  addText({
    coverageExcluded: { en: "excluded", de: "ausgeschlossen", es: "excluido", fr: "exclu", "pt-br": "excluído" },
    coverageTallyTooltip: { en: "Left click to add progress, right click to remove.", de: "Linksklick, um Fortschritt hinzuzufügen, Rechtsklick, um zu entfernen.", es: "Clic izquierdo para sumar progreso, clic derecho para quitar.", fr: "Clic gauche pour ajouter du progrès, clic droit pour retirer.", "pt-br": "Clique esquerdo para adicionar progresso, direito para remover." },
    coverageGoalTooltip: { en: "Left click to raise the goal, right click to lower.", de: "Linksklick zum Erhöhen des Ziels, Rechtsklick zum Verringern.", es: "Clic izquierdo para subir la meta, clic derecho para bajar.", fr: "Clic gauche pour augmenter l'objectif, clic droit pour diminuer.", "pt-br": "Clique esquerdo para aumentar a meta, direito para diminuir." },
    coverageEditTalliesNotice: { en: "Editing tallies: left-click to add progress, right-click to remove. Values stay within each letter's goal.", de: "Zählwerte bearbeiten : Linksklick fügt Fortschritt hinzu, Rechtsklick entfernt ihn. Werte bleiben innerhalb des Zielwerts pro Buchstabe.", es: "Editando conteos: clic izquierdo para sumar progreso, clic derecho para quitar. Los valores se mantienen dentro de la meta de cada letra.", fr: "Édition des compteurs : clic gauche pour ajouter du progrès, clic droit pour retirer. Les valeurs restent dans l'objectif de chaque lettre.", "pt-br": "Editando contagens: clique esquerdo para adicionar progresso, clique direito para remover. Os valores ficam dentro da meta de cada letra." },
    coverageEditGoalsNotice: { en: "Editing goals: left-click to raise, right-click to lower, or type a number inside any letter box.", de: "Ziele bearbeiten : Linksklick erhöht, Rechtsklick verringert oder eine Zahl ins Feld eingeben.", es: "Editar metas: clic izquierdo para subir, clic derecho para bajar o escribe un número en cualquier casilla.", fr: "Modifier les objectifs : clic gauche pour augmenter, clic droit pour diminuer, ou saisissez un nombre dans une case.", "pt-br": "Editar metas: clique esquerdo para aumentar, clique direito para diminuir ou digite um número na caixa." },
    noticeFoulFallback: { en: "No foul words matched this prompt; using the normal word list.", de: "Keine Schimpfwörter passten auf diese Silbe ; normale Liste wird genutzt.", es: "Ninguna palabra malsonante coincide con este turno; se usa la lista normal.", fr: "Aucun mot grossier ne correspond à cette syllabe ; utilisation de la liste normale.", "pt-br": "Nenhum palavrão correspondeu a esta rodada; usando a lista normal." },
    noticePokemonFallback: { en: "No Pokémon words matched this prompt; falling back to regular suggestions.", de: "Keine Pokémon-Wörter passten; es werden normale Vorschläge verwendet.", es: "Ninguna palabra Pokémon coincide; se vuelve a las sugerencias normales.", fr: "Aucun mot Pokémon ne correspond ; retour aux suggestions classiques.", "pt-br": "Nenhuma palavra Pokémon correspondeu; voltando às sugestões normais." },
    noticeMineralsFallback: { en: "No mineral words matched this prompt; showing main list instead.", de: "Keine Mineralien-Wörter passten; Hauptliste wird angezeigt.", es: "Ninguna palabra de minerales coincide; se muestra la lista principal.", fr: "Aucun mot de minéraux ne correspond ; affichage de la liste principale.", "pt-br": "Nenhuma palavra de minerais correspondeu; mostrando a lista principal." },
    noticeRareFallback: { en: "No rare words matched this prompt; showing normal suggestions.", de: "Keine seltenen Wörter passten; normale Vorschläge werden angezeigt.", es: "Ninguna palabra rara coincide; se muestran sugerencias normales.", fr: "Aucun mot rare ne correspond ; affichage des suggestions normales.", "pt-br": "Nenhuma palavra rara correspondeu; mostrando sugestões normais." },
    noticeLengthCap: { en: "Limiting to words of <= {{target}} letters while maximizing alphabet coverage.", de: "Begrenzung auf Wörter mit <= {{target}} Buchstaben bei maximaler Alphabet-Abdeckung.", es: "Limitando a palabras de <= {{target}} letras mientras se maximiza la cobertura del alfabeto.", fr: "Limitation aux mots de <= {{target}} lettres tout en maximisant la couverture de l'alphabet.", "pt-br": "Limitando a palavras com <= {{target}} letras enquanto maximiza a cobertura do alfabeto." },
    noticeLengthRelaxed: { en: "No words of <= {{target}} letters found; using best coverage regardless of length.", de: "Keine Wörter mit <= {{target}} Buchstaben gefunden; beste Abdeckung unabhängig von der Länge.", es: "No se encontraron palabras de <= {{target}} letras; usando la mejor cobertura sin importar la longitud.", fr: "Aucun mot de <= {{target}} lettres trouvé ; on utilise la meilleure couverture, quelle que soit la longueur.", "pt-br": "Nenhuma palavra com <= {{target}} letras encontrada; usando a melhor cobertura independentemente do tamanho." },
    noticeLengthFlexMax: { en: "No words at the maximum length; trying nearby lengths.", de: "Keine Wörter in der Maximallänge; versuche ähnliche Längen.", es: "No hay palabras en la longitud máxima; probando longitudes cercanas.", fr: "Aucun mot à la longueur maximale ; essai de longueurs voisines.", "pt-br": "Nenhuma palavra no comprimento máximo; tentando comprimentos próximos." },
    noticeLengthFlex: { en: "No words with exactly {{target}} letters; trying nearby lengths.", de: "Keine Wörter mit genau {{target}} Buchstaben; versuche ähnliche Längen.", es: "No hay palabras con exactamente {{target}} letras; probando longitudes cercanas.", fr: "Aucun mot avec exactement {{target}} lettres ; essai de longueurs proches.", "pt-br": "Nenhuma palavra com exatamente {{target}} letras; tentando comprimentos próximos." },
    noticeLengthSuppressed: { en: "Target length ignored because higher-priority lists supplied enough options.", de: "Ziellänge ignoriert, weil höher priorisierte Listen genügend Optionen lieferten.", es: "Longitud objetivo ignorada porque las listas prioritarias dieron suficientes opciones.", fr: "Longueur cible ignorée car des listes prioritaires ont fourni assez d'options.", "pt-br": "Comprimento alvo ignorado porque listas prioritárias forneceram opções suficientes." },
    noticeContainsFallback: { en: "Contains filter: no matches found; showing broader results.", de: "Enthält-Filter : keine Treffer; es werden breitere Ergebnisse angezeigt.", es: "Filtro Contiene: sin coincidencias; mostrando resultados más amplios.", fr: "Filtre Contient : aucune correspondance ; affichage de résultats plus larges.", "pt-br": "Filtro Contém: nenhum resultado; exibindo opções mais amplas." },
    noticeHyphenFallback: { en: "Hyphen mode: no hyphenated words matched this prompt.", de: "Bindestrich-Modus : keine Wörter mit Bindestrich passten.", es: "Modo guion: ninguna palabra con guion coincide.", fr: "Mode tiret : aucun mot avec tiret ne correspond.", "pt-br": "Modo hífen: nenhuma palavra com hífen correspondeu." }
  });

  addText({
    lenNoticeCoverageFoul: { en: "Target length (me): with coverage on it acts as a max (<= {{target}}); foul words still take priority.", de: "Ziellänge (ich) : mit aktivierter Abdeckung wirkt sie als Maximum (<= {{target}}); Schimpfwörter haben weiterhin Priorität.", es: "Longitud objetivo (yo): con cobertura activada funciona como máximo (<= {{target}}); las palabras malsonantes siguen teniendo prioridad.", fr: "Longueur cible (moi) : avec la couverture activée, elle agit comme un maximum (<= {{target}}) ; les mots grossiers restent prioritaires.", "pt-br": "Comprimento alvo (eu): com cobertura ligada age como máximo (<= {{target}}); palavrões ainda têm prioridade." },
    lenNoticeCoverage: { en: "Target length (me): acts as a max (<= {{target}}) while optimizing alphabet coverage.", de: "Ziellänge (ich) : fungiert als Maximum (<= {{target}}) und optimiert die Alphabet-Abdeckung.", es: "Longitud objetivo (yo): actúa como un máximo (<= {{target}}) mientras optimiza la cobertura del alfabeto.", fr: "Longueur cible (moi) : agit comme un maximum (<= {{target}}) tout en optimisant la couverture de l'alphabet.", "pt-br": "Comprimento alvo (eu): atua como máximo (<= {{target}}) ao otimizar a cobertura do alfabeto." },
    lenNoticeFoul: { en: "Target length (me): ignored when foul words are available; used only if none match.", de: "Ziellänge (ich) : ignoriert, wenn Schimpfwörter verfügbar sind; nur genutzt, wenn keine passen.", es: "Longitud objetivo (yo): se ignora cuando hay palabras malsonantes disponibles; solo se usa si ninguna coincide.", fr: "Longueur cible (moi) : ignorée lorsque des mots grossiers sont disponibles ; utilisée seulement si rien ne correspond.", "pt-br": "Comprimento alvo (eu): ignorado quando há palavrões disponíveis; usado apenas se nenhum corresponder." },
    lenNoticeDefault: { en: "Target length (me): exact matches show green, nearby lengths appear in yellow when needed.", de: "Ziellänge (ich): exakte Treffer werden grün angezeigt, nahe Längen erscheinen bei Bedarf gelb.", es: "Longitud objetivo (yo): coincidencias exactas en verde, longitudes cercanas aparecen en amarillo cuando se necesitan.", fr: "Longueur cible (moi) : correspondances exactes en vert, longueurs proches en jaune si nécessaire.", "pt-br": "Comprimento alvo (eu): correspondências exatas em verde, comprimentos próximos aparecem em amarelo quando necessário." },
    lenNoticeSpecFoul: { en: "Target length (spectator): ignored whenever foul words are available for the prompt.", de: "Ziellänge (Zuschauer): ignoriert, sobald Schimpfwörter verfügbar sind.", es: "Longitud objetivo (espectador): se ignora cuando hay palabras malsonantes disponibles.", fr: "Longueur cible (spectateur) : ignorée dès que des mots grossiers sont disponibles.", "pt-br": "Comprimento alvo (espectador): ignorado sempre que há palavrões disponíveis." },
    lenNoticeSpecDefault: { en: "Target length (spectator): exact matches show green; nearby lengths are marked in yellow.", de: "Ziellänge (Zuschauer): exakte Treffer werden grün angezeigt; nahe Längen sind gelb markiert.", es: "Longitud objetivo (espectador): coincidencias exactas en verde; longitudes cercanas marcadas en amarillo.", fr: "Longueur cible (spectateur) : correspondances exactes en vert ; longueurs proches marquées en jaune.", "pt-br": "Comprimento alvo (espectador): correspondências exatas em verde; comprimentos próximos marcados em amarelo." },
    legendFoul: { en: "foul", de: "Schimpfwörter", es: "malsonante", fr: "grossier", "pt-br": "palavrão" },
    legendLengthMatch: { en: "matches target length", de: "entspricht der Ziellänge", es: "coincide con la longitud objetivo", fr: "correspond à la longueur cible", "pt-br": "combina com o comprimento alvo" },
    legendLengthNear: { en: "nearby length", de: "nahe Länge", es: "longitud cercana", fr: "longueur proche", "pt-br": "comprimento próximo" },
    legendHyphen: { en: "hyphen words", de: "Bindestrich-Wörter", es: "palabras con guion", fr: "mots avec tiret", "pt-br": "palavras com hífen" },
    legendContains: { en: "contains filter", de: "Enthält-Filter", es: "filtro contiene", fr: "filtre contient", "pt-br": "filtro contém" },
    legendPokemon: { en: "Pokémon", de: "Pokémon", es: "Pokémon", fr: "Pokémon", "pt-br": "Pokémon" },
    legendMinerals: { en: "minerals", de: "Mineralien", es: "minerales", fr: "minéraux", "pt-br": "minerais" },
    legendRare: { en: "rare", de: "selten", es: "raras", fr: "rares", "pt-br": "raras" },
    legendRegular: { en: "regular", de: "normal", es: "normal", fr: "classique", "pt-br": "normal" },
    legendDismiss: { en: "click to hide", de: "klicken zum Ausblenden", es: "haz clic para ocultar", fr: "cliquer pour masquer", "pt-br": "clique para ocultar" }
  });

  addText({
    preventReuseSection: { en: "Word history", de: "Wortverlauf", es: "Historial de palabras", fr: "Historique des mots", "pt-br": "Histórico de palavras" },
    togglePreventReuse: { en: "Prevent word reuse", de: "Wortwiederholung verhindern", es: "Evitar reutilizar palabras", fr: "Éviter de réutiliser les mots", "pt-br": "Evitar reutilizar palavras" },
    wordHistoryInfo: { en: "Words used this match won't be suggested again.", de: "Wörter aus dieser Runde werden nicht erneut vorgeschlagen.", es: "Las palabras usadas en esta partida no se sugerirán de nuevo.", fr: "Les mots utilisés pendant cette partie ne seront plus proposés.", "pt-br": "As palavras usadas nesta partida não serão sugeridas novamente." },
    wordLogHeading: { en: "Recent words", de: "Neueste Wörter", es: "Palabras recientes", fr: "Mots récents", "pt-br": "Palavras recentes" },
    wordLogEmpty: { en: "No words logged yet.", de: "Noch keine Wörter protokolliert.", es: "Aún no hay palabras registradas.", fr: "Aucun mot enregistré pour l'instant.", "pt-br": "Nenhuma palavra registrada ainda." },
    wordLogSelfTag: { en: "You", de: "Du", es: "Tú", fr: "Vous", "pt-br": "Você" },
    wordLogOtherTag: { en: "Others", de: "Andere", es: "Otros", fr: "Autres", "pt-br": "Outros" },
    buttonResetWordLog: { en: "Reset logged words", de: "Wortverlauf zurücksetzen", es: "Restablecer registro de palabras", fr: "Réinitialiser l'historique", "pt-br": "Redefinir palavras registradas" },
    notificationGameReset: { en: "New game detected — alphabet list and word history reset.", de: "Neue Partie erkannt – Alphabetliste und Wortverlauf zurückgesetzt.", es: "Nueva partida detectada — lista del alfabeto y historial reiniciados.", fr: "Nouvelle partie détectée — liste alphabet et historique réinitialisés.", "pt-br": "Nova partida detectada — lista do alfabeto e histórico de palavras redefinidos." },
    notificationWordListError: { en: "Couldn't load words for {{language}} — check your connection.", de: "Konnte Wörter für {{language}} nicht laden – überprüfe deine Verbindung.", es: "No se pudieron cargar las palabras para {{language}} — verifica tu conexión.", fr: "Impossible de charger les mots pour {{language}} — vérifiez votre connexion.", "pt-br": "Não foi possível carregar as palavras para {{language}} — verifique sua conexão." }
  });

  const translator = (() => {
    const fallbackLang = "en";
    let currentLang = typeof game.normalizeLang === "function" ? game.normalizeLang(game.lang) : (game.lang || fallbackLang);
    const bindings = [];

    const normalizeLang = (lang) => (typeof game.normalizeLang === "function" ? game.normalizeLang(lang) : (lang || fallbackLang));

    const formatTemplate = (template, params) => {
      if (!params) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const value = Object.prototype.hasOwnProperty.call(params, key) ? params[key] : '';
        return value === undefined || value === null ? '' : String(value);
      });
    };

    const translateKey = (key, params = {}, fallback) => {
      const lang = normalizeLang(currentLang);
      const entry = UI_TEXT[key] || {};
      let template = entry[lang];
      if (template === undefined) template = entry[fallbackLang];
      if (template === undefined) template = fallback !== undefined ? fallback : key;
      if (typeof template === 'string') {
        return formatTemplate(template, params);
      }
      return template;
    };

    const updateBinding = (binding) => {
      const params = typeof binding.getParams === 'function' ? binding.getParams() : binding.params;
      const text = translateKey(binding.key, params, binding.fallback);
      if (binding.attribute) {
        binding.node.setAttribute(binding.attribute, text);
      } else if (binding.html) {
        binding.node.innerHTML = text;
      } else if (binding.transform) {
        binding.transform(binding.node, text);
      } else {
        binding.node.textContent = text;
      }
    };

    const bind = (node, key, options = {}) => {
      const binding = { node, key, ...options };
      bindings.push(binding);
      updateBinding(binding);
      return node;
    };

    const refresh = (lang) => {
      currentLang = normalizeLang(lang || currentLang);
      bindings.forEach(updateBinding);
    };

    return {
      t: translateKey,
      bind,
      refresh,
      current: () => currentLang
    };
  })();

  const clampNumber = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  const getBool = (value, fallback) => (typeof value === "boolean" ? value : fallback);

  let hudSizePercent = clampNumber(savedSettings?.hudSizePercent, 20, 70, 45);

  const defaultCollapsedSections = {
    automation: false,
    hud: false,
    messages: false,
    coverage: false,
    wordTargeting: false,
    suggestions: false,
    wordHistory: false,
  };
  const collapsedSections = Object.assign({}, defaultCollapsedSections, savedSettings?.collapsedSections || {});
  let wordModesCollapsed = !!savedSettings?.wordModesCollapsed;

  const setIfString = (val, setter) => { if (typeof val === "string") setter(val); };

  const formatTargetLenLabel = (pref, actual) => {
    if (pref >= 21) {
      return actual ? `${actual} (max)` : "max";
    }
    return `${pref}`;
  };

  game.paused = !getBool(savedSettings?.autoTypeEnabled, true);
  game.instantMode = getBool(savedSettings?.instantMode, game.instantMode);
  game.mistakesEnabled = getBool(savedSettings?.mistakesEnabled, game.mistakesEnabled);
  game.superRealisticEnabled = getBool(savedSettings?.superRealisticEnabled, game.superRealisticEnabled);
  game.autoSuicide = getBool(savedSettings?.autoSuicide, game.autoSuicide);
  game.setAutoJoinAlways(getBool(savedSettings?.autoJoinAlways, game.autoJoinAlways));
  game.foulMode = getBool(savedSettings?.foulMode, game.foulMode);
  game.coverageMode = getBool(savedSettings?.coverageMode, game.coverageMode);
  game.lengthMode = getBool(savedSettings?.lengthMode, game.lengthMode);
  game.specLengthMode = getBool(savedSettings?.specLengthMode, game.specLengthMode);
  game.specFoulMode = getBool(savedSettings?.specFoulMode, game.specFoulMode);
  game.hyphenMode = getBool(savedSettings?.hyphenMode, game.hyphenMode);
  game.specHyphenMode = getBool(savedSettings?.specHyphenMode, game.specHyphenMode);
  game.containsMode = getBool(savedSettings?.containsMode, game.containsMode);
  game.specContainsMode = getBool(savedSettings?.specContainsMode, game.specContainsMode);
  game.pokemonMode = getBool(savedSettings?.pokemonMode, game.pokemonMode);
  game.specPokemonMode = getBool(savedSettings?.specPokemonMode, game.specPokemonMode);
  game.mineralsMode = getBool(savedSettings?.mineralsMode, game.mineralsMode);
  game.specMineralsMode = getBool(savedSettings?.specMineralsMode, game.specMineralsMode);
  game.rareMode = getBool(savedSettings?.rareMode, game.rareMode);
  game.specRareMode = getBool(savedSettings?.specRareMode, game.specRareMode);
  game.preventReuseEnabled = getBool(savedSettings?.preventReuseEnabled, game.preventReuseEnabled);
  game.preMsgEnabled = getBool(savedSettings?.preMsgEnabled, game.preMsgEnabled);
  game.postfixEnabled = getBool(savedSettings?.postfixEnabled, game.postfixEnabled);

  game.setSpeed(clampNumber(savedSettings?.speed, 1, 12, game.speed));
  game.setThinkingDelaySec(clampNumber(savedSettings?.thinkingDelaySec, 0, 5, game.thinkingDelaySec));
  const savedMistakeProb = typeof savedSettings?.mistakesProb === "number" ? savedSettings.mistakesProb : game.mistakesProb;
  game.setMistakesProb(Math.max(0, Math.min(0.30, Number(savedMistakeProb))));
  const savedRealAgg = typeof savedSettings?.superRealisticAggression === "number" ? savedSettings.superRealisticAggression : game.superRealisticAggression;
  game.setSuperRealisticAggression(savedRealAgg);
  const savedRealPause = typeof savedSettings?.superRealisticPauseSec === "number" ? savedSettings.superRealisticPauseSec : game.superRealisticPauseSec;
  game.setSuperRealisticPauseSec(savedRealPause);
  game.setSuggestionsLimit(clampNumber(savedSettings?.suggestionsLimit, 1, 20, game.suggestionsLimit));
  const defaultTargetPref = Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen;
  const defaultSpecTargetPref = Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen;
  game.setTargetLen(clampNumber(savedSettings?.targetLen, 3, 21, defaultTargetPref));
  game.setSpecTargetLen(clampNumber(savedSettings?.specTargetLen, 3, 21, defaultSpecTargetPref));

  setIfString(savedSettings?.preMsgText, (val) => game.setPreMsgText(val));
  setIfString(savedSettings?.postfixText, (val) => game.setPostfixText(val));
  setIfString(savedSettings?.containsText, (val) => game.setContainsText(val));
  setIfString(savedSettings?.specContainsText, (val) => game.setSpecContainsText(val));
  setIfString(savedSettings?.excludeSpec, (val) => game.setExcludeSpec(val));

  game.setExcludeEnabled(getBool(savedSettings?.excludeEnabled, game.excludeEnabled));
  if (Array.isArray(savedSettings?.priorityOrder)) {
    game.setPriorityOrder(savedSettings.priorityOrder);
  }

  if (Array.isArray(sessionData?.coverageCounts) && sessionData.coverageCounts.length === 26) {
    for (let i = 0; i < 26; i++) {
      const raw = Number(sessionData.coverageCounts[i]);
      if (Number.isFinite(raw)) {
        game.coverageCounts[i] = Math.max(0, Math.min(99, Math.floor(raw)));
      }
    }
  }

  const collectSettings = () => ({
    hudSizePercent,
    autoTypeEnabled: !game.paused,
    instantMode: !!game.instantMode,
    mistakesEnabled: !!game.mistakesEnabled,
    autoSuicide: !!game.autoSuicide,
    autoJoinAlways: !!game.autoJoinAlways,
    foulMode: !!game.foulMode,
    coverageMode: !!game.coverageMode,
    excludeEnabled: !!game.excludeEnabled,
    lengthMode: !!game.lengthMode,
    specLengthMode: !!game.specLengthMode,
    specFoulMode: !!game.specFoulMode,
    hyphenMode: !!game.hyphenMode,
    specHyphenMode: !!game.specHyphenMode,
    containsMode: !!game.containsMode,
    specContainsMode: !!game.specContainsMode,
    pokemonMode: !!game.pokemonMode,
    specPokemonMode: !!game.specPokemonMode,
    mineralsMode: !!game.mineralsMode,
    specMineralsMode: !!game.specMineralsMode,
    rareMode: !!game.rareMode,
    specRareMode: !!game.specRareMode,
    speed: game.speed,
    thinkingDelaySec: game.thinkingDelaySec,
    mistakesProb: game.mistakesProb,
    superRealisticEnabled: !!game.superRealisticEnabled,
    superRealisticAggression: game.superRealisticAggression,
    superRealisticPauseSec: game.superRealisticPauseSec,
    suggestionsLimit: game.suggestionsLimit,
    targetLen: Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen,
    specTargetLen: Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen,
    preMsgEnabled: !!game.preMsgEnabled,
    preMsgText: game.preMsgText || "",
    postfixEnabled: !!game.postfixEnabled,
    postfixText: game.postfixText || "",
    containsText: game.containsText || "",
    specContainsText: game.specContainsText || "",
    excludeSpec: game.excludeSpec || "",
    priorityOrder: Array.isArray(game.priorityOrder) ? game.priorityOrder.slice() : [],
    preventReuseEnabled: !!game.preventReuseEnabled,
    collapsedSections: Object.assign({}, collapsedSections),
    wordModesCollapsed: !!wordModesCollapsed
  });

  let saveTimer = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveSettingsNow(collectSettings()); }, 120);
  };

  let talliesTimer = null;
  const scheduleTalliesSave = () => {
    if (talliesTimer) clearTimeout(talliesTimer);
    talliesTimer = setTimeout(() => {
      const counts = Array.isArray(game.coverageCounts) ? game.coverageCounts.slice(0, 26) : [];
      saveTalliesNow({ coverageCounts: counts });
    }, 120);
  };

  const recomputeSuggestions = () => {
    if (game.myTurn && game.syllable) {
      game.lastTopPicksSelf = game.getTopCandidates(game.syllable, game.suggestionsLimit);
    } else if (game.lastSpectatorSyllable) {
      game.generateSpectatorSuggestions(game.lastSpectatorSyllable, game.suggestionsLimit);
    }
  };

  const requestSave = (opts = {}) => {
    if (opts.recompute) recomputeSuggestions();
    scheduleSave();
  };

  game._notifySettingsChanged = (opts = {}) => {
    requestSave(opts);
  };

  const setSectionCollapsed = (id, collapsed, options = {}) => {
    if (!id) return;
    const next = !!collapsed;
    if (collapsedSections[id] === next) return;
    collapsedSections[id] = next;
    if (!options.silent) requestSave();
  };

  const autoJoinManager = (() => {
    let enabled = false;
    let checkTimer = null;
    let bodyObserver = null;
    let buttonObserver = null;
    let observedButton = null;
    let lastClickTime = 0;

    const ATTRIBUTE_NAMES = [
      "aria-pressed",
      "aria-checked",
      "data-active",
      "data-selected",
      "data-state",
      "data-enabled",
      "data-checked",
      "data-pressed"
    ];
    const ATTRIBUTE_FILTER = ["class", ...ATTRIBUTE_NAMES];
    const TRUTHY_VALUES = new Set(["true", "1", "on", "yes", "y"]);
    const FALSY_VALUES = new Set(["false", "0", "off", "no", "n"]);
    const CLASS_INDICATORS = ["red", "selected", "active", "enabled", "on", "pressed", "checked"];
    const DATA_KEYS = ["active", "selected", "state", "enabled", "checked", "pressed"];

    const interpret = (value) => {
      if (typeof value !== "string") return null;
      const normalized = value.trim().toLowerCase();
      if (TRUTHY_VALUES.has(normalized)) return true;
      if (FALSY_VALUES.has(normalized)) return false;
      return null;
    };

    const isButtonActive = (btn) => {
      if (!btn) return false;
      for (const cls of CLASS_INDICATORS) {
        if (btn.classList.contains(cls)) return true;
      }
      for (const attr of ATTRIBUTE_NAMES) {
        const interpreted = interpret(btn.getAttribute(attr));
        if (interpreted !== null) return interpreted;
      }
      const dataset = btn.dataset || {};
      for (const key of DATA_KEYS) {
        const interpreted = interpret(dataset[key]);
        if (interpreted !== null) return interpreted;
      }
      return false;
    };

    const detachButtonObserver = () => {
      if (buttonObserver) {
        buttonObserver.disconnect();
        buttonObserver = null;
      }
      observedButton = null;
    };

    const ensureButtonObserved = (btn) => {
      if (!btn || observedButton === btn) return;
      detachButtonObserver();
      observedButton = btn;
      buttonObserver = new MutationObserver(() => ensureAutoJoin());
      try {
        buttonObserver.observe(btn, {
          attributes: true,
          attributeFilter: ATTRIBUTE_FILTER,
          childList: true,
          characterData: true,
          subtree: true
        });
      } catch (err) {
        console.warn("[BombPartyShark] Failed to observe auto-join button", err);
      }
    };

    const clickButton = (btn) => {
      if (!btn) return;
      if (typeof btn.click === "function") {
        btn.click();
      } else {
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }
    };

    const ensureAutoJoin = () => {
      if (!enabled) return;
      const btn = document.querySelector("button.autojoinButton");
      if (!btn) {
        detachButtonObserver();
        return;
      }
      ensureButtonObserved(btn);
      if (isButtonActive(btn)) return;
      const now = Date.now();
      if (now - lastClickTime < 200) return;
      lastClickTime = now;
      clickButton(btn);
    };

    const start = () => {
      if (!bodyObserver) {
        bodyObserver = new MutationObserver(() => ensureAutoJoin());
        bodyObserver.observe(document.body, { childList: true, subtree: true });
      }
      if (!checkTimer) {
        checkTimer = window.setInterval(ensureAutoJoin, 2000);
      }
      ensureAutoJoin();
    };

    const stop = () => {
      if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
      }
      if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
      }
      detachButtonObserver();
    };

    return {
      update(value) {
        const next = !!value;
        if (next === enabled) {
          if (enabled) ensureAutoJoin();
          return;
        }
        enabled = next;
        if (enabled) start();
        else stop();
      },
      poke() {
        if (enabled) ensureAutoJoin();
      },
      disconnect() {
        stop();
      }
    };
  })();

  game.setTalliesChangedCallback(() => {
    scheduleTalliesSave();
    recomputeSuggestions();
  });
  scheduleTalliesSave();

  const toast = document.createElement("div");
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translate(-50%, -20px)",
    padding: "10px 16px",
    borderRadius: "999px",
    background: "rgba(14,165,233,0.85)",
    color: "#ecfeff",
    fontWeight: "700",
    fontSize: "13px",
    letterSpacing: "0.25px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
    opacity: "0",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    pointerEvents: "none",
    zIndex: "2147483647"
  });
  let toastTimer = null;
  let activeToast = null;
  const hideToast = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, -20px)";
    activeToast = null;
  };
  const showToast = (key, duration = 2600, params = undefined) => {
    activeToast = { key, params: params || {} };
    toast.textContent = translator.t(key, activeToast.params);
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hideToast();
    }, Math.max(1200, duration));
  };
  const updateToastLanguage = () => {
    if (activeToast) {
      toast.textContent = translator.t(activeToast.key, activeToast.params);
    }
  };
  let joinObserver = null;
  let joinCheckTimer = null;
  let lastJoinVisible = false;

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
    width: "520px",
    transformOrigin: "left top",
  });
  wrap.appendChild(box);

  // scale (range 20-70; default ~45)
  let hudScale = hudSizePercent / 100;
  const applyScale = () => { box.style.transform = `scale(${hudScale})`; };
  applyScale();

  // header (drag + collapse)
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    cursor: "grab",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    paddingBottom: "8px",
    marginBottom: "10px"
  });

  const headerRow = document.createElement("div");
  Object.assign(headerRow.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px"
  });
  header.appendChild(headerRow);

  const titleEl = document.createElement("span");
  translator.bind(titleEl, "title");
  Object.assign(titleEl.style, { fontWeight: 800, fontSize: "16px", letterSpacing: "0.2px" });
  headerRow.appendChild(titleEl);

  const headerActions = document.createElement("div");
  Object.assign(headerActions.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px"
  });
  headerRow.appendChild(headerActions);

  const languageStatus = document.createElement("span");
  translator.bind(languageStatus, "currentLanguage", {
    getParams: () => ({ language: game.languageDisplayName() })
  });
  Object.assign(languageStatus.style, {
    fontSize: "12px",
    fontWeight: "600",
    color: "#cbd5f5",
    letterSpacing: "0.2px"
  });
  languageStatus.addEventListener("mousedown", (ev) => ev.stopPropagation());
  languageStatus.addEventListener("click", (ev) => ev.stopPropagation());
  headerActions.appendChild(languageStatus);

  const forceSaveBtn = document.createElement("button");
  translator.bind(forceSaveBtn, "forceSave");
  Object.assign(forceSaveBtn.style, {
    padding: "4px 10px",
    borderRadius: "999px",
    border: "1px solid rgba(96,165,250,0.65)",
    background: "rgba(59,130,246,0.20)",
    color: "#bfdbfe",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px",
    letterSpacing: "0.2px"
  });
  forceSaveBtn.addEventListener("mousedown", (ev) => ev.stopPropagation());
  let forceSaveTimer = null;
  const forceSaveStatus = document.createElement("span");
  translator.bind(forceSaveStatus, "forceSaveSaved");
  Object.assign(forceSaveStatus.style, {
    fontSize: "12px",
    fontWeight: "700",
    color: "#22c55e",
    opacity: "0",
    transition: "opacity 0.2s ease",
    pointerEvents: "none"
  });
  forceSaveBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    saveSettingsNow(collectSettings());
    const counts = Array.isArray(game.coverageCounts) ? game.coverageCounts.slice(0, 26) : [];
    saveTalliesNow({ coverageCounts: counts });
    if (forceSaveTimer) clearTimeout(forceSaveTimer);
    forceSaveStatus.style.opacity = "1";
    forceSaveTimer = setTimeout(() => { forceSaveStatus.style.opacity = "0"; }, 1400);
  });
  headerActions.appendChild(forceSaveBtn);
  forceSaveStatus.addEventListener("mousedown", (ev) => ev.stopPropagation());
  forceSaveStatus.addEventListener("click", (ev) => ev.stopPropagation());
  headerActions.appendChild(forceSaveStatus);

  box.appendChild(header);

  // Tabs
  const tabs = document.createElement("div");
  Object.assign(tabs.style, { display:"flex", gap:"8px", marginBottom:"10px" });
  const mkTab = (labelKey) => {
    const b = document.createElement("button");
    translator.bind(b, labelKey);
    Object.assign(b.style, { padding:"6px 10px", borderRadius:"8px", cursor:"pointer",
      border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.06)", fontWeight:700 });
    b._setActive = (on)=> {
      b.style.background = on ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)";
      b.style.border = on ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.2)";
      };
    return b;
  };
  const mainTabBtn = mkTab("tabMain");
  const covTabBtn  = mkTab("tabCoverage");
  const wordsTabBtn= mkTab("tabWords");
  tabs.appendChild(mainTabBtn); tabs.appendChild(covTabBtn); tabs.appendChild(wordsTabBtn);
  box.appendChild(tabs);

  // sections
  const mainSec = document.createElement("div");
  const covSec  = document.createElement("div");
  const wordsSec= document.createElement("div");
  box.appendChild(mainSec); box.appendChild(covSec); box.appendChild(wordsSec);

  // default to Words
  let active = "Words";
  let coverageEditMode = "off";
  const setActive = (name) => {
    active = name;
    mainSec.style.display  = name==="Main" ? "block" : "none";
    covSec.style.display   = name==="Coverage" ? "block" : "none";
    wordsSec.style.display = name==="Words" ? "block" : "none";
    mainTabBtn._setActive(name==="Main");
    covTabBtn._setActive(name==="Coverage");
    wordsTabBtn._setActive(name==="Words");
    if (name !== "Coverage") coverageEditMode = "off";
  };
  mainTabBtn.onclick = () => setActive("Main");
  covTabBtn.onclick  = () => setActive("Coverage");
  wordsTabBtn.onclick= () => setActive("Words");
  setActive("Words");

  // helpers
  const toggleThemes = {
    default: { onBg: "rgba(59,130,246,0.24)", onBorder: "rgba(59,130,246,0.55)", onColor: "#bfdbfe" },
    purple:  { onBg: "rgba(168,85,247,0.26)", onBorder: "rgba(147,51,234,0.65)", onColor: "#e9d5ff" },
    white:   { onBg: "rgba(248,250,252,0.28)", onBorder: "rgba(226,232,240,0.65)", onColor: "#f8fafc" },
    yellow:  { onBg: "rgba(253,224,71,0.24)", onBorder: "rgba(250,204,21,0.70)", onColor: "#facc15" },
    gold:    { onBg: "rgba(250,204,21,0.28)", onBorder: "rgba(234,179,8,0.72)", onColor: "#fde047" },
    red:     { onBg: "rgba(248,113,113,0.26)", onBorder: "rgba(239,68,68,0.70)", onColor: "#fecaca" },
    green:   { onBg: "rgba(74,222,128,0.26)", onBorder: "rgba(34,197,94,0.65)", onColor: "#bbf7d0" },
    pink:    { onBg: "rgba(236,72,153,0.25)", onBorder: "rgba(244,114,182,0.68)", onColor: "#fce7f3" },
    teal:    { onBg: "rgba(45,212,191,0.26)", onBorder: "rgba(20,184,166,0.68)", onColor: "#ccfbf1" },
    brown:   { onBg: "rgba(120,53,15,0.32)", onBorder: "rgba(146,64,14,0.68)", onColor: "#fbbf24" },
    cyan:    { onBg: "rgba(34,211,238,0.28)", onBorder: "rgba(6,182,212,0.65)", onColor: "#a5f3fc" }
  };
  const toggleOff = { bg: "rgba(30,41,59,0.55)", border: "rgba(71,85,105,0.55)", color: "#cbd5f5" };

  const applyToggleStyle = (btn, on, scheme = "default", mode = "status") => {
    const theme = toggleThemes[scheme] || toggleThemes.default;
    btn.dataset.scheme = scheme;
    btn.dataset.mode = mode;
    if (mode === "status") {
      btn.textContent = translator.t(on ? "toggleOn" : "toggleOff");
      btn.style.letterSpacing = "0.3px";
      btn.style.fontSize = "13px";
    } else {
      btn.style.letterSpacing = "0.4px";
      btn.style.fontSize = "12px";
    }
    btn.style.background = on ? theme.onBg : toggleOff.bg;
    btn.style.border = `1px solid ${on ? theme.onBorder : toggleOff.border}`;
    btn.style.color = on ? theme.onColor : toggleOff.color;
    btn.style.fontWeight = "800";
    btn.style.borderRadius = "10px";
    btn.style.padding = "6px 12px";
    btn.style.cursor = "pointer";
    btn.style.minWidth = mode === "status" ? "64px" : "54px";
    btn.style.textAlign = "center";
    btn.style.transition = "background 0.15s ease, border 0.15s ease, color 0.15s ease";
    btn.style.boxShadow = on ? `0 0 0 1px ${theme.onBorder}` : "none";
  };
  const applyToggleBtn = (btn, on, scheme = "default", mode = "status") => applyToggleStyle(btn, !!on, scheme, mode);

  const priorityControls = new Map();
  const priorityKeys = ["contains", "foul", "coverage", "hyphen", "length"];
  const attachPriorityControl = (row, key) => {
    if (!row || !row._labelSpan || priorityControls.has(key)) return;
    const span = row._labelSpan;
    span.style.display = "inline-flex";
    span.style.alignItems = "center";
    span.style.gap = "6px";
    const select = document.createElement("select");
    for (let i = 1; i <= priorityKeys.length; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `#${i}`;
      select.appendChild(opt);
    }
    Object.assign(select.style, {
      background: "rgba(15,23,42,0.65)",
      color: "#e2e8f0",
      border: "1px solid rgba(148,163,184,0.4)",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: "700",
      padding: "2px 4px",
      cursor: "pointer"
    });
    select.addEventListener("change", () => {
      const pos = Math.max(0, Math.min(priorityKeys.length - 1, parseInt(select.value, 10) - 1 || 0));
      game.setPriorityPosition(key, pos);
      requestSave({ recompute: true });
      render();
    });
    span.appendChild(select);
    priorityControls.set(key, select);
  };

  const mkRow = (labelKey, onClick, getOn, scheme = "default", mode = "status", options = {}) => {
    const r = document.createElement("div");
    Object.assign(r.style, { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", margin:"8px 0" });
    const span = document.createElement("span");
    translator.bind(span, labelKey);
    span.style.fontWeight = "600";
    r.appendChild(span);
    r._labelSpan = span;
    const btn = document.createElement("button");
    if (mode !== "status") {
      btn.dataset.labelKey = labelKey;
      translator.bind(btn, labelKey);
    }
    btn.addEventListener("click", () => {
      onClick();
      if (typeof options.after === "function") options.after();
      if (options.recompute) requestSave({ recompute: true });
      else requestSave();
      render();
    });
    r.appendChild(btn);
    btn.dataset.mode = mode;
    r._btn = btn; r._get = getOn; r._scheme = scheme; r._mode = mode; r._labelKey = labelKey;
    return r;
  };

  const mkDualRow = (labelKey, configs) => {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display:"flex",
      alignItems:"center",
      justifyContent:"space-between",
      gap:"16px",
      flexWrap:"wrap",
      margin:"8px 0"
    });
    const span = document.createElement("span");
    translator.bind(span, labelKey);
    span.style.fontWeight = "600";
    row.appendChild(span);
    row._labelSpan = span;
    const btnWrap = document.createElement("div");
    Object.assign(btnWrap.style, { display:"flex", gap:"8px", flexWrap:"wrap" });
    row.appendChild(btnWrap);
    row._buttons = [];
    configs.forEach(cfg => {
      const btn = document.createElement("button");
      btn.dataset.mode = "label";
      if (cfg.labelKey) {
        btn.dataset.labelKey = cfg.labelKey;
        translator.bind(btn, cfg.labelKey);
      } else if (cfg.label) {
        btn.textContent = cfg.label;
      }
      btn.addEventListener("click", () => {
        cfg.onClick();
        if (typeof cfg.after === "function") cfg.after();
        if (cfg.recompute) requestSave({ recompute: true });
        else requestSave();
        render();
      });
      btnWrap.appendChild(btn);
      row._buttons.push({ btn, getOn: cfg.getOn, scheme: cfg.scheme || "default", mode: "label" });
    });
    return row;
  };

  function sliderRow(labelKey, min, max, val, step, oninput, options = {}){
    const row = document.createElement("div");
    Object.assign(row.style, {
      display:"grid",
      gridTemplateColumns:"auto 1fr auto",
      alignItems:"center",
      gap:"14px",
      margin:"10px 0"
    });
    const span = document.createElement("span");
    translator.bind(span, labelKey);
    span.style.fontWeight = "600";
    const input = document.createElement("input");
    input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(val);
    const accent = options.accent || "#60a5fa";
    input.style.accentColor = accent;
    const valEl = document.createElement("span"); valEl.style.opacity = "0.9"; valEl.style.fontWeight = "700";
    if (options.valueColor) valEl.style.color = options.valueColor;
    const formatValue = typeof options.formatValue === "function" ? options.formatValue : (value) => String(value);
    const coerceValue = (raw) => {
      let num = typeof raw === "number" ? raw : Number.parseFloat(raw);
      if (!Number.isFinite(num)) num = min;
      if (Math.abs(step - 1) < 1e-9) {
        num = Math.round(num);
      } else {
        num = Math.round(num * 1000) / 1000;
      }
      return Math.max(min, Math.min(max, num));
    };
    const updateDisplay = (value) => {
      valEl.textContent = formatValue(value);
    };
    updateDisplay(val);
    input.addEventListener("input", (e)=>{
      const v = coerceValue(input.value);
      oninput(v);
      updateDisplay(v);
      if (typeof options.onChange === "function") options.onChange(v);
      e.stopPropagation();
    });
    row.appendChild(span); row.appendChild(input); row.appendChild(valEl);
    row._range = input;
    row._valueEl = valEl;
    row._formatValue = formatValue;
    row._coerceValue = coerceValue;
    return row;
  }
  function textInput(placeholderKey, value, oninput, options = {}){
    const wrap = document.createElement("div");
    const inp = document.createElement("input");
    inp.type = "text"; inp.value = value || "";
    const baseStyle = { width:"100%", padding:"6px 8px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:"600" };
    if (options.theme === "pink") {
      Object.assign(baseStyle, { border:"1px solid rgba(244,114,182,0.65)", background:"rgba(236,72,153,0.15)", color:"#fdf2f8" });
    } else if (options.theme === "chrome") {
      Object.assign(baseStyle, { border:"1px solid rgba(226,232,240,0.35)", background:"linear-gradient(135deg, rgba(148,163,184,0.20), rgba(71,85,105,0.25))", color:"#f8fafc" });
    } else if (options.theme === "blue") {
      Object.assign(baseStyle, { border:"1px solid rgba(96,165,250,0.6)", background:"rgba(59,130,246,0.18)", color:"#dbeafe" });
    }
    Object.assign(inp.style, baseStyle);
    if (placeholderKey) {
      translator.bind(inp, placeholderKey, { attribute: "placeholder" });
    }
    inp.addEventListener("input", (e)=>{
      oninput(inp.value);
      if (typeof options.onChange === "function") options.onChange(inp.value);
      e.stopPropagation();
    });
    wrap.appendChild(inp);
    wrap._input = inp;
    return wrap;
  }
  function createCard(labelKey, options = {}){
    const id = options.id || labelKey || `section-${Math.random().toString(36).slice(2)}`;
    const card = document.createElement("div");
    Object.assign(card.style, {
      background:"rgba(15,23,42,0.55)",
      border:"1px solid rgba(148,163,184,0.25)",
      borderRadius:"14px",
      padding:"14px 16px",
      display:"flex",
      flexDirection:"column",
      gap:"10px"
    });

    const header = document.createElement("button");
    header.type = "button";
    header.dataset.sectionId = id;
    Object.assign(header.style, {
      display:"flex",
      alignItems:"center",
      justifyContent:"space-between",
      gap:"10px",
      background:"transparent",
      border:"none",
      color:"inherit",
      padding:"0",
      cursor:"pointer",
      fontWeight:800,
      fontSize:"15px",
      textAlign:"left"
    });
    header.setAttribute("aria-controls", `${id}-content`);
    header.setAttribute("aria-expanded", "true");

    const titleSpan = document.createElement("span");
    titleSpan.style.flex = "1";
    if (labelKey) translator.bind(titleSpan, labelKey);
    header.appendChild(titleSpan);

    const arrow = document.createElement("span");
    arrow.textContent = "▾";
    arrow.style.fontSize = "16px";
    header.appendChild(arrow);

    const body = document.createElement("div");
    body.id = `${id}-content`;
    Object.assign(body.style, {
      display:"flex",
      flexDirection:"column",
      gap:"12px"
    });

    const initialCollapsed = (id in collapsedSections)
      ? !!collapsedSections[id]
      : !!options.defaultCollapsed;
    if (!(id in collapsedSections)) {
      collapsedSections[id] = initialCollapsed;
    }
    let collapsed = initialCollapsed;

    const applyCollapsed = () => {
      arrow.textContent = collapsed ? "▸" : "▾";
      body.style.display = collapsed ? "none" : "flex";
      header.setAttribute("aria-expanded", collapsed ? "false" : "true");
    };

    header.addEventListener("click", (ev) => {
      ev.preventDefault();
      collapsed = !collapsed;
      setSectionCollapsed(id, collapsed);
      applyCollapsed();
    });

    card.appendChild(header);
    card.appendChild(body);

    const originalAppend = card.appendChild.bind(card);
    card.appendChild = (node) => body.appendChild(node);
    card._content = body;
    card._header = header;
    card._toggle = () => {
      collapsed = !collapsed;
      setSectionCollapsed(id, collapsed);
      applyCollapsed();
    };
    card._setCollapsed = (value, opts = {}) => {
      collapsed = !!value;
      setSectionCollapsed(id, collapsed, opts);
      applyCollapsed();
    };
    card._appendDirect = originalAppend;

    applyCollapsed();
    return card;
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
    Object.assign(d.style, {
      marginTop:"4px",
      display:"flex",
      flexWrap:"wrap",
      gap:"10px",
      alignItems:"stretch",
      fontFamily:"Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
      fontSize:`${fontPx}px`
    });
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
    mkRow("toggleAutoType", () => game.togglePause(), () => !game.paused, "purple"),
    mkRow("toggleInstantMode", () => game.toggleInstantMode(), () => game.instantMode, "white"),
    mkRow("toggleButterfingers", () => game.toggleMistakes(), () => game.mistakesEnabled, "yellow"),
    mkRow("toggleAutoSuicide", () => game.toggleAutoSuicide(), () => game.autoSuicide, "red"),
  ];
  const autoJoinToggle = mkRow(
    "toggleAutoJoin",
    () => game.toggleAutoJoinAlways(),
    () => game.autoJoinAlways,
    "green",
    "status",
    { after: () => autoJoinManager.update(game.autoJoinAlways) }
  );
  rows.push(autoJoinToggle);

  const toggleRefs = [...rows];
  const dualToggleRows = [];
  let superRealWrap = null;
  let superAggRow = null;
  let superPauseRow = null;

  const mainGrid = document.createElement("div");
  Object.assign(mainGrid.style, { display:"grid", gap:"16px" });
  mainSec.appendChild(mainGrid);

  const automationCard = createCard("sectionAutomation", { id: "automation" });
  rows.forEach(r => automationCard.appendChild(r));
  const superRealToggle = mkRow("toggleSuperRealistic", () => game.toggleSuperRealistic(), () => game.superRealisticEnabled, "yellow");
  toggleRefs.push(superRealToggle);
  automationCard.appendChild(superRealToggle);

  superRealWrap = document.createElement("div");
  Object.assign(superRealWrap.style, {
    display:"grid",
    gap:"12px 16px",
    gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",
    marginTop:"4px"
  });

  superAggRow = sliderRow("sliderSuperAggression", 0, 100, Math.round(game.superRealisticAggression * 100), 1, (v)=>game.setSuperRealisticAggression(v/100), { accent: "#facc15", valueColor: "#fde047", onChange: () => requestSave(), formatValue: (val) => `${Math.round(val)}%` });
  superPauseRow = sliderRow("sliderSuperPause", 0, 3, Math.round(game.superRealisticPauseSec * 10) / 10, 0.1, (v)=>game.setSuperRealisticPauseSec(v), { accent: "#facc15", valueColor: "#fde68a", onChange: () => requestSave(), formatValue: (val) => `${val.toFixed(1)}s` });

  const polishSliderLayout = (row) => {
    if (!row) return;
    Object.assign(row.style, {
      width:"100%",
      margin:"6px 0",
      gridTemplateColumns:"minmax(150px, 1fr) minmax(0, 1fr) auto"
    });
    if (row.firstChild) {
      Object.assign(row.firstChild.style, { whiteSpace:"normal", lineHeight:"1.3" });
    }
    if (row._valueEl) {
      row._valueEl.style.justifySelf = "end";
    }
  };
  polishSliderLayout(superAggRow);
  polishSliderLayout(superPauseRow);

  superRealWrap.appendChild(superAggRow);
  superRealWrap.appendChild(superPauseRow);
  automationCard.appendChild(superRealWrap);

  if (!game.superRealisticEnabled) {
    superRealWrap.style.opacity = "0.55";
    superRealWrap.style.pointerEvents = "none";
    if (superAggRow?._range) {
      superAggRow._range.disabled = true;
      superAggRow._range.setAttribute("aria-disabled", "true");
    }
    if (superPauseRow?._range) {
      superPauseRow._range.disabled = true;
      superPauseRow._range.setAttribute("aria-disabled", "true");
    }
  }
  mainGrid.appendChild(automationCard);

  const hudCard = createCard("sectionHud", { id: "hud" });
  const hudSizeRow = sliderRow("sliderHudSize", 20, 70, hudSizePercent, 1, (v)=>{ hudSizePercent = v; hudScale = v/100; applyScale(); }, { accent: "#3b82f6", valueColor: "#93c5fd", onChange: () => requestSave() });
  hudCard.appendChild(hudSizeRow);
  hudCard.appendChild(sliderRow("sliderSpeed", 1, 12, game.speed, 1, (v)=>game.setSpeed(v), { accent: "#22c55e", valueColor: "#4ade80", onChange: () => requestSave() }));
  hudCard.appendChild(sliderRow("sliderThinkingDelay", 0, 5, game.thinkingDelaySec, 0.1, (v)=>game.setThinkingDelaySec(v), { accent: "#fb923c", valueColor: "#fdba74", onChange: () => requestSave(), formatValue: (val) => `${val.toFixed(1)}s` }));
  hudCard.appendChild(sliderRow("sliderButterfingers", 0, 30, Math.round(game.mistakesProb * 100), 1, (v)=>game.setMistakesProb(v/100), { accent: "#facc15", valueColor: "#facc15", onChange: () => requestSave(), formatValue: (val) => `${Math.round(val)}%` }));
  mainGrid.appendChild(hudCard);

  const messageCard = createCard("sectionMessages", { id: "messages" });
  Object.assign(messageCard.style, { background:"rgba(236,72,153,0.18)", border:"1px solid rgba(244,114,182,0.45)" });
  const preTop = mkRow("togglePreMessage", ()=>game.setPreMsgEnabled(!game.preMsgEnabled), ()=>game.preMsgEnabled, "pink");
  toggleRefs.push(preTop);
  messageCard.appendChild(preTop);
  messageCard.appendChild(textInput("placeholderPreMessage", game.preMsgText, (v)=>game.setPreMsgText(v), { theme:"pink", onChange: () => requestSave() }));
  const postTop = mkRow("togglePostfix", ()=>game.setPostfixEnabled(!game.postfixEnabled), ()=>game.postfixEnabled, "pink");
  toggleRefs.push(postTop);
  messageCard.appendChild(postTop);
  messageCard.appendChild(textInput("placeholderPostfix", game.postfixText, (v)=>game.setPostfixText(v), { theme:"pink", onChange: () => requestSave() }));
  mainGrid.appendChild(messageCard);

  // =============== COVERAGE TAB =================
  const coverageCard = createCard("sectionCoverage", { id: "coverage" });
  Object.assign(coverageCard.style, {
    background:"linear-gradient(135deg, rgba(56,189,248,0.18), rgba(244,114,182,0.10), rgba(14,165,233,0.18))",
    border:"1px solid rgba(148,163,184,0.45)"
  });
  const coverageToggle = mkRow("toggleCoverage", () => game.toggleCoverageMode(), () => game.coverageMode, "teal", "status", { recompute: true });
  toggleRefs.push(coverageToggle);
  coverageCard.appendChild(coverageToggle);
  attachPriorityControl(coverageToggle, "coverage");

  const exTop = mkRow("toggleExclude", ()=>game.setExcludeEnabled(!game.excludeEnabled), ()=>game.excludeEnabled, "teal", "status", { recompute: true });
  toggleRefs.push(exTop);
  coverageCard.appendChild(exTop);

  const coverageEditButtons = [];
  const coverageCells = [];

  const editControls = document.createElement("div");
  Object.assign(editControls.style, { display:"grid", gap:"6px", marginTop:"8px" });
  coverageCard.appendChild(editControls);

  const editLabel = document.createElement("div");
  translator.bind(editLabel, "coverageEditModeLabel");
  Object.assign(editLabel.style, { fontWeight:"600", color:"rgba(226,232,240,0.9)" });
  editControls.appendChild(editLabel);

  const editButtonsRow = document.createElement("div");
  Object.assign(editButtonsRow.style, { display:"flex", flexWrap:"wrap", gap:"8px" });
  editControls.appendChild(editButtonsRow);

  const editModes = [
    { key:"off", labelKey:"coverageEditOff" },
    { key:"tally", labelKey:"coverageEditTallies" },
    { key:"goal", labelKey:"coverageEditGoals" }
  ];
  const setCoverageEditMode = (mode) => {
    const next = editModes.some(m => m.key === mode) ? mode : "off";
    if (coverageEditMode === next) return;
    coverageEditMode = next;
    render();
  };
  if (coverageToggle?._btn) coverageToggle._btn.addEventListener("click", () => { coverageEditMode = "off"; });
  if (exTop?._btn) exTop._btn.addEventListener("click", () => { coverageEditMode = "off"; });
  editModes.forEach(cfg => {
    const btn = document.createElement("button");
    if (cfg.labelKey) {
      btn.dataset.labelKey = cfg.labelKey;
      translator.bind(btn, cfg.labelKey);
    }
    btn.dataset.mode = "label";
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (coverageEditMode === cfg.key) {
        setCoverageEditMode("off");
      } else {
        setCoverageEditMode(cfg.key);
      }
    });
    editButtonsRow.appendChild(btn);
    coverageEditButtons.push({ key: cfg.key, btn });
  });

  const editNotice = document.createElement("div");
  Object.assign(editNotice.style, {
    display:"none",
    background:"rgba(15,118,110,0.22)",
    border:"1px solid rgba(20,184,166,0.45)",
    borderRadius:"10px",
    padding:"8px 10px",
    fontSize:"12px",
    color:"#ccfbf1",
    lineHeight:"1.4"
  });
  coverageCard.appendChild(editNotice);

  const setAllWrap = document.createElement("div");
  Object.assign(setAllWrap.style, { display:"none", flexWrap:"wrap", gap:"8px", alignItems:"center", marginTop:"6px" });
  const setAllLabel = document.createElement("span");
  translator.bind(setAllLabel, "coverageSetAllLabel");
  Object.assign(setAllLabel.style, { fontWeight:"600" });
  setAllWrap.appendChild(setAllLabel);
  const setAllInput = document.createElement("input");
  Object.assign(setAllInput, { type:"number", min:"0", max:"99", value:"1" });
  Object.assign(setAllInput.style, {
    width:"72px",
    padding:"6px 8px",
    borderRadius:"8px",
    border:"1px solid rgba(148,163,184,0.45)",
    background:"rgba(15,23,42,0.6)",
    color:"#e2e8f0",
    fontWeight:"600"
  });
  setAllWrap.appendChild(setAllInput);
  const setAllBtn = document.createElement("button");
  translator.bind(setAllBtn, "coverageSetAllApply");
  Object.assign(setAllBtn.style, {
    padding:"6px 12px",
    borderRadius:"8px",
    border:"1px solid rgba(20,184,166,0.55)",
    background:"rgba(13,148,136,0.35)",
    color:"#ccfbf1",
    fontWeight:"700",
    cursor:"pointer"
  });
  setAllBtn.addEventListener("click", () => {
    const val = Number.parseInt(setAllInput.value, 10);
    if (!Number.isFinite(val)) return;
    const clamped = Math.max(0, Math.min(99, val));
    game.setAllTargetCounts(clamped);
    setAllInput.value = String(clamped);
    coverageEditMode = "off";
    render();
  });
  setAllInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      setAllBtn.click();
    }
  });
  setAllWrap.appendChild(setAllBtn);
  coverageCard.appendChild(setAllWrap);

  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display:"grid",
    gridTemplateColumns:"repeat(6, minmax(0, 1fr))",
    gap:"8px",
    marginTop:"4px"
  });
  coverageCard.appendChild(grid);

  const resetBtn = document.createElement("button");
  translator.bind(resetBtn, "buttonResetCoverage");
  Object.assign(resetBtn.style,{ padding:"8px 12px", borderRadius:"10px", cursor:"pointer", background:"rgba(15,118,110,0.32)",color:"#ccfbf1", border:"1px solid rgba(20,184,166,0.55)", fontWeight:"700" });
  resetBtn.onclick = ()=>{ game.resetCoverage(); setCoverageEditMode("off"); render(); };
  coverageCard.appendChild(resetBtn);

  covSec.appendChild(coverageCard);

  // =============== WORDS TAB =================
  const wordsGrid = document.createElement("div");
  Object.assign(wordsGrid.style, { display:"grid", gap:"16px" });
  wordsSec.appendChild(wordsGrid);

  const overviewCard = createCard("sectionWordTargeting", { id: "wordTargeting" });
  const colorGuide = document.createElement("div");
  Object.assign(colorGuide.style, {
    background:"rgba(15,23,42,0.55)",
    border:"1px solid rgba(148,163,184,0.35)",
    borderRadius:"12px",
    padding:"6px 10px",
    fontSize:"12px",
    color:"rgba(248,250,252,0.88)",
    cursor:"pointer",
    display:"inline-flex",
    flexWrap:"wrap",
    gap:"6px",
    alignItems:"center"
  });
  const legendItems = [
    { key: "legendFoul", color: "#f87171" },
    { key: "legendLengthMatch", color: "#22c55e" },
    { key: "legendLengthNear", color: "#facc15" },
    { key: "legendHyphen", color: "#ec4899" },
    { key: "legendContains", color: "#3b82f6" },
    { key: "legendPokemon", color: "#fde047" },
    { key: "legendMinerals", color: "#92400e" },
    { key: "legendRare", color: "#22d3ee" },
    { key: "legendRegular", color: "#e2e8f0" }
  ];
  legendItems.forEach((item) => {
    const entry = document.createElement("span");
    Object.assign(entry.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px"
    });
    const dot = document.createElement("span");
    Object.assign(dot.style, {
      display: "inline-block",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      background: item.color
    });
    entry.appendChild(dot);
    const label = document.createElement("span");
    translator.bind(label, item.key);
    entry.appendChild(label);
    colorGuide.appendChild(entry);
  });
  const legendDismiss = document.createElement("span");
  translator.bind(legendDismiss, "legendDismiss");
  Object.assign(legendDismiss.style, {
    fontSize: "10px",
    opacity: "0.65",
    marginLeft: "6px"
  });
  colorGuide.appendChild(legendDismiss);
  colorGuide.addEventListener("click", () => { colorGuide.style.display = "none"; });
  overviewCard.appendChild(colorGuide);

  const suggRow = sliderRow("sliderSuggestions", 1, 20, game.suggestionsLimit, 1, (v)=>game.setSuggestionsLimit(v), { accent: "#e2e8f0", valueColor: "#cbd5f5", onChange: () => requestSave({ recompute: true }), formatValue: (val) => `${Math.round(val)}` });
  overviewCard.appendChild(suggRow);

  const modesToggleBtn = document.createElement("button");
  modesToggleBtn.type = "button";
  Object.assign(modesToggleBtn.style, {
    display:"flex",
    alignItems:"center",
    justifyContent:"space-between",
    gap:"12px",
    padding:"6px 10px",
    borderRadius:"10px",
    border:"1px solid rgba(148,163,184,0.35)",
    background:"rgba(15,23,42,0.5)",
    color:"#e2e8f0",
    fontWeight:"700",
    cursor:"pointer"
  });
  const modesLabel = document.createElement("span");
  translator.bind(modesLabel, "sectionWordModes");
  const modesArrow = document.createElement("span");
  modesArrow.textContent = "▾";
  modesArrow.style.fontSize = "16px";
  modesToggleBtn.appendChild(modesLabel);
  modesToggleBtn.appendChild(modesArrow);
  modesToggleBtn.setAttribute("aria-expanded", "true");
  modesToggleBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    wordModesCollapsed = !wordModesCollapsed;
    requestSave();
    render();
  });
  overviewCard.appendChild(modesToggleBtn);

  const wordModesBody = document.createElement("div");
  wordModesBody.id = "wordModesSection";
  modesToggleBtn.setAttribute("aria-controls", wordModesBody.id);
  Object.assign(wordModesBody.style, { display:"flex", flexDirection:"column", gap:"8px", marginTop:"8px" });
  wordModesBody.setAttribute("aria-hidden", "false");
  overviewCard.appendChild(wordModesBody);

  const foulDualRow = mkDualRow("dualFoul", [
    { labelKey: "labelMe", onClick: () => game.toggleFoulMode(), getOn: () => game.foulMode, scheme: "red", recompute: true },
    { labelKey: "labelSpectator", onClick: () => game.toggleSpecFoul(), getOn: () => game.specFoulMode, scheme: "red", recompute: true }
  ]);
  dualToggleRows.push(foulDualRow);
  wordModesBody.appendChild(foulDualRow);
  attachPriorityControl(foulDualRow, "foul");

  const pokemonRow = mkDualRow("dualPokemon", [
    { labelKey: "labelMe", onClick: () => game.togglePokemonMode(), getOn: () => game.pokemonMode, scheme: "gold", recompute: true },
    { labelKey: "labelSpectator", onClick: () => game.toggleSpecPokemonMode(), getOn: () => game.specPokemonMode, scheme: "gold", recompute: true }
  ]);
  dualToggleRows.push(pokemonRow);
  wordModesBody.appendChild(pokemonRow);

  const mineralsRow = mkDualRow("dualMinerals", [
    { labelKey: "labelMe", onClick: () => game.toggleMineralsMode(), getOn: () => game.mineralsMode, scheme: "brown", recompute: true },
    { labelKey: "labelSpectator", onClick: () => game.toggleSpecMineralsMode(), getOn: () => game.specMineralsMode, scheme: "brown", recompute: true }
  ]);
  dualToggleRows.push(mineralsRow);
  wordModesBody.appendChild(mineralsRow);

  const rareRow = mkDualRow("dualRare", [
    { labelKey: "labelMe", onClick: () => game.toggleRareMode(), getOn: () => game.rareMode, scheme: "cyan", recompute: true },
    { labelKey: "labelSpectator", onClick: () => game.toggleSpecRareMode(), getOn: () => game.specRareMode, scheme: "cyan", recompute: true }
  ]);
  dualToggleRows.push(rareRow);
  wordModesBody.appendChild(rareRow);

  const lenDualRow = mkDualRow("dualTargetLength", [
    { labelKey: "labelMe", onClick: () => game.toggleLengthMode(), getOn: () => game.lengthMode, scheme: "green", recompute: true },
    { labelKey: "labelSpectator", onClick: () => game.toggleSpecLength(), getOn: () => game.specLengthMode, scheme: "green", recompute: true }
  ]);
  dualToggleRows.push(lenDualRow);
  wordModesBody.appendChild(lenDualRow);
  attachPriorityControl(lenDualRow, "length");
  const lenSliderWrap = document.createElement("div");
  Object.assign(lenSliderWrap.style, { display:"grid", gap:"12px", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))" });
  const lenValueDisplay = (v) => (v >= 21 ? translator.t("lenSliderMax") : `${Math.round(v)}`);
  const lenSliderMain = sliderRow("labelMe", 3, 21, Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen, 1, (v)=>game.setTargetLen(v), { accent: "#22c55e", valueColor: "#86efac", onChange: () => requestSave({ recompute: true }), formatValue: lenValueDisplay });
  const specLenSlider = sliderRow("labelSpectator", 3, 21, Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen, 1, (v)=>game.setSpecTargetLen(v), { accent: "#22c55e", valueColor: "#86efac", onChange: () => requestSave({ recompute: true }), formatValue: lenValueDisplay });
  lenSliderWrap.appendChild(lenSliderMain);
  lenSliderWrap.appendChild(specLenSlider);
  wordModesBody.appendChild(lenSliderWrap);

  const hyphenRow = mkDualRow("dualHyphen", [
    { labelKey: "labelMe", onClick: () => game.toggleHyphenMode(), getOn: () => game.hyphenMode, scheme: "pink", recompute: true },
    { labelKey: "labelSpectator", onClick: () => game.toggleSpecHyphenMode(), getOn: () => game.specHyphenMode, scheme: "pink", recompute: true }
  ]);
  dualToggleRows.push(hyphenRow);
  wordModesBody.appendChild(hyphenRow);
  attachPriorityControl(hyphenRow, "hyphen");

    const containsRow = mkDualRow("dualContains", [
      { labelKey: "labelMe", onClick: () => game.toggleContainsMode(), getOn: () => game.containsMode, scheme: "default", recompute: true },
      { labelKey: "labelSpectator", onClick: () => game.toggleSpecContainsMode(), getOn: () => game.specContainsMode, scheme: "default", recompute: true }
  ]);
  dualToggleRows.push(containsRow);
  wordModesBody.appendChild(containsRow);
  attachPriorityControl(containsRow, "contains");

  const containsInputWrap = document.createElement("div");
  Object.assign(containsInputWrap.style, { display:"grid", gap:"12px", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))" });
  const containsMeInput = textInput("inputContainsMe", game.containsText, (v)=>game.setContainsText(v), { theme:"blue", onChange: () => requestSave({ recompute: true }) });
  const containsSpecInput = textInput("inputContainsSpectator", game.specContainsText, (v)=>game.setSpecContainsText(v), { theme:"blue", onChange: () => requestSave({ recompute: true }) });
  containsInputWrap.appendChild(containsMeInput);
  containsInputWrap.appendChild(containsSpecInput);
  wordModesBody.appendChild(containsInputWrap);

  const lenNoticeMain = noticeBar();
  overviewCard.appendChild(lenNoticeMain);
  wordsGrid.appendChild(overviewCard);

  const wordHistoryCard = createCard("sectionWordHistory", { id: "wordHistory" });
  const preventReuseRow = mkRow("togglePreventReuse", () => game.togglePreventReuse(), () => game.preventReuseEnabled, "purple", "status", { recompute: true });
  toggleRefs.push(preventReuseRow);
  wordHistoryCard.appendChild(preventReuseRow);

  const wordHistoryInfo = document.createElement("div");
  translator.bind(wordHistoryInfo, "wordHistoryInfo");
  Object.assign(wordHistoryInfo.style, {
    fontSize: "12px",
    color: "#cbd5f5",
    lineHeight: "1.35"
  });
  wordHistoryCard.appendChild(wordHistoryInfo);

  const wordHistoryHeader = document.createElement("div");
  Object.assign(wordHistoryHeader.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px"
  });
  const wordHistoryTitle = document.createElement("span");
  translator.bind(wordHistoryTitle, "wordLogHeading");
  Object.assign(wordHistoryTitle.style, { fontWeight: "700", color: "#e2e8f0" });
  wordHistoryHeader.appendChild(wordHistoryTitle);

  const resetWordLogBtn = document.createElement("button");
  translator.bind(resetWordLogBtn, "buttonResetWordLog");
  Object.assign(resetWordLogBtn.style, {
    padding: "4px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(244,114,182,0.55)",
    background: "rgba(236,72,153,0.18)",
    color: "#fce7f3",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px"
  });
  resetWordLogBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    game.resetWordLog();
    requestSave({ recompute: true });
  });
  wordHistoryHeader.appendChild(resetWordLogBtn);
  wordHistoryCard.appendChild(wordHistoryHeader);

  const wordLogList = document.createElement("div");
  Object.assign(wordLogList.style, {
    display: "grid",
    gap: "6px",
    maxHeight: "180px",
    overflowY: "auto",
    paddingRight: "4px"
  });
  wordHistoryCard.appendChild(wordLogList);

  const renderWordLog = () => {
    const entries = (game.getRecentWordLog && game.getRecentWordLog(14)) ? game.getRecentWordLog(14) : [];
    wordLogList.innerHTML = "";
    if (!entries.length) {
      const empty = document.createElement("div");
      translator.bind(empty, "wordLogEmpty");
      Object.assign(empty.style, { fontSize: "12px", color: "#cbd5f5", opacity: "0.85" });
      wordLogList.appendChild(empty);
      return;
    }
    const displayEntries = entries.slice().reverse();
    displayEntries.forEach((entry) => {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "6px 10px",
        borderRadius: "10px",
        background: "rgba(30,41,59,0.55)",
        border: "1px solid rgba(148,163,184,0.25)",
        fontSize: "12px",
        color: "#e2e8f0"
      });
      const wordSpan = document.createElement("span");
      wordSpan.textContent = entry.word;
      wordSpan.style.fontWeight = "700";
      row.appendChild(wordSpan);

      const tag = document.createElement("span");
      const tagText = translator.t(entry.fromSelf ? "wordLogSelfTag" : "wordLogOtherTag");
      tag.textContent = tagText;
      Object.assign(tag.style, {
        fontWeight: "700",
        fontSize: "11px",
        borderRadius: "999px",
        padding: "2px 8px",
        letterSpacing: "0.2px",
        background: entry.fromSelf ? "rgba(59,130,246,0.28)" : "rgba(16,185,129,0.28)",
        color: entry.fromSelf ? "#bfdbfe" : "#bbf7d0"
      });
      row.appendChild(tag);

      if (entry.outcome === "fail") {
        row.style.border = "1px solid rgba(248,113,113,0.55)";
        row.style.background = "rgba(248,113,113,0.15)";
      }
      wordLogList.appendChild(row);
    });
  };

  if (typeof game.setWordLogChangedCallback === "function") {
    game.setWordLogChangedCallback(() => {
      renderWordLog();
    });
  }
  renderWordLog();

  wordsGrid.appendChild(wordHistoryCard);

  const suggestionsCard = createCard("sectionSuggestions", { id: "suggestions" });
  const dynamicTitle = document.createElement("div");
  Object.assign(dynamicTitle.style, { fontWeight:800, fontSize:"15px" });
  suggestionsCard.appendChild(dynamicTitle);

  const turnNotice = noticeBar();
  suggestionsCard.appendChild(turnNotice);

  const wordList = listBox(22);
  suggestionsCard.appendChild(wordList);
  wordsGrid.appendChild(suggestionsCard);

  // update lists when suggestion slider changes
  suggRow._range.addEventListener("input", () => { render(); });

  function toneStyle(tone) {
    if (tone === "foul") return { bg:"rgba(248,113,113,0.18)", border:"rgba(248,113,113,0.55)", color:"#fecaca" };
    if (tone === "pokemon") return { bg:"rgba(250,204,21,0.22)", border:"rgba(234,179,8,0.6)", color:"#fde047" };
    if (tone === "minerals") return { bg:"rgba(120,53,15,0.28)", border:"rgba(146,64,14,0.65)", color:"#fcd34d" };
    if (tone === "rare") return { bg:"rgba(14,165,233,0.22)", border:"rgba(6,182,212,0.6)", color:"#bae6fd" };
    if (tone === "hyphen") return { bg:"rgba(236,72,153,0.20)", border:"rgba(244,114,182,0.6)", color:"#fbcfe8" };
    if (tone === "contains") return { bg:"rgba(59,130,246,0.20)", border:"rgba(59,130,246,0.55)", color:"#bfdbfe" };
    if (tone === "lengthExact") return { bg:"rgba(74,222,128,0.18)", border:"rgba(74,222,128,0.55)", color:"#bbf7d0" };
    if (tone === "lengthFlex") return { bg:"rgba(251,191,36,0.18)", border:"rgba(251,191,36,0.55)", color:"#fde68a" };
    return { bg:"rgba(255,255,255,0.08)", border:"rgba(255,255,255,0.18)", color:"#f8fafc" };
  }

  function clickableWords(container, entries, syllable) {
    container.innerHTML = "";
    if (!entries || !entries.length) { container.textContent = translator.t("listEmpty"); return; }
    const syl = (syllable || "").toLowerCase();
    entries.forEach((entry) => {
      const word = typeof entry === "string" ? entry : entry.word;
      const tone = typeof entry === "string" ? "default" : entry.tone || "default";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = Game.highlightSyllable(word, syl);
      const copyTooltip = translator.t("copyTooltip");
      btn.title = copyTooltip;
      btn.setAttribute("aria-label", copyTooltip);
      const styles = toneStyle(tone);
      Object.assign(btn.style, {
        cursor:"pointer",
        borderRadius:"999px",
        padding:"6px 12px",
        border:`1px solid ${styles.border}`,
        background:styles.bg,
        color:styles.color,
        fontWeight:"700",
        fontSize:"0.92em",
        transition:"transform 0.15s ease, background 0.15s ease",
        display:"inline-flex",
        alignItems:"center",
        justifyContent:"center",
        position:"relative",
        overflow:"visible"
      });
      btn.addEventListener("mouseenter", ()=>{ btn.style.transform = "translateY(-1px)"; });
      btn.addEventListener("mouseleave", ()=>{ btn.style.transform = "none"; });
      const showCopyNotice = (ok) => {
        const existing = btn.querySelector(".bps-copy-pop");
        if (existing) existing.remove();
        const pop = document.createElement("span");
        pop.className = "bps-copy-pop";
        pop.textContent = translator.t(ok ? "copySuccess" : "copyFail");
        Object.assign(pop.style, {
          position:"absolute",
          left:"50%",
          top:"-18px",
          transform:"translate(-50%, 0)",
          background:"rgba(15,118,110,0.92)",
          color:"#ecfeff",
          padding:"2px 8px",
          borderRadius:"999px",
          fontSize:"0.7rem",
          fontWeight:"600",
          pointerEvents:"none",
          opacity:"0",
          transition:"opacity 0.18s ease, transform 0.18s ease",
          zIndex:"2"
        });
        if (!ok) {
          pop.style.background = "rgba(190,18,60,0.92)";
          pop.style.color = "#fff1f2";
        }
        btn.appendChild(pop);
        requestAnimationFrame(() => {
          pop.style.opacity = "1";
          pop.style.transform = "translate(-50%, -6px)";
        });
        setTimeout(() => {
          pop.style.opacity = "0";
          pop.style.transform = "translate(-50%, -14px)";
        }, 600);
        setTimeout(() => { pop.remove(); }, 900);
      };
      const handleCopy = async (event) => {
        if (event) event.preventDefault();
        if (btn.dataset.copyBusy === "1") return;
        btn.dataset.copyBusy = "1";
        try {
          const ok = await copyPlain(word);
          btn.style.boxShadow = ok ? "0 0 0 2px rgba(34,197,94,0.45)" : "0 0 0 2px rgba(239,68,68,0.45)";
          showCopyNotice(ok);
          setTimeout(()=>{ btn.style.boxShadow = "none"; }, 420);
        } finally {
          setTimeout(() => { delete btn.dataset.copyBusy; }, 120);
        }
      };
      btn.addEventListener("pointerdown", handleCopy);
      btn.addEventListener("click", handleCopy);
      container.appendChild(btn);
    });
  }

  function ensureCoverageCells() {
    if (coverageCells.length) return;
    for (let i = 0; i < 26; i++) {
      const box = document.createElement("div");
      Object.assign(box.style, {
        padding:"8px 8px 10px",
        borderRadius:"10px",
        border:"1px solid rgba(255,255,255,0.18)",
        background:"rgba(255,255,255,0.05)",
        display:"flex",
        flexDirection:"column",
        gap:"6px",
        minHeight:"64px"
      });
      const header = document.createElement("div");
      Object.assign(header.style, {
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        gap:"6px"
      });
      const letterSpan = document.createElement("span");
      Object.assign(letterSpan.style, { fontWeight:800, fontSize:"15px", textTransform:"uppercase" });
      const progressSpan = document.createElement("span");
      Object.assign(progressSpan.style, { fontWeight:700, fontSize:"12px" });
      header.appendChild(letterSpan);
      header.appendChild(progressSpan);
      const input = document.createElement("input");
      Object.assign(input, { type:"number", min:"0", max:"99" });
      Object.assign(input.style, {
        display:"none",
        width:"100%",
        padding:"5px 6px",
        borderRadius:"8px",
        border:"1px solid rgba(148,163,184,0.45)",
        background:"rgba(15,23,42,0.65)",
        color:"#e2e8f0",
        fontWeight:"600"
      });
      const bar = document.createElement("div");
      Object.assign(bar.style, {
        height:"6px",
        width:"100%",
        borderRadius:"999px",
        background:"rgba(255,255,255,0.1)",
        overflow:"hidden"
      });
      const fill = document.createElement("div");
      Object.assign(fill.style, { height:"100%", width:"0%", background:"rgba(250,204,21,0.85)" });
      bar.appendChild(fill);
      box.appendChild(header);
      box.appendChild(input);
      box.appendChild(bar);

      const idx = i;
      box.addEventListener("click", (ev) => {
        if (coverageEditMode === "off") return;
        if (ev.target === input) return;
        if (coverageEditMode === "tally") {
          game.adjustCoverageCount(idx, 1);
        } else if (coverageEditMode === "goal") {
          game.adjustTargetCount(idx, 1);
        }
        render();
      });
      box.addEventListener("contextmenu", (ev) => {
        if (coverageEditMode === "off") return;
        if (ev.target === input) return;
        ev.preventDefault();
        if (coverageEditMode === "tally") {
          game.adjustCoverageCount(idx, -1);
        } else if (coverageEditMode === "goal") {
          game.adjustTargetCount(idx, -1);
        }
        render();
      });

      input.addEventListener("click", (ev) => ev.stopPropagation());
      input.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        }
      });
      input.addEventListener("change", () => {
        const val = Number.parseInt(input.value, 10);
        if (!Number.isFinite(val)) {
          input.value = String(game.targetCounts[idx] || 0);
          return;
        }
        game.setTargetCount(idx, val);
        input.value = String(game.targetCounts[idx] || 0);
        render();
      });
      input.addEventListener("contextmenu", (ev) => {
        if (coverageEditMode !== "goal") return;
        ev.preventDefault();
        game.adjustTargetCount(idx, -1);
        input.value = String(game.targetCounts[idx] || 0);
        render();
      });

      coverageCells.push({ idx, box, letterSpan, progressSpan, input, fill });
      grid.appendChild(box);
    }
  }

  function renderCoverageGrid() {
    ensureCoverageCells();
    const counts = game.coverageCounts || new Array(26).fill(0);
    const targets = game.targetCounts || new Array(26).fill(1);
    coverageCells.forEach(cell => {
      const { idx, box, letterSpan, progressSpan, input, fill } = cell;
      const letter = String.fromCharCode(97 + idx);
      letterSpan.textContent = letter;
      const target = Math.max(0, targets[idx] || 0);
      const haveRaw = Math.max(0, counts[idx] || 0);
      const have = Math.min(haveRaw, target);
      if (target <= 0) {
        progressSpan.textContent = translator.t("coverageExcluded");
        progressSpan.style.color = "#9ca3af";
        letterSpan.style.color = "#9ca3af";
        letterSpan.style.textDecoration = "line-through";
      } else {
        progressSpan.textContent = `${have}/${target}`;
        progressSpan.style.color = have >= target ? "#bbf7d0" : "#e0f2fe";
        letterSpan.style.color = "#fff";
        letterSpan.style.textDecoration = "none";
      }
      const pct = target > 0 ? Math.round((have / (target || 1)) * 100) : 0;
      fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      fill.style.background = target > 0 && have >= target ? "rgba(34,197,94,0.9)" : "rgba(250,204,21,0.85)";
      box.style.border = target <= 0 ? "1px solid rgba(148,163,184,0.32)" : "1px solid rgba(255,255,255,0.18)";
      box.style.background = coverageEditMode === "off" ? "rgba(255,255,255,0.05)" : "rgba(15,118,110,0.10)";
      box.style.cursor = coverageEditMode === "off" ? "default" : "pointer";
      if (coverageEditMode === "tally") {
        box.title = translator.t("coverageTallyTooltip");
      } else if (coverageEditMode === "goal") {
        box.title = translator.t("coverageGoalTooltip");
      } else {
        box.title = "";
      }

      input.style.display = coverageEditMode === "goal" ? "block" : "none";
      input.disabled = coverageEditMode !== "goal";
      if (document.activeElement !== input) {
        input.value = String(target);
      }
    });
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
    const containsFallback = context==="self" ? game.lastContainsFallbackSelf : game.lastContainsFallbackSpectator;
    const hyphenFallback = context==="self" ? game.lastHyphenFallbackSelf : game.lastHyphenFallbackSpectator;
    const pokemonFallback = context==="self" ? game.lastPokemonFallbackSelf : game.lastPokemonFallbackSpectator;
    const mineralsFallback = context==="self" ? game.lastMineralsFallbackSelf : game.lastMineralsFallbackSpectator;
    const rareFallback = context==="self" ? game.lastRareFallbackSelf : game.lastRareFallbackSpectator;
    const targetPref = context==="self" ? (Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen) : (Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen);
    const targetActual = context==="self" ? game.targetLen : game.specTargetLen;

    const parts = [];
      if ((context==="self" && game.foulMode) || (context==="spectator" && game.specFoulMode)) {
        if (foulFallback) parts.push(translator.t("noticeFoulFallback"));
      }
      if ((context==="self" && game.pokemonMode) || (context==="spectator" && game.specPokemonMode)) {
        if (pokemonFallback) parts.push(translator.t("noticePokemonFallback"));
      }
      if ((context==="self" && game.mineralsMode) || (context==="spectator" && game.specMineralsMode)) {
        if (mineralsFallback) parts.push(translator.t("noticeMineralsFallback"));
      }
      if ((context==="self" && game.rareMode) || (context==="spectator" && game.specRareMode)) {
        if (rareFallback) parts.push(translator.t("noticeRareFallback"));
      }
      if (context==="self" && game.lengthMode && game.coverageMode && capApplied)
        parts.push(translator.t("noticeLengthCap", { target: formatTargetLenLabel(targetPref, targetActual) }));
      if (context==="self" && game.lengthMode && game.coverageMode && capRelaxed)
        parts.push(translator.t("noticeLengthRelaxed", { target: formatTargetLenLabel(targetPref, targetActual) }));
      if ((context==="self" && game.lengthMode && !game.coverageMode) ||
          (context==="spectator" && game.specLengthMode)) {
        if (lenFallback) {
          if (targetPref >= 21) {
            parts.push(translator.t("noticeLengthFlexMax"));
          } else {
            parts.push(translator.t("noticeLengthFlex", { target: formatTargetLenLabel(targetPref, targetActual) }));
          }
        }
        if (lenSuppressed) parts.push(translator.t("noticeLengthSuppressed"));
      }
      if ((context==="self" && game.containsMode) || (context==="spectator" && game.specContainsMode)) {
        if (containsFallback) parts.push(translator.t("noticeContainsFallback"));
      }
      if ((context==="self" && game.hyphenMode) || (context==="spectator" && game.specHyphenMode)) {
        if (hyphenFallback) parts.push(translator.t("noticeHyphenFallback"));
      }
      if (context==="self" && game.preventReuseEnabled) {
        if (game.lastReuseFilteredSelf) parts.push(translator.t("noticeReuseFiltered"));
        if (game.lastReuseFallbackSelf) parts.push(translator.t("noticeReuseFallback"));
      }
      if (context==="spectator" && game.preventReuseEnabled) {
        if (game.lastReuseFilteredSpectator) parts.push(translator.t("noticeReuseFiltered"));
        if (game.lastReuseFallbackSpectator) parts.push(translator.t("noticeReuseFallback"));
      }
      return parts.join(" ");
    }

  function render() {
    translator.refresh(game.lang);
    updateToastLanguage();
    if (typeof renderWordLog === "function") renderWordLog();
    toggleRefs.forEach(row => applyToggleBtn(row._btn, row._get(), row._scheme, row._mode));
    dualToggleRows.forEach(row => {
      row._buttons.forEach(info => applyToggleBtn(info.btn, info.getOn(), info.scheme, info.mode));
    });

    if (modesArrow) {
      modesArrow.textContent = wordModesCollapsed ? "▸" : "▾";
    }
    if (modesToggleBtn) {
      modesToggleBtn.setAttribute("aria-expanded", wordModesCollapsed ? "false" : "true");
    }
    if (wordModesBody) {
      wordModesBody.style.display = wordModesCollapsed ? "none" : "flex";
      wordModesBody.setAttribute("aria-hidden", wordModesCollapsed ? "true" : "false");
    }

    renderCoverageGrid();
    coverageEditButtons.forEach(({ key, btn }) => {
      applyToggleStyle(btn, coverageEditMode === key, "teal", "label");
    });
    if (coverageEditMode === "tally") {
      editNotice.style.display = "block";
      editNotice.textContent = translator.t("coverageEditTalliesNotice");
    } else if (coverageEditMode === "goal") {
      editNotice.style.display = "block";
      editNotice.textContent = translator.t("coverageEditGoalsNotice");
    } else {
      editNotice.style.display = "none";
      editNotice.textContent = "";
    }

    if (setAllWrap) {
      const showSetAll = coverageEditMode === "goal";
      setAllWrap.style.display = showSetAll ? "flex" : "none";
      if (setAllInput) {
        setAllInput.disabled = !showSetAll;
        setAllInput.setAttribute("aria-disabled", showSetAll ? "false" : "true");
      }
      if (setAllBtn) {
        setAllBtn.disabled = !showSetAll;
        setAllBtn.setAttribute("aria-disabled", showSetAll ? "false" : "true");
      }
    }

    const updateSlider = (row, value) => {
      if (!row || !row._range) return;
      const coerced = row._coerceValue ? row._coerceValue(value) : value;
      const str = String(coerced);
      if (row._range.value !== str) row._range.value = str;
      if (row._valueEl) {
        const formatted = row._formatValue ? row._formatValue(coerced) : str;
        if (row._valueEl.textContent !== formatted) row._valueEl.textContent = formatted;
      }
    };
    updateSlider(hudSizeRow, hudSizePercent);
    updateSlider(lenSliderMain, Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen);
    updateSlider(specLenSlider, Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen);
    updateSlider(suggRow, game.suggestionsLimit);
    updateSlider(superAggRow, Math.round((game.superRealisticAggression || 0) * 100));
    updateSlider(superPauseRow, Math.round((game.superRealisticPauseSec || 0) * 10) / 10);

    const superEnabled = !!game.superRealisticEnabled;
    if (superRealWrap) {
      superRealWrap.style.opacity = superEnabled ? "1" : "0.55";
      superRealWrap.style.pointerEvents = superEnabled ? "auto" : "none";
    }
    if (superAggRow?._range) {
      superAggRow._range.disabled = !superEnabled;
      superAggRow._range.setAttribute("aria-disabled", superEnabled ? "false" : "true");
    }
    if (superPauseRow?._range) {
      superPauseRow._range.disabled = !superEnabled;
      superPauseRow._range.setAttribute("aria-disabled", superEnabled ? "false" : "true");
    }

    if (containsMeInput && containsMeInput._input) {
      const val = game.containsText || "";
      if (containsMeInput._input.value !== val) containsMeInput._input.value = val;
    }
    if (containsSpecInput && containsSpecInput._input) {
      const val = game.specContainsText || "";
      if (containsSpecInput._input.value !== val) containsSpecInput._input.value = val;
    }

    const basePriority = typeof game.priorityFeatures === "function" ? game.priorityFeatures() : priorityKeys;
    const rawPriority = Array.isArray(game.priorityOrder) ? game.priorityOrder.slice() : [];
    const seenPriority = new Set();
    const finalPriority = [];
    rawPriority.forEach((item) => {
      const key = (item || "").toString().toLowerCase();
      if (basePriority.includes(key) && !seenPriority.has(key)) {
        finalPriority.push(key);
        seenPriority.add(key);
      }
    });
    basePriority.forEach((key) => {
      if (!seenPriority.has(key)) {
        finalPriority.push(key);
        seenPriority.add(key);
      }
    });
    finalPriority.forEach((key, idx) => {
      const select = priorityControls.get(key);
      if (select) {
        const target = String(idx + 1);
        if (select.value !== target) select.value = target;
      }
    });

    const targetPrefSelf = Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen;
    const noticeParts = [];
    if (game.lengthMode) {
      if (game.coverageMode && game.foulMode) {
        noticeParts.push(translator.t("lenNoticeCoverageFoul", { target: formatTargetLenLabel(targetPrefSelf, game.targetLen) }));
      } else if (game.coverageMode) {
        noticeParts.push(translator.t("lenNoticeCoverage", { target: formatTargetLenLabel(targetPrefSelf, game.targetLen) }));
      } else if (game.foulMode) {
        noticeParts.push(translator.t("lenNoticeFoul"));
      } else {
        noticeParts.push(translator.t("lenNoticeDefault"));
      }
    }
    if (game.specLengthMode) {
      if (game.specFoulMode) {
        noticeParts.push(translator.t("lenNoticeSpecFoul"));
      } else {
        noticeParts.push(translator.t("lenNoticeSpecDefault"));
      }
    }
    lenNoticeMain._show(noticeParts.join(" "));

    const isMyTurn = !!game.myTurn;
    dynamicTitle.textContent = translator.t(isMyTurn ? "dynamicTitleSelf" : "dynamicTitleSpectator");
    const entries = isMyTurn
      ? ((game.lastTopPicksSelfDisplay && game.lastTopPicksSelfDisplay.length) ? game.lastTopPicksSelfDisplay : game.lastTopPicksSelf)
      : ((game.spectatorSuggestionsDisplay && game.spectatorSuggestionsDisplay.length) ? game.spectatorSuggestionsDisplay : game.spectatorSuggestions);
    const syllable = isMyTurn ? (game.syllable || "") : (game.lastSpectatorSyllable || "");
    clickableWords(wordList, entries, syllable);

    const noticeContext = isMyTurn ? "self" : "spectator";
    turnNotice._show(buildNotice(noticeContext));
  }

  const isJoinButtonVisible = (btn) => {
    if (!btn) return false;
    if (btn.disabled) return false;
    if (btn.hasAttribute("hidden")) return false;
    if (btn.closest('[hidden]')) return false;
    const style = window.getComputedStyle(btn);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const opacity = Number.parseFloat(style.opacity || "1");
    if (Number.isFinite(opacity) && opacity <= 0.01) return false;
    const rect = btn.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const handleNewGameDetected = () => {
    game.resetCoverage();
    game.resetWordLog();
    game.lastReuseFilteredSelf = false;
    game.lastReuseFallbackSelf = false;
    game.lastReuseFilteredSpectator = false;
    game.lastReuseFallbackSpectator = false;
    coverageEditMode = "off";
    scheduleTalliesSave();
    requestSave({ recompute: true });
    render();
    showToast("notificationGameReset", 2800);
  };

  const checkJoinButton = () => {
    const joinBtn = document.querySelector("button.joinRound");
    const visible = isJoinButtonVisible(joinBtn);
    if (visible && !lastJoinVisible) {
      handleNewGameDetected();
    }
    lastJoinVisible = visible;
  };

  const startJoinMonitoring = () => {
    if (joinObserver) {
      try { joinObserver.disconnect(); } catch (_) { /* ignore */ }
    }
    joinObserver = new MutationObserver(() => { checkJoinButton(); });
    try {
      if (document.body) {
        joinObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["hidden", "style", "class", "aria-hidden"]
        });
      }
    } catch (_) { /* ignore */ }
    if (joinCheckTimer) clearInterval(joinCheckTimer);
    joinCheckTimer = window.setInterval(checkJoinButton, 1500);
    checkJoinButton();
  };

  if (document.body && !toast.isConnected) {
    document.body.appendChild(toast);
  }
  startJoinMonitoring();

  const iv = setInterval(render, 160);
  window.addEventListener("beforeunload", () => {
    clearInterval(iv);
    autoJoinManager.disconnect();
    hideToast();
    if (joinObserver) {
      try { joinObserver.disconnect(); } catch (_) { /* ignore */ }
      joinObserver = null;
    }
    if (joinCheckTimer) {
      clearInterval(joinCheckTimer);
      joinCheckTimer = null;
    }
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  });

  document.body.appendChild(wrap);
  if (!toast.isConnected) document.body.appendChild(toast);
  autoJoinManager.update(game.autoJoinAlways);
  return { render };
}

async function setupBuddy() {
  // Inject page-side listener (emits myTurn/correct/fail events)
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("content/injected.js");
  s.onload = function () { this.remove(); };
  document.body.appendChild(s);

  const game = new Game(getInput());
  setTimeout(() => (game.input = getInput()), 1000);

  const { render } = createOverlay(game);

  const notifySettingsChanged = (opts = {}) => {
    if (typeof game._notifySettingsChanged === "function") {
      try {
        game._notifySettingsChanged(opts);
      } catch (err) {
        console.warn("[BombPartyShark] Failed to persist settings", err);
      }
    }
  };

  window.addEventListener("message", async (event) => {
    if (!event.origin.endsWith("jklm.fun")) return;
    const data = event.data;

    if ("myTurn" in data) game.setMyTurn(data.myTurn);

    if (data.type === "setup") {
      const desiredLang = game.normalizeLang(data.language);
      try {
        await game.setLang(data.language);
      } catch (err) {
        console.warn("[BombPartyShark] Falling back to previous language after failed load", err);
        showToast("notificationWordListError", 3600, { language: game.languageDisplayName(desiredLang) });
        render();
        return;
      }
      if (data.myTurn) {
        game.syllable = data.syllable;
        game.selfRound = (game.selfRound|0) + 1;     // new round for me
        game.lastTopPicksSelf = game.getTopCandidates(data.syllable, game.suggestionsLimit);
        if (!game.paused) game.playTurn().catch(err => console.error("[BombPartyShark] playTurn failed", err));
      } else {
        game.spectatorRound = (game.spectatorRound|0) + 1;
        game.generateSpectatorSuggestions(data.syllable, game.suggestionsLimit);
      }
      render();
    } else if (data.type === "correctWord") {
      game.onCorrectWord(data.word, !!data.myTurn);
      render();
    } else if (data.type === "failWord") {
      game.onFailedWord(!!data.myTurn, data.word, data.reason);
      render();
    } else if (data.type === "nextTurn") {
      if (data.myTurn) {
        game.syllable = data.syllable;
        game.selfRound = (game.selfRound|0) + 1;     // new round for me
        game.lastTopPicksSelf = game.getTopCandidates(data.syllable, game.suggestionsLimit);
        if (!game.paused) game.playTurn().catch(err => console.error("[BombPartyShark] playTurn failed", err));
      } else {
        game.spectatorRound = (game.spectatorRound|0) + 1;
        game.generateSpectatorSuggestions(data.syllable, game.suggestionsLimit);
      }
      render();
    }
  });

  // hotkeys
  window.addEventListener("keydown", function (ev) {
    if (!ev.altKey) return;
    const k = ev.key.toLowerCase();
    let handled = false;
    let recompute = false;
    if (k === "w") { game.togglePause(); handled = true; }
    else if (k === "arrowup") { game.setSpeed(Math.min(12, game.speed+1)); handled = true; }
    else if (k === "arrowdown") { game.setSpeed(Math.max(1, game.speed-1)); handled = true; }
    else if (k === "f") { game.toggleFoulMode(); handled = true; recompute = true; }
    else if (k === "c") { game.toggleCoverageMode(); handled = true; recompute = true; }
    else if (k === "s") { game.toggleAutoSuicide(); handled = true; }
    else if (k === "b") { game.toggleMistakes(); handled = true; }
    else if (k === "r") { game.resetCoverage(); handled = true; recompute = true; }
    else if (k === "t") { game.toggleLengthMode(); handled = true; recompute = true; }

    if (!handled) return;
    notifySettingsChanged({ recompute });
    render();
    ev.preventDefault();
  });
}

if (isBombPartyFrame()) setupBuddy();

















