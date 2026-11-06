import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const get=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Gyuri adventure is keyboard accessible and opens a native dialog',async()=>{
 const html=await get('public/index.html');
 assert.match(html,/id="gyuri-explore" type="button" aria-haspopup="dialog" aria-controls="gyuri-dialog"/);
 assert.match(html,/<dialog id="gyuri-dialog"/);
 assert.match(html,/id="gyuri-animation"/);
 assert.match(html,/data-gif="\.\/gyuri-exploration\.gif"/);
 assert.match(html,/data-close="gyuri-dialog"/);
});
test('GIF is intentionally lazy and respects reduced-motion preferences',async()=>{
 const html=await get('public/index.html'),app=await get('public/app.js');
 assert.match(html,/id="gyuri-animation"[^>]+src="\.\/gyuri\.webp"/);
 assert.match(app,/gyuriTrigger\.addEventListener\('click'/);
 assert.match(app,/prefers-reduced-motion: reduce/);
 assert.match(app,/gyuriDialog\.addEventListener\('close'/);
 assert.match(app,/gyuriAnimation\.src=animationAllowed\?/);
});
test('adventure styling covers mobile and keyboard users without exposing studio',async()=>{
 const html=await get('public/index.html'),css=await get('public/gyuri-explore.css');
 assert.doesNotMatch(html,/data-view="data"/);
 assert.match(html,/gyuri-explore\.css/);
 assert.match(css,/focus-visible/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
