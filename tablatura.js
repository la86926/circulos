/* Círculos Music · Partitura (PDF) → tablatura de guitarra o ukelele, o notas para piano
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
const prefs={tempo:100,chords:store.get('tab-chords','1')==='1',mode:store.get('tab-mode','mid'),inst:store.get('tab-inst','guitar'),kb:true,verse:+store.get('tab-verse',0)};

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
$('tabOther').addEventListener('click',()=>{$('tabListPanel').hidden=true;$('tabSong').hidden=true;KB.refresh();FAB.refresh();$('tabLoad').hidden=false;$('tabFile').click();});
$('tabBack').addEventListener('click',()=>{stop();$('tabSong').hidden=true;$('tabListPanel').hidden=false;KB.refresh();FAB.refresh();history.replaceState(null,'','#');});

/* ───────── Digitación: dónde tocar cada nota ─────────
   Guitarra: cuerdas de la 1.ª (MI agudo, índice 0) a la 6.ª (MI grave, índice 5).
   Ukelele GCEA: 1.ª LA, 2.ª MI, 3.ª DO, 4.ª SOL (la 4.ª es aguda: afinación normal del ukelele).
   Tres formas de repartir las notas:
   · mid  «Mitad del mástil» (predeterminada): cuerdas agudas entre los trastes 3 y 12.
          En la guitarra suena a la altura real de la melodía (una octava más aguda que la guitarra normal).
   · low  «Cerca de la cejuela»: trastes bajos sin cuerdas al aire. En la guitarra suena una octava más grave.
   · open «Con cuerdas al aire»: como la anterior, pero usando cuerdas al aire.
   En el ukelele el DO más grave solo existe al aire, así que ahí la cuerda al aire se evita pero no se prohíbe. */
