const colors = ["red", "yellow", "green", "blue"];
const symbols = ["skip", "reverse", "draw2"];
const playerNames = ["你", "小美", "阿強", "小華"];
const avatars = ["🧑", "👩", "👨", "👧"];

let deck = [];
let discard = [];
let hands = [[], [], [], []];
let currentPlayer = 0;
let direction = 1;
let activeColor = null;
let unoCalled = [false, false, false, false];
let gameOver = false;
let aiTimer = null;

const handEl = document.querySelector("#playerHand");
const discardEl = document.querySelector("#discardPile");
const drawEl = document.querySelector("#drawPile");
const unoButton = document.querySelector("#unoButton");
const statusPill = document.querySelector("#statusPill");
const turnLabel = document.querySelector("#turnLabel");
const directionEl = document.querySelector("#direction");
const colorDialog = document.querySelector("#colorDialog");
const helpDialog = document.querySelector("#helpDialog");
const winnerDialog = document.querySelector("#winnerDialog");

function createDeck() {
  const cards = [];

  colors.forEach((color) => {
    cards.push({ color, value: "0", type: "number" });
    for (let n = 1; n <= 9; n++) {
      cards.push({ color, value: String(n), type: "number" });
      cards.push({ color, value: String(n), type: "number" });
    }
    symbols.forEach((value) => {
      cards.push({ color, value, type: "action" });
      cards.push({ color, value, type: "action" });
    });
  });

  for (let i = 0; i < 4; i++) {
    cards.push({ color: "wild", value: "wild", type: "wild" });
    cards.push({ color: "wild", value: "wild4", type: "wild" });
  }

  return shuffle(cards);
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawCard(playerIndex, count = 1) {
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) reshuffleDiscard();
    if (deck.length) hands[playerIndex].push(deck.pop());
  }
  unoCalled[playerIndex] = false;
}

function reshuffleDiscard() {
  if (discard.length <= 1) return;
  const top = discard.pop();
  deck = shuffle(discard);
  discard = [top];
}

function startGame() {
  clearTimeout(aiTimer);
  deck = createDeck();
  discard = [];
  hands = [[], [], [], []];
  currentPlayer = 0;
  direction = 1;
  activeColor = null;
  unoCalled = [false, false, false, false];
  gameOver = false;

  for (let i = 0; i < 7; i++) {
    for (let p = 0; p < 4; p++) drawCard(p);
  }

  let first;
  do {
    first = deck.pop();
  } while (first.type !== "number");

  discard.push(first);
  activeColor = first.color;
  unoButton.classList.remove("called");
  winnerDialog.close();
  render();
}

function cardLabel(card) {
  if (card.value === "wild") return "W";
  if (card.value === "wild4") return "+4";
  if (card.value === "draw2") return "+2";
  if (card.value === "skip") return "⊘";
  if (card.value === "reverse") return "↻";
  return card.value;
}

function createCardElement(card, index, inHand = false) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `card ${card.color}${inHand ? "" : " discard-card"} ${card.type === "action" || card.type === "wild" ? "action" : ""}`;
  el.innerHTML = `
    <span class="corner">${cardLabel(card)}</span>
    <span class="card-label">${cardLabel(card)}</span>
  `;
  el.dataset.index = String(index);
  el.setAttribute("aria-label", `${card.color === "wild" ? "萬用" : card.color} ${cardLabel(card)}牌`);
  if (inHand) el.addEventListener("click", () => playHumanCard(index));
  return el;
}

function canPlay(card) {
  if (currentPlayer !== 0 || gameOver) return false;
  const top = discard[discard.length - 1];
  if (card.type === "wild") return true;
  return card.color === activeColor || card.value === top.value;
}

function render() {
  renderHand();
  renderDiscard();
  renderOpponents();

  directionEl.textContent = direction === 1 ? "↻" : "↺";
  statusPill.textContent = currentPlayer === 0 ? "輪到你" : `${playerNames[currentPlayer]}出牌`;
  turnLabel.textContent = currentPlayer === 0 ? "輪到你出牌" : `等待${playerNames[currentPlayer]}出牌`;

  unoButton.classList.toggle("called", unoCalled[0]);
  unoButton.textContent = unoCalled[0] ? "已喊!" : "UNO!";
}

function renderHand() {
  handEl.innerHTML = "";
  hands[0].forEach((card, index) => {
    const el = createCardElement(card, index, true);
    if (currentPlayer !== 0 || !canPlay(card)) el.classList.add("disabled");
    handEl.appendChild(el);
  });
}

function renderDiscard() {
  discardEl.innerHTML = "";
  discardEl.appendChild(createCardElement(discard[discard.length - 1], 0));
}

function renderOpponents() {
  [1, 2, 3].forEach((playerIndex) => {
    const el = document.querySelector(`#opponent${playerIndex}`);
    const count = hands[playerIndex].length;
    el.innerHTML = `
      <div class="player-badge ${currentPlayer === playerIndex ? "active" : ""}">
        <span class="avatar">${avatars[playerIndex]}</span>
        <span>${playerNames[playerIndex]} · ${count}張</span>
      </div>
      <div class="mini-hand" aria-hidden="true">
        ${Array.from({ length: Math.min(count, 4) }, () => '<span class="mini-card"></span>').join("")}
      </div>
    `;
  });
}

