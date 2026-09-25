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
- **Tapping.** Tap a card to choose it and tap again to put it back. Nothing is passed or played until she presses the big button. Tapping a card she can't play shows the reason ("You must follow clubs.") instead of selecting it, with two short buzzes. A long hold counts as a tap, and so does a press that slides up to 44 px off a card or button before lifting. Nothing on screen can be selected as text, and a double tap never zooms.
- **Pace.** No timers. Computer players move every 1.3 s on Slow (the default) or 0.8 s on Normal. A finished trick stays on the table for 3.8 s (or 2.4 s), and "Next trick" skips the wait.
- **End of each hand.** A results panel shows this hand's points and the totals, and names the next pass direction. After the last hand, a game-over panel shows the winner, with "Play again".
- **Menu.** Last trick, Scores, How to play, Settings (speed, sound, language), Name your opponents, and Back to the game. "Start a new game" sits below a gap and asks first.
- **Saving.** Saves after every action. Closing the app or losing power mid-hand resumes exactly where she was. A damaged save is detected, explained, and replaced with a new game.
- **Works offline** after the first visit, and can be added to the Home Screen as an app (icon, name "Hearts", full screen).
- **English, Spanish, Vietnamese.** Chosen automatically from the phone's language, changeable in Settings, or via `?lang=es` / `?lang=vi`. **The Spanish and Vietnamese are Claude's own translations and need a native speaker to check them.**
- **Sound** is off by default (Menu, then Settings). When on, each moment has its own gentle sound: a tick when a card is chosen, a soft low note when a tap isn't allowed, a card landing on the felt, a sweep when a trick is gathered, a low two-note "uh-oh" when she takes points, a deep note when the queen of spades falls, a bell when hearts are broken, and a chime or short fanfare for good moments. All sounds are generated in the app, so they work offline. An iPhone on silent plays none of them.
- **Portrait only.** Turning the phone sideways shows "Please turn your phone upright to play."

## Delight (added Sept 24, 2026)

The layout never moves. These additions explain what's happening and reward good moments:

- **Motion that explains.** A card glides out of the player's name box into their place on the table, and hers flies up from her hand. A finished trick gathers into the winner's name box, which glows. Passed cards travel to the receiving player, and the new ones arrive from the giver. Each movement takes about a third of a second. Phones set to Reduce Motion skip all of it.
- **Announcements** in the gold status line: "Hearts are broken" and "Queen of spades played: 13 points". The trick result names the queen when someone takes it. A player's red "+3" points badge bumps when it grows.
- **Celebrations sized to the moment,** as Shawn picked on Sept 24: heart cards floating up for a clean hand (no points), sky lanterns for winning the game, and "Hearts to the moon" for shooting the moon (night falls over the table, a glowing full moon appears, and the 13 hearts and the queen of spades she took fly up into it). The results box waits until the celebration has finished. Reduce Motion shows a still version of each.
- **Remembers her.** The game-over box shows games won, her best final score, and "New personal best!" when she beats it. These are kept on her phone only.

**Options pages** (a visual choice for Shawn):
- https://sghanna.github.io/claude/hearts/options-celebrations.html: gold ribbon, heart cards (live for a clean hand), sky lanterns (live for a win)
- https://sghanna.github.io/claude/hearts/options-moon.html: Moonrise, the old gold ribbon, or Hearts to the moon (live)
- https://sghanna.github.io/claude/hearts/options-playable.html: which cards she can play, checked against WCAG contrast. Live: Shawn's pick, option 3 (outline, light dim, and a deeper red ink #a81f1a on every card: red ranks 7.2:1 on a bright card and 5.4:1 dimmed, AAA; Solitaire's red was 5.4:1 and 4.3:1)

## After her playtest (Sept 24, 2026)

