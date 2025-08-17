## Vocal Pitch Detector

Single‑page web app that listens to your microphone and highlights the nearest piano key (full 88‑key range A0–C8) in real time. A faint trail of recent detected pitches (unsnapped raw frequencies) is rendered as dots rising over the keyboard for quick visual pitch drift feedback.

Demo: https://zenerrb.github.io/vocalpitchdetector/

### Current Features
* Real‑time pitch detection (autocorrelation) in the browser – no backend.
* Full 88‑key virtual piano with smooth horizontal scrolling.
* Sticky note highlighting (short debounce reduces flicker on noisy input).
* Raw frequency dot overlay (log‑interpolated between semitones) for micro‑intonation visualization.
* Dark / light theme toggle with preference persistence.
* Responsive layout; touch + mouse scroll friendly.

### Use It
1. Open `index.html` locally (or visit the demo URL).
2. Press Start and allow microphone access.
3. Sing / play – the active key lights; dots show recent pitch history.
4. Press Stop to release the mic.

### Tech Notes
* Plain HTML/CSS/JS (no build step, no dependencies).
* Autocorrelation is intentionally simple (good for monophonic voice); swap in YIN/AMDF/etc. if you need more robustness.
* Overlay uses requestAnimationFrame; emission capped (~50 Hz) to balance smoothness and CPU.

### File
* `index.html` – entire app.

### License
MIT (feel free to adapt / extend).

