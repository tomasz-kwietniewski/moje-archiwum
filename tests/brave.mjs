import {startBrowser} from './browser.mjs';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const brave='C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const hostName='pl.tomaszkwietniewski.moje_archiwum_test';
const registry='HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\'+hostName;
const base=path.resolve('.test-output');
await mkdir(base,{recursive:true});
const output=await mkdtemp(path.join(base,'brave-'));
const root=path.join(output,'Archiwum');
const config=path.join(output,'folder.txt');
const manifest=path.join(output,'host.json');
await mkdir(root,{recursive:true});
await writeFile(config,root,'utf8');
process.env.MOJE_ARCHIWUM_CONFIG=config;
const env=await startBrowser({automated:true,nativeShim:false,browserPath:brave,nativeHostName:hostName});
let registered=false;
try {
 await writeFile(manifest,JSON.stringify({name:hostName,description:'Test lokalnego archiwum',path:path.resolve('native/MojeArchiwumHost.exe'),type:'stdio',allowed_origins:['chrome-extension://'+env.id+'/']}),'utf8');
 const add=spawnSync('reg.exe',['add',registry,'/ve','/t','REG_SZ','/d',manifest,'/f'],{encoding:'utf8'});
 assert.equal(add.status,0,add.stderr);
 registered=true;
 const driver=await env.context.newPage();await driver.goto('chrome-extension://'+env.id+'/editor.html');
 await driver.evaluate(async url=>{
  const tab=(await chrome.tabs.query({})).find(t=>t.url===url);
  return (await import(chrome.runtime.getURL('background.js'))).captureTab(tab);
 },env.url);
 await driver.close();
 const editor=env.context.pages().find(page=>page.url().includes('editor.html')) || await env.context.waitForEvent('page');
 await editor.waitForSelector('#title:enabled');
 assert.equal(await editor.evaluate(()=>typeof window.showDirectoryPicker),'undefined','Brave should reproduce the missing API');
 await editor.waitForFunction(()=>document.getElementById('archive-name').textContent.includes('Archiwum'));
 await editor.locator('#topic').fill('Test Brave');
 await editor.locator('#save').click();
 await editor.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Zapisano:'));
 const dir=path.join(root,'Test Brave');
 const names=await readdir(dir);
 const notes=names.filter(name=>name.endsWith('.md'));
 assert.equal(notes.length,1);
 const note=await readFile(path.join(dir,notes[0]),'utf8');
 assert.match(note,/zażółć gęślą jaźń/);
 assert.ok(note.includes('source: "'+env.url+'"'));
 const imagePath=note.match(/!\[[^\]]*\]\(([^)]+_assets\/[^)]+)\)/);
 assert.ok(imagePath,'Brave should save an offline image link');
 const image=await readFile(path.join(dir,...imagePath[1].split('/').map(decodeURIComponent)));
 assert.ok(image.length>0);
 // The fixture server answers /missing.png with HTML, which the host must reject as an image.
 const missing=new URL('/missing.png',env.url).href;
 await editor.locator('#body').fill(await editor.locator('#body').inputValue()+'\n\n![Brak]('+missing+')');
 await editor.locator('#save').click();
 await editor.locator('#save-missing').waitFor({state:'visible'});
 assert.equal((await readdir(dir)).filter(name=>name.endsWith('.md')).length,1,'nothing saved before consent');
 await editor.locator('#save-missing').click();
 await editor.waitForFunction(()=>/_2\.md.*linkami internetowymi/.test(document.getElementById('status').textContent));
 const second=await readFile(path.join(dir,notes[0].replace(/\.md$/,'_2.md')),'utf8');
 assert.ok(second.includes('![Brak]('+missing+')'),'missing image stays an internet link');
 assert.match(second,/_2_assets\/001\./,'other images are still saved offline');
 console.log('PASS: actual Brave extension saves Markdown and its image locally through Windows native host, and saves without a missing image after consent.');
} finally {
 await env.close();
 if(registered) {
  const remove=spawnSync('reg.exe',['delete',registry,'/f'],{encoding:'utf8'});
  if(remove.status!==0)console.error('Could not remove test host registry key: '+remove.stderr);
 }
 delete process.env.MOJE_ARCHIWUM_CONFIG;
 if (!output.startsWith(base+path.sep)) throw new Error('Unsafe test cleanup path');
 await rm(output,{recursive:true,force:true});
}
