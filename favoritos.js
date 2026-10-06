/* Círculos Music · Favoritos con nick, sin contraseña
   Los favoritos se guardan siempre en el dispositivo. Si la persona crea un nick, además se guardan en la nube
   y aparecen en cualquier dispositivo donde escriba ese mismo nick.
   Usa el mismo proyecto de Firebase que la app de ajedrez (inicio de sesión anónimo + Firestore).
   Cada nick se guarda en el documento "circulos<nick>" de la colección "progresos", con la misma forma que los
   perfiles del ajedrez. Los cambios llegan solos a los demás dispositivos y siempre gana la versión más reciente. */
'use strict';

const FIREBASE='https://www.gstatic.com/firebasejs/12.18.0/';
const firebaseConfig={
  apiKey:'AIzaSyCGcl98D7288m_iyOWlc_ffTISg85-LVpw',
  authDomain:'chess86926.firebaseapp.com',
  projectId:'chess86926',
  storageBucket:'chess86926.firebasestorage.app',
  messagingSenderId:'341510503521',
  appId:'1:341510503521:web:b2afc3127bcd78326a7e20'
};
const COLLECTION='progresos',DOC_PREFIX='circulos';
const KEY_FAVS='circulos-favs',KEY_NICK='circulos-nick',KEY_CLIENT='circulos-client';
const NICK_RE=/^[A-Za-z0-9]{4,24}$/;

const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}},del(k){try{localStorage.removeItem(k);}catch(e){}}};
const clientId=store.get(KEY_CLIENT)||(()=>{const id=(crypto.randomUUID?crypto.randomUUID():'c'+Date.now().toString(36)+Math.random().toString(36).slice(2));store.set(KEY_CLIENT,id);return id;})();
const lib=()=>window.CirculosChords;
const toast=m=>window.CirculosShell?.toast(m);

let favs=(()=>{try{const v=JSON.parse(store.get(KEY_FAVS)||'[]');return Array.isArray(v)?v.filter(f=>f&&f.id):[];}catch(e){return[];}})();
let nick=store.get(KEY_NICK)||'';
let cloud={state:nick?'busy':'off',text:''};   // off | busy | ok | error

/* ───────── Datos locales ─────────
   Cada favorito es {id, k?, s, t}: id = acorde; k = una sola variación ("g3" posición de guitarra, "p1" forma de piano) */
const keyOf=f=>f.id+(f.k?':'+f.k:'');
const has=key=>favs.some(f=>keyOf(f)===key);
const hasAny=id=>favs.some(f=>f.id===id);
function saveLocal(){store.set(KEY_FAVS,JSON.stringify(favs));refreshAll();}
function toggleKey(key){
  const [id,k]=String(key).split(':'),entry=lib()?.byId(id);if(!entry)return;
  const what=!k||k==='p'?'':k[0]==='p'?'Forma de piano ':'Posición ';
  if(has(key)){favs=favs.filter(f=>keyOf(f)!==key);toast(`${what?what+'quitada':'Quitado'} de Favoritos`);}
  else{favs=[{id,...(k?{k}:{}),s:entry.s,t:Date.now()},...favs];toast(`${what?what+'guardada':'Guardado'} en Favoritos`);}
  saveLocal();scheduleUpload();
}
const toggle=entry=>entry&&toggleKey(entry.id);

/* ───────── Nube (Firebase) ─────────
   El documento tiene la misma forma que los perfiles de la app de ajedrez (l1.storage, timestamp, updatedBy,
   schemaVersion), para que las reglas de seguridad del proyecto lo acepten igual que aquellos.
   Gana siempre la última versión guardada: cada cambio lleva la hora en que se hizo ("circulos-favs-at"). */
let fb=null,ref=null,stopSnap=null,uploadTimer=0,lastUpload=0,connecting=null;
const KEY_AT='circulos-favs-at',KEY_SYNCED='circulos-favs-synced';
const KEY_MOVED='circulos-moved-to',KEY_MOVED_NICK='circulos-moved-nick';
/* Convertidor de partituras: con ID, la contraseña se escribe una vez y el cancionero (ya convertido)
   viaja a los demás dispositivos de ese ID. Sin ID, nada de esto sale del dispositivo. */
const KEY_CONV='circulos-conv',KEY_CONV_ID='circulos-conv-id',KEY_BOOK='circulos-libro',KEY_BOOKS='circulos-libros',BOOK_PREFIX='circuloslibro-',PART=700000;
let books=null;                    // «Mis partituras» del ID: [{id,parts,name,songs,at}]
/* Ajustes del Convertidor que viajan con el ID: velocidad de cada canción y lugar/tamaño del teclado.
   Cada uno guarda su hora; gana el más reciente. */
