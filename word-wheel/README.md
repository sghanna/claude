# Word Wheel (Claude)

An ad-free word puzzle in the style of Wordscapes, built for one player with a visual impairment who plays on an iPhone from the Home Screen. It is Claude's own project, separate from the other AI builders' entries.

**Live:** https://sghanna.github.io/claude/word-wheel/ (repo sghanna/claude, folder `word-wheel/`).

To put it on an iPhone: open the link in Safari, tap Share, then **Add to Home Screen**. After the first visit it works with no connection.

## How to play

- Make words from the letters on the wheel. Every word has 3 or more letters, and each letter is used once per word.
- **Swipe:** put a finger on a letter, slide through the next letters, and lift. Sliding back onto the letter before takes the last one away.
- **Or tap:** tap letters one at a time, then press **Enter**. **Back** takes away the last letter, and so does tapping the last letter again.
- A word in the puzzle fills in its squares. Any other real word is a **bonus word** ("Nice find!").
- **Shuffle** mixes up the wheel. **Hint** shows one letter. **Pick a square** shows the letter in the square you tap next. All three are free and unlimited: no coins, no ads, no timers.

## What's in it

- **1,000 levels.** They start like Wordscapes, with level 1 as C A T (CAT, ACT). Levels 5-20 have 4 letters, 21-60 have 5, and 61 onward have 6. Words per level rise slowly, from 2 to about 10. After level 1,000 play starts again at level 1.
- **Big and clear.** Grids are never wider or taller than 7 squares. On a 390 x 844 iPhone the smallest square is 46 px, and wheel letters are 69 px circles with 41 px letters. Text is 18 px or larger and bold. Contrast is measured from screen pixels: 10.4:1 or better for all text in every look, against a 7:1 target.
- **Forgiving taps.** Long holds count, and so do presses that drift before lifting. On the wheel, a press that never reaches a second letter counts as a tap, however long it is held. A letter is only picked up when the finger is well inside it, so sliding past a neighbor doesn't grab it. Nothing can be selected as text, and nothing zooms or scrolls.
- **Feedback.** A found word flies into the grid. A repeated word makes its squares flash. A word that isn't accepted shakes the strip and gives two short haptic buzzes (iOS 18+, works on silent).
- **Menu:** How to play, Settings (Sound, off by default; Language), Go to a level already reached (any level on a save started on a new device, see iPad), Back to the game. "Start over from level 1" sits apart and asks first.
- **Saving** after every action. Closing the app resumes exactly where she was. A damaged save is detected, explained and replaced.
- **English, Spanish, Vietnamese** menus, detected from the phone, changeable in Settings or with `?lang=es` / `?lang=vi`. The puzzles are English. **The Spanish and Vietnamese are Claude's translations and need a native speaker to check them.**
- **Sound** (off by default, generated in the app): a tick per letter rising in pitch, a chime for a word, a sparkle for a bonus word, the Hearts marimba for a word that isn't accepted, and a short fanfare at the end of a level.

## Words

Words come from **SCOWL** (Kevin Atkinson and contributors; copyright and permission notice in `tools/sources/SCOWL-Copyright`), minus the **List of Dirty, Naughty, Obscene, and Otherwise Bad Words** (LDNOOBW, CC BY 4.0). Grid answers come only from SCOWL's most common lists (sizes 10 and 20 for levels 1-60, plus 35 after that). Bonus words come from a much larger list (up to size 60), so a real word is rarely turned down.

An editor's review of all 17,782 possible answers, plus a second pass over the 3,063 words the levels actually use, removed 956 words from the grid. They are listed with reasons in `tools/removed-words.txt`:
- **block** (38 words): slurs, sexual, crude or drug words. Never shown, never accepted.
- **nogrid** (918 words): grim words (death, disease), odd forms (HES, MYS, PIS), archaic, British-only or obscure words, jargon and clipped slang. These are never grid answers but are still accepted as bonus words.

On Sept 25 Shawn put the weapon words (gun, knife, sword, bullet, bomb and their forms) back in, along with THY, WHILST, BITMAP, HAG and DIKE (a dam, too).

Details: `tools/WORDS.md`.

## iPad

