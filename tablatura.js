/* Círculos Music · Partitura (PDF) → tablatura de guitarra (prueba privada)
   1. Lee el PDF en el propio dispositivo con pdf.js (nada se sube a internet).
   2. partitura-analyze.js encuentra la melodía de cada canción.
   3. Aquí se elige dónde tocar cada nota (sin cuerdas al aire, cerca de la anterior) y se dibuja la tablatura. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const pdfjsLib=window.pdfjsLib,E=window.PartituraExtract,A=window.PartituraAnalyze;
if(!pdfjsLib||!E||!A)return;
pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
const toast=m=>window.CirculosShell?.toast(m);
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
const prefs={tempo:100,chords:store.get('tab-chords','1')==='1',mode:store.get('tab-mode','mid'),verse:+store.get('tab-verse',0)};

/* ───────── Guardado en el dispositivo (para no volver a leer el PDF cada vez) ───────── */
const DB={
  open(){return new Promise((ok,no)=>{const r=indexedDB.open('circulos-tablatura',1);r.onupgradeneeded=()=>r.result.createObjectStore('books');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});},
  async get(k){try{const db=await this.open();return await new Promise(ok=>{const q=db.transaction('books').objectStore('books').get(k);q.onsuccess=()=>ok(q.result||null);q.onerror=()=>ok(null);});}catch(e){return null;}},
  async set(k,v){try{const db=await this.open();await new Promise(ok=>{const t=db.transaction('books','readwrite');t.objectStore('books').put(v,k);t.oncomplete=ok;t.onerror=ok;});}catch(e){}}
};

/* ───────── Leer el PDF ───────── */
let book=null,song=null;
function progress(frac,text){$('tabProgress').hidden=false;$('tabProgressBar').style.width=(frac*100).toFixed(1)+'%';$('tabProgressText').textContent=text;}
async function readPdf(file){
  $('tabError').textContent='';
  progress(0,'Abriendo el PDF…');
  try{
    const data=new Uint8Array(await file.arrayBuffer());
    const doc=await pdfjsLib.getDocument({data,disableFontFace:true,isEvalSupported:false}).promise;
    const pages=[];
    for(let p=1;p<=doc.numPages;p++){
      const page=await doc.getPage(p);
      const raw=await E.extractPage(page,pdfjsLib.OPS);
      const r=A.analyzePage(raw);r.pageNumber=p;r.height=raw.height;pages.push(r);
      page.cleanup();
      progress(p/doc.numPages,`Leyendo página ${p} de ${doc.numPages}…`);
      if(p%3===0)await new Promise(r=>setTimeout(r,0));
    }
    const songs=A.buildSongs(pages).map(s=>{const m=A.songMeasures(s);return{number:s.number,title:s.title,pages:s.pages,time:m.time,fifths:m.fifths,measures:m.measures};}).filter(s=>s.measures.length);
    doc.destroy();
    $('tabProgress').hidden=true;
    if(!songs.length){$('tabError').textContent='No se encontraron partituras que se puedan leer en este PDF. Debe estar hecho con un programa de partituras; las fotos o escaneos no funcionan.';return;}
    book={name:file.name,size:file.size,songs};
    DB.set('last',book);
    showList();
    toast(`${songs.length} ${songs.length===1?'canción lista':'canciones listas'}`);
  }catch(err){
    console.error('Tablatura:',err);$('tabProgress').hidden=true;
    $('tabError').textContent='No se pudo leer este PDF. Prueba con otro archivo.';
  }
}
$('tabFile').addEventListener('change',e=>{const f=e.target.files[0];if(f)readPdf(f);e.target.value='';});
const drop=$('tabDrop');
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('is-over');}));
['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('is-over');}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)readPdf(f);});

/* ───────── Lista de canciones ───────── */
const norm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function showList(){
  $('tabLoad').hidden=true;$('tabSong').hidden=true;$('tabListPanel').hidden=false;
  $('tabListSub').textContent=`${book.songs.length} canciones · ${book.name}`;
  renderList();
}
function renderList(){
  const q=norm($('tabSearch').value.trim());
  const list=book.songs.map((s,i)=>({s,i})).filter(({s})=>!q||norm((s.number??'')+' '+s.title).includes(q)||String(s.number)===q);
  $('tabList').innerHTML=list.map(({s,i})=>`<button class="tab-item" type="button" data-i="${i}"><b>${s.number??'·'}</b><span>${esc(s.title)}</span></button>`).join('')||'<p class="tab-empty">Sin resultados.</p>';
}
$('tabSearch').addEventListener('input',renderList);
$('tabList').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(b)openSong(+b.dataset.i);});
$('tabOther').addEventListener('click',()=>{$('tabListPanel').hidden=true;$('tabSong').hidden=true;$('tabLoad').hidden=false;$('tabFile').click();});
$('tabBack').addEventListener('click',()=>{stop();$('tabSong').hidden=true;$('tabListPanel').hidden=false;history.replaceState(null,'','#');});