const INSTS={
  guitar:{strings:[64,59,55,50,45,40],maxFret:17,shift:{mid:0,low:-12,open:-12},sp:[0,0.1,0.6,2.6,4,5]},
  uke:{strings:[69,64,60,67],maxFret:15,shift:{mid:0,low:0,open:0},sp:[0,0.15,0.9,1.4],softOpen:true}
};
const midStat=(o,sp)=>sp[o.s]+(o.f<3?(3-o.f)*1.3+0.5:o.f>12?(o.f-12)*1.1+0.5:(o.f<5?(5-o.f)*0.18:o.f>10?(o.f-10)*0.18:0));
const lowStat=o=>(o.f>12?(o.f-12)*0.7:0)+o.f*0.025;
const MODES={mid:{open:false},low:{open:false},open:{open:true}};
function positions(p,inst,allowOpen){const out=[];inst.strings.forEach((o,s)=>{const f=p-o;if(f>=(allowOpen?0:1)&&f<=inst.maxFret)out.push({s,f});});return out;}
function fingering(notes,modeName,instName){
  const inst=INSTS[instName]||INSTS.guitar,mName=MODES[modeName]?modeName:'mid',mode=MODES[mName];
  const allowOpen=mode.open||!!inst.softOpen;
  let shift=inst.shift[mName];
  if(instName==='uke'){                                          // la canción entera una octava arriba si así cabe mejor
    const lo=Math.min(...inst.strings),hi=Math.max(...inst.strings)+12;
    const out=k=>notes.filter(n=>n.midi+k<lo||n.midi+k>hi).length;
    if(out(12)<out(0))shift=12;
  }
  const cand=notes.map(n=>{
    let p=n.midi+shift,opts=positions(p,inst,allowOpen);
    if(!opts.length){p+=12;opts=positions(p,inst,allowOpen);}         // muy grave: una octava arriba
    if(!opts.length){p-=24;opts=positions(p,inst,allowOpen);}         // muy aguda: una octava abajo
    return{p,opts};
  });
  const base=mName==='mid'?o=>midStat(o,inst.sp):lowStat;
  const stat=inst.softOpen&&!mode.open?o=>base(o)+(o.f===0?4:0):base;
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

/* ───────── Piano: nombre de cada nota con puntos de octava ─────────
   La octava del DO central (DO4–SI4) va sin puntos; un punto arriba = una octava más aguda (más a la derecha),
   dos puntos = dos octavas; un punto abajo = una octava más grave (más a la izquierda). */
const N_LAT_S=['Do','Do♯','Re','Re♯','Mi','Fa','Fa♯','Sol','Sol♯','La','La♯','Si'],N_LAT_F=['Do','Re♭','Re','Mi♭','Mi','Fa','Sol♭','Sol','La♭','La','Si♭','Si'];
const N_EN_S=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'],N_EN_F=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
function noteName(p,flats){const L=latin(),pc=((p%12)+12)%12;return(L?(flats?N_LAT_F:N_LAT_S):(flats?N_EN_F:N_EN_S))[pc];}
const octDots=p=>Math.floor(p/12)-1-4;
const isBlack=p=>[1,3,6,8,10].includes(((p%12)+12)%12);

/* ───────── Dibujo de la tablatura ───────── */
const LATIN={C:'DO',D:'RE',E:'MI',F:'FA',G:'SOL',A:'LA',B:'SI'};
const latin=()=>store.get('circulos-notation','english')==='latin';
const chordName=t=>latin()?t.replace(/(^|\/)([A-G])/g,(m,a,b)=>a+LATIN[b]):t;
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEY_NAMES=['DO','SOL','RE','LA','MI','SI','FA♯','DO♯'],KEY_FLATS=['DO','FA','SI♭','MI♭','LA♭','RE♭','SOL♭','DO♭'];
const KEY_EN=['C','G','D','A','E','B','F♯','C♯'],KEY_EN_F=['C','F','B♭','E♭','A♭','D♭','G♭','C♭'];
function keyName(f){const L=latin();if(f>=0)return(L?KEY_NAMES:KEY_EN)[f]||'';return(L?KEY_FLATS:KEY_EN_F)[-f]||'';}

function openSong(i){
  song=book.songs[i];stop();$('tabKb').checked=true;
  $('tabListPanel').hidden=true;$('tabSong').hidden=false;
  $('tabSongNum').textContent=song.number!=null?`Canción ${song.number}`:'';
  $('tabSongTitle').textContent=song.title;
  const verses=Math.max(0,...song.measures.flatMap(m=>m.notes.map(n=>(n.lyrics||[]).length)));
  $('tabVerse').innerHTML='<option value="-1">Sin letra</option>'+Array.from({length:verses},(_,k)=>`<option value="${k}">Estrofa ${k+1}</option>`).join('');
  $('tabVerse').value=String(Math.min(prefs.verse,verses-1));
  $('tabSongInfo').textContent=[song.time&&`Compás ${song.time}`,`Tonalidad con ${song.fifths>0?song.fifths+' ♯':song.fifths<0?(-song.fifths)+' ♭':'sin alteraciones'} (${keyName(song.fifths)} mayor o su relativa menor)`,`páginas ${song.pages.join(', ')}`].filter(Boolean).join(' · ');
  history.replaceState(null,'','#'+(song.number??i));
  render();scrollTo({top:$('tabSong').offsetTop-80,behavior:'smooth'});
  document.dispatchEvent(new CustomEvent('circulos:tabsong'));
}
let events=[];
const instNow=()=>$('tabInst').value;
function render(){
  if(!song)return;
  const verse=+$('tabVerse').value,showChords=$('tabChords').checked,mode=$('tabMode').value,inst=instNow(),piano=inst==='piano';
  const [num,den]=(song.time||'4/4').split('/').map(Number),L=num*4/den||4,beat=den===8&&num%3===0?1.5:1;
  const flats=song.fifths<0;
  // eventos en orden con su digitación (en el piano, la nota tal cual)
  events=[];song.measures.forEach((m,mi)=>m.notes.forEach(n=>events.push({...n,mi,dur:n.dur||L})));
  const notes=events.filter(e=>!e.rest);
  if(piano)notes.forEach(n=>{n.pos={p:n.midi};n.name=noteName(n.midi,flats);n.dots=octDots(n.midi);});
  else{const pos=fingering(notes,mode,inst);notes.forEach((n,i)=>{n.pos=pos[i];});}
  // ancho natural de cada nota y de cada compás
  const sheet=$('tabSheet'),W=Math.max(300,sheet.clientWidth);
  const nw=e=>{let w=26+16*Math.sqrt(e.dur);const ly=verse>=0&&e.lyrics&&e.lyrics[verse];if(ly)w=Math.max(w,ly.length*6.4+10);
    if(piano&&e.name)w=Math.max(w,e.name.length*8+12);
    if(showChords&&e.chords&&e.chords.length)w=Math.max(w,e.chords.reduce((a,c)=>a+chordName(c.text).length*6.6+6,0));return w;};
  const measures=song.measures.map((m,mi)=>{const ev=events.filter(e=>e.mi===mi);return{ev,w:14+ev.reduce((a,e)=>a+nw(e),0)};});
  const LEFT=piano?10:26,lines=[];let cur=[],cw=LEFT;
  for(const m of measures){if(cur.length&&cw+m.w>W){lines.push(cur);cur=[];cw=LEFT;}cur.push(m);cw+=m.w;}
  if(cur.length)lines.push(cur);
  const hasChords=showChords&&events.some(e=>e.chords&&e.chords.length),hasLyr=verse>=0;
  const NS=piano?0:INSTS[inst].strings.length,CH=hasChords?18:2,SP=piano?0:(NS===4?12:11);
  // piano: una fila de nombres (NB = línea base); tablatura: NS cuerdas entre TT y TB
  const TT=CH+10,TB=piano?0:TT+(NS-1)*SP,NB=CH+30,BT=piano?NB-24:TT,BB=piano?NB+14:TB;
  const RY=piano?NB+18:TB+8,RH=20,LY=RY+RH+14,H=hasLyr?LY+8:RY+RH+6;
  let html='',idx=0,lastNote=null;
  lines.forEach((line,li)=>{
    const nat=LEFT+line.reduce((a,m)=>a+m.w,0),last=li===lines.length-1;
    const k=last&&nat<W*0.75?1:(W-2)/nat;
    let svg=`<svg class="tab-line${piano?' is-piano':''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${piano?'Notas para piano':'Tablatura'}, línea ${li+1}">`;
    if(!piano){
      for(let s=0;s<NS;s++)svg+=`<line class="tl-str" x1="0" x2="${(nat*k).toFixed(1)}" y1="${TT+s*SP}" y2="${TT+s*SP}"/>`;
      const span=(NS-1)*SP;
      svg+=`<text class="tl-tab" x="7" y="${TT+span*.24+3}">T</text><text class="tl-tab" x="7" y="${TT+span*.54+3}">A</text><text class="tl-tab" x="7" y="${TT+span*.84+3}">B</text>`;
    }
    svg+=`<line class="tl-bar" x1="0.5" x2="0.5" y1="${BT}" y2="${BB}"/>`;
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
        else if(piano){
          if(e.tied&&lastNote&&lastNote.line===li)svg+=`<path class="tl-tie" d="M${(lastNote.x+8).toFixed(1)} ${NB+6} Q${((lastNote.x+c)/2).toFixed(1)} ${NB+13} ${(c-8).toFixed(1)} ${NB+6}"/>`;
          lastNote={x:c,line:li};
          const bw=e.name.length*8.4+12;
          let g=`<g class="tl-note${e.tied?' is-tied':''}" data-i="${idx}"><rect class="tl-now" x="${(c-bw/2).toFixed(1)}" y="${NB-16-(e.dots>1?5.5:0)}" width="${bw.toFixed(1)}" height="${22+(Math.abs(e.dots)>1?5.5:0)}" rx="8"/><text class="tl-name" x="${c.toFixed(1)}" y="${NB}">${esc(e.name)}</text>`;
          for(let d=1;d<=Math.abs(e.dots);d++){const y=e.dots>0?NB-13-(d-1)*5.5:NB+5+(d-1)*5.5;g+=`<circle class="tl-oct" cx="${c.toFixed(1)}" cy="${y}" r="1.9"/>`;}
          svg+=g+'</g>';
          stems.push({x:c,t,dur:e.dur});
        }
        else if(e.pos){
          const y=TT+e.pos.s*SP,label=e.tied?`(${e.pos.f})`:String(e.pos.f);
          if(e.tied&&lastNote&&lastNote.line===li)svg+=`<path class="tl-tie" d="M${(lastNote.x+6).toFixed(1)} ${y-7} Q${((lastNote.x+c)/2).toFixed(1)} ${y-14} ${(c-8).toFixed(1)} ${y-7}"/>`;
          lastNote={x:c,line:li};
          const bw=label.length*8+12;
          svg+=`<g class="tl-note" data-i="${idx}"><rect class="tl-now" x="${(c-bw/2).toFixed(1)}" y="${y-8}" width="${bw}" height="16" rx="6"/><text class="tl-fret${e.tied?' is-tied':''}" x="${c.toFixed(1)}" y="${y+4}">${label}</text></g>`;
          stems.push({x:c,t,dur:e.dur});
        }
        if(hasLyr&&e.lyrics&&e.lyrics[verse])svg+=`<text class="tl-lyr" x="${c.toFixed(1)}" y="${LY}">${esc(e.lyrics[verse])}</text>`;
        svg+=`<rect class="tl-hit" data-i="${idx}" x="${(cx).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H}"><title>Escuchar desde aquí</title></rect>`;
        e.idx=idx++;t+=e.dur;cx+=w;
      });
      x+=m.w*k;
      svg+=`<line class="tl-bar" x1="${(x-0.5).toFixed(1)}" x2="${(x-0.5).toFixed(1)}" y1="${BT}" y2="${BB}"/>`;
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
  sheet.innerHTML=html;lastW=sheet.clientWidth;
  KB.setSong(piano?notes.map(n=>n.midi):null,flats);
}
function syncInst(){const v=instNow(),piano=v==='piano';$('tabModeWrap').hidden=piano;$('tabKbWrap').hidden=!piano;
  document.querySelectorAll('.tab-inst [data-inst]').forEach(b=>{const on=b.dataset.inst===v;b.classList.toggle('is-on',on);b.setAttribute('aria-checked',on);});}
document.querySelector('.tab-inst').addEventListener('click',e=>{const b=e.target.closest('[data-inst]');if(!b||b.dataset.inst===instNow())return;
  if(b.dataset.inst==='piano')$('tabKb').checked=true;
  $('tabInst').value=b.dataset.inst;$('tabInst').dispatchEvent(new Event('change'));});
['tabVerse','tabChords','tabMode','tabInst'].forEach(id=>$(id).addEventListener('change',()=>{
  prefs.verse=+$('tabVerse').value;store.set('tab-verse',prefs.verse);store.set('tab-chords',$('tabChords').checked?'1':'0');store.set('tab-mode',$('tabMode').value);store.set('tab-inst',instNow());
  syncInst();stop();render();
}));
$('tabChords').checked=prefs.chords;$('tabMode').value=MODES[prefs.mode]?prefs.mode:'mid';
$('tabInst').value=['guitar','uke','piano'].includes(prefs.inst)?prefs.inst:'guitar';syncInst();
$('tabKb').checked=prefs.kb;
$('tabKb').addEventListener('change',()=>KB.refresh());
let rz=0,lastW=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{     // en el celular la barra de direcciones cambia el alto: eso no redibuja
  const w=$('tabSheet').clientWidth;if(!$('tabSong').hidden&&w&&w!==lastW){lastW=w;render();}},200);});
