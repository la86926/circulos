/* Círculos Music · página Círculos
   Un solo responsable para la página: tonalidad, escala, nomenclatura, círculo armónico, instrumento y teclado.
   Reemplaza a app.js, circle-wheel.js, performance-mode.js, piano-sync.js y stability-hotfix.js. */
(()=>{
'use strict';

/* ───────── Sin zoom: se siente como app y no se recarga por accidente ───────── */
for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault();},{passive:false});
document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)e.preventDefault();},{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['+','-','=','0'].includes(e.key))e.preventDefault();});
let lastTouchEnd=0;
document.addEventListener('touchend',e=>{const now=Date.now();if(now-lastTouchEnd<320&&!e.target.closest?.('#pianoKeyboard'))e.preventDefault();lastTouchEnd=now;},{passive:false});
if(/CriOS/i.test(navigator.userAgent))document.documentElement.classList.add('chrome-ios');

/* ───────── Teoría ───────── */
const KEYSETS={
  major:[['C','C D E F G A B'],['G','G A B C D E F#'],['D','D E F# G A B C#'],['A','A B C# D E F# G#'],['E','E F# G# A B C# D#'],['B','B C# D# E F# G# A#'],['F#','F# G# A# B C# D# E#'],['Db','Db Eb F Gb Ab Bb C'],['Ab','Ab Bb C Db Eb F G'],['Eb','Eb F G Ab Bb C D'],['Bb','Bb C D Eb F G A'],['F','F G A Bb C D E']],
  minor:[['C','C D Eb F G Ab Bb'],['G','G A Bb C D Eb F'],['D','D E F G A Bb C'],['A','A B C D E F G'],['E','E F# G A B C D'],['B','B C# D E F# G A'],['F#','F# G# A B C# D E'],['C#','C# D# E F# G# A B'],['G#','G# A# B C# D# E F#'],['Eb','Eb F Gb Ab Bb Cb Db'],['Bb','Bb C Db Eb F Gb Ab'],['F','F G Ab Bb C Db Eb']]
};
for(const m in KEYSETS)KEYSETS[m]=KEYSETS[m].map(([tonic,scale])=>({tonic,scale:scale.split(' ')}));
const MODES={
  major:{qualities:['major','minor','minor','major','major','minor','diminished'],degrees:['I','ii','iii','IV','V','vi','vii°'],functions:['Tónica','Supertónica','Mediante','Subdominante','Dominante','Superdominante','Sensible'],label:'mayor'},
  minor:{qualities:['minor','diminished','major','minor','minor','major','major'],degrees:['i','ii°','III','iv','v','VI','VII'],functions:['Tónica','Supertónica','Mediante','Subdominante','Dominante menor','Submediante','Subtónica'],label:'menor natural'}
};
const PC={C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,'E#':5,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
const SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],FLAT=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const LATIN={C:'DO',D:'RE',E:'MI',F:'FA',G:'SOL',A:'LA',B:'SI'};
const KEY_LABEL={english:['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'],latin:['DO','DO♯','RE','RE♯','MI','FA','FA♯','SOL','SOL♯','LA','LA♯','SI']};
const INTERVALS={major:[0,4,7],minor:[0,3,7],diminished:[0,3,6]};
const QUALITY={major:'mayor',minor:'menor',diminished:'disminuido'};

/* ───────── Estado (la nomenclatura se comparte con la página Acordes) ───────── */
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
const NOTATION_KEY='circulos-notation';
const state={mode:'major',keyIndex:0,degree:0,inversion:0,instrument:'guitar',notation:store.get(NOTATION_KEY)==='latin'?'latin':'english'};

/* Enlace compartido: ?tono=A&escala=menor&acorde=1&inst=piano */
(function readLink(){
  const q=new URLSearchParams(location.search);
  if(q.get('escala')==='menor')state.mode='minor';
  const tono=(q.get('tono')||'').replace('♯','#').replace('♭','b');
  if(tono){const pc=PC[tono.charAt(0).toUpperCase()+tono.slice(1)];const i=KEYSETS[state.mode].findIndex(k=>PC[k.tonic]===pc);if(i>=0)state.keyIndex=i;}
  const d=Number(q.get('acorde'));if(d>=1&&d<=7)state.degree=d-1;
  if(q.get('inst')==='piano')state.instrument='piano';
})();

const $=id=>document.getElementById(id);
const el={tones:$('toneSelector'),scale:$('minimalScaleSelect'),wheel:$('harmonyWheel'),piano:$('pianoKeyboard'),pianoNotes:$('pianoVoicingText'),pianoPanel:$('pianoPanel'),guitarPanel:$('guitarPanel')};

