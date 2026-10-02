import {spawn,spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const base=path.resolve('.test-output');
await mkdir(base,{recursive:true});
const output=await mkdtemp(path.join(base,'picker-'));
const config=path.join(output,'folder.txt');
await writeFile(config,output,'utf8');
const child=spawn(path.resolve('native/MojeArchiwumHost.exe'),[],{
 env:{...process.env,MOJE_ARCHIWUM_CONFIG:config},stdio:['pipe','pipe','pipe'],windowsHide:false
});
let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
const json=Buffer.from(JSON.stringify({op:'choose'}));
const size=Buffer.alloc(4);size.writeUInt32LE(json.length);
child.stdin.write(Buffer.concat([size,json]));
try {
 await new Promise(resolve=>setTimeout(resolve,2000));
 const check=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('tests/find-window.ps1'),'-ProcessId',String(child.pid)],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
 const handle=Number(check.stdout.trim().split(/\s+/)[0]);
 assert.ok(handle>0,'Windows folder picker did not create a visible window. Process exit='+child.exitCode+', stderr='+stderr+', process query='+check.stdout.trim());
 console.log('PASS: native Windows folder picker opened (window handle '+handle+').');
} finally {
 child.kill();
 await new Promise(resolve=>child.once('close',resolve));
 if (!output.startsWith(base+path.sep)) throw new Error('Unsafe test cleanup path');
 await rm(output,{recursive:true,force:true});
}
