const QUESTION_COUNT = 15;
const CHOICE_COUNT = 4;

const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const cardEl = document.getElementById("card");
const termEl = document.getElementById("term");
const choicesEl = document.getElementById("choices");
const feedbackEl = document.getElementById("feedback");
const nextBtn = document.getElementById("nextBtn");
const doneEl = document.getElementById("done");
const finalScoreEl = document.getElementById("finalScore");
const restartBtn = document.getElementById("restartBtn");
const errorEl = document.getElementById("error");

let terms = [];
let asked = 0;
let score = 0;
let usedIndices = new Set();
let currentAnswer = "";
let locked = false;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseTerms(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length < 2) return null;
      const term = parts[0].trim();
      const meaning = parts.slice(1).join("\t").trim();
      if (!term || !meaning) return null;
      return { term, meaning };
    })
    .filter(Boolean);
}

function setStatus() {
  const total = Math.min(QUESTION_COUNT, terms.length);
  progressEl.textContent = `Question ${Math.min(asked + 1, total)}/${total}`;
  scoreEl.textContent = `Score: ${score}`;
}

function pickUnusedIndex() {
  if (usedIndices.size >= terms.length) return -1;
  let index;
  do {
    index = Math.floor(Math.random() * terms.length);
  } while (usedIndices.has(index));
  usedIndices.add(index);
  return index;
}

function buildChoices(correctMeaning) {
  const wrongPool = terms.map((t) => t.meaning).filter((m) => m !== correctMeaning);
  const wrongChoices = shuffle(wrongPool).slice(0, CHOICE_COUNT - 1);
  return shuffle([correctMeaning, ...wrongChoices]);
}

function renderQuestion() {
  locked = false;
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  nextBtn.disabled = true;

  const idx = pickUnusedIndex();
  if (idx === -1) {
    finishQuiz();
    return;
  }

  const entry = terms[idx];
  currentAnswer = entry.meaning;
  termEl.textContent = entry.term;
  choicesEl.innerHTML = "";

  const choices = buildChoices(entry.meaning);
  for (const choice of choices) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.textContent = choice;
    btn.addEventListener("click", () => onAnswer(btn, choice));
    choicesEl.appendChild(btn);
  }

  setStatus();
}

function onAnswer(button, selected) {
  if (locked) return;
  locked = true;

  const allButtons = choicesEl.querySelectorAll("button");
  allButtons.forEach((btn) => {
    btn.disabled = true;
    if (btn.textContent === currentAnswer) btn.classList.add("correct");
  });

  if (selected === currentAnswer) {
    score += 1;
    button.classList.add("correct");
    feedbackEl.textContent = "Correct";
    feedbackEl.classList.add("correct");
  } else {
    button.classList.add("wrong");
    feedbackEl.textContent = `Incorrect. Correct answer: ${currentAnswer}`;
    feedbackEl.classList.add("wrong");
  }

  scoreEl.textContent = `Score: ${score}`;
  nextBtn.disabled = false;
}

function finishQuiz() {
  cardEl.classList.add("hidden");
  doneEl.classList.remove("hidden");
  finalScoreEl.textContent = `Final score: ${score}/${Math.min(QUESTION_COUNT, terms.length)}`;
  progressEl.textContent = "Question complete";
}

function nextQuestion() {
  asked += 1;
  const total = Math.min(QUESTION_COUNT, terms.length);
  if (asked >= total) {
    finishQuiz();
    return;
  }
  renderQuestion();
}

function restart() {
  asked = 0;
  score = 0;
  usedIndices = new Set();
  doneEl.classList.add("hidden");
  cardEl.classList.remove("hidden");
  setStatus();
  renderQuestion();
}

async function init() {
  try {
    const response = await fetch("words.txt", { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load words.txt (${response.status})`);

    const raw = await response.text();
    terms = parseTerms(raw);

    if (terms.length < CHOICE_COUNT) {
      throw new Error("Need at least 4 valid term lines in words.txt");
    }

    cardEl.classList.remove("hidden");
    restart();
  } catch (err) {
    errorEl.classList.remove("hidden");
    errorEl.textContent = `${err.message}. Run this with a local web server.`;
  }
}

nextBtn.addEventListener("click", nextQuestion);
restartBtn.addEventListener("click", restart);

init();
