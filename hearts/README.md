# Hearts (Claude)

A complete Hearts game for Shawn's mom's iPhone, built from Claude's "Suit Rows" design in the Sept 22-23 design bake-off (~/hearts-bakeoff/claude). It is Claude's own project, separate from Codex's files.

**Live:** https://sghanna.github.io/claude/hearts/ (repo sghanna/claude, folder `hearts/`). The `claude` repo holds Claude's games, one folder per game. mom-games is reserved for the game Shawn picks as each contest's winner, and the winning AI copies its game there.

## Try it on this Mac

```sh
cd ~/claude
python3 -m http.server 8767 --bind 127.0.0.1
```

Then open http://127.0.0.1:8767/hearts/. For a phone-sized view in Chrome or Safari, use the browser's responsive or device mode at 390 x 844.

## What's in it

- **Full rules.** Pass 3 cards left, right, across, then a hand with no passing. The 2 of clubs leads. Follow suit. No hearts or queen of spades on the first trick unless there's no other choice. Hearts can't be led until one has been played (the queen of spades doesn't count), unless you hold only hearts. Hearts are 1 point each and the queen of spades is 13. Shooting the moon gives everyone else 26. The game ends when anyone reaches 100; low score wins, and a tie for low score is a shared win.
- **Three computer players** (Michael, Jerry, Barbara). They play only from their own hand and cards already played. They pass the queen of spades unless they have 5+ spades to protect it, dump it on a higher spade, play just under the winning card to avoid points, lead low spades to flush out the queen, and throw away hearts and high spades when they can't follow suit. They don't try to shoot the moon on purpose.
- **The screen from the design.** One row per suit (clubs, diamonds, spades, hearts). Each player's card appears under their name, labeled "Led", "Winning" and "Takes it". The player whose turn it is has a gold name box. The playable row gets a brass outline. A red "+3" badge shows points taken this hand. The big bottom button says what will happen ("Play the queen of clubs").
- **Tapping.** Tap a card to choose it and tap again to put it back. Nothing is passed or played until she presses the big button. Tapping a card she can't play shows the reason ("You must follow clubs.") instead of selecting it.
- **Pace.** No timers. Computer players move every 1.3 s on Slow (the default) or 0.8 s on Normal. A finished trick stays on the table for 3.8 s (or 2.4 s), and "Next trick" skips the wait.
- **End of each hand.** A results panel shows this hand's points and the totals, and names the next pass direction. After the last hand, a game-over panel shows the winner, with "Play again".
- **Menu.** Last trick, Scores, How to play, Settings (speed, sound, language), and Back to the game. "Start a new game" sits below a gap and asks first.
- **Saving.** Saves after every action. Closing the app or losing power mid-hand resumes exactly where she was. A damaged save is detected, explained, and replaced with a new game.
- **Works offline** after the first visit, and can be added to the Home Screen as an app (icon, name "Hearts", full screen).
- **English, Spanish, Vietnamese.** Chosen automatically from the phone's language, changeable in Settings, or via `?lang=es` / `?lang=vi`. **The Spanish and Vietnamese are Claude's own translations and need a native speaker to check them.**
- **Sound** is off by default (Menu, then Settings). When on, each moment has its own gentle sound: a tick when a card is chosen, a soft low note when a tap isn't allowed, a card landing on the felt, a sweep when a trick is gathered, a low two-note "uh-oh" when she takes points, a deep note when the queen of spades falls, a bell when hearts are broken, and a chime or short fanfare for good moments. All sounds are generated in the app, so they work offline. An iPhone on silent plays none of them.
- **Portrait only.** Turning the phone sideways shows "Please turn your phone upright to play."

## Delight (added Sept 24, 2026)

The layout never moves. These additions explain what's happening and reward good moments:

- **Motion that explains.** A card glides out of the player's name box into their place on the table, and hers flies up from her hand. A finished trick gathers into the winner's name box, which glows. Passed cards travel to the receiving player, and the new ones arrive from the giver. Each movement takes about a third of a second. Phones set to Reduce Motion skip all of it.
- **Announcements** in the gold status line: "Hearts are broken" and "Queen of spades played: 13 points". The trick result names the queen when someone takes it. A player's red "+3" points badge bumps when it grows.
- **Celebrations sized to the moment,** as Shawn picked on Sept 24: heart cards floating up for a clean hand (no points), sky lanterns for winning the game, and "Moonrise" for shooting the moon (night falls, a glowing full moon with a heart-shaped crater rises, stars come out). The results box waits until the celebration has finished. Reduce Motion shows a still version of each.
- **Remembers her.** The game-over box shows games won, her best final score, and "New personal best!" when she beats it. These are kept on her phone only.

**Options pages** (a visual choice for Shawn):
- https://sghanna.github.io/claude/hearts/options-celebrations.html: gold ribbon, heart cards (live for a clean hand), sky lanterns (live for a win)
- https://sghanna.github.io/claude/hearts/options-moon.html: Moonrise (live), the old gold ribbon, or hearts flying into the moon
- https://sghanna.github.io/claude/hearts/options-playable.html: which cards she can play, shown as outline only (live), outline plus a light dim, or a strong dim

## Tested (Sept 23-24, 2026)

- `node hearts/tests/rules.test.mjs 5000` (from ~/claude): 30 rule checks plus 5,000 simulated games (54,865 hands, 713,245 tricks). Every play was legal, no card was ever lost or duplicated, every hand scored 26 (or 78 when someone shot the moon), and every game ended. All passed.
- `node hearts/tests/ui.test.mjs http://127.0.0.1:8767/hearts/ 2`: 61 checks, all passed, in WebKit (Safari's engine). They cover:
  - 3 complete games played through real taps, with no text overflow or scrolling at any step,
  - illegal taps explained,
  - save and restore mid-hand, and a damaged save,
  - the menus, the guarded new game, Last trick and Scores,
  - all 3 languages, including 2 full hands each in Spanish and Vietnamese at 375 x 667,
  - 13 cards on screen with 44 px or larger targets at 390 x 844, 390 x 763, 390 x 740 and 375 x 667,
  - a full game with motion and sound on (nothing stalls, stats recorded exactly once, celebrations clean up),
  - the options-page demos, which never touch the real saved game.
- Every animation and celebration was also captured mid-motion (slowed 15x) and checked by eye, including the Reduce Motion version.
- Offline play was checked in Chromium, because Playwright's WebKit can't reload any page while offline.
- Screenshots of every stage of a game were checked by eye in all three languages.

**Not tested:** a real iPhone, airplane mode on a real iPhone, VoiceOver, and Mom. On her phone, check: text size and contrast, whether Slow is slow enough, and whether she understands the gold outline and the "+3" badges.

## Not done

- **No undo.** The explicit Pass/Play button was designed to prevent mistakes instead.
- **Computer difficulty isn't adjustable.**

## Files

- `index.html`, `style.css`: the screen
- `app.js`: taps, drawing, pacing, saving, stats
- `fx.js`: motion, sounds and celebrations
- `options-*.html`, `options.css`: side-by-side choices for Shawn (not part of the installed app)
- `rules.js`: rules and computer players, no screen code, so Node can test it
- `i18n.js`: all words in three languages
- `glyphs.js`: the traced card lettering from agy-solitaire
- `sw.js`: the offline copy
- `manifest.json`, `icon-*.png`, `icon.svg`: Home Screen app setup
- `tests/`: the two test suites; `tests/shots/` holds screenshots at each phone size

## Publishing a change

1. Edit and test in ~/claude/hearts.
2. Bump `VERSION` in `sw.js` (for example `claude-hearts-v2`), or her phone keeps the old copy.
3. Commit and push ~/claude (the sghanna/claude repo). GitHub Pages usually updates within a minute or two.

**Offline copy on a shared site.** Every game on sghanna.github.io shares one offline storage area. This game only deletes its own old copies. agy-solitaire's cleanup deletes every other game's copy whenever it updates. If that happens, Hearts refills its copy the next time it's opened with a connection (tested). The one gap: if agy-solitaire updates and she then opens Hearts for the first time in airplane mode, Hearts won't load until she's back online. Changing agy-solitaire's `sw.js` to delete only caches starting with `agy-solitaire-` would close that gap.

Test-only URL options: `?seed=N` deals the same cards every time and starts a new game, and `?fast=1` makes computer players instant.