const SYNCED=[{key:'tab-tempos',at:'tab-tempos-at',ev:'circulos:tempos'},{key:'tab-kb-place',at:'tab-kb-place-at',ev:'circulos:kb'}];
const localAtOf=k=>Number(store.get(k.at))||0;
const remoteAtOf=(d,k)=>Number(d&&d.l1&&d.l1.storage&&d.l1.storage[k.at])||0;
const sessionConv=()=>{try{return sessionStorage.getItem('circulos-convertidor')==='1';}catch(e){return false;}};
const convOn=()=>!!nick&&(store.get(KEY_CONV_ID)===nick.toLowerCase()||sessionConv());
function readExtras(d,{skipBooks=false}={}){
  const st=d&&d.l1&&d.l1.storage;if(!st)return;
  if(st[KEY_CONV]==='1'&&nick){
    const was=store.get(KEY_CONV_ID)===nick.toLowerCase();
    store.set(KEY_CONV_ID,nick.toLowerCase());
    if(!was)document.dispatchEvent(new CustomEvent('circulos:conv-unlock'));
  }
  for(const k of SYNCED)if(typeof st[k.key]==='string'&&remoteAtOf(d,k)>localAtOf(k)){   // más reciente en otro dispositivo
    store.set(k.key,st[k.key]);store.set(k.at,String(remoteAtOf(d,k)));
    document.dispatchEvent(new CustomEvent(k.ev));
  }
  if(skipBooks)return;
  let list=null;
  try{
    if(typeof st[KEY_BOOKS]==='string')list=st[KEY_BOOKS]?JSON.parse(st[KEY_BOOKS]):[];
    else if(st[KEY_BOOK])list=[JSON.parse(st[KEY_BOOK])];             // formato anterior: un solo cancionero
  }catch(e){list=null;}
  if(!Array.isArray(list))list=[];
  const changed=JSON.stringify(list)!==JSON.stringify(books);
  books=list;
  if(changed)document.dispatchEvent(new CustomEvent('circulos:cloud-books',{detail:books}));
}
/* Si el ID se cambió, el documento viejo queda como aviso que apunta al nuevo */
const movedTo=d=>{const st=d&&d.l1&&d.l1.storage;return st&&st[KEY_MOVED]?{id:st[KEY_MOVED],nick:st[KEY_MOVED_NICK]||st[KEY_MOVED].replace(DOC_PREFIX,'')}:null;};
const localAt=()=>Number(store.get(KEY_AT))||0;
async function firebase(){
  if(fb)return fb;
  const [appMod,authMod,fs]=await Promise.all([import(FIREBASE+'firebase-app.js'),import(FIREBASE+'firebase-auth.js'),import(FIREBASE+'firebase-firestore.js')]);
  const app=appMod.initializeApp(firebaseConfig);
  const auth=authMod.getAuth(app);
  await authMod.signInAnonymously(auth);
  fb={db:fs.getFirestore(app),fs};
  return fb;
}
function setCloud(state,text=''){cloud={state,text};refreshSheet();refreshIdItem();}
function merge(remote,local){
  const out=[...remote],ids=new Set(remote.map(keyOf));
  local.forEach(f=>{if(!ids.has(keyOf(f)))out.push(f);});
  return out;
}
/* Lee los favoritos y su hora desde el documento (formato nuevo y el de la primera versión) */
function readRemote(d){
  if(!d)return null;
  const st=d.l1&&d.l1.storage;
  if(st&&typeof st[KEY_FAVS]==='string'){
    try{const list=JSON.parse(st[KEY_FAVS]);if(Array.isArray(list))return{list:list.filter(f=>f&&f.id),at:Number(st[KEY_AT])||0};}catch(e){}
  }
  if(Array.isArray(d.favoritos))return{list:d.favoritos.filter(f=>f&&f.id),at:d.timestamp?.toMillis?.()||0};
  return null;
}
function applyRemote(r){
  if(!r)return false;
  const same=JSON.stringify(r.list)===JSON.stringify(favs);
  favs=r.list;store.set(KEY_AT,String(r.at||Date.now()));
  if(!same)saveLocal();
  return !same;
}
function errorText(err){
  const code=err&&err.code||'';
  if(code.includes('permission-denied'))return 'Firebase no dio permiso para guardar (reglas de seguridad).';
  if(code.includes('unavailable')||!navigator.onLine)return 'Sin internet: se guarda en este dispositivo y se sincroniza al volver la conexión.';
  if(code.includes('admin-restricted')||code.includes('operation-not-allowed'))return 'El inicio de sesión anónimo de Firebase está desactivado.';
  return 'No se pudo sincronizar'+(code?` (${code})`:'')+'.';
}
async function connect(name,{silent=false,mode=''}={}){
  name=String(name||'').trim();
  if(!NICK_RE.test(name))throw new Error('Usa solo letras y números, de 4 a 24 caracteres.');
  setCloud('busy','Conectando…');
  const {db,fs}=await firebase();
  stopSnap?.();stopSnap=null;
  const id=DOC_PREFIX+name.toLowerCase();
  ref=fs.doc(db,COLLECTION,id);
  const snap=await fs.getDoc(ref);
  docExists=snap.exists();
  const moved=docExists?movedTo(snap.data()):null;
  if(moved&&silent&&moved.id!==id){                                  // este dispositivo tenía el ID viejo: sigue al nuevo
    store.set(KEY_NICK,moved.nick);return connect(moved.nick,{silent:true});
  }
  const remote=docExists&&!moved?readRemote(snap.data()):null;       // un ID que quedó libre se usa como nuevo
  const d=remote?snap.data():null;
  if(mode==='enter'&&!remote){ref=null;setCloud(nick?'error':'off');throw new Error(`No existe el ID «${name}». Si es la primera vez, toca Crear.`);}
  if(mode==='create'&&remote){ref=null;setCloud(nick?'error':'off');throw new Error(`El ID «${name}» ya existe. Si es tuyo, toca Entrar; si no, elige otro.`);}
  const firstTimeHere=store.get(KEY_SYNCED)!==id;
  await tagOwners((store.get(KEY_SYNCED)||'').slice(DOC_PREFIX.length));
  /* Primera vez con este ID en este dispositivo y hay cosas en los dos lados: la persona elige */
  let choice='';
  if(remote&&firstTimeHere&&!silent){
    const mine={favs:favs.length,pdfs:(await localLib()).filter(e=>e.local).length};
    const theirs={favs:remote.list.length,pdfs:remoteBooks(d).length};
    if((mine.favs||mine.pdfs)&&(theirs.favs||theirs.pdfs)){
      choice=await askChoice(name,mine,theirs);
      if(!choice){ref=null;setCloud(nick?'ok':'off');if(nick)reconnect();throw Object.assign(new Error(''),{cancelled:true});}
    }else choice=(mine.favs||mine.pdfs)?'device':'cloud';
  }
  nick=name;store.set(KEY_NICK,nick);books=null;
  if(choice==='cloud'){                                              // se usa lo del ID: lo de aquí se reemplaza
    favs=remote.list;store.set(KEY_AT,String(remote.at||Date.now()));saveLocal();
    SYNCED.forEach(k=>store.del(k.at));
    await clearLocalLib();
  }else if(choice==='device'){                                       // se usa lo de aquí: reemplaza lo del ID
    store.set(KEY_AT,String(Date.now()));
    SYNCED.forEach(k=>{if(store.get(k.key))store.set(k.at,String(Date.now()));});
  }
  if(remote)readExtras(d,{skipBooks:choice==='device'});
  if(choice==='device'){books=[];await forgetCloudIds();}
  const needConv=convOn()&&!(remote&&d.l1?.storage?.[KEY_CONV]==='1');
  const needSynced=SYNCED.some(k=>localAtOf(k)>remoteAtOf(d,k));
  if(!remote||choice==='device')await upload();                       // ID nuevo, o lo de aquí reemplaza al ID
  else if(choice==='cloud'){}
  else if(remote.at>=localAt())applyRemote(remote);                  // la nube es más reciente
  else await upload();                                               // este dispositivo es más reciente
  if(remote&&choice!=='device'&&(needConv||needSynced))await upload();
  store.set(KEY_SYNCED,id);
  if(!remote||choice==='device'){books=books||[];document.dispatchEvent(new CustomEvent('circulos:cloud-books',{detail:books}));}
  listen();
  setCloud('ok');
  pushLocalBooks();                                                   // los PDF que solo están aquí suben al ID
  if(!silent)toast(remote?`¡Hola, ${nick}! Todo quedó sincronizado.`:`Listo, creaste el ID «${nick}». Todo lo de este dispositivo quedó guardado en él.`);
}

