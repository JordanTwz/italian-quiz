const QUESTION_COUNT = 15;
const CHOICE_COUNT = 4;

const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const progressFillEl = document.getElementById("progressFill");
const progressWrapEl = document.getElementById("progressWrap");
const statusEl = document.getElementById("status");
const setupPanelEl = document.getElementById("setupPanel");
const cardEl = document.getElementById("card");
const promptTypeEl = document.getElementById("promptType");
const termEl = document.getElementById("term");
const choicesEl = document.getElementById("choices");
const feedbackEl = document.getElementById("feedback");
const nextBtn = document.getElementById("nextBtn");
const skipBtn = document.getElementById("skipBtn");
const endBtn = document.getElementById("endBtn");
const doneEl = document.getElementById("done");
const finalScoreEl = document.getElementById("finalScore");
const scoreBreakdownEl = document.getElementById("scoreBreakdown");
const restartBtn = document.getElementById("restartBtn");
const startBtn = document.getElementById("startBtn");
const modeSelect = document.getElementById("modeSelect");
const questionCountSelect = document.getElementById("questionCountSelect");
const errorEl = document.getElementById("error");

let terms = [];
let asked = 0;
let score = 0;
let usedIndices = new Set();
let locked = false;
let currentQuestion = null;
let results = [];
let quizQuestionCount = 15;

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

function getTotalQuestions() {
  return Math.min(quizQuestionCount, terms.length);
}

