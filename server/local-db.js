import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function localDatabase(filename=':memory:'){
 if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL;');
 db.exec('CREATE TABLE IF NOT EXISTS __jeju_migrations(name TEXT PRIMARY KEY NOT NULL);');
 const migration='0000_reference_state';
 if(!db.prepare('SELECT name FROM __jeju_migrations WHERE name=?').get(migration)){
  const file=path.join(path.dirname(fileURLToPath(import.meta.url)),'../drizzle/'+migration+'.sql');
  db.exec(readFileSync(file,'utf8'));db.prepare('INSERT INTO __jeju_migrations(name) VALUES(?)').run(migration);
 }
 const prepare=(sql,args=[])=>({bind(...values){return prepare(sql,values);},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const out=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(out.changes)}};}});
 return {prepare,async batch(statements){db.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());db.exec('COMMIT');return result;}catch(err){db.exec('ROLLBACK');throw err;}},close(){db.close();}};
}
