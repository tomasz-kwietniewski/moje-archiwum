import {chromium} from 'playwright';
import http from 'node:http';
import {readFile,mkdir,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
export async function startBrowser({automated=false,nativeShim=automated,browserPath=null,nativeHostName=null}={}) {
 const output=path.resolve('.test-output');await mkdir(output,{recursive:true});
 const server=http.createServer(async(req,res)=>{
  if(req.url.endsWith('.svg')) {res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>');return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile('tests/fixture.html'));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/article';
 let extension=path.resolve('dist');
 if(automated) {
  extension=path.join(output,'test-extension');await cp('dist',extension,{recursive:true});
  const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
  // Automated test only: grant our local fixture host so CDP can invoke capture.
  // The release manifest keeps activeTab and has NO host_permissions.
  manifest.host_permissions=['http://127.0.0.1/*'];
  await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  if(nativeShim)await cp('tests/native-shim.js',path.join(extension,'native.js'));
  if(nativeHostName) {
   const nativePath=path.join(extension,'native.js');
   const source=await readFile(nativePath,'utf8');
   await writeFile(nativePath,source.replace('pl.tomaszkwietniewski.moje_archiwum',nativeHostName));
  }
 }
 const context=await chromium.launchPersistentContext('',{...(browserPath?{executablePath:browserPath}:{channel:'chromium'}),headless:automated,args:['--disable-extensions-except='+extension,'--load-extension='+extension],viewport:{width:1000,height:850}});
 const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const page=await context.newPage();await page.goto(url);await page.bringToFront();
 return {context,worker,id,page,url,server,close:async()=>{await context.close();await new Promise(resolve=>server.close(resolve));}};
}
export async function runAutomated() {
 const env=await startBrowser({automated:true});const {context,worker,url}=env;
 const errors=[];context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
 try {
  const driver=await context.newPage();await driver.goto('chrome-extension://'+env.id+'/editor.html');
  const key=await driver.evaluate(async url=>{
   const tab=(await chrome.tabs.query({})).find(t=>t.url===url);
   return (await import(chrome.runtime.getURL('background.js'))).captureTab(tab);
  },url);
  await driver.close();
  let editor=context.pages().find(p=>p.url().includes('editor.html'));
  if(!editor)editor=await context.waitForEvent('page');
  await editor.waitForSelector('#title:enabled');
  assert.equal(await editor.locator('#topic').inputValue(),'','nothing to suggest before the first save');
  // The whole editor, with the save button, fits the window without scrolling.
  const fit=await editor.evaluate(()=>({inner:innerHeight,scroll:document.documentElement.scrollHeight,save:document.getElementById('save').getBoundingClientRect().bottom}));
  assert.ok(fit.scroll<=fit.inner && fit.save<=fit.inner,'editor fits the window: '+JSON.stringify(fit));
  const bounds=await editor.evaluate(async()=>(await import(chrome.runtime.getURL('background.js'))).editorBounds());
  assert.ok(bounds.width===780 && bounds.height>=680 && bounds.height<=900,'editor window bounds: '+JSON.stringify(bounds));
  assert.match(await editor.locator('#title').inputValue(),/Próba archiwum/);
  const body=await editor.locator('#body').inputValue();
  assert.ok(body.includes('zażółć gęślą jaźń'));
  // Soft hyphens (rp.pl puts them inside words) are invisible but break searching the archive.
  assert.ok(body.includes('omawia przechowywanie') && !/\u00ad/.test(body+await editor.locator('#title').inputValue()),'soft hyphens removed');
  assert.ok(!body.includes('MENU NIE NALEŻY'));
  assert.ok(body.includes(url.replace('/article','/szczegoly')));
  assert.ok(body.includes('/photo.svg') && body.includes('/second.svg'),'srcset images preserved');
  assert.ok(body.includes('| Format | Markdown |'),'table retained');
  // This UI regression test uses an OPFS shim. The native host is tested separately.
  await editor.evaluate(async()=>{const root=await navigator.storage.getDirectory();await root.getDirectoryHandle('Istniejący temat',{create:true});});
  await editor.locator('#choose').click();
  await editor.locator('#topics option[value="Istniejący temat"]').waitFor({state:'attached'});
  assert.ok((await editor.locator('#topics option').evaluateAll(options=>options.map(option=>option.value))).includes('Istniejący temat'));
  assert.equal(await editor.locator('#save').isDisabled(),true,'save waits for an explicit topic');
  await editor.locator('#topic').fill('Istniejący temat');
  await editor.locator('#new-topic').click();
  assert.equal(await editor.locator('#topic').inputValue(),'');
  assert.equal(await editor.locator('#topic').getAttribute('placeholder'),'Nazwa nowego tematu');
  assert.equal(await editor.locator('#topic').evaluate(input=>document.activeElement===input),true);
  await editor.locator('#topic').fill('Energetyka');
  assert.equal(await editor.locator('#save').isEnabled(),true);
  await editor.locator('#save').click();
  await editor.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Zapisano:'));
  const first=await editor.evaluate(async()=>{
   const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('Energetyka');
   const entries=[];for await(const [name,h]of dir.entries())entries.push({name,text:await(await h.getFile()).text()});
   return entries;
  });
  assert.equal(first.length,1);assert.match(first[0].name,/^\d{4}-\d{2}-\d{2}_Próba/);
  assert.ok(first[0].text.includes('source: "'+url+'"'));
  await writeFile('.test-output/'+first[0].name,first[0].text,'utf8');
  await editor.locator('#body').fill(body+'\n\nDRUGI ZAPIS');
  await editor.locator('#save').click();
  await editor.waitForFunction(()=>document.getElementById('status').textContent.includes('_2.md'));
  const after=await editor.evaluate(async()=>{
   const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('Energetyka');const files=[];
   for await(const [name,h]of dir.entries())files.push({name,text:await(await h.getFile()).text()});return files;
  });
  assert.equal(after.length,2);assert.equal(after.find(x=>x.name===first[0].name).text,first[0].text);
  await editor.reload();await editor.waitForSelector('#title:enabled');
  assert.equal(await editor.locator('#topic').inputValue(),'Energetyka','the last used topic is suggested');
  assert.match(await editor.locator('#topic-help').textContent(),/Ostatnio użyty temat/);
  assert.equal(await editor.locator('#save').isEnabled(),true);
  assert.ok((await editor.locator('#topics option').evaluateAll(options=>options.map(option=>option.value))).includes('Energetyka'));
  await editor.locator('#topic').focus();
  assert.deepEqual(await editor.locator('#topic').evaluate(input=>[input.selectionStart,input.selectionEnd]),[0,'Energetyka'.length],'suggested topic is selected for replacing');
  await editor.locator('#topic').press('B');
  assert.equal(await editor.locator('#topic').inputValue(),'B');
  assert.match(await editor.locator('#topic-help').textContent(),/Wybierz z listy/);
  // A remembered topic whose folder is gone is not suggested, so it is never recreated by accident.
  await editor.evaluate(()=>chrome.storage.local.set({lastTopic:'Usunięty temat'}));
  await editor.reload();await editor.waitForSelector('#title:enabled');
  assert.equal(await editor.locator('#topic').inputValue(),'');
  assert.equal(await editor.locator('#save').isDisabled(),true);
  await editor.locator('#topic').fill('../escape');await editor.locator('#save').click();
  assert.match(await editor.locator('#status').textContent(),/Nie zapisano/);
  await editor.locator('#topic').fill('Energetyka');
  await editor.locator('#save').click();
  await editor.waitForFunction(()=>document.getElementById('status').textContent.includes('_3.md'));
  // A failed image download offers an explicit save that keeps the image as an internet link.
  const missingImage='http://127.0.0.1:9/missing.png';
  await editor.locator('#body').fill(body+'\n\n![Brak]('+missingImage+')');
  assert.equal(await editor.locator('#save-missing').isHidden(),true);
  await editor.locator('#save').click();
  await editor.locator('#save-missing').waitFor({state:'visible'});
  assert.match(await editor.locator('#status').textContent(),/Nie zapisano notatki.*linkami internetowymi/);
  await editor.screenshot({path:'.test-output/editor-missing.png',fullPage:true});
  await editor.locator('#body').press('End');await editor.locator('#body').type(' ');
  assert.equal(await editor.locator('#save-missing').isHidden(),true,'editing withdraws the offer');
  await editor.locator('#save').click();
  await editor.locator('#save-missing').click();
  await editor.waitForFunction(()=>document.getElementById('status').textContent.includes('_4.md'));
  assert.match(await editor.locator('#status').textContent(),/Obrazy niepobrane \(1\) zostały linkami internetowymi/);
  const withLink=await editor.evaluate(async()=>{
   const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('Energetyka');
   for await(const [name,h]of dir.entries()) if(name.endsWith('_4.md')) return (await h.getFile()).text();
  });
  assert.ok(withLink.includes('![Brak]('+missingImage+')'));
  await editor.screenshot({path:'.test-output/editor.png',fullPage:true});
  await editor.locator('#body').fill('');assert.equal(await editor.locator('#save').isDisabled(),true);
  assert.equal(await editor.evaluate(async()=>(await chrome.storage.local.get('lastTopic')).lastTopic),'Energetyka','a successful save remembers its topic');
  // Built-in Chrome pages produce a useful error rather than an empty file.
  const errorPagePromise=context.waitForEvent('page');
  await editor.evaluate(async()=>{await(await import(chrome.runtime.getURL('background.js'))).captureTab({id:1,url:'chrome://extensions'});});
  const errorPage=await errorPagePromise;
  await errorPage.waitForFunction(()=>document.getElementById('status')?.textContent.includes('Otwórz artykuł'));
  assert.equal(await errorPage.locator('#save').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: extension capture, Polish, table, relative links, srcset, UI save, no overwrite, last topic suggested (not when its folder is gone), editor fits the window, topic creation, traversal rejection, empty content, restricted page.');
  console.log('Browser UI uses an OPFS native host shim. Windows host and Brave integration have separate tests.');
 } finally {await env.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve('tests/browser.mjs'))await runAutomated();
