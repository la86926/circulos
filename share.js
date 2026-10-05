/* Círculos Music · compartir un acorde o una tonalidad con un enlace
   En el celular abre el menú de compartir del sistema (WhatsApp, etc.); en la PC copia el enlace. */
(()=>{
'use strict';
const ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11"/><path d="m7.8 7.6 4.2-4.1 4.2 4.1"/><path d="M6.5 11.5H6a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-.5"/></svg>';
const toast=m=>window.CirculosShell?.toast(m);
/* El mensaje va en dos líneas: el texto y, debajo, el enlace */
async function share(info){
  if(!info)return;
  const text=`${info.text}\n${info.url}`;
  if(navigator.share){
    try{await navigator.share({text});return;}catch(e){if(e&&e.name==='AbortError')return;}
  }
  try{await navigator.clipboard.writeText(text);toast('Enlace copiado. Pégalo donde quieras.');}
  catch(e){
    const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;opacity:0';document.body.appendChild(area);area.select();
    try{document.execCommand('copy');toast('Enlace copiado. Pégalo donde quieras.');}catch(err){toast('No se pudo copiar el enlace');}
    area.remove();
  }
}
function button(getInfo){
  const b=document.createElement('button');b.type='button';b.className='act-btn act-share';b.setAttribute('aria-label','Compartir');b.title='Compartir';
  b.innerHTML=ICON;b.addEventListener('click',()=>share(getInfo()));return b;
}
/* Círculos: la tonalidad y el acorde elegidos */
const head=document.getElementById('chordActions');
if(head&&window.Circulos)head.appendChild(button(()=>window.Circulos.share()));
/* Acordes y variaciones: botones con data-share-key ("ch12" o "ch12:g3") */
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-share-key]');if(!b)return;
  const [id,k]=b.dataset.shareKey.split(':'),L=window.CirculosChords,entry=L?.byId(id);
  if(entry)share(L.shareFor(entry,k));
});
window.CirculosShare={share};
})();
