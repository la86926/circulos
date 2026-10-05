/* Círculos Music · «Convertidor de partituras» en el menú, con contraseña
   Al tocarlo pide la contraseña; si es correcta abre tablatura.html. La página también la pide si se entra
   directo con el enlace. Una vez escrita, no se vuelve a pedir mientras la pestaña siga abierta. */
(()=>{
'use strict';
const KEY='circulos-convertidor';
const HASH='453afb3d310def9d21d43098461dcd25b506fe4b760db482b7b524e82b14b5cc';   // contraseña cifrada (SHA-256)
const onPage=!!document.getElementById('tabView');
const ok=()=>{try{return sessionStorage.getItem(KEY)==='1';}catch(e){return false;}};
const ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></svg>';
async function sha(t){
  if(crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  return t==='8318'?HASH:'';                           // navegador sin cifrado (muy antiguo)
}
const style=document.createElement('style');
style.textContent=`body.conv-locked #tabView>*{visibility:hidden}
.conv-sheet .app-sheet-card{width:min(420px,calc(100% - 16px))}
.conv-sheet p.conv-text{margin:-6px 2px 14px;color:var(--muted);font-size:14px;line-height:1.5}
.conv-sheet .nick-form{grid-template-columns:minmax(0,1fr)}
.conv-sheet input{width:100%;min-width:0;letter-spacing:.35em;text-align:center;font-size:22px!important}
.conv-sheet.shake .app-sheet-card{animation:convShake .4s}
@keyframes convShake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`;
document.head.appendChild(style);

function ask({onOk,locked=false}){
  let sheet=document.getElementById('convSheet');
  if(!sheet){
    sheet=document.createElement('div');sheet.id='convSheet';sheet.className='app-sheet conv-sheet nick-sheet';
    sheet.innerHTML=`<div class="app-sheet-backdrop" data-close></div>
      <section class="app-sheet-card" role="dialog" aria-modal="true" aria-labelledby="convTitle">
        <button class="app-sheet-close" type="button" data-close aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <h2 id="convTitle">Convertidor de partituras</h2>
        <p class="conv-text">Escribe la contraseña para entrar.</p>
        <form class="fav-form nick-form" autocomplete="off">
          <input id="convPass" type="password" inputmode="numeric" maxlength="20" autocomplete="off" aria-label="Contraseña" placeholder="••••">
          <p class="fav-error" role="alert"></p>
          <button type="submit" class="nick-save">Entrar</button>
        </form>
      </section>`;
    document.body.appendChild(sheet);
  }
  const close=()=>{sheet.classList.remove('open');if(sheet._locked)location.href='index.html';};
  sheet._locked=locked;sheet._onOk=onOk;
  sheet.onclick=e=>{if(e.target.closest('[data-close]'))close();};
  sheet.onsubmit=async e=>{
    e.preventDefault();const input=sheet.querySelector('#convPass'),msg=sheet.querySelector('.fav-error');
    if(await sha(input.value.trim())===HASH){
      try{sessionStorage.setItem(KEY,'1');}catch(err){}
      sheet._locked=false;sheet.classList.remove('open');input.value='';msg.textContent='';sheet._onOk&&sheet._onOk();
    }else{
      msg.textContent='Contraseña incorrecta.';input.value='';
      sheet.classList.remove('shake');void sheet.offsetWidth;sheet.classList.add('shake');input.focus();
    }
  };
  sheet.querySelector('.fav-error').textContent='';sheet.querySelector('#convPass').value='';
  requestAnimationFrame(()=>{sheet.classList.add('open');setTimeout(()=>sheet.querySelector('#convPass').focus(),250);});
}

/* Opción del menú (en todas las páginas) */
const item=window.CirculosShell?.addMenuItem({id:'convMenuItem',icon:ICON,title:'Convertidor de partituras',subtitle:'Pasa una partitura en PDF a tablatura.',
  onClick:()=>{if(onPage&&ok())return;ask({onOk:()=>{if(!onPage)location.href='tablatura.html';}});}});
if(item&&onPage){item.classList.add('active');item.setAttribute('aria-current','page');}

/* En la página del convertidor: sin contraseña no se muestra nada */
if(onPage&&!ok()){
  document.body.classList.add('conv-locked');
  const open=()=>ask({locked:true,onOk:()=>document.body.classList.remove('conv-locked')});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',open,{once:true});else open();
}
})();
