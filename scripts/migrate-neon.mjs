import {neon} from '@neondatabase/serverless';
import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL must be configured.');
const sql=neon(process.env.DATABASE_URL);
const ddl=await readFile(new URL('../drizzle/0000_reference_state.sql',import.meta.url),'utf8');
for(const statement of ddl.split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await sql.query(statement.replace(/^CREATE TABLE /,'CREATE TABLE IF NOT EXISTS ').replace(/^CREATE INDEX /,'CREATE INDEX IF NOT EXISTS ').replace('expires_at INTEGER','expires_at BIGINT'));
console.log('Neon schema ready: user_state, search_cache. No user data seeded.');