Live now (behavior fixes, no visual choice):
- **Long holds and slides count as taps.** She holds her finger down longer than most people, and it sometimes slides before lifting; Safari then selected text or dropped the tap. app.js now sends the tap itself when a press that started on a button lifts on it or within 44 px, and ignores Safari's own click if it also comes. Text selection, the long-press menu and double-tap zoom are off everywhere.
- **A buzz for "not allowed".** Two short haptic ticks when she taps a card she can't play or a 4th card to pass. Works on silent. iPhones have no vibration API, so fx.js flips a hidden switch-style checkbox, which iOS 18+ answers with a haptic tick. Needs checking on her phone.

Shawn's picks (Sept 24, live, cache v9), from https://sghanna.github.io/claude/hearts/options-playtest.html:
- Cards she can't play: kept the light dim and gold outline (`?playable=grey` and `ghost` show the others).
- A tap on a card she can't play: the card shakes "no", then the cards she can play hop twice (`?nope=twice`, Shawn's pick on options-nope.html; also `both` for one hop, `together`, `shake`, `hop`, `none`).
- The 3 passed cards glide from the table into her hand on Continue (`?arrive=glide`; also `onebyone`, `none`). A window resize waits until cards in flight have landed.
- Top of the screen: the logo beside the title, Help and Menu without the gold border, and the biggest points badge (24 px) above each name (`?logo=0`, `?pillborder=1`, `?badge=now|big` show the others).
- The not-allowed sound: Marimba, two wooden notes going down (`nopeMarimba`), Shawn's pick of six on https://sghanna.github.io/claude/hearts/options-nope.html (`?nopesound=nope|nopeMarimba|nopeNuh|nopeKnock|nopeSlide|nopeBuzz`, volumes matched by measurement). Plays only with Sound on and the phone not on silent.

## Name your opponents (Sept 25, 2026)

Shawn's request: players can pick their own names for the three computer players. He framed it as a paid feature that doesn't change the game, paid for with a promise to donate to a school in the player's neighborhood.

- **Menu, then "Name your opponents".** The first time, it explains the deal: give the other players any names you like; the game stays the same; please donate to a school in your neighborhood, any school you choose; there is nothing to pay here, and we trust you to do it. Buttons: "I promise to donate" and "Not now".
- **After the promise** (kept on that phone, nothing checked), a thank-you line and one box per player, labeled "On your left", "Across from you" and "On your right". Up to 10 letters each. An empty box keeps the usual name. "Use the usual names" fills the boxes with Michael, Jerry and Barbara again; nothing changes until "Save names". From then on the Menu opens the names directly.
- **Only the names change.** They show on the name boxes, the status line, the big button, Last trick, Scores and the results, in every language ("You" still translates). Game state, scores and stats are untouched.
- **Details:** the boxes are the only place in the game that allows text selection (typing needs a caret). The box sits near the top of the screen so the keyboard doesn't cover it, and a tap outside it doesn't close it (that tap is how you put the keyboard away). Next on the keyboard moves to the next name, Done saves. Characters that could break the screen (`< > & "`) are dropped. A long name shrinks to fit its name box (down to 12 px); in Last trick a two-word name can take two lines.
- **Fix found on the way:** the name boxes, the table under them and the Last trick box used a grid that let a long word widen its column, pushing "You" off the right edge. They now shrink the name instead. Nothing changes for the usual names.

Options page: https://sghanna.github.io/claude/hearts/options-names.html. It shows the four steps, then the judgment calls, each with Claude's choice, what happens without it, and one other way. Shawn's picks (Sept 25): up to 10 letters (Claude's choice; `?names=A,B,C` on a demo shows any names), and, for the boxes she types in, his own idea (section 4, Option 2): dark like the buttons, and the box she is typing in turns light with a thick gold ring and glow. Before that he had picked all-light boxes over Claude's dark ones, which showed that a pale typing edge vanishes on cream, hence the ring. `?field=light|dark|plain`, `?focus=pale|magenta|edge` and `?typing=2` (marks a box as the one being typed in) show the others on the options page. `?show=menu|promise|names|thanks` opens those views on a demo page, and `?demo=pass` shows the start of a hand. Demo pages never save.

