#!/usr/bin/env node
/* Safari 15 static compatibility check for Word Wheel (iPad plan, Step 4).

   Scans every shipped file for JS/CSS features Safari 15.0 lacks. Grouped by how bad the finding is:
     FATAL       - needs newer than Safari 15.0. Regex lookbehind is always fatal (it kills the whole
                   script on any Safari below 16.4, no matter what version the device is on).
     WARN 15.4+  - needs Safari 15.4, not 15.0. Her iPad Air 2 is on 15.8, so these are fine for her,
                   but they'd break on a device stuck at 15.0-15.3.
     WARN 16 CSS - CSS that needs Safari 16 or later. Listed as a warning, not fatal, because a browser
                   ignores a CSS feature it doesn't understand rather than failing the page.

   A match inside a comment (a JS line or block comment, or an HTML comment) is reported but never
   counted toward the exit code, since it can't run.

   Exit code: 1 if any FATAL match exists outside a comment. 0 otherwise (warnings never fail the run).

   This is a text search, not a real parser: the comment-stripping is a heuristic (it does not understand
   strings that contain "//" or "/*", for example), and a couple of checks (".with(", ".at(") match any
   method call of that name, not just the new built-ins. Findings are for a human to look at, not to trust
   blindly. Usage: node tools/safari15-check.mjs
*/
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const FILES = [
  'index.html', 'app.js', 'fx.js', 'i18n.js', 'levels.js', 'sw.js', 'boot-check.js', 'style.css', 'manifest.json'
];

function typeOf(file) {
  if (file.endsWith('.html')) return 'html';
  if (file.endsWith('.css')) return 'css';
  if (file.endsWith('.json')) return 'json';
  return 'js';
}