document.addEventListener('circulos:notation',()=>{if(song)render();});

/* ───────── Teclado flotante (solo piano) ─────────
   Muestra de la nota más grave a la más aguda de la canción, completo, sin desplazarse.
   Se arrastra con el dedo o el ratón, se agranda o achica con dos dedos (en PC: Ctrl + rueda, o la esquina),
   y se quita con la X. Las teclas se iluminan mientras suena la canción y suenan al tocarlas. */
const KB=(()=>{
  const el=document.createElement('div');el.className='kb-float';el.id='kbFloat';el.hidden=true;
  el.innerHTML='<div class="kb-grip" aria-hidden="true"></div><button class="kb-close" type="button" aria-label="Quitar el teclado"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg></button><svg class="kb-svg" role="img" aria-label="Teclado de piano"></svg><span class="kb-resize" aria-hidden="true"></span>';
  document.body.appendChild(el);
  const svg=el.querySelector('.kb-svg'),WW=10,WH=42,BW=6.2,BH=26;
  let lo=60,hi=72,flats=false,has=false,nWhite=8,st=null,lit=null,drawn='';
  try{st=JSON.parse(store.get('tab-kb-pos2','null'));}catch(e){st=null;}
  const minW=()=>Math.min(140,innerWidth-16),maxW=()=>Math.max(innerWidth*1.6,1200);
  const clampW=w=>Math.max(minW(),Math.min(maxW(),w));
  function headerBottom(){const h=document.querySelector('.app-header');return h?h.getBoundingClientRect().bottom:60;}
  function defaults(){
    const aspect=nWhite*WW/WH,phone=innerWidth<700;
    const w=phone?Math.max(170,innerWidth*.5):Math.min(innerWidth-16,920,Math.max(300,(innerHeight*.3-24)*aspect));   // celular: la mitad de la pantalla
    return{w,x:(innerWidth-w)/2,y:headerBottom()+8};}
  function place(){
    if(!st)st=defaults();
    st.w=clampW(st.w);el.style.width=st.w+'px';
    // siempre entero dentro de la pantalla (si es más ancho que la pantalla, al menos sin huecos a los lados)
    const h=el.offsetHeight||120,top=headerBottom()+4;
    st.x=st.w<=innerWidth-8?Math.max(4,Math.min(innerWidth-st.w-4,st.x)):Math.min(4,Math.max(innerWidth-st.w-4,st.x));
    st.y=Math.max(top,Math.min(innerHeight-h-4,st.y));el.style.transform=`translate3d(${st.x}px,${st.y}px,0)`;
  }
  let raf=0;const placeSoon=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;place();});};
  const save=()=>store.set('tab-kb-pos2',JSON.stringify({x:Math.round(st.x),y:Math.round(st.y),w:Math.round(st.w)}));
  function dots(cx,y0,d,step){let h='';for(let k=1;k<=Math.abs(d);k++)h+=`<circle class="kb-oct" cx="${cx}" cy="${d>0?y0-(k-1)*step:y0+(k-1)*step}" r=".85"/>`;return h;}
  function draw(){
    const whites=[];for(let m=lo;m<=hi;m++)if(!isBlack(m))whites.push(m);
    nWhite=whites.length;
    svg.setAttribute('viewBox',`0 0 ${nWhite*WW} ${WH}`);svg.style.aspectRatio=`${nWhite*WW} / ${WH}`;
    const wx={};let h='';
    whites.forEach((m,i)=>{wx[m]=i*WW;const cx=i*WW+WW/2,d=octDots(m);
      h+=`<g class="kb-key kb-w" data-m="${m}"><rect x="${i*WW+.3}" y=".3" width="${WW-.6}" height="${WH-.6}" rx="1.3"/><text x="${cx}" y="${WH-6.2}">${esc(noteName(m,flats))}</text>${d>0?dots(cx,WH-12.6,d,2.4):dots(cx,WH-3.1,d,2.4)}</g>`;});
    for(let m=lo;m<=hi;m++)if(isBlack(m)&&wx[m-1]!=null){const x=wx[m-1]+WW-BW/2,cx=x+BW/2,d=octDots(m);
      h+=`<g class="kb-key kb-b" data-m="${m}"><rect x="${x}" y="0" width="${BW}" height="${BH}" rx="1"/><text x="${cx}" y="${BH-4.4}">${esc(noteName(m,flats))}</text>${d>0?dots(cx,BH-9.4,d,2):dots(cx,BH-2,d,2)}</g>`;}
    svg.innerHTML=h;lit=null;
  }
  function refresh(){
    const show=has&&$('tabKb').checked&&!$('tabSong').hidden&&instNow()==='piano';
    el.hidden=!show;if(show)place();
  }
  function setSong(midis,fl){
    if(!midis||!midis.length){has=false;refresh();return;}
    let a=Math.min(...midis),z=Math.max(...midis);while(isBlack(a))a--;while(isBlack(z))z++;
    const key=a+'|'+z+'|'+fl+'|'+latin();
    if(key!==drawn){lo=a;hi=z;flats=fl;draw();drawn=key;}
    has=true;refresh();
  }
  function light(m){
    if(lit)lit.classList.remove('is-on');lit=null;
    if(m==null)return;
    const k=svg.querySelector(`.kb-key[data-m="${m}"]`);if(k){k.classList.add('is-on');lit=k;}
  }
  // arrastrar, pellizcar y tocar teclas
  const pts=new Map();let drag=null,pinch=null;
  const two=()=>{const [a,b]=[...pts.values()];return{d:Math.hypot(a.x-b.x,a.y-b.y)||1,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};};
  el.addEventListener('pointerdown',e=>{
    if(e.target.closest('.kb-close'))return;
    e.preventDefault();try{el.setPointerCapture(e.pointerId);}catch(err){}
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===1)drag={x0:e.clientX,y0:e.clientY,px:st.x,py:st.y,w0:st.w,moved:false,resize:!!e.target.closest('.kb-resize'),key:e.target.closest('.kb-key')};
    else if(pts.size===2){const g=two();pinch={d0:g.d,cx0:g.cx,cy0:g.cy,w0:st.w,px:st.x,py:st.y};if(drag)drag.moved=true;}
  });
  el.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId))return;
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&pts.size>=2){
      const g=two(),w=clampW(pinch.w0*g.d/pinch.d0),r=w/pinch.w0;
      st.w=w;st.x=g.cx-(pinch.cx0-pinch.px)*r;st.y=g.cy-(pinch.cy0-pinch.py)*r;placeSoon();
    }else if(drag){
      const dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;
      if(!drag.moved&&Math.hypot(dx,dy)>6)drag.moved=true;
      if(drag.moved){if(drag.resize)st.w=clampW(drag.w0+dx);else{st.x=drag.px+dx;st.y=drag.py+dy;}placeSoon();}
    }
  });
  const end=e=>{
    if(!pts.has(e.pointerId))return;
    pts.delete(e.pointerId);
    if(pts.size<2&&pinch){pinch=null;drag=null;}
    if(pts.size===0){
      if(drag&&!drag.moved&&drag.key&&e.type==='pointerup'&&window.CirculosPiano){
        const m=+drag.key.dataset.m;window.CirculosPiano.unlock();window.CirculosPiano.play(m,{velocity:.8});
        if(!playing){light(m);setTimeout(()=>{if(!playing)light(null);},350);}
      }
      drag=null;save();
    }
  };
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  el.addEventListener('wheel',e=>{                                  // PC: Ctrl + rueda o pellizco del touchpad
    if(!e.ctrlKey)return;e.preventDefault();
    const w=clampW(st.w*Math.exp(-e.deltaY*0.01)),r=w/st.w;
    st.x=e.clientX-(e.clientX-st.x)*r;st.y=e.clientY-(e.clientY-st.y)*r;st.w=w;placeSoon();clearTimeout(el._t);el._t=setTimeout(save,300);
  },{passive:false});
  el.querySelector('.kb-close').addEventListener('click',()=>{$('tabKb').checked=false;refresh();});   // se quita solo en esta canción
  addEventListener('resize',()=>{if(!el.hidden)placeSoon();});
  return{setSong,refresh,light};
})();

