import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shouldFollowCursor,approach,initializeJejuMotion} from '../public/motion.js';
test('cursor only follows a precise hovering pointer when motion is allowed',()=>{
 assert.equal(shouldFollowCursor({fine:true,hover:true,reducedMotion:false}),true);
 assert.equal(shouldFollowCursor({fine:false,hover:true,reducedMotion:false}),false);
 assert.equal(shouldFollowCursor({fine:true,hover:false,reducedMotion:false}),false);
 assert.equal(shouldFollowCursor({fine:true,hover:true,reducedMotion:true}),false);
});
test('cursor catches up smoothly without overshooting',()=>{
 assert.equal(approach(0,100),22);
 assert.ok(approach(22,100)>22&&approach(22,100)<100);
 assert.equal(approach(100,100),100);
});
test('motion enhancement safely no-ops without a browser',()=>{
 assert.equal(typeof initializeJejuMotion({doc:null,win:null}),'function');
});
test('decorative icon has no pointer interception and is screen reader hidden',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/motion.css',import.meta.url),'utf8');
 assert.match(html,/id="tangerine-cursor"[^>]*aria-hidden="true"/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/pointer:coarse/);
});