function playHumanCard(index) {
  if (currentPlayer !== 0 || gameOver) return;
  const card = hands[0][index];
  if (!canPlay(card)) return;

  hands[0].splice(index, 1);
  discard.push(card);
  unoCalled[0] = hands[0].length === 1 && unoCalled[0];

  if (card.type === "wild") {
    activeColor = null;
    render();
    colorDialog.showModal();
    colorDialog._pendingCard = card;
  } else {
    activeColor = card.color;
    resolveCard(card);
  }
}

function resolveCard(card) {
  if (hands[currentPlayer].length === 0) {
    endGame(currentPlayer);
    return;
  }

  if (currentPlayer === 0 && hands[0].length === 1 && unoCalled[0] === false) {
    unoButton.classList.remove("called");
  }

  let steps = 1;

  if (card.value === "reverse") {
    direction *= -1;
    if (hands.length === 2) steps = 2;
  } else if (card.value === "skip") {
    steps = 2;
  } else if (card.value === "draw2") {
    const next = nextPlayer(currentPlayer);
    drawCard(next, 2);
    steps = 2;
  } else if (card.value === "wild4") {
    const next = nextPlayer(currentPlayer);
    drawCard(next, 4);
    steps = 2;
  }

  advanceTurn(steps);
  render();

  if (currentPlayer !== 0) scheduleAi();
}

function advanceTurn(steps = 1) {
  for (let i = 0; i < steps; i++) {
    currentPlayer = (currentPlayer + direction + 4) % 4;
  }
}

function nextPlayer(from) {
  return (from + direction + 4) % 4;
}

function scheduleAi() {
  clearTimeout(aiTimer);
  aiTimer = setTimeout(playAiTurn, 850);
}

function playAiTurn() {
  if (gameOver || currentPlayer === 0) return;

  const p = currentPlayer;
  let playable = hands[p].map((card, index) => ({ card, index })).filter(({ card }) => {
    if (card.type === "wild") return true;
    const top = discard[discard.length - 1];
    return card.color === activeColor || card.value === top.value;
  });

  if (playable.length === 0) {
    drawCard(p);
    const drawn = hands[p][hands[p].length - 1];
    const top = discard[discard.length - 1];
    if (drawn.type === "wild" || drawn.color === activeColor || drawn.value === top.value) {
      playable = [{ card: drawn, index: hands[p].length - 1 }];
    }
  }

  if (playable.length === 0) {
    advanceTurn();
    render();
    if (currentPlayer !== 0) scheduleAi();
    return;
  }

  playable.sort((a, b) => actionPriority(b.card) - actionPriority(a.card));
  const chosen = playable[0];
  hands[p].splice(chosen.index, 1);
  discard.push(chosen.card);

  if (chosen.card.type === "wild") {
    const counts = {};
    colors.forEach((color) => counts[color] = 0);
    hands[p].forEach((card) => {
      if (counts[card.color] !== undefined) counts[card.color]++;
    });
    activeColor = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || colors[Math.floor(Math.random() * 4)];
  } else {
    activeColor = chosen.card.color;
  }

  if (hands[p].length === 1) unoCalled[p] = true;
  currentPlayer = p;
  resolveCard(chosen.card);
}

function actionPriority(card) {
  if (card.value === "wild4") return 5;
  if (card.value === "draw2") return 4;
  if (card.value === "skip") return 3;
  if (card.value === "reverse") return 3;
  if (card.type === "wild") return 2;
  return 1;
}

drawEl.addEventListener("click", () => {
  if (currentPlayer !== 0 || gameOver) return;

  drawCard(0);
  const drawn = hands[0][hands[0].length - 1];
  if (drawn.type === "wild" || drawn.color === activeColor || drawn.value === discard[discard.length - 1].value) {
    render();
    turnLabel.textContent = "抽到了可出的牌";
  } else {
    advanceTurn();
    render();
    scheduleAi();
  }
});

unoButton.addEventListener("click", () => {
  if (gameOver) return;
  unoCalled[0] = true;
  unoButton.classList.add("called");
  unoButton.textContent = "已喊!";

  if (hands[0].length > 2) {
    unoCalled[0] = false;
    unoButton.classList.remove("called");
  }
});

document.querySelectorAll(".color-choice").forEach((button) => {
  button.addEventListener("click", () => {
    activeColor = button.dataset.color;
    colorDialog.close();
    resolveCard(colorDialog._pendingCard);
  });
});

document.querySelector("#restartButton").addEventListener("click", startGame);
document.querySelector("#helpButton").addEventListener("click", () => helpDialog.showModal());
document.querySelector("#helpClose").addEventListener("click", () => helpDialog.close());
document.querySelector("#helpDone").addEventListener("click", () => helpDialog.close());
document.querySelector("#playAgainButton").addEventListener("click", startGame);

function endGame(winnerIndex) {
  gameOver = true;
  clearTimeout(aiTimer);
  document.querySelector("#winnerTitle").textContent =
    winnerIndex === 0 ? "你贏了！" : `${playerNames[winnerIndex]}贏了`;
  document.querySelector("#winnerText").textContent =
    winnerIndex === 0 ? "漂亮的一局，UNO 大師！" : "再來一局，找回勝利！";
  winnerDialog.showModal();
  render();
}

startGame();
