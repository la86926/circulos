/* Círculos Music · aviso al recargar
   Si la persona ya cambió algo (tonalidad, acorde, filtros…), el navegador pide confirmación
   antes de recargar o cerrar la página, porque se perdería lo que estaba viendo.
   No molesta si no tocó nada, ni al pasar de Círculos a Acordes con el menú.
   Nota: los navegadores muestran su propio texto genérico; no permiten personalizarlo. */
(() => {
'use strict';
let dirty = false, leaving = false;
const CHANGERS = '.tone-btn,[data-mode],.harmony-wheel-node,[data-instrument],[data-nomenclature],[data-inversion],.chord-catalog-card,[data-root],[data-library-notation]';
const tutorialOn = () => document.body.classList.contains('tuto-on');

addEventListener('click', e => {
  if (!e.isTrusted || !(e.target instanceof Element)) return;
  if (e.target.closest('a[href]')) { leaving = true; setTimeout(() => { leaving = false; }, 1500); }
  if (!tutorialOn() && e.target.closest(CHANGERS)) dirty = true;
}, true);
addEventListener('change', e => { if (e.isTrusted && !tutorialOn() && e.target.matches && e.target.matches('select')) dirty = true; }, true);
addEventListener('input', e => { if (e.isTrusted && !tutorialOn() && e.target.matches && e.target.matches('#chordSearch')) dirty = true; }, true);
addEventListener('beforeunload', e => {
  if (!dirty || leaving) return;
  e.preventDefault();
  e.returnValue = '';
});
})();
