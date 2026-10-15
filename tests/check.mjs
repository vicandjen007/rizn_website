import {readFileSync,existsSync} from 'node:fs';import {execFileSync} from 'node:child_process';
for(const file of ['server/api.mjs','server/local.mjs','server/worker.mjs','dist/script.js','dist/admin.js'])execFileSync(process.execPath,['--check',file]);
const html=readFileSync('dist/index.html','utf8');
for(const [,src]of html.matchAll(/(?:src|href)="(assets\/[^"#]+)"/g))if(!existsSync('dist/'+src))throw Error('Missing asset: '+src);
for(const [,id]of html.matchAll(/href="#([^"]+)"/g))if(!html.includes('id="'+id+'"'))throw Error('Missing target '+id);
if(html.includes('in-action.webp')||html.includes('hero.webp'))throw Error('Unapproved imagery');
for(const path of ['tester-form','launch-form','tester-success','launch-success'])if(!html.includes('id="'+path+'"'))throw Error('Missing conversion state');
console.log('Static build / lint: JavaScript parses, assets and anchors resolve, separate forms and approved imagery present. No TypeScript source; syntax checks apply.');