/* ───────── Mis partituras guardadas en este dispositivo (misma base que tablatura.js) ───────── */
const LIBDB={
  open(){return new Promise((ok,no)=>{const r=indexedDB.open('circulos-tablatura',1);r.onupgradeneeded=()=>r.result.createObjectStore('books');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});},
  async get(k){try{const db=await this.open();return await new Promise(ok=>{const q=db.transaction('books').objectStore('books').get(k);q.onsuccess=()=>ok(q.result??null);q.onerror=()=>ok(null);});}catch(e){return null;}},
  async set(k,v){try{const db=await this.open();await new Promise(ok=>{const t=db.transaction('books','readwrite');t.objectStore('books').put(v,k);t.oncomplete=ok;t.onerror=ok;});}catch(e){}},
  async del(k){try{const db=await this.open();await new Promise(ok=>{const t=db.transaction('books','readwrite');t.objectStore('books').delete(k);t.oncomplete=ok;t.onerror=ok;});}catch(e){}}
};
async function localLib(){
  let idx=await LIBDB.get('index');
  if(!Array.isArray(idx)){                                          // aún con el formato anterior (un solo PDF)
    const last=await LIBDB.get('last');idx=[];
    if(last&&last.songs&&last.songs.length){const id=Date.now().toString(36)+'m';idx.push({id,name:last.name,songs:last.songs.length,size:last.size||0,added:Date.now(),local:true});await LIBDB.set('book:'+id,last);await LIBDB.set('current',id);}
    await LIBDB.set('index',idx);await LIBDB.del('last');
  }
  return idx;
}
const libReset=()=>document.dispatchEvent(new CustomEvent('circulos:lib-reset'));
const ownedHere=e=>!!e.cloudId&&e.owner===nick.toLowerCase();
async function tagOwners(prev){                                    // PDF subidos antes de guardar a qué ID pertenecen
  if(!prev)return;
  const idx=await localLib();let n=0;
  idx.forEach(e=>{if(e.cloudId&&!e.owner){e.owner=prev;n++;}});
  if(n){await LIBDB.set('index',idx);libReset();}
}
async function clearLocalLib(){
  const idx=await localLib();
  for(const e of idx)await LIBDB.del('book:'+e.id);
  await LIBDB.set('index',[]);await LIBDB.del('current');libReset();
}
async function forgetCloudIds(){                                   // lo de aquí se subirá de nuevo a este ID
  const idx=await localLib();
  idx.forEach(e=>{delete e.cloudId;delete e.parts;delete e.seen;delete e.owner;});
  await LIBDB.set('index',idx.filter(e=>e.local));libReset();
}
const inflight=new Set();
/* Sube un PDF de Mis partituras al ID (si aún no está en él) y lo marca en la lista del dispositivo */
async function uploadEntry(entryId){
  if(!nick||inflight.has(entryId))return null;
  const e=(await localLib()).find(x=>x.id===entryId);
  if(!e||!e.local||ownedHere(e))return null;
  inflight.add(entryId);
  try{
    const b=await LIBDB.get('book:'+entryId);if(!b)return null;
    const m=await saveBook(b,{title:e.title});if(!m)return null;
    const idx=await localLib(),x=idx.find(y=>y.id===entryId);
    if(x){x.cloudId=m.id;x.parts=m.parts;x.seen=true;x.owner=nick.toLowerCase();await LIBDB.set('index',idx);}
    return {...m,owner:nick.toLowerCase()};
  }finally{inflight.delete(entryId);}
}
async function pushLocalBooks(){
  if(!nick)return;
  let n=0;
  try{for(const e of await localLib())if(e.local&&!ownedHere(e)&&await uploadEntry(e.id))n++;}
  catch(err){console.error('Favoritos:',err);}
  if(n){libReset();}
}
function remoteBooks(d){
  const st=d&&d.l1&&d.l1.storage;if(!st)return [];
  try{if(typeof st[KEY_BOOKS]==='string')return st[KEY_BOOKS]?JSON.parse(st[KEY_BOOKS]):[];if(st[KEY_BOOK])return [JSON.parse(st[KEY_BOOK])];}catch(e){}
  return [];
}
/* Ventana: ¿lo de tu ID o lo de este dispositivo? (con confirmación si se reemplaza lo del ID) */
const ICON_CLOUD2='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.2a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 9.5 4.5 4.5 0 0 0 7 18.5Z"/></svg>';
const ICON_PHONE='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.5h3"/></svg>';
const ICON_WARN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5M12 17.2v.1"/></svg>';
const countTxt=c=>[c.favs?`${c.favs} ${c.favs===1?'acorde':'acordes'}`:'',c.pdfs?`${c.pdfs} PDF`:''].filter(Boolean).join(' · ')||'Vacío';
function askChoice(name,mine,theirs){
  return new Promise(done=>{
    const el=document.createElement('div');el.className='app-sheet id-choice';
    const step1=`<div class="idc-box"><h2>¿Qué quieres usar?</h2></div>
      <button class="idc-opt" type="button" data-pick="cloud"><span class="idc-ic is-cloud">${ICON_CLOUD2}</span><span class="idc-txt"><strong>Lo de tu ID «${escapeHtml(name)}»</strong><small>${countTxt(theirs)}</small></span></button>
      <button class="idc-opt" type="button" data-pick="device"><span class="idc-ic">${ICON_PHONE}</span><span class="idc-txt"><strong>Lo de este dispositivo</strong><small>${countTxt(mine)}</small></span></button>
      <button class="idc-cancel" type="button" data-pick="">Cancelar</button>`;
    const step2=`<div class="idc-box"><span class="idc-warn">${ICON_WARN}</span><h2>¿Reemplazar lo de tu ID?</h2><p>Se borra lo que tenía «${escapeHtml(name)}».</p></div>
      <button class="idc-danger" type="button" data-pick="device!">Reemplazar</button>
      <button class="idc-cancel" type="button" data-back>Volver</button>`;
    el.innerHTML=`<div class="app-sheet-backdrop"></div><section class="app-sheet-card idc-card" role="dialog" aria-modal="true">${step1}</section>`;
    document.body.appendChild(el);
    const card=el.querySelector('.idc-card');
    const finish=v=>{el.classList.remove('open');setTimeout(()=>el.remove(),300);done(v);};
    el.addEventListener('click',ev=>{
      if(ev.target.closest('[data-back]')){card.innerHTML=step1;return;}
      const b=ev.target.closest('[data-pick]');if(!b)return;
      const v=b.dataset.pick;
      if(v==='device'){card.innerHTML=step2;return;}
      finish(v==='device!'?'device':v);
    });
    requestAnimationFrame(()=>el.classList.add('open'));
  });
}
function listen(){
  if(!ref||!fb)return;
  stopSnap?.();
  stopSnap=fb.fs.onSnapshot(ref,{includeMetadataChanges:false},s=>{
    if(!s.exists())return;
    docExists=true;
    const d=s.data();
    const moved=movedTo(d);
    if(moved){
      if(d.updatedBy!==clientId){stopSnap?.();stopSnap=null;ref=null;toast(`Tu ID cambió a «${moved.nick}» en otro dispositivo`);nick=moved.nick;store.set(KEY_NICK,nick);reconnect();}
      return;
    }
    readExtras(d);
    if(d.updatedBy===clientId&&Date.now()-lastUpload<4000){setCloud('ok');return;}
    const r=readRemote(d);
    if(r&&r.at>=localAt()){if(applyRemote(r))toast('Favoritos actualizados desde otro dispositivo');}
    else if(r){upload().catch(()=>{});}                            // llegó una versión más vieja que la de aquí: gana la más reciente
    setCloud('ok');
  },err=>{console.error('Favoritos:',err);setCloud('error',errorText(err));});
}
/* Igual que el ajedrez: al crear el perfil se escribe el documento completo (l1 y l2) y después solo se
   actualiza l1. Si Firebase rechaza la actualización parcial, se intenta una vez con el documento completo. */
