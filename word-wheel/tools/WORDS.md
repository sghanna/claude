# Word Wheel: words and levels

How `levels.js` is made. Everything here runs offline on a computer, never on the phone.

## Sources (in `tools/sources/`)

- **SCOWL** final lists `english-words.N` and `american-words.N`, sizes 10, 20, 35, 40, 50, 55 and 60. Lower size means more common. SCOWL is free to use; its copyright and license text is kept in `SCOWL-Copyright`. The files are Latin-1; only lines made of plain a-z are used, so proper nouns, possessives and accented words drop out.
- **LDNOOBW** English list (`ldnoobw-en.txt`, "List of Dirty, Naughty, Obscene, and Otherwise Bad Words", CC BY 4.0). Any exact match is removed from every list.
- **`tools/removed-words.txt`** (hand review): one word per line as `word<TAB>tier<TAB>reason`.
  - `block`: never a grid word and never accepted as a bonus word.
  - `nogrid`: never a grid word, but still accepted as a bonus word, so a real word she spells is not rejected.
  - A line with an unknown tier counts as `block`. Blank lines and lines starting with `#` are ignored.

## Word sets

| Set | Rule |
| --- | --- |
| Grid words, levels 1-60 | SCOWL sizes 10 and 20, a-z, 3-7 letters, minus LDNOOBW, minus every word in removed-words.txt |
| Grid words, levels 61+ | the same, plus SCOWL size 35 |
| Bonus words | SCOWL sizes 10 to 60, a-z, 3+ letters, minus LDNOOBW, minus `block` words |

Before the hand review that is about 17,800 possible grid words and about 76,700 accepted words.

## How a level is built (`tools/generate.mjs`)

1. **Wheel size ramp:** levels 1-4 have 3 letters, 5-20 have 4, 21-60 have 5, and 61-1,000 have 6.
2. **Level 1** is fixed: wheel T C A, words CAT and ACT. **Levels 2-4** are 3-letter anagram sets (OWN/NOW/WON, ARE/EAR/ERA, TAP/PAT/APT while those survive the review).
3. **Base word:** a word that uses every wheel letter. More common words (and words that are not plurals) come first, in a seeded shuffled order. No base word, and no set of wheel letters, is used twice.
4. **Grid words:** every grid word that can be spelled from the base word's letters (each letter once). A word and its plain plural (word + s or + es) never share a grid.
5. **How many words:** the target starts at the low end of each band and drifts up: 3 letters 2-3, 4 letters 3-5, 5 letters 4-7, 6 letters 6-10.
6. **Crossword:** the base word is placed first (across or down), then longer and more common words are tried first, each at every spot where it crosses a letter already placed. A placement is legal only if the grid stays within 7 x 7, letters agree where words cross, and no new letter touches a parallel neighbor, so every across or down run of 2 or more letters is exactly one placed word. Words that do not fit are skipped. The generator makes up to 160 randomized tries and keeps the layout with the target word count, the most crossings, the smallest area and the squarest shape. If a base word cannot reach the target, the next base word is tried.
7. **Wheel order:** the letters are shuffled so the wheel does not spell any grid word left to right.
8. **Bonus words:** every other accepted word that can be spelled from the wheel.

Every random choice comes from a seeded generator (mulberry32 with an FNV-1a hash of a label such as the level number), so running it twice gives the same file byte for byte.

## Commands

```
node tools/generate.mjs        # writes levels.js (about 4 seconds)
node tests/levels.test.mjs     # checks all 1,000 levels, prints a summary
```

Rerun both after any change to `tools/removed-words.txt`.
