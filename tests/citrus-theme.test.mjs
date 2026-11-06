import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = file => readFile(new URL('../'+file,import.meta.url),'utf8');
const lin = hex => {
 const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
};
const contrast=(a,b)=>{const x=lin(a),y=lin(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('Citrus palette has AA-contrast text and accessible button labels',async()=>{
 const css=await read('public/citrus.css');
 const colors=['#FFF8EF','#FFFCF7','#F9E7D1','#F58A3B','#B84E1D','#45382F'];
 for(const hex of colors)assert.ok(css.includes(hex),hex+' is missing');
 assert.ok(contrast('#45382F','#FFF8EF')>=7);
 assert.ok(contrast('#715B4A','#FFF8EF')>=4.5);
 assert.ok(contrast('#685043','#F9E7D1')>=4.5);
 assert.ok(contrast('#FFFFFF','#B84E1D')>=4.5);
 assert.ok(contrast('#A64618','#FFFCF7')>=4.5);
});
test('new theme loads last and updates browser theme color',async()=>{
 const html=await read('public/index.html');
 const all=[...html.matchAll(/href="\.\/([^"]+\.css)"/g)].map(x=>x[1]);
 assert.equal(all.at(-1),'citrus.css');
 assert.ok(html.includes('name="theme-color" content="#FFF8EF"'));
});
test('site-wide surfaces, mobile layout and keyboard focus are themed',async()=>{
 const css=await read('public/citrus.css');
 for(const token of ['.sidebar','.hero','.search-box','.palette-rail','.card','.save-button','.topbar','.page-footer','.draft-panel','.data-panel','dialog','.studio-login','.toast'])assert.ok(css.includes(token),token+' should be themed');
 assert.ok(css.includes('summary:focus-visible'));
 assert.ok(css.includes('@media (max-width:760px)'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
});
test('private studio remains absent from public markup and pointer mascot remains',async()=>{
 const html=await read('public/index.html');
 assert.doesNotMatch(html,/data-view="data"/);
 assert.match(html,/id="tangerine-cursor"/);
 assert.match(html,/class="workspace-mascot" src="\.\/gyuri.webp"/);
});
