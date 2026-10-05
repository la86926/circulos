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
function setCloud(state,text=''){cloud={state,text};refreshSheet();}
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
async function connect(name,{silent=false}={}){
  name=String(name||'').trim();
  if(!NICK_RE.test(name))throw new Error('Usa solo letras y números, de 4 a 24 caracteres.');
  setCloud('busy','Conectando…');
  const {db,fs}=await firebase();
  stopSnap?.();stopSnap=null;
  const id=DOC_PREFIX+name.toLowerCase();
  ref=fs.doc(db,COLLECTION,id);
  const snap=await fs.getDoc(ref);
  docExists=snap.exists();
  const remote=docExists?readRemote(snap.data()):null;
  const firstTimeHere=store.get(KEY_SYNCED)!==id;
  nick=name;store.set(KEY_NICK,nick);
  if(!remote){await upload();}                                       // nick nuevo: sube lo de este dispositivo
  else if(firstTimeHere){                                            // primera vez en este dispositivo: se juntan ambos
    const joined=merge(remote.list,favs),changed=joined.length!==remote.list.length;
    favs=joined;store.set(KEY_AT,String(changed?Date.now():remote.at));saveLocal();
    if(changed)await upload();
  }
  else if(remote.at>=localAt())applyRemote(remote);                  // la nube es más reciente
  else await upload();                                               // este dispositivo es más reciente
  store.set(KEY_SYNCED,id);
  listen();
  setCloud('ok');
  if(!silent)toast(remote?`¡Hola, ${nick}! Tus acordes ya están aquí.`:`Listo, ${nick}. Tus acordes se guardan en la nube.`);
}
function listen(){
  if(!ref||!fb)return;
  stopSnap?.();
  stopSnap=fb.fs.onSnapshot(ref,{includeMetadataChanges:false},s=>{
    if(!s.exists())return;
    docExists=true;
    const d=s.data();
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
  const l1={storage:{[KEY_FAVS]:JSON.stringify(favs),[KEY_AT]:String(at)},page:{}};
  const meta={timestamp:fs.serverTimestamp(),updatedBy:clientId,schemaVersion:1};
  const full=()=>fs.setDoc(ref,{l1,l2:{storage:{},page:{}},...meta});
  if(!docExists){await full();docExists=true;return;}
  try{await fs.setDoc(ref,{l1,...meta},{merge:true});}
  catch(err){if(String(err&&err.code).includes('permission-denied')){await full();return;}throw err;}
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
function signOut(){
  stopSnap?.();stopSnap=null;ref=null;nick='';store.del(KEY_NICK);store.del(KEY_SYNCED);setCloud('off');
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

/* ───────── Hoja "Favoritos" ───────── */
let sheet=null,favTab='guitar';
const instOf=f=>f.k&&f.k[0]==='p'?'piano':'guitar';
function openSheet(){
  if(!sheet){
    sheet=document.createElement('div');sheet.className='app-sheet';sheet.id='favSheet';
    sheet.innerHTML=`<div class="app-sheet-backdrop" data-close></div>
      <section class="app-sheet-card fav-card" role="dialog" aria-modal="true" aria-labelledby="favTitle">
        <button class="app-sheet-close" type="button" data-close aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <h2 id="favTitle">Favoritos</h2>
        <div class="fav-account" id="favAccount"></div>
        <div class="segmented seg2 fav-tabs" id="favTabs" role="tablist" aria-label="Instrumento">
          <button class="seg-btn active" type="button" role="tab" data-fav-tab="guitar" aria-selected="true">Guitarra <span class="fav-count"></span></button>
          <button class="seg-btn" type="button" role="tab" data-fav-tab="piano" aria-selected="false">Piano <span class="fav-count"></span></button>
        </div>
        <div class="chord-catalog-grid fav-grid" id="favGrid"></div>
      </section>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click',e=>{
      if(e.target.closest('[data-close]')){sheet.classList.remove('open');document.dispatchEvent(new CustomEvent('circulos:favsheet',{detail:false}));return;}
      const card=e.target.closest('[data-chord-id]');if(card)lib()?.openDetail(card.dataset.chordId,{inst:card.dataset.inst,...(card.dataset.var?{focus:card.dataset.var}:{})});
    });
    sheet.addEventListener('submit',async e=>{
      e.preventDefault();const input=sheet.querySelector('#favNick'),msg=sheet.querySelector('.fav-error');
      try{msg.textContent='';await connect(input.value);}catch(err){console.error('Favoritos:',err);msg.textContent=err.code?errorText(err):(err.message||'No se pudo conectar. Revisa tu internet.');if(nick)setCloud('error',errorText(err));else setCloud('off');}
    });
    sheet.addEventListener('click',e=>{if(e.target.closest('[data-signout]'))signOut();});
    sheet.addEventListener('click',e=>{const t=e.target.closest('[data-fav-tab]');if(t){favTab=t.dataset.favTab;refreshSheet();}});
  }
  favTab='guitar';                                   // siempre abre en Guitarra
  refreshSheet();
  lib()?.load().then(refreshSheet).catch(()=>{});
  requestAnimationFrame(()=>{sheet.classList.add('open');document.dispatchEvent(new CustomEvent('circulos:favsheet',{detail:true}));});
}
function refreshSheet(){
  if(!sheet)return;
  const acc=sheet.querySelector('#favAccount');
  if(nick){
    const label={ok:'Sincronizado · se actualiza solo en tus dispositivos',busy:cloud.text||'Conectando…',error:cloud.text||'Sin conexión: guardado en este dispositivo',off:''}[cloud.state];
    acc.innerHTML=`<div class="fav-user"><span class="fav-dot is-${cloud.state}"></span><div><strong>${escapeHtml(nick)}</strong><small>${label}</small></div><button type="button" class="fav-link" data-signout>Salir</button></div>`;
  }else if(!acc.querySelector('form')){
    acc.innerHTML=`<form class="fav-form" autocomplete="off"><label for="favNick">Crea o escribe tu nick para tener tus acordes en cualquier dispositivo.</label>
      <div class="fav-row"><input id="favNick" maxlength="24" placeholder="Tu nick" autocapitalize="off" spellcheck="false" inputmode="text"><button type="submit">Entrar</button></div><p class="fav-error" role="alert"></p></form>`;
  }
  const g=sheet.querySelector('#favGrid'),L=lib();
  sheet.querySelectorAll('[data-fav-tab]').forEach(b=>{const on=b.dataset.favTab===favTab,n=favs.filter(f=>instOf(f)===b.dataset.favTab).length;
    b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.querySelector('.fav-count').textContent=n?`(${n})`:'';});
  const list=favs.filter(f=>instOf(f)===favTab);
  if(!list.length){g.innerHTML=`<div class="chord-empty"><strong>Aún no tienes acordes de ${favTab==='piano'?'piano':'guitarra'}</strong><span>Toca ♡ en un acorde, o en una sola ${favTab==='piano'?'forma de piano':'posición'}, para guardarlo aquí.</span></div>`;return;}
  // Cada guardado se muestra en el instrumento en que se guardó: acorde completo en guitarra (sin k) o en piano (k = "p")
  g.innerHTML=list.map(f=>{const e=L?.byId(f.id);if(!e)return '';return !f.k?L.cardHtml(e,'guitar',{label:'Guitarra · todas'}):f.k==='p'?L.cardHtml(e,'piano',{label:'Piano · todas'}):L.variantCardHtml(e,f.k);}).join('')||'<div class="chord-empty"><strong>Cargando…</strong></div>';
  markCards(g);
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function refreshAll(){markHearts();markCards();refreshSheet();}

const ICON_FAV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5s-6.8-4.1-8.4-8.4C2.6 8.2 4.5 5.3 7.5 5.3c1.8 0 3.3 1 4.5 2.6 1.2-1.6 2.7-2.6 4.5-2.6 3 0 4.9 2.9 3.9 5.8-1.6 4.3-8.4 8.4-8.4 8.4Z"/></svg>';
window.CirculosShell?.addMenuItem({id:'favMenuItem',icon:ICON_FAV,title:'Favoritos',subtitle:'Tus acordes guardados, en todos tus dispositivos.',onClick:openSheet});
window.CirculosFavs={open:openSheet,has,toggle,toggleKey,isOpen:()=>!!sheet?.classList.contains('open'),get nick(){return nick;},get count(){return favs.length;}};

/* Si ya tenía nick, se reconecta solo */
if(nick)reconnect();
