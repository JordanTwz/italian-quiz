const QUESTION_COUNT = 15;
const CHOICE_COUNT = 4;

const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const quizContextEl = document.getElementById("quizContext");
const progressFillEl = document.getElementById("progressFill");
const progressWrapEl = document.getElementById("progressWrap");
const statusEl = document.getElementById("status");
const setupPanelEl = document.getElementById("setupPanel");
const cardEl = document.getElementById("card");
const promptTypeEl = document.getElementById("promptType");
const questionLanguageEl = document.getElementById("questionLanguage");
const questionGradeEl = document.getElementById("questionGrade");
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
const gradeSelect = document.getElementById("gradeSelect");
const scopeSelect = document.getElementById("scopeSelect");
const modeSelect = document.getElementById("modeSelect");
const questionCountSelect = document.getElementById("questionCountSelect");
const termCountEl = document.getElementById("termCount");
const errorEl = document.getElementById("error");

let allTerms = [];
let terms = [];
let asked = 0;
let score = 0;
let usedIndices = new Set();
let locked = false;
let currentQuestion = null;
let results = [];
let quizQuestionCount = 15;
let celebrationTimer = null;

const FRENCH_TERMS = new Set([
  "Animé", "Douce", "Lent", "Modéré", "Retenu", "Vite",
  "À", "Avec", "Doux", "Encore", "Et", "Non", "Peu", "Plus", "Sans", "Très", "Un, une",
  "1er mouvt. (mouvement)", "Assez", "Au mouvt. (mouvement)", "Cédez", "En animant",
  "En serrant", "Mais", "Moins", "Ralentir", "Sonore", "Vif",
  "En dehors", "Légèrement", "Modérément", "Peu à peu", "Presser, pressez"
]);

const GERMAN_TERMS = new Set([
  "Langsam", "Lebhaft", "Mässig", "Ruhig", "Schnell", "Traurig",
  "Ausdruck, ausdrucksvoll", "Ein", "Etwas", "Geschwind", "Langsamer", "Mit", "Nicht",
  "Ohne", "Rasch", "Sehr", "Und", "Ziemlich", "Zu",
  "Aber", "Doch", "Empfindung", "Fröhlich", "Gesangvoll", "Langsamer als", "Süss", "Voll", "Zart",
  "Bewegt", "Breit", "Einfach", "Gesprochen", "Immer", "Lebhafter", "Leicht", "Leise",
  "Ruhiger", "Schleppend", "Schneller", "Wenig", "Wieder"
]);

function languageForTerm(term) {
  if (FRENCH_TERMS.has(term)) return "French";
  if (GERMAN_TERMS.has(term)) return "German";
  return "Italian";
}

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
      if (parts.length < 3) return null;
      const grade = Number.parseInt(parts[0].trim(), 10);
      const term = parts[1].trim();
      const meaning = parts.slice(2).join("\t").trim();
      if (grade < 1 || grade > 8 || !term || !meaning) return null;
      return { grade, language: languageForTerm(term), term, meaning };
    })
    .filter(Boolean);
}

function getTermsForSelection() {
  const grade = Number.parseInt(gradeSelect.value, 10);
  const isCumulative = scopeSelect.value === "cumulative";
  const selected = allTerms.filter((entry) => isCumulative ? entry.grade <= grade : entry.grade === grade);
  if (!isCumulative) return selected;

  const uniqueTerms = new Map();
  for (const entry of selected) {
    const key = entry.term.toLocaleLowerCase();
    if (!uniqueTerms.has(key)) uniqueTerms.set(key, entry);
  }
  return [...uniqueTerms.values()];
}

