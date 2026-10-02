import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {INBOX, TOPICS_FILE, processInbox, writeTopicList} from '../scripts/telefon-skrzynka.mjs';

const OLD = Date.parse('2026-10-02T10:00:00Z');
const NOW = OLD + 10 * 60 * 1000;

function archive() {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skrzynka-'));
 test.after(() => fs.rmSync(root, {recursive: true, force: true}));
 return root;
}
function put(file, content, time = OLD) {
 fs.mkdirSync(path.dirname(file), {recursive: true});
 fs.writeFileSync(file, content);
 fs.utimesSync(file, new Date(time), new Date(time));
}
// A note as the phone app writes it: assets folder next to the note, links encoded like Uri.encode.
function phoneNote(root, topic, stem, {body = 'Treść', image = 'JPG', time = OLD} = {}) {
 const dir = path.join(root, INBOX, topic);
 const link = image ? `\n![](${encodeURIComponent(stem + '_assets')}/001.jpg)` : '';
 if (image) put(path.join(dir, stem + '_assets', '001.jpg'), image, time);
 put(path.join(dir, stem + '.md'), `---\ntitle: "x"\n---\n\n${body}${link}\n`, time);
 return dir;
}
const run = root => processInbox(root, {now: NOW});

test('a phone note with its images moves to the topic folder and the empty inbox topic disappears', () => {
 const root = archive();
 fs.mkdirSync(path.join(root, 'Koszykówka'));
 phoneNote(root, 'Koszykówka', '2026-10-02_Legia z trofeum');
 assert.deepEqual(run(root), {moved: 1, duplicates: 0, waiting: 0, skipped: 0});
 const md = fs.readFileSync(path.join(root, 'Koszykówka', '2026-10-02_Legia z trofeum.md'), 'utf8');
 assert.match(md, /!\[\]\(2026-10-02_Legia%20z%20trofeum_assets\/001\.jpg\)/);
 assert.equal(fs.readFileSync(path.join(root, 'Koszykówka', '2026-10-02_Legia z trofeum_assets', '001.jpg'), 'utf8'), 'JPG');
 assert.ok(fs.existsSync(path.join(root, INBOX)), 'the inbox itself stays for the phone');
 assert.deepEqual(fs.readdirSync(path.join(root, INBOX)), []);
});

test('a new topic folder is created in the archive', () => {
 const root = archive();
 phoneNote(root, 'Nowy temat', '2026-10-02_Notatka', {image: null});
 assert.equal(run(root).moved, 1);
 assert.ok(fs.existsSync(path.join(root, 'Nowy temat', '2026-10-02_Notatka.md')));
});

test('a note still arriving waits: too fresh, or its images not synced yet', () => {
 const root = archive();
 phoneNote(root, 'Sport', '2026-10-02_Świeża', {time: NOW - 30 * 1000});
 const dir = path.join(root, INBOX, 'Sport');
 put(path.join(dir, '2026-10-02_Bez obrazu.md'), `![](${encodeURIComponent('2026-10-02_Bez obrazu_assets')}/001.jpg)\n`);
 assert.deepEqual(run(root), {moved: 0, duplicates: 0, waiting: 2, skipped: 0});
 assert.ok(fs.existsSync(path.join(dir, '2026-10-02_Świeża.md')));
 assert.ok(!fs.existsSync(path.join(root, 'Sport')));
});

test('a different note with the same name gets _2 and its image links follow the renamed folder', () => {
 const root = archive();
 put(path.join(root, 'Sport', '2026-10-02_Mecz.md'), 'inna notatka\n');
 put(path.join(root, 'Sport', '2026-10-02_Mecz_assets', '001.jpg'), 'INNY');
 phoneNote(root, 'Sport', '2026-10-02_Mecz', {body: 'z telefonu'});
 assert.equal(run(root).moved, 1);
 assert.equal(fs.readFileSync(path.join(root, 'Sport', '2026-10-02_Mecz.md'), 'utf8'), 'inna notatka\n');
 const moved = fs.readFileSync(path.join(root, 'Sport', '2026-10-02_Mecz_2.md'), 'utf8');
 assert.match(moved, /z telefonu/);
 assert.match(moved, /!\[\]\(2026-10-02_Mecz_2_assets\/001\.jpg\)/);
 assert.equal(fs.readFileSync(path.join(root, 'Sport', '2026-10-02_Mecz_2_assets', '001.jpg'), 'utf8'), 'JPG');
});

test('an identical copy already in the archive is only removed from the inbox', () => {
 const root = archive();
 phoneNote(root, 'Sport', '2026-10-02_Mecz');
 fs.cpSync(path.join(root, INBOX, 'Sport'), path.join(root, 'Sport'), {recursive: true});
 assert.deepEqual(run(root), {moved: 0, duplicates: 1, waiting: 0, skipped: 0});
 assert.deepEqual(fs.readdirSync(path.join(root, 'Sport')).sort(), ['2026-10-02_Mecz.md', '2026-10-02_Mecz_assets']);
 assert.deepEqual(fs.readdirSync(path.join(root, INBOX)), []);
});

test('hidden folders, files outside a topic and invalid topic names are left alone', () => {
 const root = archive();
 put(path.join(root, INBOX, '.sync', 'x.md'), 'x');
 put(path.join(root, INBOX, 'luzem.md'), 'x');
 phoneNote(root, 'Temat.', '2026-10-02_Zły temat', {image: null});
 assert.deepEqual(run(root), {moved: 0, duplicates: 0, waiting: 0, skipped: 1});
 assert.ok(fs.existsSync(path.join(root, INBOX, 'luzem.md')));
});

test('a missing inbox is not an error', () => {
 assert.deepEqual(run(archive()), {moved: 0, duplicates: 0, waiting: 0, skipped: 0});
});

test('the topic list for the phone lists archive topics in Polish order and is rewritten only when it changes', () => {
 const root = archive();
 for (const dir of ['Żużel', 'Koszykówka', 'Ąkacja', 'Zegarki', '.obsidian', '.SynologyWorkingDirectory', INBOX]) fs.mkdirSync(path.join(root, dir), {recursive: true});
 put(path.join(root, 'desktop.ini'), 'x');
 assert.equal(writeTopicList(root), true);
 const file = path.join(root, INBOX, TOPICS_FILE);
 assert.equal(fs.readFileSync(file, 'utf8'), 'Ąkacja\nKoszykówka\nZegarki\nŻużel\n');
 fs.utimesSync(file, new Date(OLD), new Date(OLD));
 assert.equal(writeTopicList(root), false);
 assert.equal(fs.statSync(file).mtimeMs, OLD, 'unchanged list is not rewritten, so Synology has nothing to sync');
 fs.mkdirSync(path.join(root, 'Bieganie'));
 assert.equal(writeTopicList(root), true);
 assert.match(fs.readFileSync(file, 'utf8'), /^Ąkacja\nBieganie\n/);
});

test('the topic list file in the inbox is not treated as a note', () => {
 const root = archive();
 put(path.join(root, INBOX, TOPICS_FILE), 'Sport\n');
 assert.deepEqual(run(root), {moved: 0, duplicates: 0, waiting: 0, skipped: 0});
 assert.ok(fs.existsSync(path.join(root, INBOX, TOPICS_FILE)));
});
