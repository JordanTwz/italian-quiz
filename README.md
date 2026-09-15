# ABRSM Musical Terms Quiz

Interactive multiple-choice quiz for practising the Italian, French and German musical terms required for ABRSM Music Theory Grades 1–8.

## Scope

The term lists follow the current ABRSM Music Theory qualification specification. Each term in `words.txt` is tagged with the grade at which it is listed.

## Features

- Grade 1–8 selection
- Selected-grade-only or cumulative coverage
- Randomized questions from the grade-tagged `words.txt`
- Modes: Term → English, English → term, Mixed
- Adjustable quiz length
- Skip question option
- Progress bar during the quiz
- End-of-quiz scorecard with breakdown

## Data format

Each line in `words.txt` contains three tab-separated fields:

```text
grade	term	English meaning
```

## Run locally

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

If `python` is not available:

```powershell
py -m http.server 8000
```
