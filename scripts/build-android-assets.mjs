import {build} from 'esbuild';
import {mkdir, copyFile} from 'node:fs/promises';
import {captureBuild} from './capture-build.mjs';

const assets = 'android/app/src/main/assets';
await mkdir(`${assets}/licenses`, {recursive: true});
await build({...captureBuild, outfile: `${assets}/capture.js`});
for (const [name, path] of [
  ['readability', '@mozilla/readability/LICENSE.md'],
  ['turndown', 'turndown/LICENSE'],
  ['turndown-plugin-gfm', 'turndown-plugin-gfm/LICENSE']
]) await copyFile(`node_modules/${path}`, `${assets}/licenses/${name}.txt`);
console.log(`Kod ekstrakcji Android gotowy w ${assets}.`);
