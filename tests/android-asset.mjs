import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {captureBuild} from '../scripts/capture-build.mjs';

// The committed Android asset must be the current src/capture.js bundle.
// Line endings are ignored because Windows checkouts may convert them.
const fresh = (await build({...captureBuild, write: false})).outputFiles[0].text;
const committed = await readFile('android/app/src/main/assets/capture.js', 'utf8');
const lf = text => text.split(String.fromCharCode(13)).join('');
assert.equal(lf(committed), lf(fresh), 'android/app/src/main/assets/capture.js is stale: run npm run build:android-assets');

const fixture = await readFile('tests/fixture.html');
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(fixture);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless: true});
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/article`);
  await page.addScriptTag({path: 'android/app/src/main/assets/capture.js'});
  const capture = await page.evaluate(() => globalThis.__captureMarkdownPage());
  assert.match(capture.title, /Próba archiwum/);
  assert.match(capture.body, /zażółć gęślą jaźń/);
  assert.doesNotMatch(capture.body, /MENU NIE NALEŻY/);
  assert.match(capture.body, /\| Format \| Markdown \|/);
  assert.match(capture.body, /\/szczegoly/);
  assert.match(capture.body, /\/photo.svg/);
  console.log('PASS: kod ekstrakcji dołączony do aplikacji wyodrębnia artykuł i polskie znaki.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
