/* Círculos Music · lectura de partituras en PDF exportadas desde programas de notación (Sibelius, Finale, MuseScore).
   Recibe lo que extrae extract.js de cada página y devuelve la melodía (voz superior del pentagrama de clave de sol)
   con duración, cifrado de acordes y sílabas de la letra. No usa reconocimiento de imágenes: lee los símbolos exactos. */
(function(root){
'use strict';

/* ───────── Símbolos ───────── */
const MUSIC_FONT=/opus|maestro|bravura|leland|petaluma|emmentaler|sebastian|finale|november|gonville|musescore|engraver|jazz/i;
const CHORD_FONT=/chord/i;
const SM={                      // SMuFL (MuseScore, Dorico, Sibelius moderno)
  '':'q','':'h','':'w','':'G','':'F','':'C',
  '':'b','':'n','':'#','':'x','':'bb','':'.',
  '':'f1','':'f1','':'f2','':'f2','':'f3','':'f3'
};
const LEGACY={                  // Opus / Maestro (misma tabla de caracteres)
  'œ':'q','Ï':'q','ú':'q','˙':'h','w':'w','W':'w2',
  '&':'G','?':'F','B':'C',
  'b':'b','#':'#','n':'n','º':'bb','Ü':'x',
  '™':'.','k':'.',
  'j':'f1','J':'f1','r':'f2','R':'f2',
  'Œ':'r1','‰':'r0.5','Ó':'r2','∑':'rm','≈':'r0.25','î':'r4'
};
function kindOf(g){
  if(SM[g.ch])return SM[g.ch];
  if(MUSIC_FONT.test(g.fontName)&&!CHORD_FONT.test(g.fontName))return LEGACY[g.ch]||(/^[0-9]$/.test(g.ch)?'d'+g.ch:null);
  return null;
}
const isNotehead=k=>k==='q'||k==='h'||k==='w'||k==='w2';
const isAcc=k=>k==='b'||k==='#'||k==='n'||k==='bb'||k==='x';
const ACC_ALTER={b:-1,'#':1,n:0,bb:-2,x:2};
const LETTER_SEMI=[0,2,4,5,7,9,11];
const NAMES=['C','D','E','F','G','A','B'];
const SHARP_ORDER=[3,0,4,1,5,2,6],FLAT_ORDER=[6,2,5,1,4,0,3];   // F C G D A E B / B E A D G C F (índice de letra)
const CLEF_BASE={G:30,F:18,C:24};                                  // nota de la 1.ª línea (abajo): MI4, SOL2, FA3

/* ───────── Pentagramas ───────── */
function findStaves(segs){
  const h=segs.filter(s=>Math.abs(s.y0-s.y1)<0.35&&Math.abs(s.x1-s.x0)>30)
    .map(s=>({y:(s.y0+s.y1)/2,x0:Math.min(s.x0,s.x1),x1:Math.max(s.x0,s.x1)}));
  // une tramos de la misma línea
  h.sort((a,b)=>b.y-a.y||a.x0-b.x0);
  const lines=[];
  for(const l of h){const last=lines.find(m=>Math.abs(m.y-l.y)<0.25&&l.x0<=m.x1+3&&l.x1>=m.x0-3);if(last){last.x0=Math.min(last.x0,l.x0);last.x1=Math.max(last.x1,l.x1);}else lines.push({...l});}
  lines.sort((a,b)=>b.y-a.y);
  const staves=[],used=new Set();
  for(let i=0;i<lines.length;i++){
    if(used.has(i))continue;
    const a=lines[i],grp=[i];
    for(let j=i+1;j<lines.length&&grp.length<5;j++){
      const b=lines[j],prev=lines[grp[grp.length-1]];
      if(Math.abs(b.x0-a.x0)>6||Math.abs(b.x1-a.x1)>6)continue;
      const gap=prev.y-b.y;
      if(grp.length===1){if(gap>2&&gap<14)grp.push(j);else if(gap>=14)break;}
      else{const s=lines[grp[0]].y-lines[grp[1]].y;if(Math.abs(gap-s)<0.35)grp.push(j);else if(gap>s+0.35)break;}
    }
    if(grp.length===5){grp.forEach(k=>used.add(k));const ys=grp.map(k=>lines[k].y);
      staves.push({yTop:ys[0],yBot:ys[4],s:(ys[0]-ys[4])/4,x0:a.x0,x1:a.x1});}
  }
  return staves.sort((a,b)=>b.yTop-a.yTop);
}

/* ───────── Página → sistemas con melodía ───────── */
function analyzePage(raw){
  const mus=[],chordG=[],textG=[];
  for(const g of raw.glyphs){
    const k=kindOf(g);
    if(k){mus.push({...g,k});continue;}
    if(CHORD_FONT.test(g.fontName)){chordG.push(g);continue;}
    if(MUSIC_FONT.test(g.fontName))continue;
    if(g.ch&&g.ch.trim())textG.push(g);
  }
  const staves=findStaves(raw.segs);
  if(!staves.length)return {systems:[],textG};
  // clave de cada pentagrama
  for(const st of staves){
    const c=mus.find(g=>(g.k==='G'||g.k==='F'||g.k==='C')&&g.x<st.x0+6*st.s&&g.y<=st.yTop+st.s&&g.y>=st.yBot-st.s);
    st.clef=c?c.k:'G';st.clefX=c?c.x+(c.w||st.s*3.5):st.x0;
  }
  // sistemas: clave de sol seguida de clave de fa cercana → piano/coro; la de arriba lleva la melodía
  const systems=[];
  for(let i=0;i<staves.length;i++){
    const st=staves[i],nx=staves[i+1];
    if(st.clef!=='G')continue;
    const paired=nx&&nx.clef==='F'&&(st.yBot-nx.yTop)<14*st.s;
    systems.push({staff:st,lower:paired?nx:null,next:staves[i+1]||null});
    if(paired)i++;
  }
  // a qué pentagrama pertenece cada símbolo (el más cercano)
  const nearest=y=>{let b=null,bd=1e9;for(const st of staves){const c=(st.yTop+st.yBot)/2,d=Math.abs(y-c);if(d<bd){bd=d;b=st;}}return b;};
  const vsegs=raw.segs.filter(s=>Math.abs(s.x0-s.x1)<0.35&&Math.abs(s.y1-s.y0)>1).map(s=>({x:(s.x0+s.x1)/2,y0:Math.min(s.y0,s.y1),y1:Math.max(s.y0,s.y1),lw:s.lw}));
  for(const sys of systems){
    const st=sys.staff,s=st.s;
    const own=mus.filter(g=>nearest(g.y)===st&&g.y<=st.yTop+7*s&&g.y>=st.yBot-7*s);
    const heads=own.filter(g=>isNotehead(g.k)).sort((a,b)=>a.x-b.x||b.y-a.y);
    const hw=heads.length?median(heads.map(h=>h.w||s*1.7)):s*1.7;
    const accs=own.filter(g=>isAcc(g.k));
    const attached=a=>heads.some(h=>Math.abs(h.y-a.y)<0.4*s&&h.x-a.x>0&&h.x-a.x<3.4*s);
    const firstX=heads.length?heads[0].x:st.x1;
    // armadura y compás (antes de la primera nota)
    const keyAcc=accs.filter(a=>a.x>st.clefX-2&&a.x<firstX&&!attached(a));
    const fl=keyAcc.filter(a=>a.k==='b').length,sh=keyAcc.filter(a=>a.k==='#').length;
    st.fifths=sh?sh:-fl;
    const digits=own.filter(g=>/^d/.test(g.k)&&g.x<firstX&&g.x>st.clefX-2).sort((a,b)=>b.y-a.y);
    if(digits.length>=2){const mid=(st.yTop+st.yBot)/2;const up=digits.filter(d=>d.y>mid).sort((a,b)=>a.x-b.x).map(d=>d.k[1]).join(''),dn=digits.filter(d=>d.y<=mid).sort((a,b)=>a.x-b.x).map(d=>d.k[1]).join('');if(up&&dn)st.time=up+'/'+dn;}
    // barras de compás: tocan la línea superior e inferior del pentagrama
    const bars=dedupe(vsegs.filter(v=>v.x>firstX-hw&&v.x<=st.x1+1&&Math.abs(v.y1-st.yTop)<0.6&&v.y0<=st.yBot+0.6&&!heads.some(h=>v.x>h.x-0.8&&v.x<h.x+hw+0.8&&Math.abs(h.y-(v.y0+v.y1)/2)<3*s)).map(v=>v.x).sort((a,b)=>a-b),1.5);
    // columnas (notas que suenan juntas)
    // Dos notas van juntas si están alineadas (o se enciman), o si son vecinas (una segunda) y una quedó corrida al lado.
    // Se agrupan todas las conectadas, así un acorde no se parte aunque una de sus notas esté corrida.
    const par=heads.map((_,i)=>i),find=i=>par[i]===i?i:(par[i]=find(par[i]));
    for(let i=0;i<heads.length;i++)for(let j=i+1;j<heads.length;j++){
      const a=heads[i],b=heads[j],dx=Math.abs(a.x-b.x);
      if(dx>=1.25*hw)continue;
      if(dx<0.9*hw||Math.abs(a.y-b.y)<0.6*s)par[find(i)]=find(j);   // cabezas que se enciman no pueden ir una después de otra
    }
    const byRoot=new Map();
    heads.forEach((h,i)=>{const r=find(i);if(!byRoot.has(r))byRoot.set(r,{x:h.x,heads:[]});const c=byRoot.get(r);c.heads.push(h);c.x=Math.min(c.x,h.x);});
    const cols=[...byRoot.values()].sort((a,b)=>a.x-b.x);
    // altura de cada nota con alteraciones del compás
    const base=CLEF_BASE[st.clef]??30;
    const keyAlter=d=>{const L=((d%7)+7)%7;if(st.fifths>0)return SHARP_ORDER.slice(0,st.fifths).includes(L)?1:0;if(st.fifths<0)return FLAT_ORDER.slice(0,-st.fifths).includes(L)?-1:0;return 0;};
    let measureAcc={},bi=0;
    const allHeads=heads.slice().sort((a,b)=>a.x-b.x);
    for(const h of allHeads){
      while(bi<bars.length&&bars[bi]<h.x-0.5){bi++;measureAcc={};}
      h.D=base+Math.round((h.y-st.yBot)/(s/2));
      const acc=accs.filter(a=>Math.abs(a.y-h.y)<0.4*s&&h.x-a.x>0&&h.x-a.x<3.4*s&&!keyAcc.includes(a)).sort((a,b)=>b.x-a.x)[0];
      if(acc)measureAcc[h.D]=ACC_ALTER[acc.k];
      const alter=h.D in measureAcc?measureAcc[h.D]:keyAlter(h.D);
      const L=((h.D%7)+7)%7,oct=Math.floor(h.D/7);
      h.midi=12*(oct+1)+LETTER_SEMI[L]+alter;h.alter=alter;
    }
    // plica de cada nota: hacia arriba (voz de la melodía) o hacia abajo (voz de abajo)
    for(const h of heads){
      const up=vsegs.find(v=>v.x>h.x+0.5*hw&&v.x<h.x+hw+1&&v.y0<=h.y+0.8*s&&v.y1>=h.y+2*s);
      const dn=vsegs.find(v=>v.x>h.x-1&&v.x<h.x+0.5*hw&&v.y1>=h.y-0.8*s&&v.y0<=h.y-2*s);
      h.stem=up&&!dn?{dir:'up',seg:up}:dn&&!up?{dir:'down',seg:dn}:up&&dn?{dir:'up',seg:up}:null;
    }
    // ¿hay dos voces en el pentagrama? (melodía con plicas arriba y otra voz con plicas abajo)
    const twoVoices=cols.filter(c=>c.heads.some(h=>h.stem&&h.stem.dir==='up')&&c.heads.some(h=>h.stem&&h.stem.dir==='down')).length>=1;
    const midY=st.yBot+2*s;
    // melodía: en cada columna donde empieza una nota de la voz de arriba, la nota más aguda de todas las que suenan juntas.
    // (En un acorde con notas vecinas, la de arriba se dibuja corrida al otro lado de la plica y parecía de otra voz.)
    const fills=raw.fills;
    const restsAll=own.filter(g=>/^r/.test(g.k));
    const melodyCols=[];
    for(const c of cols){
      const cand=twoVoices?c.heads.filter(h=>(h.stem&&h.stem.dir==='up')||(!h.stem&&(h.k==='w'||h.k==='w2'||h.k==='h'))):c.heads;
      if(!cand.length)continue;
      const high=(a,b)=>b.y>a.y?b:a,top=cand.reduce(high),withStem=cand.filter(h=>h.stem);
      // h: la que suena; d: la que dice cuánto dura (si la de arriba quedó sin plica por estar corrida, la duración la da su vecina con plica)
      const d=(top.stem||top.k==='w'||top.k==='w2'||!withStem.length)?top:withStem.reduce(high);
      melodyCols.push({x:c.x,h:c.heads.reduce(high),d});
    }
    // silencios de la melodía
    for(const r of restsAll){
      if(twoVoices&&r.y<midY-0.3*s)continue;
      if(melodyCols.some(m=>Math.abs(m.x-r.x)<1.2*hw))continue;
      const d=r.k==='rm'?null:parseFloat(r.k.slice(1));
      melodyCols.push({x:r.x,rest:true,dur:d});
    }
    melodyCols.sort((a,b)=>a.x-b.x);
    sys.notes=melodyCols.map(c=>{
      if(c.rest){const dot=own.find(g=>g.k==='.'&&g.x>c.x&&g.x<c.x+2.6*s&&Math.abs(g.y-c.y)<1.2*s);return {x:c.x,y:midY,w:hw,rest:true,dur:c.dur==null?null:c.dur*(dot?1.5:1)};}
      const h=c.h,dh=c.d||h;
      let dur={q:1,h:2,w:4,w2:8}[dh.k]||1,beams=0;
      if(dh.k==='q'){
        const stem=dh.stem&&dh.stem.seg,up=dh.stem&&dh.stem.dir==='up';
        if(stem){
          const end=up?stem.y1:stem.y0;
          const bs=fills.filter(f=>!f.curve&&f.w>s&&f.h<2*s&&stem.x>=f.x0-0.8&&stem.x<=f.x1+0.8&&Math.abs((up?f.y1:f.y0)-end)<1.6*s+(up?0:0));
          beams=countLevels(bs,s);
          const flag=own.find(g=>(g.k==='f1'||g.k==='f2'||g.k==='f3')&&Math.abs(g.x-stem.x)<1.5&&Math.abs(g.y-end)<3*s);
          if(flag)beams=Math.max(beams,+flag.k[1]);
        }
        dur=1/Math.pow(2,beams);
      }
      const dot=[h,dh].some(n=>own.find(g=>g.k==='.'&&g.x>n.x+hw*0.6&&g.x<n.x+hw+2.4*s&&Math.abs(g.y-n.y)<0.75*s));
      if(dot)dur*=1.5;
      return {x:h.x,y:h.y,w:hw,midi:h.midi,D:h.D,alter:h.alter,dur,tied:false};
    });
    sys.twoVoices=twoVoices;
    // ligaduras de prolongación: curva que une dos notas iguales
    const curves=fills.filter(f=>f.curve&&f.w>hw&&f.h<2.5*s);
    for(let i=0;i<sys.notes.length;i++){
      const n=sys.notes[i],m=sys.notes[i+1];if(n.rest)continue;
      const tie=curves.find(c=>c.x0>=n.x-0.5&&c.x0<n.x+hw+2*s&&Math.abs((c.y0+c.y1)/2-n.y)<2.4*s&&(m?c.x1<=m.x+hw+0.5&&c.x1>=m.x-2*s:c.x1>=st.x1-4*s));
      if(tie){if(m){if(m.midi===n.midi)m.tied=true;}else if(true)sys.tieOut=n.midi;}
    }
    // compases
    sys.bars=bars;
    // cifrado de acordes encima del pentagrama
    const ch=chordG.filter(g=>g.y>st.yTop&&g.y<st.yTop+9*s&&g.x>=st.x0-2&&g.x<=st.x1+2).sort((a,b)=>b.y-a.y||a.x-b.x);
    const chords=groupWords(ch,0.3,true);
    for(const c of chords){
      // el acorde va con la nota que suena en ese momento (la última que empezó antes de él)
      let bi=-1;sys.notes.forEach((n,i)=>{if(n.x<=c.x+2.5*s)bi=i;});
      if(bi<0)bi=0;const best=sys.notes[bi];
      if(best){
        const nextX=(sys.notes[bi+1]||{x:st.x1}).x,frac=Math.max(0,Math.min(0.9,(c.x+1.5*s-best.x)/Math.max(1,nextX-best.x)));
        best.chords=best.chords||[];best.chords.push({text:prettyChord(c.text),frac:frac<0.2?0:frac});
      }
    }
    // letra: líneas de texto entre este pentagrama y el siguiente
    const lowLimit=sys.lower?sys.lower.yTop:(sys.next?sys.next.yTop:st.yBot-14*s);
    const lyr=attachAccents(textG.filter(g=>g.y<st.yBot-1.2*s&&g.y>lowLimit+0.5*s&&g.x>=st.x0-2&&g.x<=st.x1+2).map(g=>({...g})));
    const lines=[];
    for(const g of lyr.sort((a,b)=>b.y-a.y)){const l=lines.find(l=>Math.abs(l.y-g.y)<1.2);if(l)l.g.push(g);else lines.push({y:g.y,g:[g]});}
    lines.sort((a,b)=>b.y-a.y);
    sys.verses=lines.filter(l=>l.g.length>2).map(l=>{
      const words=groupWords(l.g.sort((a,b)=>a.x-b.x),0.22).filter(w=>w.text!=='-'&&w.text!=='–'&&w.text!=='_');
      return words;
    });
    sys.verses.forEach((words,vi)=>{
      for(const w of words){
        let best=null,bd=1e9;for(const n of sys.notes){if(n.rest)continue;const d=Math.abs(n.x+hw/2-(w.x+w.x1)/2);if(d<bd){bd=d;best=n;}}
        if(best&&bd<4.5*s){best.lyrics=best.lyrics||[];best.lyrics[vi]=(best.lyrics[vi]?best.lyrics[vi]+' ':'')+w.text;}
      }
    });
    sys.time=st.time;sys.fifths=st.fifths;
  }
  return {systems,textG,staves};
}
function median(a){const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)]||0;}
function dedupe(xs,tol){const out=[];for(const x of xs)if(!out.length||x-out[out.length-1]>tol)out.push(x);return out;}
function countLevels(bs,s){const ys=bs.map(b=>(b.y0+b.y1)/2).sort((a,b)=>a-b);let n=0,last=-1e9;for(const y of ys){if(y-last>0.35*s){n++;last=y;}}return Math.min(n,3);}
/* Junta letras en palabras o sílabas según la distancia entre ellas; une tildes sueltas */
const ACCENTS={'´':'́','`':'̀','˜':'̃','¨':'̈','ˆ':'̂'};
/* Las tildes vienen como signos sueltos encima de la letra: se pegan a la letra que tienen debajo */
function attachAccents(gs){
  const acc=gs.filter(g=>ACCENTS[g.ch]),base=gs.filter(g=>!ACCENTS[g.ch]);
  for(const a of acc){
    let b=null,bd=1e9;
    for(const g of base){const dy=a.y-g.y;if(dy<-0.5||dy>(g.size||10)*0.95)continue;const d=Math.abs(g.x+(g.w||0)/2-(a.x+(a.w||0)/2));if(d<bd){bd=d;b=g;}}
    if(b&&bd<(b.size||10)*0.45){b.ch=((b.ch==='ı'?'i':b.ch)+ACCENTS[a.ch]).normalize('NFC');}
  }
  return base;
}
function groupWords(gs,gapRatio,noAccents){
  const lines=[];
  for(const g of gs){const l=lines.find(l=>Math.abs(l.y-g.y)<(g.size||10)*0.6);if(l)l.g.push(g);else lines.push({y:g.y,g:[g]});}
  const out=[];
  for(const l of lines){
    const arr=l.g.sort((a,b)=>a.x-b.x);let cur=null;
    for(const g of arr){
      if(!noAccents&&ACCENTS[g.ch]&&cur){cur.chars.push({ch:ACCENTS[g.ch],x:g.x,acc:true});continue;}
      const gap=cur?g.x-cur.x1:1e9;
      if(cur&&gap<(g.size||10)*gapRatio&&g.ch!=='-'&&cur.text!=='-'){cur.chars.push(g);cur.x1=g.x+(g.w||0);}
      else{cur={x:g.x,x1:g.x+(g.w||0),y:g.y,chars:[g]};out.push(cur);}
    }
  }
  for(const w of out){
    // coloca cada tilde sobre la letra que tiene debajo
    const letters=w.chars.filter(c=>!c.acc).map(c=>({...c}));
    for(const a of w.chars.filter(c=>c.acc)){let b=null,bd=1e9;for(const c of letters){const d=Math.abs(c.x+(c.w||0)/2-a.x-1.5);if(d<bd){bd=d;b=c;}}if(b)b.ch=(b.ch==='ı'?'i':b.ch)+a.ch;}
    w.text=letters.map(c=>c.ch).join('').normalize('NFC');
  }
  return out;
}
/* Las fuentes de cifrado usan signos propios: se traducen a texto normal */
const CHORD_MAP={'‹':'m','Œ':'m','„':'a','ˆ':'d','“':'sus','¨':'b','©':'#','º':'°','&':'+'};
function prettyChord(t){t=[...t].map(c=>CHORD_MAP[c]??c).join('');return t.replace(/([A-G])b/g,'$1♭').replace(/([A-G])#/g,'$1♯').replace(/b(\d)/g,'♭$1').replace(/#(\d)/g,'♯$1');}

/* ───────── Canciones ───────── */
function titleOf(textG,height){
  if(!textG.length)return null;
  const sizes=textG.map(g=>g.size).sort((a,b)=>a-b),med=sizes[Math.floor(sizes.length/2)];
  const big=attachAccents(textG.filter(g=>g.size>=med*1.55&&g.y>height*0.82).map(g=>({...g})));
  if(!big.length)return null;
  const words=groupWords(big,0.18).sort((a,b)=>b.y-a.y||a.x-b.x);
  const text=words.map(w=>w.text).join(' ').replace(/\s+/g,' ').trim();
  const m=text.match(/^(\d{1,4})\s+(.*)$/);
  return m?{number:+m[1],title:m[2]}:{number:null,title:text};
}
/* páginas analizadas → canciones */
function buildSongs(pages){
  const songs=[];let cur=null;
  pages.forEach((p,i)=>{
    const hasMusic=p.systems.length>0;
    const t=titleOf(p.textG,p.height);
    if(t&&hasMusic){cur={number:t.number,title:t.title,pages:[p.pageNumber],systems:[]};songs.push(cur);}
    else if(hasMusic&&cur)cur.pages.push(p.pageNumber);
    else if(hasMusic){cur={number:null,title:'Página '+p.pageNumber,pages:[p.pageNumber],systems:[]};songs.push(cur);}
    if(hasMusic)cur.systems.push(...p.systems.map(s=>({...s,page:p.pageNumber})));
  });
  return songs;
}
/* sistemas → compases con notas */
function songMeasures(song){
  const measures=[];let time=null,fifths=0,pendingTie=null;
  for(const sys of song.systems){
    if(sys.time)time=sys.time;fifths=sys.fifths;
    const bars=sys.bars;let mi=0,cur={notes:[],fifths};
    for(const n of sys.notes){
      while(mi<bars.length&&bars[mi]<n.x){if(cur.notes.length)measures.push(cur);cur={notes:[],fifths};mi++;}
      const chords=(n.chords||[]).map(c=>({text:c.text,at:+(c.frac*(n.dur||1)).toFixed(3)}));
      const note=n.rest?{rest:true,dur:n.dur,chords,lyrics:[]}:{midi:n.midi,dur:n.dur,tied:n.tied,chords,lyrics:n.lyrics||[]};
      if(pendingTie!=null&&note===note&&cur.notes.length===0&&measures.length&&n===sys.notes[0]&&n.midi===pendingTie)note.tied=true;
      pendingTie=null;
      cur.notes.push(note);
    }
    if(cur.notes.length)measures.push(cur);
    pendingTie=sys.tieOut??null;
  }
  return {measures,time:time||'',fifths};
}

/* Sube cuando cambia la forma de leer las partituras: los PDF guardados se vuelven a transcribir solos */
const VERSION=3;
const api={analyzePage,buildSongs,songMeasures,findStaves,NAMES,VERSION};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PartituraAnalyze=api;
})(typeof self!=='undefined'?self:this);
