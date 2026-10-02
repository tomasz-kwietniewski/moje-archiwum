import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.route('https://example.test/**',route=>route.fulfill({
  contentType:'image/jpeg',body:Buffer.from([0xff,0xd8,0xff,0xd9])
 }));
 await page.route('http://clipper.test/article',route=>route.fulfill({
  contentType:'text/html; charset=utf-8',
  body:`<!doctype html><html><head><title>Przykładowy artykuł</title></head><body>
   <header>MENU</header>
   <div class="article-top"><h1>Przykładowy artykuł</h1>
    <figure class="article-main-image"><img src="https://example.test/lead.jpg" alt="Główne zdjęcie"></figure>
   </div>
   <article><p>${'To jest właściwy tekst artykułu, który czytelnik chce zachować. '.repeat(15)}</p></article>
   <aside><img src="https://example.test/related.jpg" alt="Polecany tekst"></aside>
   </body></html>`
 }));
 await page.goto('http://clipper.test/article');
 await page.addScriptTag({path:path.resolve('dist/capture.js')});
 const result=await page.evaluate(()=>globalThis.__captureMarkdownPage());
 assert.equal(result.extracted,true);
 assert.match(result.body,/!\[Główne zdjęcie\]\(https:\/\/example\.test\/lead\.jpg/,
  'tryb artykułu powinien zachować zdjęcie główne poza blokiem tekstu');
 assert.doesNotMatch(result.body,/related\.jpg|MENU/,
  'tryb artykułu nie powinien kopiować polecanych materiałów ani menu');
 assert.match(result.full,/related\.jpg/,'tryb całej strony nadal obejmuje pozostałe obrazy');
 console.log('PASS: zdjęcie główne poza tekstem trafia do samego artykułu bez polecanych materiałów.');
} finally {
 await browser.close();
}