let docExists=false;
async function upload(){
  if(!ref||!fb)return;
  lastUpload=Date.now();
  const at=localAt()||Date.now(),{fs}=fb;
  const storage={[KEY_FAVS]:JSON.stringify(favs),[KEY_AT]:String(at)};
  if(convOn())storage[KEY_CONV]='1';
  if(books){storage[KEY_BOOKS]=JSON.stringify(books);storage[KEY_BOOK]='';}
  for(const k of SYNCED)if(localAtOf(k)){storage[k.key]=store.get(k.key)||'{}';storage[k.at]=String(localAtOf(k));}
  const l1={storage,page:{}};
  const meta={timestamp:fs.serverTimestamp(),updatedBy:clientId,schemaVersion:1};
  const full=()=>fs.setDoc(ref,{l1,l2:{storage:{},page:{}},...meta});
  if(!docExists){await full();docExists=true;return;}
  try{await fs.setDoc(ref,{l1,...meta},{merge:true});}
  catch(err){if(String(err&&err.code).includes('permission-denied')){await full();return;}throw err;}
}
/* ───────── Cancionero del Convertidor en la nube ───────── */
const b64=buf=>{let s='';const a=new Uint8Array(buf);for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(s);};
const unb64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
async function gzip(text){return b64(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());}
async function gunzip(t){return await new Response(new Blob([unb64(t)]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}
async function ready(){
  if(!nick)throw new Error('Sin ID');
  if(connecting)await connecting;
  if(!ref||!fb)await connect(nick,{silent:true});
  return fb;
}
async function saveBook(book,{title=''}={}){
  if(!nick||typeof CompressionStream==='undefined')return null;
  const {db,fs}=await ready();
  const data=await gzip(JSON.stringify({name:book.name,size:book.size,songs:book.songs}));
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2,8),parts=Math.max(1,Math.ceil(data.length/PART));
  const meta={timestamp:fs.serverTimestamp(),updatedBy:clientId,schemaVersion:1};
  for(let i=0;i<parts;i++)await fs.setDoc(fs.doc(db,COLLECTION,`${BOOK_PREFIX}${id}-${i}`),{l1:{storage:{part:data.slice(i*PART,(i+1)*PART),i:String(i),of:String(parts)},page:{}},l2:{storage:{},page:{}},...meta});
  const m={id,parts,name:book.name,songs:book.songs.length,at:Date.now(),...(title?{title}:{})};
  books=[m,...(books||[]).filter(x=>x.id!==id)];
  lastUpload=Date.now();await upload();
  return m;
}
async function renameBook(id,title){
  if(!nick||!books)return;
  await ready();
  books=books.map(m=>{if(m.id!==id)return m;const n={...m};if(title)n.title=title;else delete n.title;return n;});
  lastUpload=Date.now();await upload();
}
async function removeBook(id){
  if(!nick||!books)return;
  await ready();
  books=books.filter(m=>m.id!==id);
  lastUpload=Date.now();await upload();
}
async function loadBook(m){
  if(!m||typeof DecompressionStream==='undefined')return null;
  const {db,fs}=await ready();
  let data='';
  for(let i=0;i<m.parts;i++){const snap=await fs.getDoc(fs.doc(db,COLLECTION,`${BOOK_PREFIX}${m.id}-${i}`));if(!snap.exists())return null;data+=snap.data().l1.storage.part;}
  const book=JSON.parse(await gunzip(data));book.cloudId=m.id;
  return book;
}
/* La contraseña del Convertidor se escribió en este dispositivo: si hay ID, queda guardada en él */
document.addEventListener('circulos:conv-ok',()=>{
  if(!nick)return;
  store.set(KEY_CONV_ID,nick.toLowerCase());
  if(ref)upload().catch(err=>console.error('Favoritos:',err));else reconnect();
});

/* Cambios del Convertidor (velocidades): se suben un momento después, sin tocar la hora de los favoritos */
let extrasTimer=0;
function syncSoon(){
  if(!nick)return;
  clearTimeout(extrasTimer);
  extrasTimer=setTimeout(()=>{if(!ref){reconnect();return;}upload().then(()=>setCloud('ok')).catch(err=>{console.error('Favoritos:',err);setCloud('error',errorText(err));});},700);
}
function scheduleUpload(){
  store.set(KEY_AT,String(Date.now()));                              // hora de este cambio
  if(!nick)return;
  clearTimeout(uploadTimer);
  uploadTimer=setTimeout(()=>{
    if(!ref){reconnect();return;}
    setCloud('busy','Guardando…');
    upload().then(()=>setCloud('ok')).catch(err=>{console.error('Favoritos:',err);setCloud('error',errorText(err));});
  },500);
}
/* Si no había conexión al abrir la página, vuelve a intentarlo cuando regresa internet o la página */
function reconnect(){
  if(!nick||connecting||(ref&&cloud.state==='ok'))return;
  connecting=connect(nick,{silent:true}).catch(err=>{console.error('Favoritos:',err);setCloud('error',errorText(err));}).finally(()=>{connecting=null;});
}
addEventListener('online',reconnect);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconnect();});
/* Cambiar el ID: los favoritos pasan al ID nuevo y el viejo queda libre.
   Los demás dispositivos que tenían el ID viejo se cambian solos al nuevo. */