/* ───────── Digitación: dónde tocar cada nota ─────────
   Cuerdas de la 1.ª (MI agudo, índice 0) a la 6.ª (MI grave, índice 5). Tres formas de repartir las notas:
   · mid  «Mitad del mástil» (predeterminada): cuerdas 1.ª a 3.ª entre los trastes 3 y 12, mejor 1.ª y 2.ª entre 5 y 10.
          Suena a la altura real de la melodía (una octava más aguda que la guitarra normal).
   · low  «Cerca de la cejuela»: trastes bajos sin cuerdas al aire; una nota de cuerda al aire va en la cuerda
          siguiente (traste 5, o 4 al pasar de SI a SOL). Suena una octava más grave, como la guitarra normal.
   · open «Con cuerdas al aire»: como la anterior, pero usando cuerdas al aire. */
const OPEN=[64,59,55,50,45,40];
const MODES={
  mid:{shift:0,open:false,stat(o){
    const sp=[0,0.1,0.6,2.6,4,5][o.s];
    const fp=o.f<3?(3-o.f)*1.3+0.5:o.f>12?(o.f-12)*1.1+0.5:(o.f<5?(5-o.f)*0.18:o.f>10?(o.f-10)*0.18:0);
    return sp+fp;}},
  low:{shift:-12,open:false,stat:o=>(o.f>12?(o.f-12)*0.7:0)+o.f*0.025},
  open:{shift:-12,open:true,stat:o=>(o.f>12?(o.f-12)*0.7:0)+o.f*0.025}
};
function positions(p,allowOpen){const out=[];for(let s=0;s<6;s++){const f=p-OPEN[s];if(f>=(allowOpen?0:1)&&f<=17)out.push({s,f});}return out;}
function fingering(notes,modeName){
  const mode=MODES[modeName]||MODES.mid;
  const cand=notes.map(n=>{
    let p=n.midi+mode.shift,opts=positions(p,mode.open);
    if(!opts.length){p+=12;opts=positions(p,mode.open);}         // muy grave: una octava arriba
    if(!opts.length){p-=24;opts=positions(p,mode.open);}         // muy aguda: una octava abajo
    return{p,opts};
  });
  const stat=mode.stat;
  const move=(a,b)=>{
    if(a.f===0||b.f===0)return Math.abs(a.s-b.s)*0.15;
    const df=Math.abs(a.f-b.f);
    return (df<=3?df*0.22:1.1+(df-3)*0.55)+Math.abs(a.s-b.s)*0.12;
  };
  // Viterbi: el camino con menos saltos de la mano
  let prev=null;const back=[];
  cand.forEach((c,i)=>{
    const cost=c.opts.map(o=>{
      if(!prev)return{c:stat(o),from:-1};
      let best=1e9,from=-1;
      prev.forEach((pc,j)=>{const t=pc.c+move(cand[i-1].opts[j],o)+(notes[i].tied&&(cand[i-1].opts[j].s!==o.s||cand[i-1].opts[j].f!==o.f)?50:0);if(t<best){best=t;from=j;}});
      return{c:best+stat(o),from};
    });
    back.push(cost.map(x=>x.from));prev=cost;
  });
  const out=new Array(notes.length);
  if(!prev||!prev.length)return out;
  let j=prev.reduce((bi,x,i,arr)=>x.c<arr[bi].c?i:bi,0);
  for(let i=notes.length-1;i>=0;i--){const o=cand[i].opts[j];out[i]=o?{...o,p:cand[i].p}:null;j=back[i][j];}
  return out;
}