## Top bar without Help (Sept 25, 2026)

Shawn asked why the rules were in two places (the Help button and Menu, How to play). From https://sghanna.github.io/claude/hearts/options-help.html he chose to remove the Help button (Claude had recommended keeping it, as in her Solitaire, and dropping the Menu item instead) and to put the logo and title on the left. The rules are in Menu, How to play. With the room freed, the title is 27 px in all three languages (it was 20 px in English and hid its word in Spanish and Vietnamese). `?help=1` shows the old top bar, and the older options pages use it so they still show what was compared; `?howto=0` hides the Menu item.

## Our own lettering for the title (Sept 25, 2026)

Shawn asked for "Hearts" in our own lettering, drawn as SVG like the card faces, and only for the title next to the logo for now, so nothing else changes and screen readers keep working. `wordmark.js` holds "Hearts" in six SIL Open Font License fonts (Abril Fatface, Playfair Display Black, DM Serif Display, Yeseva One, Fraunces Black soft, Alfa Slab One), converted to paths with each font's own kerning (fontTools and HarfBuzz, from github.com/google/fonts). Shawn picked **Fraunces Black, soft** (over Claude's recommendation, Abril Fatface); it is live. The drawing is hidden from screen readers and the heading keeps its words (in her language), visually hidden. He asked to keep "Corazones", the name Spanish speakers use for the game, so Spanish gets its own drawn title; Vietnamese already calls the game "Hearts". `drawTitle()` in app.js picks the drawing for the current title and redraws on a language change. To draw a new title, add the word to `WORDS` in `tools/build-wordmark.py` and run it.

**Backup font.** The drawing needs no font on the phone, so it always shows. If there is no drawing for the title (a new language) or wordmark.js fails to load, the title shows as text in the iPhone's own serif: `ui-serif` (New York, built in since iOS 13) in its Black weight, then Georgia, then any serif. Claude's pick, as Shawn asked for an iOS-native serif; `?titlefont=georgia|iowan` show the alternatives. Browsers other than Safari don't know `ui-serif` and use Georgia.

Options: https://sghanna.github.io/claude/hearts/options-wordmark.html (`?wordmark=abril|playfair|dmserif|yeseva|alfaslab` for the other fonts, `none` for text; older options pages use `wordmark=none&titlefont=georgia` to keep showing the title as it was). The Home Screen name under the icon is still "Hearts" in every language.

## Screen readers (checked Sept 25, 2026)

Shawn asked whether the card faces have the right accessibility controls. Checked with axe-core and the browser's accessibility tree: every card is announced by name ("queen of diamonds"), the drawn face is hidden from screen readers, cards she can't play are announced as unavailable, a chosen card as pressed, each suit row as a group ("Diamonds: 4"), the name plates with their scores, and the status line is read out as it changes. One gap fixed: cards on the table didn't say who played them, and the tags ("Led", "Winning") were read separately afterward; each now reads like "Jerry: 7 of hearts, Led". axe-core still reports two moderate page-structure items (no "main" landmark, some content outside landmarks), not about the cards; left for now, as fixing them means restructuring the page. Not yet tried with VoiceOver on a real iPhone.

## Tested (Sept 23-25, 2026)

