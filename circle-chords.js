/* Círculos Music · posiciones de guitarra del acorde elegido
   Usa los mismos datos y las mismas tarjetas que la biblioteca de Acordes. */
(()=>{
'use strict';
const host=document.getElementById('circleChordPositions');
const title=document.getElementById('circleChordTitle');
if(!host||!window.CirculosChords)return;
const lib=window.CirculosChords;

function showLoading(){host.innerHTML=Array.from({length:3},()=>'<div class="chord-skeleton" aria-hidden="true"></div>').join('');}
function render(){
  const chord=window.circulosChord;
  if(!chord)return;
  title.textContent=chord.name;
  if(!lib.findTriad(chord.rootPc,chord.quality))showLoading();
  lib.load().then(()=>{
    if(chord!==window.circulosChord)return;            // se eligió otro acorde mientras cargaba
    const entry=lib.findTriad(chord.rootPc,chord.quality);
    if(!entry)return;
    host.innerHTML=lib.positionCardsHtml(entry);
    host.querySelectorAll('.chord-position-card').forEach((card,i)=>card.style.setProperty('--i',i));
  }).catch(()=>{host.innerHTML='<div class="library-error"><strong>No se pudieron cargar las posiciones.</strong><span>Recarga la página para intentarlo de nuevo.</span></div>';});
}
document.addEventListener('circulos:chord',render);
render();
})();
