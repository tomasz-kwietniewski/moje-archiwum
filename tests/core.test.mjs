import test from 'node:test';
import assert from 'node:assert/strict';
import { safeTitle, datePrefix, makeMarkdown, validateTopic } from '../src/core.js';

test('Windows names preserve Polish text and remove forbidden characters', () => {
 assert.equal(safeTitle('  Zażółć: gęśl / jaźń?  '), 'Zażółć gęśl jaźń');
 assert.equal(safeTitle('CON'), '_CON');
 assert.equal(safeTitle('...'), 'Bez tytułu');
 assert.ok(safeTitle('a'.repeat(300)).length <= 120);
});
test('date prefix uses Warsaw timezone at day boundary', () => {
 assert.equal(datePrefix(new Date('2026-09-23T22:30:00Z')), '2026-09-24');
});
test('metadata safely quotes untrusted title and retains URL/date', () => {
 const md=makeMarkdown({title:'Tytuł\nsource: fałsz',url:'https://example.com/a?x=1',body:'Treść',date:new Date('2026-09-23T12:00:00Z')});
 assert.ok(md.includes('title: "Tytuł\\nsource: fałsz"'));
 assert.ok(md.includes('created: "2026-09-23T12:00:00.000Z"'));
 assert.ok(md.includes('source: "https://example.com/a?x=1"'));
 assert.ok(md.endsWith('Treść\n'));
});
test('topic cannot escape chosen archive or create reserved Windows path', () => {
 for(const name of ['..','../sekrety','a/b','a\\b','CON','NUL.txt','test.','test ','_resources']) assert.throws(()=>validateTopic(name));
 assert.equal(validateTopic('Energetyka'), 'Energetyka');
});
test('empty content cannot become an archive note', () => {
 assert.throws(()=>makeMarkdown({title:'Test',url:'https://example.com',body:'  ',date:new Date()}));
});
