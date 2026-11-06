import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const get=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('sidebar preserves navigation and collection behavior',async()=>{
 const html=await get('public/index.html');
 assert.match(html,/data-view="explore"/);
 assert.match(html,/data-view="board"/);
 assert.match(html,/id="board-count"/);
 for(const q of ['바다 청록','현무암 질감','한글 타이포그래피'])assert.ok(html.includes(`data-preset="${q}"`));
 assert.match(html,/class="workspace-mascot" src="\.\/gyuri.webp"/);
 assert.match(html,/class="sidebar-collections"/);
});
test('private studio markup never appears in the public sidebar',async()=>{
 const html=await get('public/index.html');
 assert.doesNotMatch(html,/data-view="data"/);
 assert.doesNotMatch(html,/id="data-stats"/);
 const app=await get('public/app.js');
 assert.match(app,/studioReady/);
});
test('sidebar is keyboard accessible and motion respects preferences',async()=>{
 const html=await get('public/index.html'),css=await get('public/sidebar.css');
 assert.match(html,/nav aria-label="주 메뉴"/);
 assert.match(html,/aria-current="page"/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