/* ───────── Dibujo de la tablatura ───────── */
const LATIN={C:'DO',D:'RE',E:'MI',F:'FA',G:'SOL',A:'LA',B:'SI'};
const latin=()=>store.get('circulos-notation','english')==='latin';
const chordName=t=>latin()?t.replace(/(^|\/)([A-G])/g,(m,a,b)=>a+LATIN[b]):t;
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEY_NAMES=['DO','SOL','RE','LA','MI','SI','FA♯','DO♯'],KEY_FLATS=['DO','FA','SI♭','MI♭','LA♭','RE♭','SOL♭','DO♭'];
const KEY_EN=['C','G','D','A','E','B','F♯','C♯'],KEY_EN_F=['C','F','B♭','E♭','A♭','D♭','G♭','C♭'];
function keyName(f){const L=latin();if(f>=0)return(L?KEY_NAMES:KEY_EN)[f]||'';return(L?KEY_FLATS:KEY_EN_F)[-f]||'';}

function openSong(i){
  song=book.songs[i];stop();
  $('tabListPanel').hidden=true;$('tabSong').hidden=false;
  $('tabSongNum').textContent=song.number!=null?`Canción ${song.number}`:'';
  $('tabSongTitle').textContent=song.title;
  const verses=Math.max(0,...song.measures.flatMap(m=>m.notes.map(n=>(n.lyrics||[]).length)));
  $('tabVerse').innerHTML='<option value="-1">Sin letra</option>'+Array.from({length:verses},(_,k)=>`<option value="${k}">Estrofa ${k+1}</option>`).join('');
  $('tabVerse').value=String(Math.min(prefs.verse,verses-1));
  $('tabSongInfo').textContent=[song.time&&`Compás ${song.time}`,`Tonalidad con ${song.fifths>0?song.fifths+' ♯':song.fifths<0?(-song.fifths)+' ♭':'sin alteraciones'} (${keyName(song.fifths)} mayor o su relativa menor)`,`páginas ${song.pages.join(', ')}`].filter(Boolean).join(' · ');
  history.replaceState(null,'','#'+(song.number??i));
  render();scrollTo({top:$('tabSong').offsetTop-80,behavior:'smooth'});
}
let events=[];
function render(){
  if(!song)return;
  const verse=+$('tabVerse').value,showChords=$('tabChords').checked,mode=$('tabMode').value;
  const [num,den]=(song.time||'4/4').split('/').map(Number),L=num*4/den||4,beat=den===8&&num%3===0?1.5:1;
  // eventos en orden con su digitación
  events=[];song.measures.forEach((m,mi)=>m.notes.forEach(n=>events.push({...n,mi,dur:n.dur||L})));
  const notes=events.filter(e=>!e.rest),pos=fingering(notes,mode);
  notes.forEach((n,i)=>{n.pos=pos[i];});
  // ancho natural de cada nota y de cada compás
  const sheet=$('tabSheet'),W=Math.max(300,sheet.clientWidth);
  const nw=e=>{let w=26+16*Math.sqrt(e.dur);const ly=verse>=0&&e.lyrics&&e.lyrics[verse];if(ly)w=Math.max(w,ly.length*6.4+10);
    if(showChords&&e.chords&&e.chords.length)w=Math.max(w,e.chords.reduce((a,c)=>a+chordName(c.text).length*6.6+6,0));return w;};
  const measures=song.measures.map((m,mi)=>{const ev=events.filter(e=>e.mi===mi);return{ev,w:14+ev.reduce((a,e)=>a+nw(e),0)};});
  const LEFT=26,lines=[];let cur=[],cw=LEFT;
  for(const m of measures){if(cur.length&&cw+m.w>W){lines.push(cur);cur=[];cw=LEFT;}cur.push(m);cw+=m.w;}
  if(cur.length)lines.push(cur);
  const hasChords=showChords&&events.some(e=>e.chords&&e.chords.length),hasLyr=verse>=0;
  const CH=hasChords?18:2,SP=11,TT=CH+10,TB=TT+5*SP,RY=TB+8,RH=20,LY=RY+RH+14,H=hasLyr?LY+8:RY+RH+6;
  let html='',idx=0,lastNote=null;
  lines.forEach((line,li)=>{
    const nat=LEFT+line.reduce((a,m)=>a+m.w,0),last=li===lines.length-1;
    const k=last&&nat<W*0.75?1:(W-2)/nat;
    let svg=`<svg class="tab-line" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Tablatura, línea ${li+1}">`;
    for(let s=0;s<6;s++)svg+=`<line class="tl-str" x1="0" x2="${(nat*k).toFixed(1)}" y1="${TT+s*SP}" y2="${TT+s*SP}"/>`;
    svg+=`<text class="tl-tab" x="7" y="${TT+SP*1.2}">T</text><text class="tl-tab" x="7" y="${TT+SP*2.7}">A</text><text class="tl-tab" x="7" y="${TT+SP*4.2}">B</text>`;
    svg+=`<line class="tl-bar" x1="0.5" x2="0.5" y1="${TT}" y2="${TB}"/>`;
    let x=LEFT*k,chordEnd=-1e9;
    const stems=[];
    line.forEach((m,mIdx)=>{
      let cx=x+8*k,t=0;
      m.ev.forEach(e=>{
        const w=nw(e)*k,c=cx+9;
        e.x=c;e.line=li;
        if(hasChords)for(const ch of e.chords||[]){
          const label=chordName(ch.text);let cxp=Math.max(c-4+(ch.at/(e.dur||1))*w,chordEnd+5);   // sin encimar acordes
          chordEnd=cxp+label.length*6.6;
          svg+=`<text class="tl-chord" x="${cxp.toFixed(1)}" y="${CH-4}">${esc(label)}</text>`;}
        if(e.rest){svg+=`<rect class="tl-rest" x="${(c-5).toFixed(1)}" y="${RY+6}" width="10" height="3.2" rx="1.6"/>`;stems.push({x:c,rest:true,t,dur:e.dur});}
        else if(e.pos){
          const y=TT+e.pos.s*SP,label=e.tied?`(${e.pos.f})`:String(e.pos.f);
          if(e.tied&&lastNote&&lastNote.line===li)svg+=`<path class="tl-tie" d="M${(lastNote.x+6).toFixed(1)} ${y-7} Q${((lastNote.x+c)/2).toFixed(1)} ${y-14} ${(c-8).toFixed(1)} ${y-7}"/>`;
          lastNote={x:c,line:li};
          svg+=`<g class="tl-note" data-i="${idx}"><text class="tl-fret${e.tied?' is-tied':''}" x="${c.toFixed(1)}" y="${y+4}">${label}</text></g>`;
          stems.push({x:c,t,dur:e.dur});
        }
        if(hasLyr&&e.lyrics&&e.lyrics[verse])svg+=`<text class="tl-lyr" x="${c.toFixed(1)}" y="${LY}">${esc(e.lyrics[verse])}</text>`;
        svg+=`<rect class="tl-hit" data-i="${idx}" x="${(cx).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H}"><title>Escuchar desde aquí</title></rect>`;
        e.idx=idx++;t+=e.dur;cx+=w;
      });
      x+=m.w*k;
      svg+=`<line class="tl-bar" x1="${(x-0.5).toFixed(1)}" x2="${(x-0.5).toFixed(1)}" y1="${TT}" y2="${TB}"/>`;
      // ritmo debajo: plicas, corcheas unidas por pulso, puntillos
      const ms=stems.splice(0);
      const groups=[];ms.forEach(st=>{if(st.rest||st.dur>=1||st.dur<=0){groups.push([st]);return;}const g=groups[groups.length-1];if(g&&!g[0].rest&&g[0].dur<1&&Math.floor((g[0].t+1e-6)/beat)===Math.floor((st.t+1e-6)/beat))g.push(st);else groups.push([st]);});
      for(const g of groups){
        for(const st of g){
          if(st.rest)continue;
          const len=st.dur>=4?0:st.dur>=2?9:RH-4;
          if(len)svg+=`<line class="tl-stem" x1="${st.x}" x2="${st.x}" y1="${RY}" y2="${RY+len}"/>`;
          else svg+=`<circle class="tl-whole" cx="${st.x}" cy="${RY+5}" r="3"/>`;
          if([0.75,1.5,3,6].some(d=>Math.abs(st.dur-d)<1e-6))svg+=`<circle class="tl-dot" cx="${st.x+4}" cy="${RY+len-1}" r="1.4"/>`;
        }
        const flagged=g.filter(st=>!st.rest&&st.dur<1);
        if(flagged.length>1){
          const a=flagged[0].x,b=flagged[flagged.length-1].x;
          svg+=`<line class="tl-beam" x1="${a}" x2="${b}" y1="${RY+RH-4}" y2="${RY+RH-4}"/>`;
          flagged.forEach((st,ii)=>{if(st.dur<=0.375){const nx=flagged[ii+1]?flagged[ii+1].x:st.x-6;svg+=`<line class="tl-beam" x1="${st.x}" x2="${ii+1<flagged.length?nx:st.x-6}" y1="${RY+RH-8}" y2="${RY+RH-8}"/>`;}});
        }else if(flagged.length===1){const st=flagged[0];svg+=`<path class="tl-flag" d="M${st.x} ${RY+RH-4} q5 -2 6 -8"/>`;if(st.dur<=0.375)svg+=`<path class="tl-flag" d="M${st.x} ${RY+RH-8} q5 -2 6 -8"/>`;}
      }
    });
    svg+='</svg>';html+=svg;
  });
  sheet.innerHTML=html;
}
['tabVerse','tabChords','tabMode'].forEach(id=>$(id).addEventListener('change',()=>{
  prefs.verse=+$('tabVerse').value;store.set('tab-verse',prefs.verse);store.set('tab-chords',$('tabChords').checked?'1':'0');store.set('tab-mode',$('tabMode').value);
  stop();render();
}));
$('tabChords').checked=prefs.chords;$('tabMode').value=MODES[prefs.mode]?prefs.mode:'mid';
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(!$('tabSong').hidden)render();},200);});
document.addEventListener('circulos:notation',()=>{if(song)render();});

