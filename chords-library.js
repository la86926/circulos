(()=>{
'use strict';
if(window.__circulosChordLibraryV11)return;
window.__circulosChordLibraryV11=true;

const DATA_URL='chords-data.json?v=2';
const ROOT_PC={C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,'E#':5,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
const PC_ROOT=['C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab','A','A#/Bb','B'];
const LATIN={C:'DO',D:'RE',E:'MI',F:'FA',G:'SOL',A:'LA',B:'SI'};
const ROOT_QUERY={c:'C',do:'C','c#':'C#/Db',db:'C#/Db','do#':'C#/Db',reb:'C#/Db',d:'D',re:'D','d#':'D#/Eb',eb:'D#/Eb','re#':'D#/Eb',mib:'D#/Eb',e:'E',mi:'E',f:'F',fa:'F','f#':'F#/Gb',gb:'F#/Gb','fa#':'F#/Gb',solb:'F#/Gb',g:'G',sol:'G','g#':'G#/Ab',ab:'G#/Ab','sol#':'G#/Ab',lab:'G#/Ab',a:'A',la:'A','a#':'A#/Bb',bb:'A#/Bb','la#':'A#/Bb',sib:'A#/Bb',b:'B',si:'B'};
const FAMILY_LABEL={mayor:'Mayor',m:'Menor',dim:'Disminuido',aug:'Aumentado',inversiones:'Inversiones',slash:'Slash / pedal'};
const BATCH=72;
const state={inst:(()=>{try{return localStorage.getItem('circulos-library-inst')==='piano'?'piano':'guitar';}catch(e){return'guitar';}})(),data:null,loading:false,notation:(()=>{try{return localStorage.getItem('circulos-notation')==='latin'?'latin':'english';}catch(e){return'english';}})(),root:'all',family:'all',query:'',visible:BATCH,filtered:[]};
const $=id=>document.getElementById(id);

function stripAccents(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function normalize(value){
  let s=stripAccents(value).toLowerCase().replace(/♯/g,'#').replace(/♭/g,'b');
  s=s.replace(/sostenido/g,'#').replace(/bemol/g,'b');
  const notes=[['sol','g'],['do','c'],['re','d'],['mi','e'],['fa','f'],['la','a'],['si','b']];
  const prefix=notes.find(([n])=>new RegExp(`^${n}(?=(?:#|b|m|maj|dim|aug|sus|add|alt|[0-9]|/|$))`).test(s));
  if(prefix)s=s.replace(new RegExp(`^${prefix[0]}`),prefix[1]);
  for(const[n,e]of notes)s=s.replace(new RegExp(`\\b${n}(?=[#b]|\\b)`,'g'),e);
  return s.replace(/disminuido/g,'dim').replace(/aumentado/g,'aug').replace(/menor/g,'m').replace(/mayor/g,'maj').replace(/septima/g,'7').replace(/\s+/g,'').replace(/[()]/g,'');
}
function noteDisplay(note,notation=state.notation){
  const m=String(note).match(/^([A-G])([#b]*)$/);if(!m)return note;
  const base=notation==='latin'?(LATIN[m[1]]||m[1]):m[1];
  return base+m[2].replace(/#/g,'♯').replace(/b/g,'♭');
}
function displayChordToken(token){
  const m=String(token).trim().match(/^([A-G](?:#|b)?)(.*)$/);if(!m)return token;
  let rest=m[2].replace(/\/([A-G](?:#|b)?)/g,(_,n)=>'/'+noteDisplay(n));
  return noteDisplay(m[1])+rest;
}
function displaySymbol(symbol){return String(symbol).split(' / ').map(displayChordToken).join(' / ');}
function familyLabel(f){return FAMILY_LABEL[f]||f;}
function primaryRoot(symbol){const first=String(symbol).split(' / ')[0].split('/')[0];return first.match(/^([A-G](?:#|b)?)/)?.[1]||'C';}
function entryRootGroup(symbol){return PC_ROOT[ROOT_PC[primaryRoot(symbol)]??0];}
function buildSearch(entry){
  const values=[entry.s,displaySymbolFor(entry.s,'latin'),entry.n,entry.f,entry.fn,...(entry.a||[])].filter(Boolean);
  return values.map(normalize);
}
function displaySymbolFor(symbol,notation){const before=state.notation;state.notation=notation;const result=displaySymbol(symbol);state.notation=before;return result;}
const symbolIndex=new Map();
function enrich(){
  for(const entry of state.data.entries)if(entry.k==='chord')entry.s.split(' / ').forEach(t=>{if(!symbolIndex.has(t.trim()))symbolIndex.set(t.trim(),entry);});
  for(const entry of state.data.entries){entry.r=entry.r||entryRootGroup(entry.s);entry._search=buildSearch(entry);entry._symbolNorm=normalize(entry.s);entry._latinNorm=normalize(displaySymbolFor(entry.s,'latin'));}
}
function rootOnlyQuery(raw){
  const v=stripAccents(raw).toLowerCase().trim().replace(/♯/g,'#').replace(/♭/g,'b').replace(/\s+/g,'');
  return ROOT_QUERY[v]||null;
}
function matchesQuery(entry){
  const raw=state.query.trim();if(!raw)return true;
  const rootOnly=rootOnlyQuery(raw);if(rootOnly)return entry.r===rootOnly;
  const q=normalize(raw);return entry._search.some(x=>x.includes(q));
}
function score(entry){
  const raw=state.query.trim();if(!raw)return 0;const q=normalize(raw);
  if(entry._symbolNorm===q||entry._latinNorm===q||(entry.a||[]).some(a=>normalize(a)===q))return 0;
  if(entry._symbolNorm.startsWith(q)||entry._latinNorm.startsWith(q))return 1;
  return 2;
}
function applyFilters(reset=true){
  if(!state.data)return;
  let list=state.data.entries.filter(entry=>{
    if(state.root!=='all'&&entry.r!==state.root)return false;
    if(state.family!=='all'&&entry.f!==state.family)return false;
    return matchesQuery(entry);
  });
  if(state.query.trim())list=list.map((entry,index)=>({entry,index,score:score(entry)})).sort((a,b)=>a.score-b.score||a.entry.s.length-b.entry.s.length||a.index-b.index).map(x=>x.entry);
  state.filtered=list;if(reset)state.visible=BATCH;renderResults();
}
function shapeTokens(shape){return String(shape||'').trim().split(/\s+/);}
function preferredPosition(entry){
  const list=entry.p||[];
  return list.find(p=>/(principal|est[aá]ndar|tradicional|com[uú]n)/i.test(stripAccents(p.l)))||list[0]||null;
}
function cardHtml(entry,inst=state.inst,{label=''}={}){
  const pos=preferredPosition(entry),pv=inst==='piano'?pianoVariants(entry)[0]:null;
  const visual=inst==='piano'?(pv?pianoSvg(pv,{mini:true}):'<span class="diagram-empty">Sin diagrama</span>'):(pos?diagramSvg(entry,pos,0,{mini:true}):'<span class="diagram-empty">Sin diagrama</span>');
  return `<button class="chord-catalog-card" type="button" data-chord-id="${entry.id}" data-inst="${inst}" aria-label="Abrir ${escapeHtml(displaySymbol(entry.s))}">
    <span class="chord-catalog-top"><strong>${escapeHtml(displaySymbol(entry.s))}</strong>${label?`<small>${escapeHtml(label)}</small>`:''}</span>
    ${visual}
  </button>`;
}
/* Tarjeta de una sola variación guardada (una posición de guitarra o una forma de piano) */
function variantCardHtml(entry,k){
  const v=variantOf(entry,k);if(!v)return cardHtml(entry);
  const visual=v.inst==='piano'?pianoSvg(v.data,{mini:true}):diagramSvg(entry,v.data,v.index,{mini:true});
  return `<button class="chord-catalog-card fav-var" type="button" data-chord-id="${entry.id}" data-var="${k}" data-inst="${v.inst}" aria-label="Abrir ${escapeHtml(displaySymbol(entry.s))}, ${escapeHtml(v.label)}">
    <span class="chord-catalog-top"><strong>${escapeHtml(displaySymbol(entry.s))}</strong><small>${escapeHtml(v.short)}</small></span>
    ${visual}
  </button>`;
}
function renderResults(){
  const grid=$('chordCatalogGrid'),more=$('chordLoadMore'),empty=$('chordEmpty');if(!grid)return;
  const shown=state.filtered.slice(0,state.visible);grid.innerHTML=shown.map(e=>cardHtml(e)).join('');
  empty.hidden=state.filtered.length!==0;more.hidden=state.visible>=state.filtered.length;more.textContent='Mostrar más';
}
function renderRoots(){
  const host=$('chordRootFilters');if(!host)return;
  const roots=['all',...state.data.roots];host.innerHTML=roots.map(root=>`<button class="chord-filter-chip ${state.root===root?'active':''}" type="button" data-root="${root}">${root==='all'?'Todas':escapeHtml(displayRootGroup(root))}</button>`).join('');
}
function displayRootGroup(root){if(state.notation==='english')return root.replace(/#/g,'♯').replace(/b/g,'♭');return root.split('/').map(noteDisplay).join('/');}
function renderFamilies(){
  const select=$('chordFamilyFilter');if(!select)return;
  const families=[...state.data.families,'inversiones','slash'];select.innerHTML='<option value="all">Todas las familias</option>'+families.map(f=>`<option value="${escapeAttr(f)}">${escapeHtml(familyLabel(f))}</option>`).join('');select.value=state.family;
}
function syncNotation(){
  document.querySelectorAll('[data-library-notation]').forEach(btn=>btn.classList.toggle('active',btn.dataset.libraryNotation===state.notation));
  if(state.data){renderRoots();renderResults();}
  const open=document.querySelector('.chord-detail.open');if(open&&open.dataset.entryId)openDetail(open.dataset.entryId,true);
}
function setLoading(value){state.loading=value;const grid=$('chordCatalogGrid');if(grid&&value)grid.innerHTML=Array.from({length:18},()=>'<div class="chord-skeleton" aria-hidden="true"></div>').join('');}
function ensureData(){
  if(state.data)return Promise.resolve(state.data);
  if(state.promise)return state.promise;
  setLoading(true);
  state.promise=fetch(DATA_URL,{cache:'force-cache'}).then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}).then(data=>{
    if(data.stringOrder!=='1-6')throw new Error('Orden de cuerdas no compatible');
    state.data=data;enrich();renderFamilies();renderRoots();applyFilters();
    const stats=$('chordLibraryStats');if(stats)stats.textContent=`${data.entries.length} acordes · ${data.entries.reduce((n,e)=>n+(e.p?.length||0),0)} posiciones`;
    return data;
  }).catch(error=>{
    state.promise=null;
    const grid=$('chordCatalogGrid');if(grid)grid.innerHTML='<div class="library-error"><strong>No se pudo abrir la biblioteca.</strong><span>Recarga la página para intentarlo de nuevo.</span></div>';
    console.error('Círculos Music: biblioteca de acordes',error);throw error;
  }).finally(()=>setLoading(false));
  return state.promise;
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function escapeAttr(value){return escapeHtml(value);}
function diagramSvg(entry,position,index,options={}){
  const mini=Boolean(options.mini),tokens=shapeTokens(position.x);
  const frets=tokens.map(v=>v.toLowerCase()==='x'?null:Number(v));
  const positive=frets.filter(v=>Number.isFinite(v)&&v>0);
  const max=positive.length?Math.max(...positive):0,min=positive.length?Math.min(...positive):1;
  let start=positive.length?min:1;if(start<=3&&max<=5)start=1;
  const fretCount=Math.max(5,Math.min(7,max-start+1));
  const left=24,top=50,stringGap=18,fretGap=25;
  const verticalWidth=left+5*stringGap+24,verticalHeight=top+fretCount*fretGap+20;
  // El dato siempre llega 1→6. Partimos del diagrama vertical clásico 6→1
  // y lo proyectamos 90° en sentido horario: cejuela a la izquierda,
  // cuerda 1 arriba y cuerda 6 abajo.
  const rotateCW=(x,y)=>[y,verticalWidth-x];
  const stringX=dataIndex=>left+(5-dataIndex)*stringGap;
  const rootPc=ROOT_PC[primaryRoot(entry.s)]??0;
  const tuningByDataIndex=[4,11,7,2,9,4];
  const classes=`library-diagram${mini?' library-diagram-mini':''}`;
  const accessibility=mini?'aria-hidden="true"':`role="img" aria-label="${escapeAttr(displaySymbol(entry.s))}, posición ${index+1}"`;
  let svg=`<svg class="${classes}" viewBox="0 0 ${verticalHeight} ${verticalWidth}" ${accessibility} data-string-order="1-6" data-orientation="cw-90">`;
  for(let dataIndex=0;dataIndex<6;dataIndex++){
    const x=stringX(dataIndex),a=rotateCW(x,top),b=rotateCW(x,top+fretCount*fretGap);
    svg+=`<line class="diagram-string" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
  }
  for(let f=0;f<=fretCount;f++){
    const y=top+f*fretGap,a=rotateCW(left,y),b=rotateCW(left+5*stringGap,y);
    svg+=`<line class="${start===1&&f===0?'diagram-nut':'diagram-fret'}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
  }
  const nutX=rotateCW(left,top)[0];
  const barre=barreFret(position);
  if(barre&&barre>=start&&barre<start+fretCount){
    const from=frets.findIndex(v=>Number.isFinite(v)&&v>0),to=frets.map((v,i)=>Number.isFinite(v)&&v>0?i:-1).reduce((a,b)=>Math.max(a,b),-1);
    const y=top+(barre-start+.5)*fretGap,a=rotateCW(stringX(from),y),b=rotateCW(stringX(to),y);
    svg+=`<line class="diagram-barre" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
  }
  frets.forEach((fret,dataIndex)=>{
    const verticalX=stringX(dataIndex),stringNumber=dataIndex+1,stringY=rotateCW(verticalX,top)[1];
    const marker=fret===null?'×':fret===0?'○':'';
    if(marker)svg+=`<text class="diagram-label diagram-marker" x="${nutX-17}" y="${stringY}" text-anchor="middle" dominant-baseline="central">${marker}</text>`;
    svg+=`<text class="diagram-label diagram-string-number" x="${nutX-36}" y="${stringY}" text-anchor="middle" dominant-baseline="central">${stringNumber}</text>`;
    if(fret===null||fret===0||fret<start||fret>=start+fretCount)return;
    const verticalY=top+(fret-start+.5)*fretGap,p=rotateCW(verticalX,verticalY);
    const pc=(tuningByDataIndex[dataIndex]+fret)%12,isRoot=pc===rootPc;
    svg+=`<circle class="${isRoot?'diagram-root':'diagram-dot'}" cx="${p[0]}" cy="${p[1]}" r="${mini?7.5:9.5}"/>`;
    if(isRoot&&!mini)svg+=`<text class="diagram-dot-text" x="${p[0]}" y="${p[1]}">R</text>`;
  });
  svg+='</svg>';return svg;
}
function displayNotesText(text){return String(text||'').split('–').map(part=>noteDisplay(part.trim())).join('–');}
function detailMeta(entry){
  const items=[];
  const cn=!entry.nt?.length?chordNotes(entry):null;
  if(cn)items.push(`<div><span>Notas</span><strong>${escapeHtml(displayNotesText([cn.bass,...cn.names.filter(n=>pcOf(n)!==pcOf(cn.bass))].join('–')))}</strong></div>`);
  if(entry.nt?.length)items.push(`<div><span>Notas</span><strong>${entry.nt.map(([label,notes])=>entry.nt.length>1?`${escapeHtml(noteDisplay(label))}: ${escapeHtml(displayNotesText(notes))}`:escapeHtml(displayNotesText(notes))).join('<br>')}</strong></div>`);
  return items.join('');
}
/* Traste de la cejilla (el dedo que pisa varias cuerdas a la vez); null si la forma no lleva cejilla */
function barreFret(position){
  if(!stripAccents(position.l).toLowerCase().includes('cejilla'))return null;
  const frets=shapeTokens(position.x).map(v=>v.toLowerCase()==='x'?null:Number(v));
  const pressed=frets.filter(v=>Number.isFinite(v)&&v>0);if(!pressed.length)return null;
  const from=frets.findIndex(v=>Number.isFinite(v)&&v>0),to=frets.map((v,i)=>Number.isFinite(v)&&v>0?i:-1).reduce((a,b)=>Math.max(a,b),-1);
  return to>from?Math.min(...pressed):null;
}
const ICON_HEART='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2s-7.4-4.5-9.1-9.2C1.8 7.8 3.9 4.6 7.2 4.6c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.4 3.2 4.3 6.4-1.7 4.7-9.1 9.2-9.1 9.2Z"/></svg>';
const ICON_SHARE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11"/><path d="m7.8 7.6 4.2-4.1 4.2 4.1"/><path d="M6.5 11.5H6a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-.5"/></svg>';
/* Corazón y compartir. key = "ch12" (el acorde completo) o "ch12:g3" / "ch12:p1" (una sola variación) */
function actionsHtml(key,{small=false,what='este acorde'}={}){
  const cls=small?' act-sm':'';
  return `<div class="chord-actions${small?' pos-actions':''}"><button class="act-btn act-fav${cls}" type="button" data-fav-key="${key}" aria-label="Guardar ${what} en Favoritos" title="Guardar en Favoritos">${ICON_HEART}</button><button class="act-btn act-share${cls}" type="button" data-share-key="${key}" aria-label="Compartir ${what}" title="Compartir">${ICON_SHARE}</button></div>`;
}
function positionLabel(p,i){const b=barreFret(p);return `Posición ${i+1}${b?` · Traste ${b}`:''}`;}
function positionCardsHtml(entry){
  return entry.p.map((p,i)=>`<article class="chord-position-card" data-var="g${i}"><div class="position-card-head"><strong>${positionLabel(p,i)}</strong>${actionsHtml(`${entry.id}:g${i}`,{small:true,what:'esta posición'})}</div>${diagramSvg(entry,p,i)}<code aria-label="Tablatura de la 1.ª a la 6.ª cuerda">${escapeHtml(p.x.replace(/x/g,'×'))}</code></article>`).join('');
}

/* ───────── Piano ───────── */
const LETTER_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function pcOf(name){const m=String(name).trim().match(/^([A-G])([#b]*)$/);if(!m)return null;let p=LETTER_PC[m[1]];for(const ch of m[2])p+=ch==='#'?1:-1;return((p%12)+12)%12;}
/* Apila las notas hacia arriba desde "start": cada una en la primera tecla libre por encima de la anterior */
function stack(names,start){const out=[];let prev=start-1;names.forEach(n=>{const pc=pcOf(n);let m=prev+1;while(m%12!==pc)m++;out.push(m);prev=m;});return out;}
const midStart=pc=>pc>=5?48+pc:60+pc;            // la nota más grave queda entre FA3 y MI4, cerca del DO central
/* Notas del acorde: {root, names, bass?} */
function chordNotes(entry){
  if(entry._cn!==undefined)return entry._cn;
  let out=null;
  if(entry.nt?.length){const [root,notes]=preferredSpelling(entry.nt);out={root,names:notes.split('–').map(x=>x.trim())};}
  else for(const token of entry.s.split(' / ')){
    const m=token.trim().match(/^(.+)\/([A-G](?:##|bb|#|b)?)$/);if(!m)continue;
    const base=symbolIndex.get(m[1]);if(!base?.nt?.length)continue;
    const upperRoot=m[1].match(/^[A-G](?:##|bb|#|b)?/)[0];
    const [root,notes]=base.nt.find(([l])=>l===upperRoot)||base.nt[0];
    out={root,names:notes.split('–').map(x=>x.trim()),bass:m[2]};break;
  }
  return entry._cn=out;
}
/* Entre dos nombres de la misma nota (C♯ / D♭) se usa el más común en partituras */
const COMMON=new Set(['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B']);
function preferredSpelling(list){return list.find(([l])=>COMMON.has(l))||list[0];}
function pianoVariants(entry){
  if(entry._pv)return entry._pv;
  const c=chordNotes(entry),list=[];
  if(c){
    const rootPc=pcOf(c.root),add=(label,names,midis)=>list.push({k:'p'+list.length,label,names,midis,rootPc});
    if(!c.bass){
      const n=Math.min(c.names.length,4);
      for(let i=0;i<n;i++){const rot=[...c.names.slice(i),...c.names.slice(0,i)];add(i===0?'Fundamental':`${i}.ª inversión`,rot,stack(rot,midStart(pcOf(rot[0]))));}
    }else{
      const bpc=pcOf(c.bass),inChord=c.names.some(x=>pcOf(x)===bpc);
      const apart=()=>{const up=stack(c.names,midStart(rootPc));const b=36+bpc+(up[0]-(36+bpc)>=24?12:0);add('Bajo en la mano izquierda',[c.bass,...c.names],[b,...up]);};
      const close=()=>{
        if(inChord){const i=c.names.findIndex(x=>pcOf(x)===bpc),rot=[...c.names.slice(i),...c.names.slice(0,i)];add('Cerrada',rot,stack(rot,midStart(bpc)));}
        else{const names=[c.bass,...c.names];add('Cerrada',names,stack(names,midStart(bpc)));}
      };
      if(inChord){close();apart();}else{apart();close();}
    }
  }
  return entry._pv=list;
}
const BLACK=new Set([1,3,6,8,10]);
function pianoSvg(v,{mini=false}={}){
  const lo=Math.min(...v.midis),hi=Math.max(...v.midis);
  const start=Math.floor(lo/12)*12;let end=Math.ceil((hi+1)/12)*12-1;if(end-start<23)end=start+23;
  const W=20,H=mini?72:104,BW=11.6,BH=Math.round(H*.6);
  const whites=[];for(let m=start;m<=end;m++)if(!BLACK.has(m%12))whites.push(m);
  const on=new Map(v.midis.map((m,i)=>[m,v.names[i]]));
  const cls=m=>on.has(m)?(m%12===v.rootPc?' is-root':' is-on'):'';
  let svg=`<svg class="lib-piano${mini?' lib-piano-mini':''}" viewBox="0 0 ${whites.length*W} ${H}" ${mini?'aria-hidden="true"':`role="img" aria-label="Piano: ${escapeAttr(v.names.map(n=>noteDisplay(n)).join(', '))}"`}>`;
  whites.forEach((m,i)=>{svg+=`<rect class="lp-w${cls(m)}" data-midi="${m}" x="${i*W+.5}" y=".5" width="${W-1}" height="${H-1}" rx="3"/>`;});
  let labels='';
  whites.forEach((m,i)=>{
    if(!mini&&on.has(m))labels+=`<text class="lp-t${m%12===v.rootPc?' is-root':''}" x="${i*W+W/2}" y="${H-12}">${escapeHtml(noteDisplay(on.get(m)))}</text>`;
    const b=m+1;if(b<=end&&BLACK.has(b%12)){
      const x=(i+1)*W-BW/2;svg+=`<rect class="lp-b${cls(b)}" data-midi="${b}" x="${x}" y="0" width="${BW}" height="${BH}" rx="2.5"/>`;
      if(!mini&&on.has(b))labels+=`<text class="lp-t lp-tb${b%12===v.rootPc?' is-root':''}" x="${x+BW/2}" y="${BH-9}">${escapeHtml(noteDisplay(on.get(b)))}</text>`;
    }
  });
  return svg+labels+'</svg>';
}
function pianoCardsHtml(entry){
  const list=pianoVariants(entry);
  if(!list.length)return '<div class="chord-empty"><strong>Sin forma de piano</strong><span>No se encontraron las notas de este acorde.</span></div>';
  return list.map(v=>`<article class="chord-position-card piano-card" data-var="${v.k}"><div class="position-card-head"><strong>${v.label}</strong>${actionsHtml(`${entry.id}:${v.k}`,{small:true,what:'esta forma de piano'})}</div>
    ${pianoSvg(v)}<div class="piano-card-foot"><span>${v.names.map(n=>escapeHtml(noteDisplay(n))).join(' · ')}</span>${window.CirculosPiano?`<button class="piano-play" type="button" data-play="${v.midis.join(',')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5Z"/></svg>Escuchar</button>`:''}</div></article>`).join('');
}
/* Datos de una variación: "g3" = 4.ª posición de guitarra, "p1" = 2.ª forma de piano */
function variantOf(entry,k){
  const m=String(k||'').match(/^([gp])(\d+)$/);if(!m)return null;const i=Number(m[2]);
  if(m[1]==='g'){const p=entry.p?.[i];if(!p)return null;const b=barreFret(p);return{inst:'guitar',index:i,data:p,label:`posición ${i+1}${b?`, traste ${b}`:''}`,short:`Guitarra · Posición ${i+1}`};}
  const v=pianoVariants(entry)[i];if(!v)return null;return{inst:'piano',index:i,data:v,label:`piano, ${v.label.toLowerCase()}`,short:`Piano · ${v.label}`};
}
/* Tríada (mayor, menor o disminuida) de una nota: la usa la página Círculos con los mismos datos y tarjetas */
function findTriad(pitchClass,quality){
  const family=quality==='minor'?'m':quality==='diminished'?'dim':'mayor',group=PC_ROOT[((pitchClass%12)+12)%12];
  return state.data?.entries.find(e=>e.f===family&&e.r===group)||null;
}
function openDetail(id,opts={}){
  if(typeof opts==='boolean')opts={rerender:opts};
  const rerender=!!opts.rerender;
  if(!state.data)return;const entry=state.data.entries.find(e=>e.id===id);if(!entry)return;
  let modal=$('chordDetail');if(!modal){modal=document.createElement('div');modal.id='chordDetail';modal.className='chord-detail';modal.innerHTML='<div class="chord-detail-backdrop" data-detail-close></div><section class="chord-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="chordDetailTitle"><button class="chord-detail-close" type="button" data-detail-close aria-label="Cerrar">×</button><div id="chordDetailContent"></div></section>';document.body.appendChild(modal);}
  const inst=opts.inst||(opts.focus?(opts.focus[0]==='p'?'piano':'guitar'):null)||(rerender&&modal.dataset.entryId===id&&modal.dataset.inst)||state.inst;
  modal.dataset.entryId=id;modal.dataset.inst=inst;const content=$('chordDetailContent');
  content.innerHTML=`<header class="chord-detail-head"><div class="detail-title-row"><h2 id="chordDetailTitle">${escapeHtml(displaySymbol(entry.s))}</h2>${actionsHtml(inst==='piano'?`${entry.id}:p`:entry.id)}</div><div class="chord-detail-meta">${detailMeta(entry)}</div></header><div class="chord-position-grid${inst==='piano'?' is-piano':''}">${inst==='piano'?pianoCardsHtml(entry):positionCardsHtml(entry)}</div>`;
  modal.classList.add('open');document.dispatchEvent(new CustomEvent('circulos:detail',{detail:{entry,container:content.querySelector('.chord-actions')}}));document.body.classList.add('chord-detail-open');if(!rerender)modal.querySelector('.chord-detail-close')?.focus({preventScroll:true});
  if(opts.focus){
    const card=content.querySelector(`[data-var="${opts.focus}"]`);
    if(card)setTimeout(()=>{card.scrollIntoView({block:'center',behavior:'smooth'});card.classList.remove('is-focus');void card.offsetWidth;card.classList.add('is-focus');},260);
  }
}
function syncInst(){document.querySelectorAll('[data-library-inst]').forEach(b=>{const on=b.dataset.libraryInst===state.inst;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});}
function setInst(inst){
  state.inst=inst==='piano'?'piano':'guitar';try{localStorage.setItem('circulos-library-inst',state.inst);}catch(e){}
  syncInst();renderResults();
  const open=document.querySelector('.chord-detail.open');if(open&&open.dataset.entryId)openDetail(open.dataset.entryId,{rerender:true,inst:state.inst});
}
/* Piano de la biblioteca: cada tecla suena al tocarla y "Escuchar" toca el acorde */
document.addEventListener('pointerdown',e=>{
  const key=e.target.closest?.('.lib-piano:not(.lib-piano-mini) [data-midi]');if(!key||!window.CirculosPiano)return;
  window.CirculosPiano.play(Number(key.dataset.midi));key.classList.add('is-press');setTimeout(()=>key.classList.remove('is-press'),200);
});
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-play]');if(!b||!window.CirculosPiano)return;
  window.CirculosPiano.play(b.dataset.play.split(',').map(Number),{roll:.035});
  const svg=b.closest('.piano-card')?.querySelector('.lib-piano');
  svg?.querySelectorAll('.is-on,.is-root').forEach((k,i)=>{setTimeout(()=>{k.classList.add('is-press');setTimeout(()=>k.classList.remove('is-press'),260);},i*35);});
});
function closeDetail(){const modal=$('chordDetail');if(!modal?.classList.contains('open'))return;modal.classList.remove('open');document.body.classList.remove('chord-detail-open');}
function resetFilters(){state.root=state.family='all';state.query='';$('chordSearch').value='';$('chordFamilyFilter').value='all';renderRoots();applyFilters();}
function bind(){
  $('chordSearch')?.addEventListener('input',event=>{state.query=event.target.value;applyFilters();});
  $('chordFamilyFilter')?.addEventListener('change',event=>{state.family=event.target.value;applyFilters();});
  $('chordRootFilters')?.addEventListener('click',event=>{const btn=event.target.closest('[data-root]');if(!btn)return;state.root=btn.dataset.root;renderRoots();applyFilters();});
  $('chordCatalogGrid')?.addEventListener('click',event=>{const card=event.target.closest('[data-chord-id]');if(card)openDetail(card.dataset.chordId);});
  $('chordLoadMore')?.addEventListener('click',()=>{state.visible+=BATCH;renderResults();});
  $('chordResetFilters')?.addEventListener('click',resetFilters);
  document.querySelectorAll('[data-library-notation]').forEach(btn=>btn.addEventListener('click',()=>{state.notation=btn.dataset.libraryNotation;try{localStorage.setItem('circulos-notation',state.notation);}catch(e){}syncNotation();}));
  document.addEventListener('click',event=>{if(event.target.closest('[data-detail-close]'))closeDetail();});
  document.querySelectorAll('[data-library-inst]').forEach(btn=>btn.addEventListener('click',()=>setInst(btn.dataset.libraryInst)));
  syncInst();
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDetail();});
  document.querySelectorAll('[data-app-view="chords"]').forEach(btn=>btn.addEventListener('click',ensureData));
  const view=$('chordsView');if(view)new MutationObserver(()=>{if(!view.classList.contains('view-hidden'))ensureData();}).observe(view,{attributes:true,attributeFilter:['class']});
}
/* Enlace compartido: acordes.html?acorde=Am7 abre ese acorde */
function openFromLink(){
  const wanted=new URLSearchParams(location.search).get('acorde');if(!wanted||!state.data)return;
  const n=normalize(wanted),entry=state.data.entries.find(e=>e.id===wanted)||state.data.entries.find(e=>e.s.split(' / ').some(t=>normalize(t)===n));
  if(!entry)return;
  const v=new URLSearchParams(location.search).get('var');
  if(v&&/^[gp]\d*$/.test(v)){const inst=v[0]==='p'?'piano':'guitar';if(state.inst!==inst){state.inst=inst;syncInst();renderResults();}openDetail(entry.id,v.length>1?{focus:v}:{inst});}
  else openDetail(entry.id);
}
document.addEventListener('circulos:notation',e=>{state.notation=e.detail==='latin'?'latin':'english';syncNotation();});
function init(){bind();syncNotation();if($('chordsView'))ensureData().then(openFromLink).catch(()=>{});}
window.CirculosChords={load:ensureData,findTriad,positionCardsHtml,cardHtml,variantCardHtml,variantOf,actionsHtml,openDetail,pianoVariants,
  byId:id=>state.data?.entries.find(e=>e.id===id)||null,
  symbol:entry=>displaySymbol(entry.s),
  shareFor(entry,k){
    const url=new URL('acordes.html',location.href);url.search='';url.searchParams.set('acorde',entry.s.split(' / ')[0]);
    const v=k==='p'?{label:'piano'}:k?variantOf(entry,k):null;if(v)url.searchParams.set('var',k);
    return{text:`Mira el acorde ${displaySymbol(entry.s)}${v?` (${v.label})`:''}`,url:url.toString()};
  }};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();