async function rename(oldName,newName){
  oldName=String(oldName||'').trim();newName=String(newName||'').trim();
  if(!NICK_RE.test(oldName)||!NICK_RE.test(newName))throw new Error('Usa solo letras y números, de 4 a 24 caracteres.');
  const oldId=DOC_PREFIX+oldName.toLowerCase(),newId=DOC_PREFIX+newName.toLowerCase();
  if(oldId===newId){                                                   // solo cambian mayúsculas o minúsculas
    if(nick&&DOC_PREFIX+nick.toLowerCase()===oldId){nick=newName;store.set(KEY_NICK,nick);refreshSheet();return;}
  }
  setCloud(nick?'busy':'off','Cambiando el ID…');
  const {db,fs}=await firebase();
  const oldRef=fs.doc(db,COLLECTION,oldId),newRef=fs.doc(db,COLLECTION,newId);
  await fs.runTransaction(db,async tx=>{
    const o=await tx.get(oldRef);
    if(!o.exists()||movedTo(o.data())||!readRemote(o.data()))throw new Error(`No existe el ID «${oldName}». Revisa cómo lo escribiste.`);
    const n=await tx.get(newRef);
    if(n.exists()&&!movedTo(n.data()))throw new Error(`El ID «${newName}» ya lo usa alguien. Elige otro.`);
    const d=o.data(),meta={timestamp:fs.serverTimestamp(),updatedBy:clientId,schemaVersion:1};
    tx.set(newRef,{l1:d.l1,l2:d.l2||{storage:{},page:{}},...meta});
    tx.set(oldRef,{l1:{storage:{[KEY_MOVED]:newId,[KEY_MOVED_NICK]:newName},page:{}},l2:{storage:{},page:{}},...meta});
  });
  const wasHere=nick&&DOC_PREFIX+nick.toLowerCase()===oldId;
  stopSnap?.();stopSnap=null;ref=null;
  if(wasHere)store.set(KEY_SYNCED,newId);                            // mismos favoritos: no hace falta juntarlos
  await connect(newName,{silent:true});
  toast(`Listo, ahora tu ID es «${newName}»`);
}
function signOut(){
  stopSnap?.();stopSnap=null;ref=null;nick='';store.del(KEY_NICK);store.del(KEY_SYNCED);store.del(KEY_CONV_ID);books=null;setCloud('off');
  toast('Saliste. Tus acordes siguen en este dispositivo.');
}