Her iPad Air 2 (iPadOS 15.8) and Shawn's iPad mini 5 both measure 768 x 1024 points; the mini shows the same layout about 20% smaller. Three layouts sit behind the URL option `?ipad=` (not saved). Until Shawn picks, the live game uses `today`. Ship a pick by changing `DEFAULT_IPAD` in app.js.

- **`fill`** (Claude's recommendation): upright, everything grows together by one scale, u (1.30 on a 768 x 1024 iPad): grid squares, wheel letters, buttons, text and dialogs. It's the phone layout, bigger. Sideways there's no extra height, so it looks like today. On the 146 levels with 7-row grids of up to 6 columns, the word strip and buttons get a little shorter (as on a small phone) so squares and letters never come out smaller than today's.
- **`today`**: the phone-width column (430 px) with empty space on both sides.
- **`split`**: `fill` when upright. Sideways (at least 900 wide and 1.2 times as wide as tall), two columns: the grid on the left; the status line, word strip, buttons and wheel on the right (u = 1.26).

Any screen 430 points wide or narrower gets today's game exactly, whatever the option; Split View and Slide Over widths get today's sizes. Turning the iPad mid-level keeps the word in progress, found words, Pick a square and open dialogs.

Measured in WebKit (grid square / wheel letter, px; button text is 19 px on the phone, 25 in fill upright, 24 in split sideways):

| Level | iPhone 390 x 844 | iPad upright, today | iPad upright, fill | iPad sideways, today and fill | iPad sideways, split |
|---|---|---|---|---|---|
| 1 | 66 / 92 | 66 / 92 | 86 / 120 | 66 / 92 | 83 / 120 |
| 21 | 52 / 83 | 66 / 84 | 68 / 109 | 52 / 76 | 83 / 109 |
| 65 (tall grid) | 46 / 69 | 64 / 84 | 68 / 94 | 49 / 72 | 72 / 109 |
| 105 (biggest grid) | 46 / 69 | 54 / 84 | 60 / 91 | 49 / 72 | 62 / 109 |
| 400 | 46 / 69 | 54 / 84 | 60 / 91 | 49 / 72 | 62 / 109 |

- **No buzz on an iPad.** Neither iPad has a vibration motor; a word that isn't accepted still shakes the strip.
- **Progress.** Each device keeps its own save. A save started from nothing on a device (such as her iPad) lets Go to a level reach all 1,000 levels. Her phone's existing save still reaches only the levels she has played.
- **Safety screen.** If the game can't start (a script error before the first level is drawn, or no level 2 seconds after the page loads), `boot-check.js` shows a big plain message: "Word Wheel couldn't start on this iPad. Please send Shawn a screenshot of this screen." ("iPhone" on a phone), with the error and the iPadOS or Safari version under it.
- **Safari 15 was checked by search, not on a real iPad Air 2.** `node word-wheel/tools/safari15-check.mjs` found nothing that needs newer than Safari 15.0; es-check (ES2021) and doiuse (`ios_saf >= 15`) agree. `:focus-visible` needs 15.4 (her 15.8 has it) and `overscroll-behavior` needs 16 (ignored; the page never scrolls).
- **Known:** at 320 points wide (the narrowest Split View, and 4-inch iPhones), "Level 400" in the top bar is cut to "Level 4" in every option, today's game included. Her phone and full-screen iPads are fine.

To put it on an iPad: open the link in Safari, tap Share, then **Add to Home Screen**, and open it once from there while online.

## Tested (Sept 25, 2026)

- `node word-wheel/tests/levels.test.mjs` (from ~/claude) checks every one of the 1,000 levels. Each answer must be spellable from the wheel and come from the right word list, with no removed words. Grids must stay within 7 x 7 and be connected, every word must cross another, and letters must agree where words cross. No accidental words can form where letters touch, no base word repeats, the ramp must hold, and level 1 must be CAT/ACT. All passed.
- `node word-wheel/tests/ui.test.mjs http://127.0.0.1:8767/word-wheel/` ran 2,098 checks in WebKit (Safari's engine) with touch, all passed (about 16 minutes). They cover:
  - levels 1-10 finished by swipes, 3 more by taps and Enter, and one by touch events;
  - a wrong word, a repeated word, a bonus word, Shuffle, Hint (including finishing a word by hints alone) and Pick a square;
  - long holds, drift and backing up on the wheel; long holds and slides on buttons counted exactly once; no text selection;
  - save and restore mid-level, and a damaged save;
  - minimum sizes and no scrolling on the biggest grid (level 105, 7 x 7 with 6 letters) at 390 x 844, 390 x 763, 390 x 740 and 375 x 667;
  - all dialogs in all three languages;
  - offline play (in Chromium, because Playwright's WebKit can't reload offline).
  - iPad (added Sept 25): every option (`today`, `fill`, `split`) at 768 x 1024, 768 x 954, 1024 x 768, 1024 x 698 and the Split View widths 320, 438, 507 and 694, on levels 1, 21, 105, 400 and 1,000: no scrolling or overlap, the minimum sizes, and `fill`/`split` bigger than the phone where the plan says;
  - levels finished by swipes and by taps at iPad size, long holds, drift and button slides; turning the iPad mid-level with a word half spelled, Pick a square on, or a dialog open;
  - every dialog and the level-complete panel in all three languages at iPad size; Go to a level on a new save and an old one; the safety screen with a broken or throwing app.js, and never in normal play.
- `node .work/ipad-baseline/compare.mjs` (from ~/claude; kept out of git) proves her phone didn't change: with no option and with each `?ipad=` value, the sizes for all 1,000 levels at 390 x 844, 390 x 763, 390 x 740 and 375 x 667, and screenshots of five levels in all three looks plus Menu, Help and level complete, match the game from before the iPad work pixel for pixel.
- Screenshots of each screen were checked by eye.

**Not tested:** a real iPhone (haptics, sound and real finger swipes), a real iPad Air 2 or iPad mini, VoiceOver, and the player herself. On her phone, check that letters are big enough, that swiping works for her or she uses tap and Enter, and that Hint is easy to find.

**Known:** on the smallest phone size tested (375 x 667, not her phone), the six wheel letters on the biggest levels hang slightly over the rim of the wheel. Everything fits and meets the minimum sizes.

## Visual choices (for Shawn)

- https://sghanna.github.io/claude/word-wheel/options-look.html: three looks with measured contrast. Shawn picked felt (Sept 25, live now). `?look=light` or `?look=scenery` previews one; ship a pick by changing `DEFAULT_LOOK` in app.js.
- https://sghanna.github.io/claude/word-wheel/options-icon.html: three icons at Home Screen size next to Solitaire and Hearts. Shawn picked the six-letter wheel (Sept 25).
- https://sghanna.github.io/claude/word-wheel/options-icon-word.html: that wheel with the swipe path spelling out the word. Live now: W-O-R-D.
- https://sghanna.github.io/claude/word-wheel/options-ipad.html: three iPad layouts, each the real game at iPad size, upright or sideways, with measured sizes. "Try it full size" opens one in its own tab. Waiting for Shawn's pick; `today` is live.

## Publishing a change

1. Edit and test in ~/claude/word-wheel. For word changes: edit `tools/removed-words.txt`, then run `node tools/generate.mjs` and `node tests/levels.test.mjs`.
2. Bump `VERSION` in `sw.js` (for example `claude-word-wheel-v4`), or installed phones keep the old copy.
3. Commit and push ~/claude. GitHub Pages usually updates within a minute or two.

The offline copy deletes only its own old copies (prefix `claude-word-wheel-`) and refills itself if another game's cleanup wipes it.

Test-only URL options: `?level=N` plays level N in a separate test save, `?fresh=1` clears that test save, and `?fast=1` removes animation delays. A real game never uses them.

## Files

- `index.html`, `style.css`: the screen and the three looks
- `boot-check.js`: the "couldn't start" safety screen (old-style code on purpose, so it runs when newer code fails)
- `app.js`: wheel input, grid, hints, saving, dialogs, layout sizing
- `fx.js`: sounds, haptic buzz and motion
- `i18n.js`: every on-screen word in three languages
- `levels.js`: the 1,000 levels (generated; don't edit by hand)
- `sw.js`, `manifest.json`, `icon.svg`, `icon-*.png`: offline copy and Home Screen setup
- `options-*.html`, `options.css`, `icon-options/`: side-by-side choices (not part of the installed app)
- `tools/`: word sources, the removal list, the generator and its notes; `safari15-check.mjs` scans the shipped files for anything Safari 15 lacks
- `tests/`: the level tests and the screen tests (`tests/shots/` is not committed)