function directionLabel(direction) {
  return direction === "term-en" ? "Term → English" : "English → term";
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
  if (mode === "mixed") return Math.random() < 0.5 ? "term-en" : "en-term";
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
  const isTermPrompt = direction === "term-en";
  const prompt = isTermPrompt ? entry.term : entry.meaning;
  const answer = isTermPrompt ? entry.meaning : entry.term;
  const pool = isTermPrompt ? terms.map((t) => t.meaning) : terms.map((t) => t.term);

  currentQuestion = {
    index: asked + 1,
    grade: entry.grade,
    language: entry.language,
    direction,
    prompt,
    answer
  };

  promptTypeEl.textContent = direction === "term-en" ? "Term to English" : "English to term";
  questionLanguageEl.textContent = entry.language;
  questionGradeEl.textContent = `Grade ${entry.grade}`;

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

function lockChoices(answerClass = "correct") {
  const allButtons = choicesEl.querySelectorAll("button");
  allButtons.forEach((btn) => {
    btn.disabled = true;
    if (btn.textContent === currentQuestion.answer) {
      btn.classList.add(answerClass);
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
  } else {
    button.classList.add("wrong");
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

  lockChoices("skipped");

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
      return `<tr class="${rowClass}"><td>${r.index}</td><td>${r.grade}</td><td>${r.language}</td><td>${directionLabel(r.direction)}</td><td>${escapeHtml(r.prompt)}</td><td>${escapeHtml(r.selected)}</td><td>${escapeHtml(r.answer)}</td></tr>`;
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
    ${detailRows ? `<table><thead><tr><th>#</th><th>Grade</th><th>Language</th><th>Mode</th><th>Question</th><th>Your answer</th><th>Correct answer</th></tr></thead><tbody>${detailRows}</tbody></table>` : ""}
  `;
}

function clearConfetti() {
  if (celebrationTimer) {
    window.clearTimeout(celebrationTimer);
    celebrationTimer = null;
  }
  document.querySelector(".confettiLayer")?.remove();
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  clearConfetti();
  const layer = document.createElement("div");
  layer.className = "confettiLayer";
  layer.setAttribute("aria-hidden", "true");

  const colors = ["#156b59", "#d6a84b", "#e56b5d", "#5b75c9", "#f0b7c2", "#ffffff"];
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < 120; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confettiPiece";
    piece.style.setProperty("--x", `${Math.random() * 100}vw`);
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 28}vw`);
    piece.style.setProperty("--delay", `${Math.random() * 0.9}s`);
    piece.style.setProperty("--duration", `${2.8 + Math.random() * 1.8}s`);
    piece.style.setProperty("--rotation", `${360 + Math.random() * 720}deg`);
    piece.style.setProperty("--color", colors[Math.floor(Math.random() * colors.length)]);
    piece.style.setProperty("--size", `${6 + Math.random() * 7}px`);
    fragment.appendChild(piece);
  }

  layer.appendChild(fragment);
  document.body.appendChild(layer);
  celebrationTimer = window.setTimeout(clearConfetti, 5200);
}

function finishQuiz() {
  cardEl.classList.add("hidden");
  doneEl.classList.remove("hidden");
  finalScoreEl.textContent = `Final score: ${score}/${getTotalQuestions()}`;
  scoreBreakdownEl.innerHTML = breakdownHtml();
  progressEl.textContent = "Complete";
  progressFillEl.style.width = "100%";
  if (getTotalQuestions() > 0 && score === getTotalQuestions()) launchConfetti();
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
  clearConfetti();
  setupPanelEl.classList.remove("hidden");
  statusEl.classList.add("hidden");
  progressWrapEl.classList.add("hidden");
  cardEl.classList.add("hidden");
  doneEl.classList.add("hidden");
  progressEl.textContent = "Question 0/0";
  scoreEl.textContent = "Score: 0";
  quizContextEl.textContent = "";
  progressFillEl.style.width = "0%";
}

function startQuiz() {
  terms = getTermsForSelection();
  const grade = gradeSelect.value;
  quizContextEl.textContent = scopeSelect.value === "cumulative" ? `Grades 1–${grade}` : `Grade ${grade}`;
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
  scopeSelect.disabled = gradeSelect.value === "1";
  if (scopeSelect.disabled) scopeSelect.value = "grade-only";

  const defaults = [5, 10, 15, 20, 30, 50];
  const selectedTerms = getTermsForSelection();
  const max = selectedTerms.length;
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

  const grade = gradeSelect.value;
  const coverage = scopeSelect.value === "cumulative" ? `Grades 1–${grade}` : `Grade ${grade} only`;
  termCountEl.textContent = `${coverage}: ${max} terms available`;
  startBtn.disabled = max < CHOICE_COUNT;
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
    allTerms = parseTerms(raw);

    if (allTerms.length < CHOICE_COUNT) {
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
gradeSelect.addEventListener("change", populateQuestionCountOptions);
scopeSelect.addEventListener("change", populateQuestionCountOptions);

init();
