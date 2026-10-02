import test from 'node:test';
import assert from 'node:assert/strict';
import {safeTitle, datePrefix, validateTopic, fitBasename} from '../src/core.js';
import {readVectors} from './vectors/read.mjs';

// The same file is checked by the Windows host (tests/RuleVectors.cs) and Android (LogicTest.java).
const vectors = readVectors();

test('shared vectors: titles, dates, topics and path fitting', () => {
 const kinds = new Set();
 for (const [kind, ...args] of vectors) {
  kinds.add(kind);
  if (kind === 'title') assert.equal(safeTitle(args[0]), args[1], JSON.stringify(args[0]));
  else if (kind === 'date') assert.equal(datePrefix(new Date(args[0])), args[1], args[0]);
  else if (kind === 'topic-ok') assert.equal(validateTopic(args[0]), args[0]);
  else if (kind === 'topic-bad') assert.throws(() => validateTopic(args[0]), JSON.stringify(args[0]));
  else if (kind === 'fit') assert.equal(fitBasename(Number(args[0]), args[1]), args[2]);
  else if (kind === 'fit-bad') assert.throws(() => fitBasename(Number(args[0]), args[1]));
  else if (!kind.startsWith('images')) assert.fail('Unknown vector kind ' + kind);
 }
 for (const kind of ['title', 'date', 'topic-ok', 'topic-bad', 'fit', 'fit-bad']) assert.ok(kinds.has(kind), kind);
});

test('title fits 255-byte file systems even with Polish letters and emoji', () => {
 assert.equal(safeTitle('ż'.repeat(100)), 'ż'.repeat(90));
 assert.equal(safeTitle('😀'.repeat(60)), '😀'.repeat(45));
 assert.equal(safeTitle('a'.repeat(300)), 'a'.repeat(120));
});

test('basename is shortened so the longest asset path stays within MAX_PATH', () => {
 const name = '2026-09-25_' + 'x'.repeat(200);
 const fitted = fitBasename(150, name);
 assert.equal(fitted.length, 259 - 151 - 22);
 assert.ok(150 + 1 + fitted.length + '_10000_assets\\001.webp'.length <= 259);
 assert.equal(fitBasename(150, '2026-09-25_' + '😀'.repeat(80)).length % 2, 1, 'surrogate pair is not split');
});
