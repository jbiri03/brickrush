# BrickRush

BrickRush is a browser-based brick-breaker arcade game. Move the paddle, clear each brick layout, and see how far you can get through the endless levels.

## Play locally

No build tools or dependencies are required. Open `index.html` in a modern browser, or use a local static server such as the VS Code Live Server extension.

## How to play

- Move the paddle with the left/right arrow keys or `A`/`D`.
- Move the paddle with your mouse, or drag with touch on mobile.
- Press `P` or `Escape`, or use the Pause button, to pause or resume.
- Switching tabs or leaving the browser window pauses the game. Resume manually when you return.
- Break bricks to score 10 points each. Clear the board to see the level-complete screen, then choose **Next Level**.
- The first ten levels use authored layouts; later levels generate new layouts and continue indefinitely.
- A life is lost only after every active ball is lost.

## Power-ups

Some destroyed bricks drop a collectible. Catch it with the paddle to activate its effect:

- **Wide paddle:** increases paddle width for 10 seconds.
- **Multi-ball:** adds two balls.
- **Extra life:** grants one additional life.
- **Slow ball:** reduces ball speed for 8 seconds.

Power-ups are intentionally uncommon, and extra lives are rarer than the other types.

## Progress

The high score and highest unlocked level are saved in the browser's `localStorage`. Progress is local to that browser and device; it is not synced to an account or leaderboard. Clearing a brick earns points and may update the high score; reaching a new level updates the unlocked level.

## Built with

- HTML5
- CSS
- Vanilla JavaScript
- HTML Canvas API

The game is a static frontend with no backend or external runtime dependencies, so it can be hosted on GitHub Pages or another static site host.