/* ───────── Corazones ─────────
   Cualquier botón con data-fav-key guarda o quita ese acorde o variación (las tarjetas los traen ya dibujados). */
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-fav-key]');if(!b||!b.dataset.favKey)return;
  toggleKey(b.dataset.favKey);b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');
});
function markHearts(root=document){
  root.querySelectorAll('[data-fav-key]').forEach(b=>{const on=!!b.dataset.favKey&&has(b.dataset.favKey);
    if(b.classList.contains('is-on')!==on){b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));b.title=on?'Quitar de Favoritos':'Guardar en Favoritos';}});
}
let markQueued=false;
new MutationObserver(()=>{if(markQueued)return;markQueued=true;requestAnimationFrame(()=>{markQueued=false;markHearts();markCards();});}).observe(document.documentElement,{childList:true,subtree:true});

const HEART='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2s-7.4-4.5-9.1-9.2C1.8 7.8 3.9 4.6 7.2 4.6c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.4 3.2 4.3 6.4-1.7 4.7-9.1 9.2-9.1 9.2Z"/></svg>';
/* Círculos: corazón del acorde elegido en la rueda y acciones de la inversión de piano */
const circleHead=document.getElementById('chordActions');
if(circleHead){
  const heart=document.createElement('button');heart.type='button';heart.className='act-btn act-fav';heart.innerHTML=HEART;
  heart.setAttribute('aria-label','Guardar este acorde en Favoritos');circleHead.prepend(heart);
  const pianoBox=document.getElementById('pianoActions');
  const refresh=()=>{
    const c=window.circulosChord,entry=c&&lib()?.findTriad(c.rootPc,c.quality);
    const piano=document.querySelector('#instrumento [data-instrument].active')?.dataset.instrument==='piano';
    heart.dataset.favKey=entry?(piano?`${entry.id}:p`:entry.id):'';heart.disabled=!entry;
    if(pianoBox){
      const inv=document.querySelector('#pianoPanel [data-inversion].active')?.dataset.inversion||'0';
      pianoBox.innerHTML=entry?lib().actionsHtml(`${entry.id}:p${inv}`,{small:true,what:'esta inversión'}):'';
    }
    markHearts();
  };
  document.addEventListener('circulos:chord',()=>lib()?.load().then(refresh).catch(()=>{}));
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-inversion],[data-instrument]'))setTimeout(refresh,0);});
  lib()?.load().then(refresh).catch(()=>{});
}

/* Marca ♥ en las tarjetas de la biblioteca (si se guardó el acorde o alguna de sus variaciones) */
function markCards(root=document){root.querySelectorAll('.chord-catalog-card[data-chord-id]').forEach(c=>c.classList.toggle('is-fav',c.dataset.var?has(c.dataset.chordId+':'+c.dataset.var):hasAny(c.dataset.chordId)));}
const grid=document.getElementById('chordCatalogGrid');

/* ───────── Página "Favoritos" (favoritos.html) ─────────
   En las demás páginas, «Favoritos» del menú lleva a esta página. */