// Byte ranges [start, end) that are comments, so a match inside one can be reported but not counted.
function commentRanges(text, type) {
  const ranges = [];
  if (type === 'html') {
    const re = /<!--[\s\S]*?-->/g;
    let m;
    while ((m = re.exec(text))) ranges.push([m.index, m.index + m[0].length]);
    return ranges;
  }
  if (type === 'json') return ranges; // JSON has no comments
  // js and css: /* ... */ block comments
  const blockRe = /\/\*[\s\S]*?\*\//g;
  let m;
  while ((m = blockRe.exec(text))) ranges.push([m.index, m.index + m[0].length]);
  if (type === 'js') {
    // // line comments (heuristic: does not know about strings or regex literals containing "//")
    const lineRe = /\/\/[^\n]*/g;
    while ((m = lineRe.exec(text))) ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function inComment(idx, ranges) {
  for (const [s, e] of ranges) if (idx >= s && idx < e) return true;
  return false;
}

function lineColOf(text, idx) {
  let line = 1, lastNl = -1;
  for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) { line++; lastNl = i; }
  return { line, col: idx - lastNl };
}

// Checks Safari 15.0 lacks outright. `fileTypes` limits which file kinds a check applies to.
const FATAL_CHECKS = [
  { name: 'regex lookbehind (?<= / (?<!', re: /\(\?<[=!]/g, fileTypes: ['js'],
    note: 'needs Safari 16.4+; on anything older this throws while parsing the regex and kills the whole script' },
  { name: 'Array.toSorted/toReversed/toSpliced', re: /\.(toSorted|toReversed|toSpliced)\s*\(/g, fileTypes: ['js'],
    note: 'needs Safari 16+' },
  { name: 'Array/TypedArray .with(', re: /\.with\s*\(/g, fileTypes: ['js'],
    note: 'needs Safari 16+ (heuristic: matches any ".with(" call, including an unrelated method of that name)' },
  { name: 'Object.groupBy', re: /Object\.groupBy\s*\(/g, fileTypes: ['js'], note: 'needs Safari 17.4+' },
  { name: 'Promise.withResolvers', re: /Promise\.withResolvers\s*\(/g, fileTypes: ['js'], note: 'needs Safari 17.4+' },
  { name: 'class static {} block', re: /\bstatic\s*\{/g, fileTypes: ['js'], note: 'needs Safari 16.4+' },
  { name: 'AbortSignal.timeout', re: /AbortSignal\.timeout\s*\(/g, fileTypes: ['js'], note: 'needs Safari 15.4+... actually 16+ per MDN; flagged fatal per plan list' },
  { name: 'navigator.wakeLock', re: /navigator\.wakeLock\b/g, fileTypes: ['js'], note: 'needs Safari 16.4+' },
  { name: 'scrollend event', re: /\bscrollend\b/g, fileTypes: ['js', 'css'], note: 'needs Safari 17+' },
  { name: 'popover', re: /\bpopover\b/g, fileTypes: ['html', 'js', 'css'], note: 'needs Safari 17+' },
  { name: 'inert', re: /\binert\b/g, fileTypes: ['html', 'js'],
    note: 'needs Safari 15.5+ / 16+ depending on context (heuristic: matches the plain word "inert" anywhere, including English prose)' }
];

// Fine on her iPad (15.8) but would break on a device stuck at 15.0-15.3.
const WARN_154_CHECKS = [
  { name: 'Array/String .at(', re: /\.at\s*\(/g, fileTypes: ['js'],
    note: 'needs Safari 15.4+ (heuristic: matches any ".at(" call)' },
  { name: 'Object.hasOwn', re: /Object\.hasOwn\s*\(/g, fileTypes: ['js'], note: 'needs Safari 15.4+' },
  { name: 'structuredClone', re: /\bstructuredClone\s*\(/g, fileTypes: ['js'], note: 'needs Safari 15.4+' },
  { name: 'Array.findLast/findLastIndex', re: /\.findLast(Index)?\s*\(/g, fileTypes: ['js'], note: 'needs Safari 15.4+' },
  { name: '<dialog> element', re: /<dialog\b/gi, fileTypes: ['html'], note: 'needs Safari 15.4+' },
  { name: '.showModal(', re: /\.showModal\s*\(/g, fileTypes: ['js'], note: 'needs Safari 15.4+' },
  { name: 'CSS :has(', re: /:has\s*\(/g, fileTypes: ['css'], note: 'needs Safari 15.4+' },
  { name: 'dvh unit', re: /\bdvh\b/g, fileTypes: ['css'],
    note: 'needs Safari 15.4+; harmless without a fallback only if there is always a plain vh/vw value set right before it for the same property' },
  { name: ':focus-visible', re: /:focus-visible\b/g, fileTypes: ['css'],
    note: 'needs Safari 15.4+; harmless below that version, the rule just never matches (no crash)' }
];

// Needs Safari 16+ (CSS only). A browser that does not understand a CSS feature ignores that
// declaration/rule rather than failing the page, so these are warnings, never fatal.
const WARN_16_CSS_CHECKS = [
  { name: '@container', re: /@container\b/g, fileTypes: ['css'], note: 'needs Safari 16+' },
  { name: 'color-mix(', re: /color-mix\s*\(/g, fileTypes: ['css'], note: 'needs Safari 16.2+' },
  { name: 'nested CSS &', re: /(^|[^\\])&\s*[.:#[&]/gm, fileTypes: ['css'],
    note: 'needs Safari 16.5+ (heuristic: "&" followed by a selector character; can false-positive on content strings)' },
  { name: 'text-wrap', re: /\btext-wrap\s*:/g, fileTypes: ['css'], note: 'needs Safari 17.4+' },
  { name: 'lh unit', re: /\d(\.\d+)?lh\b/g, fileTypes: ['css'], note: 'needs Safari 16.4+' },
  { name: 'overscroll-behavior', re: /overscroll-behavior\s*:/g, fileTypes: ['css'],
    note: 'needs Safari 16+; harmless here per the plan, since the page itself never scrolls (only used to stop a bounce)' }
];

function runChecks(checks, file, type, text, ranges) {
  const out = [];
  for (const check of checks) {
    if (!check.fileTypes.includes(type)) continue;
    check.re.lastIndex = 0;
    let m;
    while ((m = check.re.exec(text))) {
      const { line, col } = lineColOf(text, m.index);
      const commentOnly = inComment(m.index, ranges);
      const snippet = text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).replace(/\s+/g, ' ').trim();
      out.push({ file, check: check.name, note: check.note, line, col, commentOnly, snippet });
      if (m[0].length === 0) check.re.lastIndex++; // guard against zero-length matches looping forever
    }
  }
  return out;
}

function main() {
  const fatal = [], warn154 = [], warn16css = [];
  const missing = [];

  for (const rel of FILES) {
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) { missing.push(rel); continue; }
    const text = readFileSync(abs, 'utf8');
    const type = typeOf(rel);
    const ranges = commentRanges(text, type);
    fatal.push(...runChecks(FATAL_CHECKS, rel, type, text, ranges));
    warn154.push(...runChecks(WARN_154_CHECKS, rel, type, text, ranges));
    warn16css.push(...runChecks(WARN_16_CSS_CHECKS, rel, type, text, ranges));
  }

  const fatalReal = fatal.filter(f => !f.commentOnly);

  function printGroup(title, items) {
    console.log('\n' + title + (items.length ? '' : ': none found'));
    for (const it of items) {
      const tag = it.commentOnly ? ' [comment only, does not run]' : '';
      console.log(`  ${it.file}:${it.line}:${it.col}  ${it.check}${tag}`);
      console.log(`    ${it.note}`);
      console.log(`    ...${it.snippet}...`);
    }
  }

  console.log('Word Wheel Safari 15 static check');
  console.log('Files scanned: ' + FILES.filter(f => !missing.includes(f)).join(', '));
  if (missing.length) console.log('Files not present (skipped): ' + missing.join(', '));

  printGroup('FATAL (needs newer than Safari 15.0)', fatal);
  printGroup('WARN - needs Safari 15.4+ (fine on her 15.8 iPad)', warn154);
  printGroup('WARN - needs Safari 16+ CSS (browser ignores, does not crash)', warn16css);

  console.log('\nSummary:');
  console.log(`  FATAL (counted, not in a comment): ${fatalReal.length}`);
  console.log(`  FATAL (in a comment, informational only): ${fatal.length - fatalReal.length}`);
  console.log(`  WARN 15.4+: ${warn154.length}`);
  console.log(`  WARN 16+ CSS: ${warn16css.length}`);

  if (fatalReal.length) {
    console.log('\nRESULT: FAIL - fatal Safari-15-incompatible code found outside comments.');
    process.exitCode = 1;
  } else {
    console.log('\nRESULT: PASS - nothing found that needs newer than Safari 15.0 outside a comment.');
    process.exitCode = 0;
  }
}

main();