/* ───────── Escuchar ───────── */
const tempo=$('tabTempo');tempo.value=prefs.tempo;$('tabTempoVal').textContent=prefs.tempo;
tempo.addEventListener('input',()=>{$('tabTempoVal').textContent=tempo.value;});
let timer=0,playing=false,paused=false,pos=0,cur=-1,soundReady=false,nowEl=null;
const ICON_PLAY='M8 5.5v13l10.5-6.5Z',ICON_PAUSE='M7 5.5h3.6v13H7ZM13.4 5.5H17v13h-3.6Z';
function ui(){
  const b=$('tabPlay');b.classList.toggle('is-on',playing);
  b.querySelector('span').textContent=playing?'Pausa':paused?'Continuar':'Escuchar';
  b.querySelector('path').setAttribute('d',playing?ICON_PAUSE:ICON_PLAY);
  FAB.sync();
}
function halt(keepMark){
  playing=false;clearTimeout(timer);window.CirculosPiano?.stopAll?.();
  if(!keepMark){KB.light(null);if(nowEl){nowEl.classList.remove('is-now');nowEl=null;}}
}
/* Pausa: el sonido se corta, la nota queda marcada y al continuar se retoma desde ella */
function pause(){if(!playing)return;halt(true);paused=true;if(cur>=0)pos=cur;ui();}
/* Detener del todo: vuelve al inicio (cambio de canción, de instrumento, fin de la canción) */
function stop(){halt(false);paused=false;pos=0;ui();}
function play(from){
  if(playing&&from==null){pause();return;}
  if(playing)halt(false);
  if(!window.CirculosPiano){toast('El sonido no está disponible');return;}
  window.CirculosPiano.unlock();
  const resume=from==null&&paused;
  if(from!=null)pos=from;else if(!paused)pos=0;
  if(pos>=events.length)pos=0;
  let lastLine=from!=null||resume?(events[pos]||{}).line:-1;
  playing=true;paused=false;cur=-1;ui();
  const step=()=>{
    if(!playing)return;
    if(pos>=events.length){stop();return;}
    const e=events[pos],ms=e.dur*60000/(+tempo.value);cur=pos;
    if(nowEl){nowEl.classList.remove('is-now');nowEl=null;}
    KB.light(!e.rest&&e.pos?e.pos.p:null);
    if(!e.rest&&e.pos){
      if(!e.tied||e.idx===resumeIdx)window.CirculosPiano.play(e.pos.p,{velocity:.8});
      const el=document.querySelector(`.tl-note[data-i="${e.idx}"]`);
      if(el){el.classList.add('is-now');nowEl=el;if(e.line!==lastLine){lastLine=e.line;el.closest('svg').scrollIntoView({block:'center',behavior:'smooth'});}}
    }
    pos++;timer=setTimeout(step,ms);
  };
  const resumeIdx=pos;                                            // la primera nota al continuar suena aunque esté ligada
  timer=setTimeout(step,soundReady?60:450);soundReady=true;      // la primera vez deja cargar el sonido
}
$('tabPlay').addEventListener('click',()=>play());
/* ───────── Botón flotante de Escuchar / Detener ─────────
   Aparece abajo a la izquierda cuando el botón normal sale de la pantalla al bajar; se puede arrastrar. */