const key=()=>KEYSETS[state.mode][state.keyIndex];
const mode=()=>MODES[state.mode];
function note(n){
  const acc=n.slice(1).replace('#','♯').replace('b','♭');
  return state.notation==='english'?n[0]+acc:(LATIN[n[0]]||n[0])+acc;
}
function chords(){
  const k=key(),m=mode();
  return k.scale.map((root,i)=>({index:i,root,rootPc:PC[root],quality:m.qualities[i],degree:m.degrees[i],functionName:m.functions[i],notes:[k.scale[i],k.scale[(i+2)%7],k.scale[(i+4)%7]]}));
}
const selected=()=>chords()[state.degree];
const symbol=c=>note(c.root)+(c.quality==='minor'?'m':c.quality==='diminished'?'°':'');
const longName=c=>`${note(c.root)} ${QUALITY[c.quality]}`;

/* ───────── Tonalidad ───────── */
function renderTones(){
  const set=KEYSETS[state.mode];
  el.tones.innerHTML=KEY_LABEL.english.map((_,pc)=>{
    const i=set.findIndex(k=>PC[k.tonic]===pc);
    return `<button class="tone-btn${i===state.keyIndex?' active':''}" data-k="${i}" type="button">${KEY_LABEL[state.notation][pc]}</button>`;
  }).join('');
}
el.tones.addEventListener('click',e=>{
  const b=e.target.closest('.tone-btn');if(!b)return;
  state.keyIndex=Number(b.dataset.k);state.degree=0;state.inversion=0;render();
});
el.scale.addEventListener('change',()=>{state.mode=el.scale.value==='minor'?'minor':'major';state.keyIndex=0;state.degree=0;state.inversion=0;render();});

/* ───────── Círculo armónico (se dibuja directo desde el estado) ───────── */
const NS='http://www.w3.org/2000/svg';
const playing=new Map();
function svg(name,attrs){const n=document.createElementNS(NS,name);for(const k in attrs)n.setAttribute(k,attrs[k]);return n;}
function node(c,x,y,r,center){
  const notes=c.notes.map(note).join(' · ');
  const g=svg('g',{class:`harmony-wheel-node ${c.quality}${c.index===state.degree?' active':''}${center?' harmony-wheel-center-node':''}${(playing.get(c.index)||0)>Date.now()?' playing':''}`,
    role:'button',tabindex:'0','aria-label':`${c.degree}, ${symbol(c)}, ${c.functionName}, notas ${notes}`,'data-wheel-index':c.index});
  g.appendChild(svg('circle',{class:'harmony-wheel-node-bg',cx:x,cy:y,r}));
  const dy=center?[-50,-18,18,50]:[-43,-13,21,49];
  [['harmony-wheel-degree',c.degree],['harmony-wheel-name',symbol(c)],['harmony-wheel-function',c.functionName],['harmony-wheel-notes',notes]]
    .forEach(([cls,text],i)=>{const t=svg('text',{class:cls,x,y:y+dy[i]});t.textContent=text;g.appendChild(t);});
  return g;
}
function renderWheel(){
  const list=chords(),cx=360,cy=360,R=268;
  const root=svg('svg',{class:'harmony-wheel-svg',viewBox:'0 0 720 720',role:'group','aria-label':'Círculo armónico: la tónica al centro y los otros seis acordes alrededor'});
  root.appendChild(svg('circle',{class:'harmony-wheel-ring',cx,cy,r:R}));
  list.slice(1).forEach((c,i)=>{
    const a=(-90+i*60)*Math.PI/180,x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R;
    root.appendChild(svg('line',{class:'harmony-wheel-spoke',x1:cx,y1:cy,x2:x,y2:y}));
    root.appendChild(node(c,x,y,78,false));
  });
  root.appendChild(node(list[0],cx,cy,105,true));
  el.wheel.replaceChildren(root);
}
function pickDegree(i){
  state.degree=i;state.inversion=0;
  playing.set(i,Date.now()+1750);setTimeout(renderWheel,1800);
  render();
}
/* Se elige al apoyar el dedo (respuesta inmediata); el clic que sigue se ignora */
let blockClickUntil=0;
el.wheel.addEventListener('pointerdown',e=>{
  const g=e.target.closest('.harmony-wheel-node');if(!g)return;
  e.preventDefault();blockClickUntil=Date.now()+700;pickDegree(Number(g.dataset.wheelIndex));
});
el.wheel.addEventListener('click',e=>{
  const g=e.target.closest('.harmony-wheel-node');if(!g)return;
  if(Date.now()<blockClickUntil)return;pickDegree(Number(g.dataset.wheelIndex));
});
el.wheel.addEventListener('keydown',e=>{
  const g=e.target.closest('.harmony-wheel-node');if(!g||!['Enter',' '].includes(e.key))return;
  e.preventDefault();pickDegree(Number(g.dataset.wheelIndex));
  requestAnimationFrame(()=>el.wheel.querySelector(`[data-wheel-index="${g.dataset.wheelIndex}"]`)?.focus());
});

