# Italian Musical Terms Quiz

Interactive web quiz for practicing musical Italian terms in MCQ format.

## Scope
This version is intended for **ABRSM Grades 1-5 only** (for now).

## Features
- Randomized questions from `words.txt`
- Modes: Italian -> English, English -> Italian, Mixed
- Skip question option
- Progress bar during quiz
- End-of-quiz scorecard with breakdown

## Run locally
```powershell
cd C:\Users\Jordan Tan\Desktop\italiantest
python -m http.server 8000
```
Then open `http://localhost:8000`.

If `python` is not available:
```powershell
py -m http.server 8000
```
