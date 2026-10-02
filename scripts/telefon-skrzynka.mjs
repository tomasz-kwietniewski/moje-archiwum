// Moves notes saved on the phone from the inbox folder "_Z telefonu" into the archive topic folders.
// Synology Drive on Android cannot sync the whole archive: the server rejects its listing of the
// 15k "_assets" folders (error 167, 2026-10-02), so the phone syncs only this small inbox and the PC
// runs this script every few minutes (Task Scheduler, scripts/telefon-skrzynka-ukryty.vbs).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateTopic} from '../src/core.js';

export const INBOX = '_Z telefonu';
// Synced to the phone with the inbox; the Android app suggests topics from it (the phone has no archive).
export const TOPICS_FILE = '_tematy.txt';
// Synology delivers the note and its images separately; younger files may still be arriving.
const MIN_AGE_MS = 2 * 60 * 1000;
const STUCK_MS = 60 * 60 * 1000;

const hidden = name => name.startsWith('.') || name.startsWith('#') || name === '@eaDir' || name.toLowerCase() === 'desktop.ini';
const decode = link => { try { return decodeURIComponent(link); } catch { return link; } };

// Relative link and image targets, e.g. "2026-10-02_Tytu%C5%82_assets/001.jpg".
function localTargets(markdown) {
 return [...markdown.matchAll(/\]\(\s*(?:<([^>]+)>|([^)\s]+))/g)]
  .map(match => match[1] || match[2])
  .filter(link => !/^[a-z][a-z0-9+.-]*:/i.test(link) && !link.startsWith('#') && !link.startsWith('/'));
}

function sameTree(a, b) {
 const sa = fs.statSync(a), sb = fs.statSync(b);
 if (sa.isDirectory() !== sb.isDirectory()) return false;
 if (!sa.isDirectory()) return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
 const names = dir => fs.readdirSync(dir).filter(name => !hidden(name)).sort();
 const na = names(a), nb = names(b);
 return na.length === nb.length && na.every((name, i) => name === nb[i] && sameTree(path.join(a, name), path.join(b, name)));
}

function replaceLinks(markdown, from, to) {
 return markdown.split(encodeURIComponent(from) + '/').join(encodeURIComponent(to) + '/')
  .split('<' + from + '/').join('<' + to + '/');
}

export function processInbox(root, {now = Date.now(), minAgeMs = MIN_AGE_MS, log = () => {}} = {}) {
 const result = {moved: 0, duplicates: 0, waiting: 0, skipped: 0};
 const inbox = path.join(root, INBOX);
 if (!fs.existsSync(inbox)) return result;
 for (const entry of fs.readdirSync(inbox, {withFileTypes: true})) {
  if (!entry.isDirectory() || hidden(entry.name)) continue;
  const topic = entry.name;
  try { validateTopic(topic); } catch { result.skipped++; log(`pominięty temat o niedozwolonej nazwie: ${topic}`); continue; }
  const source = path.join(inbox, topic);
  const target = path.join(root, topic);
  for (const file of fs.readdirSync(source)) {
   if (!file.toLowerCase().endsWith('.md') || hidden(file)) continue;
   const note = path.join(source, file);
   const stem = file.slice(0, -3);
   const assets = path.join(source, stem + '_assets');
   const markdown = fs.readFileSync(note, 'utf8');
   const missing = localTargets(markdown).filter(link => !fs.existsSync(path.join(source, decode(link))));
   const age = now - fs.statSync(note).mtimeMs;
   if (age < minAgeMs || missing.length) {
    result.waiting++;
    if (age > STUCK_MS) log(`czeka ponad godzinę: ${topic}/${file}, brak: ${missing.join(', ') || '-'}`);
    continue;
   }
   const hasAssets = fs.existsSync(assets);
   try {
    fs.mkdirSync(target, {recursive: true});
    const sameName = path.join(target, file);
    if (fs.existsSync(sameName) && sameTree(sameName, note) &&
        (!hasAssets || (fs.existsSync(path.join(target, stem + '_assets')) && sameTree(path.join(target, stem + '_assets'), assets)))) {
     if (hasAssets) fs.rmSync(assets, {recursive: true});
     fs.rmSync(note);
     result.duplicates++;
     log(`duplikat usunięty ze skrzynki: ${topic}/${file}`);
     continue;
    }
    let name = stem;
    for (let n = 2; fs.existsSync(path.join(target, name + '.md')) || fs.existsSync(path.join(target, name + '_assets')); n++) name = `${stem}_${n}`;
    // Images first, the note last: whoever looks at the archive never sees a note without its images.
    if (hasAssets) fs.renameSync(assets, path.join(target, name + '_assets'));
    if (name === stem) fs.renameSync(note, path.join(target, name + '.md'));
    else {
     const destination = path.join(target, name + '.md');
     fs.writeFileSync(destination, replaceLinks(markdown, stem + '_assets', name + '_assets'), {flag: 'wx'});
     const {atime, mtime} = fs.statSync(note);
     fs.utimesSync(destination, atime, mtime);
     fs.rmSync(note);
    }
    result.moved++;
    log(`przeniesiona: ${topic}/${name}.md`);
   } catch (error) {
    // Usually a file still held by Synology Drive; the next run tries again.
    result.waiting++;
    log(`błąd przy ${topic}/${file}: ${error.message}`);
   }
  }
  try { if (!fs.readdirSync(source).length) fs.rmdirSync(source); } catch {}
 }
 return result;
}

// Returns true when the list changed; an unchanged list is not rewritten, so Synology has nothing to sync.
export function writeTopicList(root) {
 const topics = fs.readdirSync(root, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && !hidden(entry.name) && entry.name !== INBOX)
  .map(entry => entry.name)
  .filter(name => { try { validateTopic(name); return true; } catch { return false; } })
  .sort(new Intl.Collator('pl').compare);
 const content = topics.map(name => name + '\n').join('');
 const file = path.join(root, INBOX, TOPICS_FILE);
 if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
 fs.mkdirSync(path.dirname(file), {recursive: true});
 fs.writeFileSync(file + '.tmp', content);
 fs.renameSync(file + '.tmp', file);
 return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const dataDir = path.join(process.env.LOCALAPPDATA, 'MojeArchiwum');
 const root = fs.readFileSync(path.join(dataDir, 'folder.txt'), 'utf8').replace(/^﻿/, '').trim();
 const logFile = path.join(dataDir, 'z-telefonu.log');
 const log = line => fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
 try {
  const result = processInbox(root, {log});
  // After moving notes, so a topic created from the phone shows up in the list at once.
  result.topicsUpdated = writeTopicList(root);
  if (process.argv.includes('--verbose')) console.log(JSON.stringify(result));
 } catch (error) {
  log(`błąd: ${error.stack || error}`);
  process.exitCode = 1;
 }
}