const pageEl=document.getElementById('favView')||document.getElementById('idView');   // Favoritos o Mi ID
let sheet=null,favTab='guitar';
const instOf=f=>f.k&&f.k[0]==='p'?'piano':'guitar';
function bindFav(root){
  root.addEventListener('click',e=>{
    const card=e.target.closest('[data-chord-id]');if(card)lib()?.openDetail(card.dataset.chordId,{inst:card.dataset.inst,...(card.dataset.var?{focus:card.dataset.var}:{})});
  });
  root.addEventListener('submit',async e=>{
    if(!e.target.closest('#favAccount'))return;
    e.preventDefault();const input=root.querySelector('#favNick'),msg=root.querySelector('.fav-error');
    const mode=(e.submitter&&e.submitter.dataset.mode)||'enter';
    try{msg.textContent='';await connect(input.value,{mode});}catch(err){if(err.cancelled){msg.textContent='';return;}console.error('Favoritos:',err);msg.textContent=err.code?errorText(err):(err.message||'No se pudo conectar. Revisa tu internet.');if(nick)setCloud('error',errorText(err));else setCloud('off');}
  });
  root.addEventListener('click',e=>{if(e.target.closest('[data-signout]'))signOut();if(e.target.closest('[data-rename]'))openRename();});
  root.addEventListener('click',e=>{const t=e.target.closest('[data-fav-tab]');if(t){favTab=t.dataset.favTab;refreshSheet();}});
}
function openSheet(){if(!pageEl){location.href='favoritos.html';return;}pageEl.scrollIntoView({behavior:'smooth'});}
const ICON_IN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l4-4-4-4M14 12H4"/></svg>';
const ICON_NEW='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_EDIT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>';
const ICON_OUT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 16l4-4-4-4M19 12H9"/></svg>';
/* Ventana para cambiar el ID: ID actual y ID nuevo */
let renameSheet=null;
function openRename(){
  if(!renameSheet){
    renameSheet=document.createElement('div');renameSheet.className='app-sheet nick-sheet';renameSheet.id='nickSheet';
    renameSheet.innerHTML=`<div class="app-sheet-backdrop" data-close></div>
      <section class="app-sheet-card" role="dialog" aria-modal="true" aria-labelledby="nickTitle">
        <button class="app-sheet-close" type="button" data-close aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <h2 id="nickTitle">Cambiar ID</h2>
        <form class="fav-form nick-form" autocomplete="off">
          <label for="nickOld">ID actual</label>
          <input id="nickOld" maxlength="24" autocapitalize="off" spellcheck="false" placeholder="Tu ID de ahora">
          <label for="nickNew">ID nuevo</label>
          <input id="nickNew" maxlength="24" autocapitalize="off" spellcheck="false" placeholder="El que quieres usar">
          <p class="fav-hint">Solo letras y números, de 4 a 24. Tus acordes pasan al ID nuevo en todos tus dispositivos.</p>
          <p class="fav-error" role="alert"></p>
          <button type="submit" class="nick-save">Cambiar ID</button>
        </form>
      </section>`;
    document.body.appendChild(renameSheet);
    renameSheet.addEventListener('click',e=>{if(e.target.closest('[data-close]'))renameSheet.classList.remove('open');});
    renameSheet.addEventListener('submit',async e=>{
      e.preventDefault();const msg=renameSheet.querySelector('.fav-error'),btn=renameSheet.querySelector('.nick-save');
      msg.textContent='';btn.disabled=true;btn.textContent='Cambiando…';
      try{await rename(renameSheet.querySelector('#nickOld').value,renameSheet.querySelector('#nickNew').value);renameSheet.classList.remove('open');}
      catch(err){console.error('Favoritos:',err);msg.textContent=err.code?errorText(err):(err.message||'No se pudo cambiar el ID.');if(nick)setCloud(ref?'ok':'error');else setCloud('off');}
      finally{btn.disabled=false;btn.textContent='Cambiar ID';}
    });
  }
  renameSheet.querySelector('#nickOld').value=nick||sheet?.querySelector('#favNick')?.value.trim()||'';renameSheet.querySelector('#nickNew').value='';renameSheet.querySelector('.fav-error').textContent='';
  requestAnimationFrame(()=>{renameSheet.classList.add('open');setTimeout(()=>renameSheet.querySelector(nick?'#nickNew':'#nickOld').focus(),250);});
}
function refreshSheet(){
  if(!sheet)return;
  refreshSummary();
  const acc=sheet.querySelector('#favAccount');
  if(!acc){}
  else if(nick){
    const label={ok:'Sincronizado · se actualiza solo en tus dispositivos',busy:cloud.text||'Conectando…',error:cloud.text||'Sin conexión: guardado en este dispositivo',off:''}[cloud.state];
    acc.innerHTML=`<div class="fav-user"><span class="fav-dot is-${cloud.state}"></span><div><small class="fav-id-label">Tu ID</small><strong>${escapeHtml(nick)}</strong><small>${label}</small></div></div>
      <div class="fav-actions fav-actions-2"><button type="button" class="fav-btn" data-rename>${ICON_EDIT}Cambiar ID</button><button type="button" class="fav-btn" data-signout>${ICON_OUT}Salir</button></div>`;
  }else if(!acc.querySelector('form')){
    acc.innerHTML=`<form class="fav-form" autocomplete="off"><label for="favNick">Escribe tu ID para ver tus acordes en cualquier dispositivo. ¿Primera vez? Toca <b>Crear</b>.</label>
      <input class="fav-id-input" id="favNick" maxlength="24" placeholder="Tu ID" autocapitalize="off" spellcheck="false" inputmode="text">
      <div class="fav-actions"><button type="submit" class="fav-btn" data-mode="enter">${ICON_IN}Entrar</button><button type="submit" class="fav-btn" data-mode="create">${ICON_NEW}Crear</button><button type="button" class="fav-btn" data-rename>${ICON_EDIT}Cambiar ID</button></div>
      <p class="fav-error" role="alert"></p></form>`;
  }
  const g=sheet.querySelector('#favGrid'),L=lib();
  if(!g)return;
  sheet.querySelectorAll('[data-fav-tab]').forEach(b=>{const on=b.dataset.favTab===favTab,n=favs.filter(f=>instOf(f)===b.dataset.favTab).length;
    b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.querySelector('.fav-count').textContent=n?`(${n})`:'';});
  const list=favs.filter(f=>instOf(f)===favTab);
  if(!list.length){g.innerHTML=`<div class="chord-empty"><strong>Aún no tienes acordes de ${favTab==='piano'?'piano':'guitarra'}</strong><span>Toca ♡ en un acorde, o en una sola ${favTab==='piano'?'forma de piano':'posición'}, para guardarlo aquí.</span></div>`;return;}
  // Cada guardado se muestra en el instrumento en que se guardó: acorde completo en guitarra (sin k) o en piano (k = "p")
  g.innerHTML=list.map(f=>{const e=L?.byId(f.id);if(!e)return '';return !f.k?L.cardHtml(e,'guitar',{label:'Guitarra · todas'}):f.k==='p'?L.cardHtml(e,'piano',{label:'Piano · todas'}):L.variantCardHtml(e,f.k);}).join('')||'<div class="chord-empty"><strong>Cargando…</strong></div>';
  markCards(g);
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function refreshAll(){markHearts();markCards();refreshSheet();refreshIdItem();}
/* Mi ID: lo que se muestra (favoritos y partituras); las velocidades viajan igual, pero no se muestran */
let sumTimer=0;
function refreshSummary(){
  const box=sheet&&sheet.querySelector('#idSummary');if(!box)return;
  clearTimeout(sumTimer);
  sumTimer=setTimeout(async()=>{
    const pdfs=(await localLib()).length;
    const row=(ic,t,n,href)=>`<a class="ids-row" href="${href}"><span class="ids-ic">${ic}</span><span class="ids-t">${t}</span><span class="ids-n">${n}</span><svg class="ids-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>`;
    box.innerHTML=`<p class="ids-head">${nick?`Se sincroniza con «${escapeHtml(nick)}»`:'Guardado solo en este dispositivo'}</p>
      <div class="ids-list">${row(ICON_FAV,'Favoritos',favs.length,'favoritos.html')}${row('<img src="icon-partitura.webp" alt="">','Mis partituras',pdfs,'tablatura.html')}</div>`;
  },30);
}

const ICON_FAV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5s-6.8-4.1-8.4-8.4C2.6 8.2 4.5 5.3 7.5 5.3c1.8 0 3.3 1 4.5 2.6 1.2-1.6 2.7-2.6 4.5-2.6 3 0 4.9 2.9 3.9 5.8-1.6 4.3-8.4 8.4-8.4 8.4Z"/></svg>';
/* «Mi ID» arriba de todo en el menú */
const ICON_ID='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M6.2 18.4c1.3-2.3 3.4-3.5 5.8-3.5s4.5 1.2 5.8 3.5"/></svg>';
const onIdPage=!!document.getElementById('idView');
(()=>{const picker=document.querySelector('.app-picker');if(!picker||document.getElementById('idMenuItem'))return;
  const a=document.createElement('a');a.id='idMenuItem';a.href='mi-id.html';a.className='app-choice app-extra'+(onIdPage?' active':'');
  if(onIdPage)a.setAttribute('aria-current','page');
  a.innerHTML=`<span class="app-choice-icon">${ICON_ID}</span><strong>Mi ID</strong><small></small>`;
  picker.appendChild(a);})();
function refreshIdItem(){const sm=document.querySelector('#idMenuItem small');if(sm)sm.textContent=nick?`Tu ID: ${nick}`:'Crea tu ID y sincroniza tus dispositivos.';}
refreshIdItem();

/* «Favoritos» en el menú: un enlace a su página, igual que Círculos y Acordes */
(()=>{const picker=document.querySelector('.app-picker');if(!picker||document.getElementById('favMenuItem'))return;
  const a=document.createElement('a');a.id='favMenuItem';a.href='favoritos.html';a.className='app-choice app-extra'+(document.getElementById('favView')?' active':'');
  if(document.getElementById('favView'))a.setAttribute('aria-current','page');
  a.innerHTML=`<span class="app-choice-icon">${ICON_FAV}</span><strong>Favoritos</strong><small>Tus acordes guardados, en todos tus dispositivos.</small>`;
  picker.appendChild(a);})();
window.CirculosFavs={open:openSheet,has,toggle,toggleKey,isOpen:()=>!!pageEl,get nick(){return nick;},get count(){return favs.length;},saveBook,loadBook,removeBook,renameBook,syncSoon,uploadEntry,pushLocalBooks,get books(){return books;}};

/* En la página de Favoritos: dibuja la cuenta, las pestañas y los acordes guardados */
if(pageEl){
  sheet=pageEl;bindFav(pageEl);refreshSheet();
  lib()?.load().then(refreshSheet).catch(()=>{});
}

/* Si ya tenía nick, se reconecta solo */
if(nick)reconnect();
