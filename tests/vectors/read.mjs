import {readFileSync} from 'node:fs';

const unescape = value => value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, code) =>
 code[0] === 'u' && code.length === 5 ? String.fromCharCode(parseInt(code.slice(1), 16))
  : code === 't' ? '\t' : code === 'n' ? '\n' : code);

export function readVectors(path = 'tests/vectors/rules.tsv') {
 return readFileSync(path, 'utf8').split(/\r?\n/)
  .filter(line => line && !line.startsWith('#'))
  .map(line => line.split('\t').map(unescape));
}
