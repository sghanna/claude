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
- **Menu:** How to play, Settings (Sound, off by default; Language), Go to a level already reached, Back to the game. "Start over from level 1" sits apart and asks first.
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

## Tested (Sept 25, 2026)

- `node word-wheel/tests/levels.test.mjs` (from ~/claude) checks every one of the 1,000 levels. Each answer must be spellable from the wheel and come from the right word list, with no removed words. Grids must stay within 7 x 7 and be connected, every word must cross another, and letters must agree where words cross. No accidental words can form where letters touch, no base word repeats, the ramp must hold, and level 1 must be CAT/ACT. All passed.
- `node word-wheel/tests/ui.test.mjs http://127.0.0.1:8767/word-wheel/` ran 173 checks in WebKit (Safari's engine) with touch, all passed. They cover:
  - levels 1-10 finished by swipes, 3 more by taps and Enter, and one by touch events;
  - a wrong word, a repeated word, a bonus word, Shuffle, Hint (including finishing a word by hints alone) and Pick a square;
  - long holds, drift and backing up on the wheel; long holds and slides on buttons counted exactly once; no text selection;
  - save and restore mid-level, and a damaged save;
  - minimum sizes and no scrolling on the biggest grid (level 105, 7 x 7 with 6 letters) at 390 x 844, 390 x 763, 390 x 740 and 375 x 667;
  - all dialogs in all three languages;
  - offline play (in Chromium, because Playwright's WebKit can't reload offline).
- Screenshots of each screen were checked by eye.

**Not tested:** a real iPhone (haptics, sound and real finger swipes), VoiceOver, and the player herself. On her phone, check that letters are big enough, that swiping works for her or she uses tap and Enter, and that Hint is easy to find.

**Known:** on the smallest phone size tested (375 x 667, not her phone), the six wheel letters on the biggest levels hang slightly over the rim of the wheel. Everything fits and meets the minimum sizes.

## Visual choices (for Shawn)

- https://sghanna.github.io/claude/word-wheel/options-look.html: three looks with measured contrast. Shawn picked felt (Sept 25, live now). `?look=light` or `?look=scenery` previews one; ship a pick by changing `DEFAULT_LOOK` in app.js.
- https://sghanna.github.io/claude/word-wheel/options-icon.html: three icons at Home Screen size next to Solitaire and Hearts. Shawn picked the six-letter wheel (Sept 25).
- https://sghanna.github.io/claude/word-wheel/options-icon-word.html: that wheel with the swipe path spelling out the word. Live now: W-O-R-D.

## Publishing a change

1. Edit and test in ~/claude/word-wheel. For word changes: edit `tools/removed-words.txt`, then run `node tools/generate.mjs` and `node tests/levels.test.mjs`.
2. Bump `VERSION` in `sw.js` (for example `claude-word-wheel-v2`), or installed phones keep the old copy.
3. Commit and push ~/claude. GitHub Pages usually updates within a minute or two.

The offline copy deletes only its own old copies (prefix `claude-word-wheel-`) and refills itself if another game's cleanup wipes it.

Test-only URL options: `?level=N` plays level N in a separate test save, `?fresh=1` clears that test save, and `?fast=1` removes animation delays. A real game never uses them.

## Files

- `index.html`, `style.css`: the screen and the three looks
- `app.js`: wheel input, grid, hints, saving, dialogs, layout sizing
- `fx.js`: sounds, haptic buzz and motion
- `i18n.js`: every on-screen word in three languages
- `levels.js`: the 1,000 levels (generated; don't edit by hand)
- `sw.js`, `manifest.json`, `icon.svg`, `icon-*.png`: offline copy and Home Screen setup
- `options-*.html`, `options.css`, `icon-options/`: side-by-side choices (not part of the installed app)
- `tools/`: word sources, the removal list, the generator and its notes
- `tests/`: the level tests and the screen tests (`tests/shots/` is not committed)
