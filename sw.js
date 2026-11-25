const BASE="/",APP=BASE+"app/";let key=null,cfg=null;
const MIME={html:"text/html; charset=utf-8",js:"text/javascript; charset=utf-8",mjs:"text/javascript; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",woff2:"font/woff2",woff:"font/woff",otf:"font/otf",ttf:"font/ttf",m4a:"audio/mp4",mp3:"audio/mpeg",md:"text/plain; charset=utf-8",txt:"text/plain; charset=utf-8"};
const db=()=>new Promise((res,rej)=>{const r=indexedDB.open("aicx-review",1);r.onupgradeneeded=()=>r.result.createObjectStore("k");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const idb=async(mode,fn)=>{const d=await db();return new Promise((res,rej)=>{const t=d.transaction("k",mode),r=fn(t.objectStore("k"));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})};
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(e)=>e.waitUntil(self.clients.claim()));
self.addEventListener("message",(e)=>{if(e.data&&e.data.key){key=e.data.key;e.waitUntil(idb("readwrite",(s)=>s.put(key,"key")).then(()=>e.ports[0]&&e.ports[0].postMessage("ok")))}});
const hex=(b)=>[...new Uint8Array(b)].map((x)=>x.toString(16).padStart(2,"0")).join("");
async function works(){try{const b=await (await fetch(BASE+"c/check",{cache:"no-store"})).arrayBuffer();await crypto.subtle.decrypt({name:"AES-GCM",iv:b.slice(0,12)},key,b.slice(12));return true}catch(e){key=null;await idb("readwrite",(s)=>s.delete("key")).catch(()=>{});return false}}
async function serve(url,req){
  if(!key)key=await idb("readonly",(s)=>s.get("key")).catch(()=>null);
  let rel=decodeURIComponent(url.pathname.slice(APP.length));
  const back=()=>Response.redirect(BASE+"?next="+encodeURIComponent(url.pathname+url.search+url.hash),302);
  if(rel==="__unlocked")return new Response(null,{status:key&&await works()?200:401});
  if(!key)return back();
  cfg=await (await fetch(BASE+"config.json",{cache:"no-store"})).json();
  if(rel===""||rel.endsWith("/"))rel+="index.html";
  const name=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(cfg.salt+":"+rel))).slice(0,40);
  const r=await fetch(BASE+"c/"+name,{cache:"no-cache"});if(!r.ok)return new Response("Not found",{status:404});
  const buf=await r.arrayBuffer();let pt;
  try{pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:buf.slice(0,12)},key,buf.slice(12))}
  catch(e){key=null;await idb("readwrite",(s)=>s.delete("key")).catch(()=>{});return req.mode==="navigate"?back():new Response("Locked",{status:401})}
  return new Response(pt,{headers:{"content-type":MIME[rel.split(".").pop().toLowerCase()]||"application/octet-stream","cache-control":"no-store"}});
}
self.addEventListener("fetch",(e)=>{const u=new URL(e.request.url);if(u.origin===location.origin&&u.pathname.startsWith(APP)&&e.request.method==="GET")e.respondWith(serve(u,e.request))});