/* ───────── Escuchar ───────── */
const tempo=$('tabTempo');tempo.value=prefs.tempo;$('tabTempoVal').textContent=prefs.tempo;
tempo.addEventListener('input',()=>{$('tabTempoVal').textContent=tempo.value;});
let timer=0,playing=false,soundReady=false;
function stop(){playing=false;clearTimeout(timer);window.CirculosPiano?.stopAll?.();document.querySelectorAll('.tl-note.is-now').forEach(n=>n.classList.remove('is-now'));const b=$('tabPlay');b.classList.remove('is-on');b.querySelector('span').textContent='Escuchar';}
function play(from){
  if(playing&&from==null){stop();return;}
  if(playing)stop();
  if(!window.CirculosPiano){toast('El sonido no está disponible');return;}
  window.CirculosPiano.unlock();
  playing=true;const b=$('tabPlay');b.classList.add('is-on');b.querySelector('span').textContent='Detener';
  let i=from||0,lastLine=from!=null?(events[from]||{}).line:-1;
  const step=()=>{
    if(!playing)return;
    if(i>=events.length){stop();return;}
    const e=events[i],ms=e.dur*60000/(+tempo.value);
    document.querySelectorAll('.tl-note.is-now').forEach(n=>n.classList.remove('is-now'));
    if(!e.rest&&e.pos){
      if(!e.tied)window.CirculosPiano.play(e.pos.p,{velocity:.8});
      const el=document.querySelector(`.tl-note[data-i="${e.idx}"]`);
      if(el){el.classList.add('is-now');if(e.line!==lastLine){lastLine=e.line;el.closest('svg').scrollIntoView({block:'center',behavior:'smooth'});}}
    }
    i++;timer=setTimeout(step,ms);
  };
  timer=setTimeout(step,soundReady?60:450);soundReady=true;      // la primera vez deja cargar el sonido
}
$('tabPlay').addEventListener('click',()=>play());
/* Al cambiar de pantalla o de pestaña, el sonido se corta */
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
addEventListener('pagehide',stop);
document.addEventListener('click',e=>{if(e.target.closest('a[href],#menuBtn,.app-choice'))stop();},true);
/* Tocar una nota de la tablatura: suena desde ahí (si ya estaba sonando, salta a esa nota) */
$('tabSheet').addEventListener('click',e=>{const h=e.target.closest('.tl-hit');if(h)play(+h.dataset.i);});
$('tabPrint').addEventListener('click',()=>{stop();print();});

/* ───────── Inicio: abre el último PDF leído en este dispositivo ───────── */
(async()=>{
  const last=await DB.get('last');
  if(last&&last.songs&&last.songs.length){
    book=last;showList();
    const h=decodeURIComponent(location.hash.slice(1));
    if(h){const i=book.songs.findIndex(s=>String(s.number)===h);if(i>=0)openSong(i);}
    $('tabDropTitle').textContent='Elegir otra partitura en PDF';
  }
})();
})();