function setStatus() {
  const total = getTotalQuestions();
  progressEl.textContent = `Question ${Math.min(asked + 1, total)}/${total}`;
  scoreEl.textContent = `Score: ${score}`;
  const completed = results.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressFillEl.style.width = `${pct}%`;
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

function getDirection() {
  const mode = modeSelect.value;
  if (mode === "mixed") return Math.random() < 0.5 ? "it-en" : "en-it";
  return mode;
}

function buildChoices(correct, pool) {
  const uniquePool = [...new Set(pool.filter((item) => item !== correct))];
  if (uniquePool.length < CHOICE_COUNT - 1) {
    throw new Error("Not enough unique items to build multiple choice options");
  }

  const wrongChoices = shuffle(uniquePool).slice(0, CHOICE_COUNT - 1);
  return shuffle([correct, ...wrongChoices]);
}

function renderQuestion() {
  locked = false;
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  nextBtn.disabled = true;
  skipBtn.disabled = false;
  endBtn.disabled = false;

  const idx = pickUnusedIndex();
  if (idx === -1) {
    finishQuiz();
    return;
  }

  const entry = terms[idx];
  const direction = getDirection();
  const isItalianPrompt = direction === "it-en";
  const prompt = isItalianPrompt ? entry.term : entry.meaning;
  const answer = isItalianPrompt ? entry.meaning : entry.term;
  const pool = isItalianPrompt ? terms.map((t) => t.meaning) : terms.map((t) => t.term);

  currentQuestion = {
    index: asked + 1,
    direction,
    prompt,
    answer
  };

  promptTypeEl.textContent = direction === "it-en" ? "Italian to English" : "English to Italian";

  termEl.textContent = prompt;
  choicesEl.innerHTML = "";

  const choices = buildChoices(answer, pool);
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

function lockChoices() {
  const allButtons = choicesEl.querySelectorAll("button");
  allButtons.forEach((btn) => {
    btn.disabled = true;
    if (btn.textContent === currentQuestion.answer) {
      btn.classList.add("correct");
    }
  });

  skipBtn.disabled = true;
  endBtn.disabled = true;
}

function onAnswer(button, selected) {
  if (locked) return;
  locked = true;

  lockChoices();

  const isCorrect = selected === currentQuestion.answer;
  if (isCorrect) {
    score += 1;
    button.classList.add("correct");
    feedbackEl.textContent = "Correct";
    feedbackEl.classList.add("correct");
  } else {
    button.classList.add("wrong");
    feedbackEl.textContent = `Incorrect. Correct answer: ${currentQuestion.answer}`;
    feedbackEl.classList.add("wrong");
  }

  results.push({
    ...currentQuestion,
    status: isCorrect ? "correct" : "incorrect",
    selected
  });

  scoreEl.textContent = `Score: ${score}`;
  setStatus();
  nextBtn.disabled = false;
}

function skipQuestion() {
  if (locked || !currentQuestion) return;
  locked = true;

  lockChoices();
  feedbackEl.textContent = `Skipped. Correct answer: ${currentQuestion.answer}`;
  feedbackEl.classList.add("wrong");

  results.push({
    ...currentQuestion,
    status: "skipped",
    selected: "(Skipped)"
  });

  setStatus();
  nextBtn.disabled = false;
}

function breakdownHtml() {
  const total = getTotalQuestions();
  const notReached = Math.max(0, total - results.length);
  const correct = results.filter((r) => r.status === "correct").length;
  const incorrect = results.filter((r) => r.status === "incorrect").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const attempted = correct + incorrect;
  const accuracy = attempted === 0 ? 0 : Math.round((correct / attempted) * 100);

  const detailRows = results
    .map((r) => {
      let rowClass = "row-skipped";
      if (r.status === "correct") rowClass = "row-correct";
      if (r.status === "incorrect") rowClass = "row-incorrect";
      return `<tr class="${rowClass}"><td>${r.index}</td><td>${r.direction}</td><td>${escapeHtml(r.prompt)}</td><td>${escapeHtml(r.selected)}</td><td>${escapeHtml(r.answer)}</td></tr>`;
    })
    .join("");

  return `
    <ul>
      <li class="metric-correct">Correct: ${correct}</li>
      <li class="metric-wrong">Incorrect: ${incorrect}</li>
      <li class="metric-skipped">Skipped: ${skipped}</li>
      <li>Not reached: ${notReached}</li>
      <li>Attempted accuracy: ${accuracy}%</li>
      <li>Total questions: ${total}</li>
    </ul>
    ${detailRows ? `<table><thead><tr><th>#</th><th>Mode</th><th>Question</th><th>Your answer</th><th>Correct answer</th></tr></thead><tbody>${detailRows}</tbody></table>` : ""}
  `;
}

function finishQuiz() {
  cardEl.classList.add("hidden");
  doneEl.classList.remove("hidden");
  finalScoreEl.textContent = `Final score: ${score}/${getTotalQuestions()}`;
  scoreBreakdownEl.innerHTML = breakdownHtml();
  progressEl.textContent = "Question complete";
  progressFillEl.style.width = "100%";
}

function endQuizEarly() {
  if (cardEl.classList.contains("hidden")) return;
  finishQuiz();
}

function nextQuestion() {
  asked += 1;
  if (asked >= getTotalQuestions()) {
    finishQuiz();
    return;
  }

  renderQuestion();
}

function showSetupScreen() {
  setupPanelEl.classList.remove("hidden");
  statusEl.classList.add("hidden");
  progressWrapEl.classList.add("hidden");
  cardEl.classList.add("hidden");
  doneEl.classList.add("hidden");
  progressEl.textContent = "Question 0/0";
  scoreEl.textContent = "Score: 0";
  progressFillEl.style.width = "0%";
}

function startQuiz() {
  setupPanelEl.classList.add("hidden");
  statusEl.classList.remove("hidden");
  progressWrapEl.classList.remove("hidden");
  quizQuestionCount = Number.parseInt(questionCountSelect.value, 10) || QUESTION_COUNT;

  asked = 0;
  score = 0;
  usedIndices = new Set();
  locked = false;
  currentQuestion = null;
  results = [];

  doneEl.classList.add("hidden");
  cardEl.classList.remove("hidden");
  setStatus();
  renderQuestion();
}

function populateQuestionCountOptions() {
  const defaults = [5, 10, 15, 20, 30, 50];
  const max = terms.length;
  const values = defaults.filter((n) => n <= max);
  if (!values.includes(max)) values.push(max);
  const uniqueSorted = [...new Set(values)].sort((a, b) => a - b);
  questionCountSelect.innerHTML = "";

  for (const value of uniqueSorted) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    if (value === 15) option.selected = true;
    questionCountSelect.appendChild(option);
  }

  if (!uniqueSorted.includes(15) && uniqueSorted.length > 0) {
    questionCountSelect.value = String(uniqueSorted[uniqueSorted.length - 1]);
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function init() {
  try {
    const response = await fetch("words.txt", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load words.txt (${response.status})`);
    }

    const raw = await response.text();
    terms = parseTerms(raw);

    if (terms.length < CHOICE_COUNT) {
      throw new Error("Need at least 4 valid term lines in words.txt");
    }

    populateQuestionCountOptions();
    errorEl.classList.add("hidden");
    showSetupScreen();
  } catch (err) {
    errorEl.classList.remove("hidden");
    errorEl.textContent = `${err.message}. Run this with a local web server.`;
  }
}

nextBtn.addEventListener("click", nextQuestion);
skipBtn.addEventListener("click", skipQuestion);
endBtn.addEventListener("click", endQuizEarly);
restartBtn.addEventListener("click", showSetupScreen);
startBtn.addEventListener("click", startQuiz);

init();
