/* Círculos Music · lo común a todas las páginas
   Tema claro/oscuro, logo según el tema, menú lateral, aviso breve (toast),
   modo sin internet (service worker) y la opción opcional de instalar como app. */
(()=>{
'use strict';
const root=document.documentElement,media=matchMedia('(prefers-color-scheme: dark)');
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
const LOGO={light:'logo.svg?v=3',dark:'logo-dark.svg?v=3'};

/* ───────── Tema ───────── */
const currentTheme=()=>store.get('circulos-theme')||'system';
function paintTheme(choice=currentTheme()){
  const resolved=choice==='system'?(media.matches?'dark':'light'):choice;
  root.dataset.theme=resolved;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=resolved==='dark'?'#0e1116':'#f4f6f9';
  document.querySelectorAll('img[data-logo]').forEach(img=>{const src=LOGO[resolved];if(!img.src.endsWith(src))img.src=src;});
  document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===choice));
}
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{store.set('circulos-theme',b.dataset.themeChoice);paintTheme(b.dataset.themeChoice);}));
media.addEventListener?.('change',()=>{if(currentTheme()==='system')paintTheme('system');});
paintTheme();

/* ───────── Menú lateral ───────── */
const menu=document.getElementById('sideMenu'),backdrop=document.getElementById('menuBackdrop'),menuBtn=document.getElementById('menuBtn'),closeBtn=document.getElementById('menuCloseBtn');
function toggleMenu(open){
  document.body.classList.toggle('menu-open',open);
  menu?.classList.toggle('open',open);backdrop?.classList.toggle('open',open);
  menu?.setAttribute('aria-hidden',String(!open));backdrop?.setAttribute('aria-hidden',String(!open));
  menuBtn?.setAttribute('aria-expanded',String(open));
}
menuBtn?.addEventListener('click',()=>toggleMenu(true));
closeBtn?.addEventListener('click',()=>toggleMenu(false));
backdrop?.addEventListener('click',()=>toggleMenu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleMenu(false);});

/* Las mismas opciones en todas las páginas, siempre en el mismo orden.
   Si alguna página no trae una de las secciones principales, se agrega aquí. */
const ICON_SECTION={
  'index.html':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke-opacity=".35"/><circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="4" r="1.7"/><circle cx="18.9" cy="8" r="1.7"/><circle cx="18.9" cy="16" r="1.7"/><circle cx="12" cy="20" r="1.7"/><circle cx="5.1" cy="16" r="1.7"/><circle cx="5.1" cy="8" r="1.7"/></svg>',
  'acordes.html':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16M10.67 4v16M15.33 4v16M20 4v16" stroke-opacity=".5"/><path d="M6 4h14" stroke-width="2.4"/><path d="M6 9h14M6 14h14M6 19h14" stroke-opacity=".3"/><circle class="dot" cx="10.67" cy="11.5" r="2"/><circle class="dot" cx="15.33" cy="16.5" r="2"/><circle class="dot" cx="20" cy="6.5" r="2"/></svg>',
};
const SECTIONS=[
  {href:'index.html',title:'Círculos',subtitle:'Tonalidades, sus 7 acordes y posiciones.'},
  {href:'acordes.html',title:'Acordes',subtitle:'Biblioteca de acordes de guitarra y piano.'}
];
const MENU_ORDER=['idMenuItem','index.html','acordes.html','convMenuItem','favMenuItem','installItem','tuto'];
const here=(location.pathname.split('/').pop()||'index.html');
function menuKey(el){return el.classList.contains('tuto-menu-item')?'tuto':(el.id||el.getAttribute('href')||'');}
function sortMenu(){
  const picker=document.querySelector('.app-picker');if(!picker)return;
  const items=[...picker.children];
  const rank=el=>{const i=MENU_ORDER.indexOf(menuKey(el));return i<0?MENU_ORDER.length:i;};
  const sorted=[...items].sort((a,b)=>rank(a)-rank(b));
  if(sorted.some((el,i)=>el!==items[i]))sorted.forEach(el=>picker.appendChild(el));
}
function ensureSections(){
  const picker=document.querySelector('.app-picker');if(!picker)return;
  SECTIONS.forEach(sec=>{
    if(picker.querySelector(`.app-choice[href="${sec.href}"]`))return;
    const a=document.createElement('a');a.className='app-choice'+(sec.href===here?' active':'');a.href=sec.href;
    if(sec.href===here)a.setAttribute('aria-current','page');
    a.innerHTML=`<span class="app-choice-icon">${ICON_SECTION[sec.href]}</span><strong>${sec.title}</strong><small>${sec.subtitle}</small>`;
    picker.appendChild(a);
  });
  sortMenu();
  new MutationObserver(sortMenu).observe(picker,{childList:true});
}
ensureSections();