- `node hearts/tests/rules.test.mjs 5000` (from ~/claude): 30 rule checks plus 5,000 simulated games (54,865 hands, 713,245 tricks). Every play was legal, no card was ever lost or duplicated, every hand scored 26 (or 78 when someone shot the moon), and every game ended. All passed.
- `node hearts/tests/ui.test.mjs http://127.0.0.1:8767/hearts/ 2`: 143 checks, all passed, in WebKit (Safari's engine). They cover:
  - 3 complete games played through real taps, with no text overflow or scrolling at any step,
  - illegal taps explained,
  - save and restore mid-hand, and a damaged save,
  - the menus, the guarded new game, Last trick and Scores,
  - all 3 languages, including 2 full hands each in Spanish and Vietnamese at 375 x 667,
  - 13 cards on screen with 44 px or larger targets at 390 x 844, 390 x 763, 390 x 740 and 375 x 667,
  - a full game with motion and sound on (nothing stalls, stats recorded exactly once, celebrations clean up),
  - the options-page demos, which never touch the real saved game,
  - long holds and slides counted as exactly one tap, no text selection, the passed cards flying into her hand, the shake and hop, and the logo and bigger badges fitting in all 3 languages without covering names,
  - Name your opponents: the promise comes first and "Not now" changes nothing; the promise opens the names; names show everywhere, survive closing the app, and never change the game; an empty box keeps the usual name; "Use the usual names" works; Next moves to the next box; a tap outside keeps her typing; a name can't add anything to the screen; 10-letter names fit everywhere in all 3 languages at 375 x 667 through two hands, Last trick included; the options-page views never save.
- Every animation and celebration was also captured mid-motion (slowed 15x) and checked by eye, including the Reduce Motion version.
- Offline play was checked in Chromium, because Playwright's WebKit can't reload any page while offline.
- Screenshots of every stage of a game were checked by eye in all three languages.

**Not tested:** a real iPhone, airplane mode on a real iPhone, and VoiceOver. Mom played it on Sept 24; the changes from that playtest are above. On her phone, check: typing names with the iPhone keyboard up (not testable on a Mac), a long press and a slide off the Play button each count as one tap, a tap on a card she can't play buzzes twice (iOS 18+), the three passed cards glide into her hand, and whether Slow is slow enough.

## Not done

- **No undo.** The explicit Pass/Play button was designed to prevent mistakes instead.
- **Computer difficulty isn't adjustable.**

## Files

- `index.html`, `style.css`: the screen
- `wordmark.js`: the title drawn as paths (Fraunces live, five other fonts for the options page); `tools/build-wordmark.py` makes it
- `options-img/`: pictures of the backup title fonts from Safari's engine
- `app.js`: taps, drawing, pacing, saving, stats
- `fx.js`: motion, sounds and celebrations
- `options-*.html`, `options.css`: side-by-side choices for Shawn (not part of the installed app)
- `rules.js`: rules and computer players, no screen code, so Node can test it
- `i18n.js`: all words in three languages
- `glyphs.js`: the traced card lettering from agy-solitaire
- `sw.js`: the offline copy
- `manifest.json`, `icon-*.png`, `icon.svg`: Home Screen app setup. The icon is Shawn's pick from options-icon-cards.html (Sept 24): version 1, the queen of spades behind the ace of hearts, with the magenta selection glow on the ace and a brass border. `icon-options/` holds the other candidates.
- `tests/`: the two test suites; `tests/shots/` holds screenshots at each phone size

## Publishing a change

1. Edit and test in ~/claude/hearts.
2. Bump `VERSION` in `sw.js` (for example `claude-hearts-v2`), or her phone keeps the old copy.
3. Commit and push ~/claude (the sghanna/claude repo). GitHub Pages usually updates within a minute or two.

**Offline copy on a shared site.** Every game on sghanna.github.io shares one offline storage area. This game only deletes its own old copies. agy-solitaire's cleanup deletes every other game's copy whenever it updates. If that happens, Hearts refills its copy the next time it's opened with a connection (tested). The one gap: if agy-solitaire updates and she then opens Hearts for the first time in airplane mode, Hearts won't load until she's back online. Changing agy-solitaire's `sw.js` to delete only caches starting with `agy-solitaire-` would close that gap.

Test-only URL options: `?seed=N` deals the same cards every time and starts a new game, and `?fast=1` makes computer players instant.
