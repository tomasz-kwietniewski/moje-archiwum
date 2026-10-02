import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium} from 'playwright';

const svg=(width,height)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="green"/></svg>`;
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.route('https://example.test/**',route=>{
  const size={'/photo.svg':[640,360],'/share.svg':[16,16],'/logo.svg':[20,16],'/pixel.svg':[1,1],'/lazy.svg':[800,450]}[new URL(route.request().url()).pathname];
  return size ? route.fulfill({contentType:'image/svg+xml',body:svg(...size)}) : route.fulfill({status:404,body:''});
 });
 await page.route('http://clipper.test/article',route=>route.fulfill({
  contentType:'text/html; charset=utf-8',
  body:`<!doctype html><html><head><title>Artykuł z ikonami</title></head><body><article>
   <h1>Artykuł z ikonami</h1>
   <p><a href="https://facebook.example/share"><img src="https://example.test/share.svg" alt="Udostępnij"></a>
      <img src="https://example.test/logo.svg" alt="Logo"></p>
   <p>${'To jest właściwy tekst artykułu, który czytelnik chce zachować. '.repeat(15)}</p>
   <img src="https://example.test/photo.svg" alt="Zdjęcie w artykule">
   <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="https://example.test/lazy.svg" alt="Leniwe zdjęcie">
   <img src="https://example.test/pixel.svg" alt="">
   <img src="https://example.test/not-loaded.png" width="24" height="24" alt="Ikona z atrybutami" loading="lazy" style="margin-top:3000px">
   <p>${'Drugi akapit z dodatkową treścią artykułu. '.repeat(10)}<a href="https://example.test/dalej">Czytaj dalej</a></p>
   <p><a href="https://www.facebook.com/Sportpl" title="Facebook"><img src="https://example.test/share.svg" alt=""></a><a href="https://x.com/sport" aria-label="X"></a></p>
  </article></body></html>`
 }));
 await page.goto('http://clipper.test/article');
 await page.addScriptTag({path:path.resolve(process.argv[2] || 'dist/capture.js')});
 const result=await page.evaluate(()=>globalThis.__captureMarkdownPage());
 assert.match(result.body,/photo\.svg/,'article photo kept');
 assert.match(result.body,/lazy\.svg/,'lazy image behind a 1x1 placeholder kept');
 for(const icon of ['share.svg','logo.svg','pixel.svg','not-loaded.png'])
  assert.doesNotMatch(result.body+result.full,new RegExp(icon.replace('.','\\.')),icon+' dropped as icon');
 assert.doesNotMatch(result.body+result.full,/\[\]\(/,'no empty links left after removing icons');
 assert.match(result.body,/\[Czytaj dalej\]\(https:\/\/example\.test\/dalej\)/,'text links stay');
 console.log('PASS: ikony, logo i piksele śledzące nie trafiają do notatki; zdjęcia, także leniwe, zostają.');
} finally {
 await browser.close();
}
