/* Círculos Music · sonido del piano
   Muestras reales del Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0) — ver sounds/piano/CREDITS.txt.
   Hay una grabación cada tres semitonos (DO, RE♯, FA♯, LA); las notas intermedias se afinan desde la más cercana. */
(()=>{
'use strict';
const AC=window.AudioContext||window.webkitAudioContext;
if(!AC)return;
const SAMPLES={48:'C3',51:'Ds3',54:'Fs3',57:'A3',60:'C4',63:'Ds4',66:'Fs4',69:'A4',72:'C5',75:'Ds5',78:'Fs5',81:'A5',84:'C6'};
const ROOTS=Object.keys(SAMPLES).map(Number);
let ctx=null,out=null,loading=null;
const buffers=new Map(),voices=new Map();

function context(){
  if(ctx)return ctx;
  try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(e){}   // suena aunque el iPhone esté en silencio
  ctx=new AC({latencyHint:'interactive'});
  const comp=ctx.createDynamicsCompressor();                 // evita saturación cuando suenan varias notas
  comp.threshold.value=-14;comp.knee.value=18;comp.ratio.value=3;comp.attack.value=.004;comp.release.value=.25;
  out=ctx.createGain();out.gain.value=.9;out.connect(comp);comp.connect(ctx.destination);
  return ctx;
}
function load(){
  if(loading)return loading;
  const c=context();
  loading=Promise.all(ROOTS.map(m=>fetch(`sounds/piano/${SAMPLES[m]}.mp3`).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();})
    .then(data=>new Promise((ok,fail)=>c.decodeAudioData(data,ok,fail))).then(buf=>buffers.set(m,buf))))
    .catch(err=>{loading=null;console.warn('Círculos Music: no se pudo cargar el sonido del piano',err);});
  return loading;
}
function unlock(){const c=context();if(c.state==='suspended')c.resume();load();}

function voice(midi,when,velocity){
  const root=ROOTS.reduce((a,b)=>Math.abs(b-midi)<Math.abs(a-midi)?b:a),buf=buffers.get(root);if(!buf)return;
  const prev=voices.get(midi);                                // la misma tecla otra vez: se apaga la anterior con suavidad
  if(prev){try{prev.gain.gain.cancelScheduledValues(when);prev.gain.gain.setTargetAtTime(0,when,.03);prev.src.stop(when+.25);}catch(e){}}
  const src=ctx.createBufferSource(),gain=ctx.createGain();
  src.buffer=buf;src.playbackRate.value=Math.pow(2,(midi-root)/12);
  gain.gain.setValueAtTime(velocity,when);
  gain.gain.setTargetAtTime(0,when+3.2,.9);                  // cola natural y luego se desvanece
  src.connect(gain);gain.connect(out);src.start(when);src.stop(when+7.5);
  if(voices.size>28){const [old,ov]=voices.entries().next().value;try{ov.gain.gain.setTargetAtTime(0,when,.05);ov.src.stop(when+.3);}catch(e){}voices.delete(old);}
  const v={src,gain};voices.set(midi,v);src.onended=()=>{if(voices.get(midi)===v)voices.delete(midi);};
}
function play(midis,{roll=0,velocity=.8}={}){
  unlock();
  const list=[].concat(midis).filter(Number.isFinite);if(!list.length)return;
  const asked=performance.now();
  load()?.then(()=>{
    if(performance.now()-asked>900)return;                    // si tardó mucho en cargar, mejor no sonar fuera de tiempo
    const t=ctx.currentTime+.012;
    list.forEach((m,i)=>voice(m,t+i*roll,velocity*(list.length>1?.82:1)));
  });
}
/* Corta en seco todo lo que esté sonando (al detener o al salir de la pantalla) */
function stopAll(){
  if(!ctx)return;const t=ctx.currentTime;
  voices.forEach(v=>{try{v.gain.gain.cancelScheduledValues(t);v.gain.gain.setTargetAtTime(0,t,.015);v.src.stop(t+.12);}catch(e){}});
  voices.clear();
}
window.CirculosPiano={play,unlock,stopAll};

/* Teclas: suenan al tocarlas y al deslizar el dedo encima (barrido o glissando).
   En pantallas táctiles, si el gesto es vertical se deja desplazar la página y no suena nada. */
const KEY_SEL='#pianoKeyboard .white-key,#pianoKeyboard .black-key';
const midiOf=key=>Number(key?.dataset.pkMidi);
function press(key,velocity){
  const m=midiOf(key);if(!Number.isFinite(m))return;
  play(m,{velocity});
  key.classList.add('performance-playing');clearTimeout(key._pkTimer);
  key._pkTimer=setTimeout(()=>key.classList.remove('performance-playing'),220);
}
const keyUnder=(x,y)=>document.elementFromPoint(x,y)?.closest?.(KEY_SEL)||null;
/* Cada dedo lleva su propio barrido, así se pueden tocar varias teclas a la vez (acordes) */
const sweeps=new Map();
document.addEventListener('pointerdown',e=>{
  const key=e.target.closest?.(KEY_SEL);
  if(!key){if(e.target.closest?.('#instrumento'))unlock();return;}
  if(e.button>0)return;
  unlock();
  const sw={x:e.clientX,y:e.clientY,first:key,last:null,started:false,touch:e.pointerType==='touch',timer:0};
  sweeps.set(e.pointerId,sw);
  const begin=()=>{if(sw.started||sweeps.get(e.pointerId)!==sw)return;sw.started=true;sw.last=sw.first;press(sw.first,.8);};
  if(sw.touch){
    if([...sweeps.values()].some(o=>o!==sw&&o.started))begin();   // ya hay otro dedo tocando: suena al instante
    else sw.timer=setTimeout(begin,70);
  }else{e.preventDefault();begin();}
},true);
addEventListener('pointermove',e=>{
  const sw=sweeps.get(e.pointerId);if(!sw)return;
  if(!sw.touch&&!(e.buttons&1)){sweeps.delete(e.pointerId);return;}
  const dx=e.clientX-sw.x,dy=e.clientY-sw.y;
  if(!sw.started){
    if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){clearTimeout(sw.timer);sweeps.delete(e.pointerId);return;}   // está desplazando la página
    if(Math.abs(dx)<6)return;
    clearTimeout(sw.timer);sw.started=true;sw.last=sw.first;press(sw.first,.75);
  }
  const key=keyUnder(e.clientX,e.clientY);
  if(key&&key!==sw.last){sw.last=key;press(key,.7);}
},true);
addEventListener('pointerup',e=>{
  const sw=sweeps.get(e.pointerId);if(!sw)return;
  clearTimeout(sw.timer);if(!sw.started)press(sw.first,.8);
  sweeps.delete(e.pointerId);
},true);
addEventListener('pointercancel',e=>{const sw=sweeps.get(e.pointerId);if(sw){clearTimeout(sw.timer);sweeps.delete(e.pointerId);}},true);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-instrument="piano"]'))unlock();},true);
})();