/* Agrega una opción al menú (la usan favoritos, tutorial e instalar) */
function addMenuItem({id,icon,title,subtitle,onClick,before}){
  const picker=document.querySelector('.app-picker');if(!picker||document.getElementById(id))return null;
  const item=document.createElement('button');item.type='button';item.id=id;item.className='app-choice app-extra';
  item.innerHTML=`<span class="app-choice-icon">${icon}</span><strong>${title}</strong>${subtitle?`<small>${subtitle}</small>`:''}`;
  item.addEventListener('click',()=>{toggleMenu(false);setTimeout(onClick,280);});
  const ref=before?picker.querySelector(before):null;
  ref?picker.insertBefore(item,ref):picker.appendChild(item);
  return item;
}

/* ───────── Aviso breve ───────── */
let toastTimer=0;
function toast(message){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ───────── Sin internet: la web queda guardada en el dispositivo ───────── */
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

/* ───────── Instalar como app (solo si la persona quiere) ───────── */
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ICON_INSTALL='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 8v6.5M9.2 11.8 12 14.6l2.8-2.8"/></svg>';
let deferredPrompt=null;
addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredPrompt=e;
  addMenuItem({id:'installItem',icon:ICON_INSTALL,title:'Instalar app',subtitle:'Úsala desde tu pantalla de inicio.',onClick:async()=>{
    if(!deferredPrompt)return;deferredPrompt.prompt();const choice=await deferredPrompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted')document.getElementById('installItem')?.remove();deferredPrompt=null;
  }});
});
addEventListener('appinstalled',()=>{document.getElementById('installItem')?.remove();toast('¡Listo! Ya está en tu pantalla de inicio.');});
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function iosHelp(){
  let sheet=document.getElementById('installSheet');
  if(!sheet){
    sheet=document.createElement('div');sheet.id='installSheet';sheet.className='app-sheet';
    sheet.innerHTML=`<div class="app-sheet-backdrop" data-close></div><section class="app-sheet-card" role="dialog" aria-modal="true" aria-labelledby="installTitle">
      <button class="app-sheet-close" type="button" data-close aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <h2 id="installTitle">Instalar en tu iPhone</h2>
      <ol class="install-steps"><li>Toca el botón <b>Compartir</b> <svg class="ios-share" viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg> de Safari.</li><li>Elige <b>Agregar a inicio</b>.</li><li>Toca <b>Agregar</b>. Se abrirá como una app, también sin internet.</li></ol>
    </section>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click',e=>{if(e.target.closest('[data-close]'))sheet.classList.remove('open');});
  }
  requestAnimationFrame(()=>sheet.classList.add('open'));
}
if(isIOS&&!standalone)addEventListener('DOMContentLoaded',()=>setTimeout(()=>addMenuItem({id:'installItem',icon:ICON_INSTALL,title:'Instalar app',subtitle:'Úsala desde tu pantalla de inicio.',onClick:iosHelp}),0));

/* El logo de la barra de arriba lleva al inicio (en el inicio, sube al principio de la página) */
(()=>{const bw=document.querySelector('.app-header .brand-wrap');if(!bw||bw.tagName==='A')return;
  const a=document.createElement('a');a.href='index.html';a.className=bw.className;a.setAttribute('aria-label','Ir al inicio');
  while(bw.firstChild)a.appendChild(bw.firstChild);bw.replaceWith(a);
  const home=/(^|\/)(index\.html)?$/.test(location.pathname);
  a.addEventListener('click',e=>{if(home){e.preventDefault();scrollTo({top:0,behavior:'smooth'});}});
})();
window.CirculosShell={toast,addMenuItem,toggleMenu,paintTheme};
})();
