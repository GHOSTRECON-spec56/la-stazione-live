import {randomUUID} from 'node:crypto';

// Keep each UTF-8 value below D1's 2 MB row limit, including non-Latin menus.
const CHUNK_CHARACTERS=300_000;
export function prepareJSONWrite(namespace,key,data,options={},now=Date.now(),chunkCharacters=CHUNK_CHARACTERS) {
  const etag=randomUUID(),json=JSON.stringify(data);
  const expires=key.startsWith('sessions/')?data.expiresAt:
    key.startsWith('used-nonces/')?data.usedAt+86_400_000:
    key.startsWith('history/')?now+30*86_400_000:null;
  const match=options.onlyIfMatch??null,onlyNew=options.onlyIfNew?1:0;
  const statements=[{
    sql:`INSERT INTO records (namespace,key,etag,metadata,expires_at)
      SELECT ?,?,?,?,? WHERE ? IS NULL OR EXISTS
        (SELECT 1 FROM records WHERE namespace=? AND key=? AND etag=?)
      ON CONFLICT(namespace,key) DO UPDATE SET etag=excluded.etag,
        metadata=excluded.metadata,expires_at=excluded.expires_at
      WHERE ?=0 AND (? IS NULL OR records.etag=?)`,
    values:[namespace,key,etag,JSON.stringify(options.metadata||{}),expires,match,namespace,key,match,onlyNew,match,match]
  }];
  for(let offset=0,part=0;offset<json.length;part++) {
    let end=Math.min(offset+chunkCharacters,json.length);
    // Never split a Unicode surrogate pair across SQLite values.
    if(end<json.length&&/[\uD800-\uDBFF]/.test(json[end-1]))end--;
    statements.push({
    sql:`INSERT INTO chunks (namespace,key,etag,part,data)
      SELECT ?,?,?,?,? WHERE EXISTS
        (SELECT 1 FROM records WHERE namespace=? AND key=? AND etag=?)`,
    values:[namespace,key,etag,part,json.slice(offset,end),namespace,key,etag]
    });
    offset=end;
  }
  statements.push({
    sql:`DELETE FROM chunks WHERE namespace=? AND key=? AND etag<>?
      AND EXISTS (SELECT 1 FROM records WHERE namespace=? AND key=? AND etag=?)`,
    values:[namespace,key,etag,namespace,key,etag]
  });
  return {etag,statements};
}

export function createCloudflareStore(env,namespace) {
  // Always begin on the primary, even if read replication is enabled later.
  const db=env.DB.withSession('first-primary');
  return {
    async getWithMetadata(key,{type='json'}={}) {
      if(key.startsWith('photos/')) {
        const entry=await env.PHOTOS.getWithMetadata(key,{type:'arrayBuffer',cacheTtl:60});
        return entry.value===null?null:{data:entry.value,metadata:entry.metadata,etag:key.slice(7)};
      }
      if(type!=='json')throw new Error('D1 records contain JSON only.');
      const {results}=await db.prepare(`SELECT r.etag,r.metadata,c.data FROM records r
        JOIN chunks c ON c.namespace=r.namespace AND c.key=r.key AND c.etag=r.etag
        WHERE r.namespace=? AND r.key=? AND (r.expires_at IS NULL OR r.expires_at>?)
        ORDER BY c.part`).bind(namespace,key,Date.now()).all();
      if(!results.length)return null;
      return {data:JSON.parse(results.map(row=>row.data).join('')),etag:results[0].etag,metadata:JSON.parse(results[0].metadata)};
    },
    async setJSON(key,data,options={}) {
      const {etag,statements}=prepareJSONWrite(namespace,key,data,options);
      // D1 batch is one transaction. The CAS pointer and its chunks commit together.
      const results=await db.batch(statements.map(({sql,values})=>db.prepare(sql).bind(...values)));
      return {modified:results[0].meta.changes===1,etag};
    },
    async set(key,bytes,{metadata={}}={}) {
      if(!/^photos\/[a-f0-9]{64}$/.test(key))throw new Error('Only content-addressed photos belong in KV.');
      // Immutable SHA-256 keys make eventual consistency safe; permissions never use KV.
      const existing=await env.PHOTOS.getWithMetadata(key,{type:'arrayBuffer',cacheTtl:60});
      if(existing.value!==null)return {modified:false,etag:key.slice(7)};
      await env.PHOTOS.put(key,bytes,{metadata});
      return {modified:true,etag:key.slice(7)};
    }
  };
}

export async function cleanExpiredRecords(env,now=Date.now()) {
  // Bounded cleanup; expired sessions are rejected on reads even before this runs.
  return env.DB.prepare(`DELETE FROM records WHERE (namespace,key) IN
    (SELECT namespace,key FROM records WHERE expires_at<=? LIMIT 500)`).bind(now).run();
}
