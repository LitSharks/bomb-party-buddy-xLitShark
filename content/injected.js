// injected.js

socket.on("setup", (data) => {
  if (data.milestone.name != "round") return;
  postMessage({
    type: "setup",
    myTurn: data.milestone.currentPlayerPeerId === selfPeerId,
    syllable: data.milestone.syllable,
    language: data.milestone.dictionaryManifest.name,
  });
});

socket.on("setMilestone", (newMilestone) => {
  if (newMilestone.name != "round") return;
  postMessage({
    type: "setup",
    myTurn: newMilestone.currentPlayerPeerId === selfPeerId,
    syllable: newMilestone.syllable,
    language: newMilestone.dictionaryManifest.name,
  });
});

socket.on("nextTurn", (playerId, syllable) => {
  postMessage({
    type: "nextTurn",
    myTurn: playerId === selfPeerId,
    syllable: syllable,
  });
});

socket.on("failWord", (playerId, reason) => {
  postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word: actual_word,
    reason: reason,
  });
});

socket.on("correctWord", (_) => {
  postMessage({
    type: "correctWord",
    word: actual_word,
  });
});

let actual_word;
socket.on("setPlayerWord", (_, word) => (actual_word = word));
