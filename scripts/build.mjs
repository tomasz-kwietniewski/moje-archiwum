import {build} from 'esbuild';
import {captureBuild} from './capture-build.mjs';
import {mkdir,copyFile,rm} from 'node:fs/promises';
// Start from an empty dist so files removed from src/ do not linger in the installed extension.
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await build({...captureBuild,outfile:'dist/capture.js'});
for(const file of ['background.js','editor.html','editor.js','editor.css','core.js','native.js']) await copyFile('src/'+file,'dist/'+file);
await copyFile('manifest.json','dist/manifest.json');
await mkdir('dist/licenses',{recursive:true});
for(const [name,path] of [['readability','@mozilla/readability/LICENSE.md'],['turndown','turndown/LICENSE'],['turndown-plugin-gfm','turndown-plugin-gfm/LICENSE']]) {
 await copyFile('node_modules/'+path,'dist/licenses/'+name+'.txt');
}
console.log('Wtyczka gotowa w dist/.');
