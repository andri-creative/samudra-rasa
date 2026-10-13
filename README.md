# Samudra Rasa 🌊 — 14 Babak Laut Dalam

> A 14-scene romantic mini-game journey through a deep-ocean bioluminescent world — sonar, message bottles, pearl clams, and a lighthouse finale.

## About

`samudra-rasa` is a deep-ocean themed romantic interactive experience. Across 14 scenes, the visitor navigates a bioluminescent sea: lighting a lighthouse, scanning with sonar, catching glowing bubbles, opening a message in a bottle, scratching pearl clams, steering a ship's wheel, connecting star constellations, and more — all rendered in an ocean-glassmorphism aesthetic.

## 14 Scenes

1. 🗼 **Nyalakan Mercusuar** — Slider + 3 ignites to light the beacon
2. 🧭 **Sonar Radar Hati** — Hold 2.5s to scan
3. 🫧 **Gelembung Harapan** — Catch 5 glowing bubbles (canvas)
4. 🍾 **Pesan dalam Botol** — Lift bottle, pull the cork
5. 🦪 **Gosok Kerang Mutiara** — Scratch-card 3 pearl clams
6. ⚓ **Kemudi Haluan Cinta** — Turn ship's wheel 180°
7. 🐚 **Kotak Musik Nautilus** — Music box with ocean visualizer
8. 🌌 **Rasi Bintang Samudra** — Connect 5 constellation stars
9. 📸 **Polaroid Kenangan Laut** — Ocean memory polaroids
10. 🤿 **Gelembung Napas Cinta** — Breath-bubble game
11. 🛟 **Pelampung Pelukan Hangat** — Hug float game
12. 📜 **Surat Palung Terdalam** — Deepest trench letter
13. 🪼 **Ubur-ubur Usil** — Mischievous jellyfish chase
14. 🎆 **Grand Finale Cahaya Laut** — Ocean light fireworks + WA

## Features

- Ocean glassmorphism cards
- Bioluminescent particles (jellyfish, glowing bubbles)
- Web Audio API: water-drop SFX, soft wave, starlight chime (all synthesized — no large audio files)
- Scene navigation with progress dots
- Mini-game canvas elements
- Finale fireworks + WhatsApp share

## Tech Stack

- Vanilla HTML / CSS / JS
- Web Audio API (synthesized ocean SFX + music)
- Canvas (bubbles, finale)
- SVG icons (bottle, clam, boat)
- Local asset: `perahu-kenangan.gif`

## How to Run

```bash
cd samudra-rasa
npx serve .
```

## Project Structure

```
samudra-rasa/
├── index.html                # 14 scene sections + SVG defs
├── script.js                 # Engine + 14 interactions + audio
├── style.css                 # Ocean theme
├── PLAN.md                   # Full project spec
├── assets/
│   └── perahu-kenangan.gif   # Memory sailboat asset
└── .gitignore
```

## Theme

- **Palette:** Deep Sea Navy `#071326`, Sapphire Wave `#0c4a6e`/`#0284c7`, Aquamarine Glow `#38bdf8`/`#7dd3fc`, Seafoam Pearl `#e0f2fe`, Coral Love `#f43f5e`
- **Mood:** Deep ocean at night, bioluminescent, mysterious-yet-warm
