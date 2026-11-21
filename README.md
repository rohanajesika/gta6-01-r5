[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/rohanajesika/gta6-01-r5/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/rohanajesika/gta6-01-r5/reward.svg)](https://make.fun/c/gta6-01)

# Solmar Bay — Open-World Crime

An original open-world crime game built for the [Make GTA 6](https://make.fun/c/gta6-01) competition on [make.fun](https://make.fun). Explore the sun-soaked city of Solmar Bay on foot and by car, steal vehicles, outrun the police, and finish Mira's three story jobs to become a Solmar legend.

## Play it

Serve `game/` with any static file server and open `index.html` in desktop Chrome — the game runs fully offline, no network requests:

```sh
node serve.ts
# then open http://localhost:8080
```

## How to play

- **W A S D / arrows** — move on foot, drive when in a car (Shift to run)
- **E** — get in / out of a car (steal it — the cops will notice)
- **F** — punch
- **Mouse drag** — look around, **wheel** — zoom, **P** — pause
- Progress (money, best fortune) saves in the browser.

## What's in the game

- A drivable open city: avenues, streets, buildings, lamps, palms and a marina plaza, built with three.js
- Traffic cars and pedestrians with flee behaviour
- A wanted system (0–5 stars) with police cruisers that chase, ram and bust you
- Three sequential story missions with a beacon, objectives and cash rewards, plus scattered cash bundles
- Combat on foot, car-vs-pedestrian consequences, health and slow regen
- Full HUD: minimap, wanted stars, health, speed, mission objective, message feed, bust meter
- Title, pause, busted and wasted screens; synthesised WebAudio sound (engine, sirens, punches, jingles) with no audio files
- Deterministic screenshot scenes: `?shot=start`, `?shot=play`, `?shot=end` (with `&seed=N`)

## Layout

- `game/` — the game itself (`index.html`, `src/` modules, vendored three.js under `game/vendor/three/`)
- `screenshots/` — real renders of the game
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `serve.ts` — tiny static server for local playtesting

## License

MIT — see [LICENSE](LICENSE).