/* ───────── Piano: teclas de DO 48 a DO 84, en orden cromático ───────── */
function cssPx(name,fallback){const v=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));return Number.isFinite(v)&&v>0?v:fallback;}
function voicing(c){
  const n=INTERVALS[c.quality].map(i=>60+c.rootPc+i);
  while(n[0]>=72)n.forEach((_,i)=>n[i]-=12);
  for(let i=0;i<state.inversion;i++)n.push(n.shift()+12);
  return n;
}
function renderPiano(){
  const c=selected(),v=voicing(c),vs=new Set(v),pcs=new Set(c.notes.map(n=>PC[n])),labels=KEY_LABEL[state.notation];
  const w=cssPx('--key-w',58),pad=parseFloat(getComputedStyle(el.piano).paddingLeft)||0,frag=document.createDocumentFragment();
  let whites=0;
  for(let midi=48;midi<=84;midi++){
    const pc=midi%12,black=[1,3,6,8,10].includes(pc),k=document.createElement('span');
    k.className=`${black?'black-key':'white-key'}${pcs.has(pc)?' chord-tone':''}${vs.has(midi)?' voicing-tone':''}${pc===c.rootPc?' root-tone':''}`;
    k.textContent=labels[pc];
    if(black)k.style.left=`${pad+whites*w}px`;else whites++;
    frag.appendChild(k);
  }
  el.piano.replaceChildren(frag);
  el.piano.style.minWidth=`${whites*w+8}px`;
  const flat=key().tonic.includes('b');
  el.pianoNotes.textContent=v.map(m=>note((flat?FLAT:SHARP)[m%12])).join(' · ');
  document.querySelectorAll('[data-inversion]').forEach(b=>b.classList.toggle('active',Number(b.dataset.inversion)===state.inversion));
}
document.querySelectorAll('[data-inversion]').forEach(b=>b.addEventListener('click',()=>{state.inversion=Number(b.dataset.inversion);renderPiano();}));

/* ───────── Instrumento ───────── */
function setInstrument(inst){
  state.instrument=inst==='piano'?'piano':'guitar';
  document.querySelectorAll('[data-instrument]').forEach(b=>b.classList.toggle('active',b.dataset.instrument===state.instrument));
  el.pianoPanel.classList.toggle('hidden',state.instrument!=='piano');
  el.guitarPanel.classList.toggle('hidden',state.instrument!=='guitar');
}
document.querySelectorAll('[data-instrument]').forEach(b=>b.addEventListener('click',()=>setInstrument(b.dataset.instrument)));

/* ───────── Nomenclatura (misma elección en Círculos y Acordes) ───────── */
function syncNotationButtons(){document.querySelectorAll('[data-nomenclature]').forEach(b=>b.classList.toggle('active',b.dataset.nomenclature===state.notation));}
document.querySelectorAll('[data-nomenclature]').forEach(b=>b.addEventListener('click',()=>{
  state.notation=b.dataset.nomenclature==='latin'?'latin':'english';store.set(NOTATION_KEY,state.notation);render();document.dispatchEvent(new CustomEvent('circulos:notation',{detail:state.notation}));
}));

/* ───────── Todo junto ───────── */
function publish(){
  const c=selected();
  window.circulosChord={name:longName(c),rootPc:c.rootPc,quality:c.quality,degree:c.index};
  document.dispatchEvent(new CustomEvent('circulos:chord'));
}
function render(){
  el.scale.value=state.mode;
  syncNotationButtons();renderTones();renderWheel();renderPiano();publish();
}

/* Datos para compartir el acorde elegido (los usa share.js) */
window.Circulos={
  share(){
    const c=selected(),url=new URL(location.pathname,location.origin);
    url.searchParams.set('tono',key().tonic);
    if(state.mode==='minor')url.searchParams.set('escala','menor');
    url.searchParams.set('acorde',String(c.index+1));
    if(state.instrument==='piano')url.searchParams.set('inst','piano');
    // El mensaje usa el nombre en español («Mira el La menor»), que se lee natural en cualquier chat
    const L=LATIN[c.root[0]]||c.root[0],acc=c.root.slice(1).replace('#','♯').replace('b','♭');
    return{text:`Mira el ${L[0]+L.slice(1).toLowerCase()+acc} ${QUALITY[c.quality]}`,url:url.toString(),title:'Círculos Music'};
  }
};

setInstrument(state.instrument);
render();
})();
