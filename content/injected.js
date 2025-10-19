// injected.js

socket.on("setup", (data) => {
  if (data.milestone.name != "round") return;
  window.postMessage({
    type: "setup",
    myTurn: data.milestone.currentPlayerPeerId === selfPeerId,
    syllable: data.milestone.syllable,
    language: data.milestone.dictionaryManifest.name,
  }, "*");
});

socket.on("setMilestone", (newMilestone) => {
  if (newMilestone.name != "round") return;
  window.postMessage({
    type: "setup",
    myTurn: newMilestone.currentPlayerPeerId === selfPeerId,
    syllable: newMilestone.syllable,
    language: newMilestone.dictionaryManifest.name,
  }, "*");
});

socket.on("nextTurn", (playerId, syllable) => {
  window.postMessage({
    type: "nextTurn",
    myTurn: playerId === selfPeerId,
    syllable: syllable,
  }, "*");
});

socket.on("failWord", (playerId, reason) => {
  window.postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word: actual_word,
    reason: reason,
  }, "*");
});

socket.on("correctWord", (playerId) => {
  window.postMessage({
    type: "correctWord",
    word: actual_word,
    myTurn: playerId === selfPeerId,
  }, "*");
});

let actual_word;
socket.on("setPlayerWord", (_, word) => (actual_word = word));