const FAB=(()=>{
  const el=document.createElement('div');el.className='tab-fab';el.id='tabFab';
  el.innerHTML='<button type="button" aria-label="Escuchar"><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5Z"/></svg><svg class="i-stop" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.6v13H7ZM13.4 5.5H17v13h-3.6Z"/></svg></button>';
  document.body.appendChild(el);
  const btn=el.querySelector('button'),S=58;
  let st=null,raf=0,offscreen=false,drag=null,moved=false;
  try{st=JSON.parse(store.get('tab-fab-pos','null'));}catch(e){st=null;}
  function place(){
    if(!st)st={x:16,y:innerHeight-S-24};
    st.x=Math.max(4,Math.min(innerWidth-S-4,st.x));st.y=Math.max(70,Math.min(innerHeight-S-4,st.y));
    el.style.transform=`translate3d(${st.x}px,${st.y}px,0)`;
  }
  const placeSoon=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;place();});};
  function refresh(){const show=offscreen&&!$('tabSong').hidden;el.classList.toggle('show',show);if(show)place();}
  function sync(){el.classList.toggle('is-on',playing);btn.setAttribute('aria-label',playing?'Pausa':paused?'Continuar':'Escuchar');}
  new IntersectionObserver(([en])=>{offscreen=!en.isIntersecting;refresh();},{rootMargin:'-90px 0px 0px 0px'}).observe($('tabPlay'));
  btn.addEventListener('pointerdown',e=>{try{btn.setPointerCapture(e.pointerId);}catch(err){}drag={x0:e.clientX,y0:e.clientY,px:st.x,py:st.y};moved=false;});
  btn.addEventListener('pointermove',e=>{
    if(!drag)return;const dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;
    if(!moved&&Math.hypot(dx,dy)>6)moved=true;
    if(moved){st.x=drag.px+dx;st.y=drag.py+dy;placeSoon();}
  });
  const end=()=>{if(drag&&moved)store.set('tab-fab-pos',JSON.stringify({x:Math.round(st.x),y:Math.round(st.y)}));drag=null;};
  btn.addEventListener('pointerup',end);btn.addEventListener('pointercancel',end);
  btn.addEventListener('click',()=>{if(moved){moved=false;return;}play();});
  addEventListener('resize',()=>{if(el.classList.contains('show'))placeSoon();});
  return{refresh,sync};
})();

/* Al cambiar de pantalla o de pestaña, el sonido se corta */
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
addEventListener('pagehide',()=>pause());
document.addEventListener('click',e=>{if(e.target.closest('a[href],#menuBtn,.app-choice'))stop();},true);
/* Tocar una nota de la tablatura: suena desde ahí (si ya estaba sonando, salta a esa nota) */
$('tabSheet').addEventListener('click',e=>{const h=e.target.closest('.tl-hit');if(h)play(+h.dataset.i);});
$('tabPrint').addEventListener('click',()=>{pause();print();});

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
