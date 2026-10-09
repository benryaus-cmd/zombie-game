import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const directory=await mkdtemp(path.join(tmpdir(),'dead-city-tests-'));
try {
 const names=['assets','combat','controls','parts','score'];
 await build({entryPoints:names.map(n=>`tests/zombie-${n}.test.ts`),bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},outdir:directory});
 const result=spawnSync(process.execPath,['--test',...names.map(n=>path.join(directory,`zombie-${n}.test.mjs`))],{stdio:'inherit'});
 process.exitCode=result.status??1;
}finally{await rm(directory,{recursive:true,force:true});}
