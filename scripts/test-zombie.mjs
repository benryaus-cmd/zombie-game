import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const directory=await mkdtemp(path.join(process.cwd(),'.dead-city-tests-'));
try {
 const names=['assets','combat','controls','parts','score','tracers','navigation','warzone'];
 for(const name of names) {
   await build({configFile:false,root:process.cwd(),logLevel:'error',
     build:{outDir:directory,emptyOutDir:false,minify:false,target:'esnext',
       lib:{entry:`tests/zombie-${name}.test.ts`,formats:['es'],fileName:()=>`zombie-${name}.test.mjs`},
       rollupOptions:{external:['node:test','node:assert/strict','node:fs','three','three/examples/jsm/utils/SkeletonUtils.js']}}});
 }
 const result=spawnSync(process.execPath,['--test',...names.map(name=>path.join(directory,`zombie-${name}.test.mjs`))],{stdio:'inherit',cwd:process.cwd()});
 process.exitCode=result.status??1;
} finally {await rm(directory,{recursive:true,force:true});}
