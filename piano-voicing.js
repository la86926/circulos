/* Círculos Music · piano en colores pastel, inversiones animadas, mapa para mover el teclado y "todo el teclado"
   Solo se iluminan las 3 teclas de la posición elegida: azul intenso = tónica, azul hielo = las otras notas.
   Al cambiar de inversión, la nota que cambia de octava "vuela" a su nueva tecla y el teclado se centra solo. */
(()=>{
'use strict';
const host=document.getElementById('pianoKeyboard');
if(!host)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
let last=null,allOn=store.get('circulos-piano-all')==='1',nav=null,allBtn=null;

const keys=()=>[...host.children].filter(k=>k.classList.contains('white-key')||k.classList.contains('black-key'));
const scrollBox=()=>host.closest('.piano-scroll');
function snapshot(){
  const voicing=[];let root=null;
  keys().forEach((k,i)=>{                                    // las teclas van en orden cromático desde DO 48
    k.dataset.pkMidi=48+i;
    if(k.classList.contains('root-tone'))root=i%12;
    if(k.classList.contains('voicing-tone'))voicing.push(48+i);
  });
  return{voicing,root,pcs:voicing.map(m=>m%12).sort((a,b)=>a-b).join(',')};
}
const keyAt=m=>host.querySelector(`[data-pk-midi="${m}"]`);
function paint(state){
  const pcs=new Set(state.voicing.map(m=>m%12));
  keys().forEach(k=>{
    const m=Number(k.dataset.pkMidi),main=state.voicing.includes(m),echo=!main&&allOn&&pcs.has(m%12),on=main||echo;
    k.classList.toggle('pk-on',on&&m%12!==state.root);
    k.classList.toggle('pk-root',on&&m%12===state.root);
    k.classList.toggle('pk-echo',echo);
  });
  syncMini();
}
function centerOf(k){return{x:k.offsetLeft+k.offsetWidth/2,y:k.offsetTop+k.offsetHeight-(k.classList.contains('black-key')?34:58)};}

/* ── Posición del teclado: se mueve solo con el mapa, las flechas o al centrar el acorde ── */
function maxScroll(){const s=scrollBox();return s?Math.max(0,s.scrollWidth-s.clientWidth):0;}
function goTo(left,animate=true){
  const s=scrollBox(),max=maxScroll();if(!s||max<2)return;
  const target=Math.max(0,Math.min(max,left)),from=s.scrollLeft,dur=animate&&!reduced.matches?480:0,t0=performance.now();
  cancelAnimationFrame(goTo.raf);
  const step=now=>{
    const p=dur?Math.min(1,(now-t0)/dur):1,e=1-Math.pow(1-p,3);
    s.scrollLeft=from+(target-from)*e;syncWindow();
    if(p<1)goTo.raf=requestAnimationFrame(step);
  };
  goTo.raf=requestAnimationFrame(step);
}
function recenter(state){
  const s=scrollBox();if(!s||!state.voicing.length)return;
  const first=keyAt(state.voicing[0]),lastKey=keyAt(state.voicing[state.voicing.length-1]);if(!first||!lastKey)return;
  const a=first.offsetLeft,b=lastKey.offsetLeft+lastKey.offsetWidth;
  if(a>=s.scrollLeft+16&&b<=s.scrollLeft+s.clientWidth-16)return;      // ya se ven
  goTo((a+b)/2-s.clientWidth/2);
}

/* ── Mapa del teclado: un piano en miniatura con un recuadro que se arrastra ── */
const ARROW=d=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
function buildNav(){
  const s=scrollBox();if(!s||nav&&document.contains(nav))return;
  nav=document.createElement('div');nav.className='pk-nav';nav.setAttribute('role','group');nav.setAttribute('aria-label','Mover el teclado');
  nav.innerHTML=`<button class="pk-nav-btn" type="button" data-dir="-1" aria-label="Mover el teclado a la izquierda">${ARROW('M14.5 6 8.5 12l6 6')}</button>
    <div class="pk-nav-track"><div class="pk-nav-keys"></div><div class="pk-nav-window"><span class="pk-nav-grip"></span></div></div>
    <button class="pk-nav-btn" type="button" data-dir="1" aria-label="Mover el teclado a la derecha">${ARROW('M9.5 6l6 6-6 6')}</button>`;
  s.before(nav);
  nav.querySelectorAll('.pk-nav-btn').forEach(b=>b.addEventListener('click',()=>{
    const box=scrollBox();goTo(box.scrollLeft+Number(b.dataset.dir)*box.clientWidth*.7);
  }));
  const track=nav.querySelector('.pk-nav-track');let drag=null;
  const leftFor=(clientX,grab)=>{const r=track.getBoundingClientRect(),box=scrollBox();return(clientX-r.left-grab)/r.width*box.scrollWidth;};
  track.addEventListener('pointerdown',e=>{
    e.preventDefault();track.setPointerCapture(e.pointerId);
    const win=nav.querySelector('.pk-nav-window').getBoundingClientRect(),box=scrollBox();
    const inside=e.clientX>=win.left&&e.clientX<=win.right;
    drag={grab:inside?e.clientX-win.left:win.width/2};
    nav.classList.add('is-dragging');
    if(!inside)goTo(leftFor(e.clientX,drag.grab));
  });
  track.addEventListener('pointermove',e=>{if(drag)goTo(leftFor(e.clientX,drag.grab),false);});
  const end=()=>{drag=null;nav?.classList.remove('is-dragging');};
  track.addEventListener('pointerup',end);track.addEventListener('pointercancel',end);
  s.addEventListener('scroll',syncWindow,{passive:true});
  if(window.ResizeObserver)new ResizeObserver(()=>{syncMini();syncWindow();}).observe(s);
}
function syncMini(){
  if(!nav)return;
  const box=nav.querySelector('.pk-nav-keys'),total=host.scrollWidth||host.offsetWidth;if(!box||!total)return;
  box.innerHTML=keys().map(k=>{
    const black=k.classList.contains('black-key'),cls=`${black?'pk-mini-b':'pk-mini-w'}${k.classList.contains('pk-root')?' is-root':k.classList.contains('pk-on')?' is-on':''}`;
    return black?`<i class="${cls}" style="left:${(k.offsetLeft/total*100).toFixed(3)}%;width:${(k.offsetWidth/total*100).toFixed(3)}%"></i>`:`<i class="${cls}"></i>`;
  }).join('');
  syncWindow();
}
function syncWindow(){
  if(!nav)return;
  const s=scrollBox(),win=nav.querySelector('.pk-nav-window');if(!s||!win)return;
  const max=s.scrollWidth-s.clientWidth;nav.hidden=max<2;
  win.style.left=(s.scrollLeft/s.scrollWidth*100)+'%';win.style.width=(s.clientWidth/s.scrollWidth*100)+'%';
}

/* ── Botón "Todo el teclado": el acorde en todas las octavas, mismos colores ── */
function buildAllButton(){
  const top=document.querySelector('#pianoPanel .visual-top');if(!top||allBtn&&document.contains(allBtn))return;
  allBtn=document.createElement('button');allBtn.type='button';allBtn.className='pk-all';
  allBtn.innerHTML='<span class="pk-all-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Todo el teclado</span>';
  allBtn.setAttribute('aria-pressed',String(allOn));
  allBtn.addEventListener('click',()=>{
    allOn=!allOn;store.set('circulos-piano-all',allOn?'1':'0');allBtn.setAttribute('aria-pressed',String(allOn));
    if(!last)return;paint(last);
    if(allOn&&!reduced.matches){                              // las demás octavas aparecen como una ola
      const center=last.voicing[1]||last.voicing[0];
      keys().filter(k=>k.classList.contains('pk-echo')).forEach(k=>{
        const d=Math.abs(Number(k.dataset.pkMidi)-center)*14;k.style.setProperty('--pk-d',`${d}ms`);
        k.classList.remove('pk-pop');void k.offsetWidth;k.classList.add('pk-pop');
      });
    }
  });
  top.appendChild(allBtn);
}

/* ── Animaciones ── */
function pop(list){list.forEach((k,i)=>{k.style.setProperty('--pk-d',`${i*80}ms`);k.classList.remove('pk-pop');void k.offsetWidth;k.classList.add('pk-pop');});}
function ring(x,y,root){
  const r=document.createElement('span');r.className=`pk-ring${root?' is-root':''}`;r.style.left=x+'px';r.style.top=y+'px';
  host.appendChild(r);setTimeout(()=>r.remove(),700);
}
function fly(fromKey,toKey,label,root,delay){
  const a=centerOf(fromKey),b=centerOf(toKey);
  const bubble=document.createElement('span');bubble.className=`pk-fly${root?' is-root':''}`;bubble.textContent=label;
  host.appendChild(bubble);toKey.classList.add('pk-wait');
  const lift=Math.max(24,Math.min(150,60+Math.abs(b.x-a.x)*.22,Math.min(a.y,b.y)-24)),frames=[];
  for(let i=0;i<=12;i++){const t=i/12;frames.push({transform:`translate(${a.x+(b.x-a.x)*t}px,${a.y+(b.y-a.y)*t-Math.sin(Math.PI*t)*lift}px) scale(${1+.18*Math.sin(Math.PI*t)})`,opacity:i===0?0:1});}
  const anim=bubble.animate(frames,{duration:760,delay,easing:'cubic-bezier(.45,.05,.3,1)',fill:'both'});
  fromKey.classList.add('pk-leave');setTimeout(()=>fromKey.classList.remove('pk-leave'),delay+520);
  anim.onfinish=()=>{bubble.remove();toKey.classList.remove('pk-wait');pop([toKey]);ring(b.x,b.y,root);};
}

function update(){
  buildNav();buildAllButton();
  const state=snapshot();if(!state.voicing.length)return;
  const sig=state.voicing.join(',')+'|'+state.root;
  if(last&&sig===last.sig){paint(last);return;}
  paint(state);
  const prev=last;last={...state,sig};
  const visible=!!host.offsetParent;
  if(prev&&visible)window.CirculosPiano?.play(state.voicing,{roll:.028});
  if(!prev&&visible)requestAnimationFrame(()=>recenter(state));
  if(!visible||reduced.matches){if(prev)recenter(state);return;}
  const nowKeys=state.voicing.map(keyAt).filter(Boolean);
  if(prev&&prev.pcs===state.pcs&&prev.root===state.root){        // mismo acorde, otra inversión
    const gone=prev.voicing.filter(m=>!state.voicing.includes(m)),came=state.voicing.filter(m=>!prev.voicing.includes(m));
    recenter(state);
    setTimeout(()=>gone.forEach((m,i)=>{
      const target=came.find(c=>c%12===m%12),fromKey=keyAt(m),toKey=keyAt(target);
      if(fromKey&&toKey)fly(fromKey,toKey,toKey.textContent.trim(),m%12===state.root,i*140);
    }),120);
    pop(nowKeys.filter(k=>!came.includes(Number(k.dataset.pkMidi))));
  }else{
    pop(nowKeys);
    if(prev)recenter(state);
  }
}
const ours=n=>n.classList&&(n.classList.contains('pk-fly')||n.classList.contains('pk-ring'));
new MutationObserver(muts=>{
  if(muts.every(m=>[...m.addedNodes,...m.removedNodes].every(ours)))return;
  requestAnimationFrame(update);
}).observe(host,{childList:true});
document.addEventListener('click',e=>{if(e.target.closest?.('[data-instrument="piano"]'))setTimeout(()=>{syncMini();if(last)recenter(last);},60);});
update();
})();
