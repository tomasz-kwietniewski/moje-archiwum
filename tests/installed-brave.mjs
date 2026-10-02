import {chromium} from 'playwright';
import path from 'node:path';
import assert from 'node:assert/strict';

const extension=path.resolve('dist');
const context=await chromium.launchPersistentContext('',{
 executablePath:'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
 headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension]
});
try {
 const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const page=await context.newPage();
 await page.goto('chrome-extension://'+id+'/editor.html');
 const result=await page.evaluate(()=>new Promise((resolve,reject)=>{
  chrome.runtime.sendNativeMessage('pl.tomaszkwietniewski.moje_archiwum',{op:'status'},reply=>{
   if(chrome.runtime.lastError)reject(new Error(chrome.runtime.lastError.message));
   else resolve({reply,picker:typeof window.showDirectoryPicker});
  });
 }));
 assert.equal(result.reply.ok,true,result.reply.error);
 assert.equal(result.picker,'undefined');
 console.log('PASS: installed native host responds to extension '+id+' in actual Brave; folder picker API is absent.');
} finally {await context.close();}
