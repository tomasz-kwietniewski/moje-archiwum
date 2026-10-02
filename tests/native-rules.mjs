import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

// Compiles native/Program.cs with tests/RuleVectors.cs as the entry point and runs the shared vectors.
const compiler = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
mkdirSync('.test-output', {recursive: true});
const exe = path.resolve('.test-output', 'RuleVectors.exe');
const run = (file, args) => {
 const result = spawnSync(file, args, {stdio: 'inherit'});
 if (result.status !== 0) process.exit(result.status || 1);
};
run(compiler, ['/nologo', '/target:exe', '/main:RuleVectors', '/out:' + exe, '/reference:System.Windows.Forms.dll',
 '/reference:System.Web.Extensions.dll', 'native\\Program.cs', 'tests\\RuleVectors.cs']);
run(exe, ['tests/vectors/rules.tsv']);
