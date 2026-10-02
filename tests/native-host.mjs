import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';

const exe=path.resolve('native/MojeArchiwumHost.exe');
const base=path.resolve('.test-output');
await mkdir(base,{recursive:true});
const output=await mkdtemp(path.join(base,'native-host-'));
// Padded to 100 characters, so the MAX_PATH case below does not depend on where the repository is checked out.
const root=path.join(output,'Archiwum').padEnd(100,'_');
const config=path.join(output,'folder.txt');
let imageServer;
await mkdir(root,{recursive:true});
await writeFile(config,root,'utf8');

function send(message) {
 const json=Buffer.from(JSON.stringify(message),'utf8');
 const length=Buffer.alloc(4);length.writeUInt32LE(json.length);
 const result=spawnSync(exe,[],{input:Buffer.concat([length,json]),env:{...process.env,MOJE_ARCHIWUM_CONFIG:config},maxBuffer:2*1024*1024});
 assert.equal(result.status,0,result.stderr.toString());
 const size=result.stdout.readUInt32LE(0);
 assert.equal(result.stdout.length,size+4);
 return JSON.parse(result.stdout.subarray(4).toString('utf8'));
}

try {
 assert.equal(send({op:'status'}).root,root);
 const note={op:'save',topic:'Zażółć',basename:'2026-09-23_Tytuł',content:'---\ntitle: "Tytuł"\n---\n\nTreść żółć\n'};
 const first=send(note);const second=send(note);
 assert.equal(first.ok,true,first.error);
 assert.equal(second.ok,true,second.error);
 assert.equal(first.name,'2026-09-23_Tytuł.md');
 assert.equal(second.name,'2026-09-23_Tytuł_2.md');
 assert.equal(await readFile(path.join(root,'Zażółć',first.name),'utf8'),note.content);
 assert.deepEqual((await readdir(path.join(root,'Zażółć'))).sort(),[first.name,second.name].sort());
 assert.ok(send({op:'topics'}).topics.includes('Zażółć'));
 assert.equal(send({...note,topic:'../inny'}).ok,false);
 imageServer=spawn(process.execPath,['--input-type=module','-e',`
  import http from 'node:http';
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9kAAAAASUVORK5CYII=','base64');
  const server=http.createServer((req,res)=>{
   if(req.url==='/ok.png' || decodeURIComponent(req.url)==='/filters:format(webp)/ok.png'){res.writeHead(200,{'content-type':'image/png'});res.end(png);}
   else if(req.url==='/alias.jpg'){res.writeHead(200,{'content-type':'image/jpg'});res.end(Buffer.from([0xff,0xd8,0xff,0xd9]));}
   else{res.writeHead(404);res.end('missing');}
  });
  server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));
 `],{stdio:['ignore','pipe','pipe']});
 const [portData]=await once(imageServer.stdout,'data');
 const imageUrl='http://127.0.0.1:'+Number(portData.toString().trim())+'/ok.png';
 const withImage={op:'save',topic:'Zażółć',basename:'2026-09-24_Offline',content:'---\ntitle: "Offline"\n---\n\n![Opis]('+imageUrl+')\n![Drugi]('+imageUrl+' "Podpis")\n'};
 const saved=send(withImage);
 assert.equal(saved.ok,true,saved.error);
 const stored=await readFile(path.join(root,'Zażółć',saved.name),'utf8');
 assert.match(stored,/!\[Opis\]\(2026-09-24_Offline_assets\/001\.png\)/);
 assert.match(stored,/!\[Drugi\]\(2026-09-24_Offline_assets\/001\.png "Podpis"\)/);
 assert.deepEqual(await readdir(path.join(root,'Zażółć','2026-09-24_Offline_assets')),['001.png']);
 assert.deepEqual(await readFile(path.join(root,'Zażółć','2026-09-24_Offline_assets','001.png')),
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9kAAAAASUVORK5CYII=','base64'));
 const alias=send({...withImage,basename:'2026-09-24_JpgAlias',content:'![JPEG](http://127.0.0.1:'+Number(portData.toString().trim())+'/alias.jpg)'});
 assert.equal(alias.ok,true,alias.error);
 assert.match(await readFile(path.join(root,'Zażółć',alias.name),'utf8'),/!\[JPEG\]\(2026-09-24_JpgAlias_assets\/001\.jpg\)/);
 // Turndown escapes parentheses in addresses (Eurosport: filters:format(webp)); the host downloads the plain address.
 const escapedUrl='http://127.0.0.1:'+Number(portData.toString().trim())+'/filters:format\\(webp\\)/ok.png';
 const escaped=send({...withImage,basename:'2026-09-28_Nawias',content:'![Eurosport]('+escapedUrl+')'});
 assert.equal(escaped.ok,true,escaped.error);
 assert.equal(await readFile(path.join(root,'Zażółć',escaped.name),'utf8'),'![Eurosport](2026-09-28_Nawias_assets/001.png)');
 const failed=send({...withImage,basename:'2026-09-24_Bad',content:'![Dobry]('+imageUrl+')\n![Brak](http://127.0.0.1:'+Number(portData.toString().trim())+'/missing)'});
 const missingUrl='http://127.0.0.1:'+Number(portData.toString().trim())+'/missing';
 assert.equal(failed.ok,false);
 assert.deepEqual(failed.missingImages,[missingUrl]);
 assert.match(failed.error,/1 z 2 obrazów/);
 assert.ok(!(await readdir(path.join(root,'Zażółć'))).some(name=>name.startsWith('2026-09-24_Bad')));
 // With the user's consent the note is saved and the missing image keeps its internet address.
 const partial=send({...withImage,basename:'2026-09-24_Bad',allowMissingImages:true,content:'![Dobry]('+imageUrl+')\n![Brak]('+missingUrl+')'});
 assert.equal(partial.ok,true,partial.error);
 assert.deepEqual(partial.missingImages,[missingUrl]);
 assert.equal(await readFile(path.join(root,'Zażółć',partial.name),'utf8'),'![Dobry](2026-09-24_Bad_assets/001.png)\n![Brak]('+missingUrl+')');
 const onlyMissing=send({...withImage,basename:'2026-09-24_OnlyMissing',allowMissingImages:true,content:'![Brak]('+missingUrl+')'});
 assert.equal(onlyMissing.ok,true,onlyMissing.error);
 assert.ok(!(await readdir(path.join(root,'Zażółć'))).includes('2026-09-24_OnlyMissing_assets'),'no empty asset folder');
 // Long Joplin-style titles are shortened so the deepest asset path stays within Windows MAX_PATH.
 // Topic length chosen so the topic folder path has 180 characters on any machine.
 const longTopic='Temat '+'t'.repeat(180-root.length-1-6);
 assert.ok(longTopic.length>6 && longTopic.length<=100,'test root path too long: '+root);
 const longNote=send({op:'save',topic:longTopic,basename:'2026-09-25_'+'Długi tytuł '.repeat(10).trim(),content:'![Obraz]('+imageUrl+')'});
 assert.equal(longNote.ok,true,longNote.error);
 const assetPath=path.join(root,longTopic,longNote.name.slice(0,-3)+'_assets','001.png');
 assert.ok(assetPath.length<=259 && longNote.name.length<'2026-09-25_'.length+120,assetPath);
 assert.deepEqual(await readFile(assetPath),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9kAAAAASUVORK5CYII=','base64'));
 assert.equal(send({op:'save',topic:'Zażółć\u00a0',basename:'2026-09-25_X',content:'x'}).ok,false,'topic with trailing NBSP');
 console.log('PASS: Windows host saves local images, cleans partial files, keeps consented missing images as links, fits MAX_PATH.');
} finally {
 if(imageServer)imageServer.kill();
 if (!output.startsWith(base+path.sep)) throw new Error('Unsafe test cleanup path');
 await rm(output,{recursive:true,force:true});
}
