(()=>{
  const PORTAL_ID='gift-ui-portal';
  const STYLE_ID='gift-ui-global-style';

  function ensureGlobalStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${PORTAL_ID}{
        position:fixed!important;
        inset:0!important;
        z-index:2147483000!important;
        display:grid!important;
        place-items:center!important;
        width:100vw!important;
        height:100dvh!important;
        min-height:100vh!important;
        padding:22px!important;
        margin:0!important;
        box-sizing:border-box!important;
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        isolation:isolate!important;
      }
      #${PORTAL_ID}.open{
        opacity:1;
        visibility:visible;
        pointer-events:auto;
      }
      #${PORTAL_ID} .gift-portal-backdrop{
        position:fixed!important;
        inset:0!important;
        width:100vw!important;
        height:100dvh!important;
        min-height:100vh!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        background:#dfe8f5!important;
        overflow:hidden!important;
        cursor:pointer;
      }
      /* Fondo tipo Apple: manchas de color muy desenfocadas que se mueven lento */
      #${PORTAL_ID} .gift-portal-backdrop::before{
        content:"";position:absolute;inset:-18%;
        background:
          radial-gradient(38% 42% at 18% 22%,rgba(157,207,255,.95),transparent 70%),
          radial-gradient(34% 40% at 82% 18%,rgba(196,176,255,.85),transparent 70%),
          radial-gradient(40% 44% at 78% 82%,rgba(255,188,174,.72),transparent 70%),
          radial-gradient(46% 50% at 22% 84%,rgba(79,134,214,.78),transparent 70%),
          radial-gradient(30% 34% at 52% 52%,rgba(255,255,255,.65),transparent 72%);
        filter:blur(46px) saturate(1.15);
        animation:giftDrift 22s ease-in-out infinite alternate;
      }
      #${PORTAL_ID} .gift-portal-backdrop::after{
        content:"";position:absolute;inset:0;background:var(--gift-photo,none) center/cover no-repeat;filter:blur(38px) saturate(1.1);transform:scale(1.2);opacity:.9;
      }
      @keyframes giftDrift{from{transform:translate3d(-3%,-2%,0) rotate(0deg) scale(1)}to{transform:translate3d(3%,2%,0) rotate(8deg) scale(1.08)}}
      @media(prefers-reduced-motion:reduce){#${PORTAL_ID} .gift-portal-backdrop::before{animation:none}}
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-backdrop{background:#0f1622!important}
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-backdrop::before{opacity:.55}
      #${PORTAL_ID} .gift-portal-card{
        position:relative!important;
        z-index:1!important;
        box-sizing:border-box!important;
        width:min(100%,520px)!important;
        max-height:calc(100dvh - 44px)!important;
        overflow:auto!important;
        padding:48px 34px 38px!important;
        margin:0!important;
        border:1px solid rgba(255,255,255,.7)!important;
        border-radius:34px!important;
        background:rgba(255,255,255,.58)!important;
        -webkit-backdrop-filter:blur(28px) saturate(1.6);
        backdrop-filter:blur(28px) saturate(1.6);
        color:#1d2b45!important;
        text-align:center!important;
        box-shadow:0 30px 90px rgba(30,50,90,.22)!important;
        transform:translateY(18px) scale(.97);
        transition:transform .25s ease;
        font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif!important;
      }
      #${PORTAL_ID}.open .gift-portal-card{transform:translateY(0) scale(1)}
      #${PORTAL_ID} .gift-portal-close{
        position:absolute!important;
        top:16px!important;
        right:16px!important;
        width:40px!important;
        height:40px!important;
        display:grid!important;
        place-items:center!important;
        margin:0!important;
        padding:0!important;
        border:1px solid rgba(29,43,69,.12)!important;
        border-radius:50%!important;
        background:rgba(255,255,255,.72)!important;
        cursor:pointer!important;
      }
      #${PORTAL_ID} .gift-portal-close svg{
        width:18px!important;height:18px!important;
        fill:none!important;stroke:#1d2b45!important;stroke-width:1.8!important;
        stroke-linecap:round!important;
      }
      #${PORTAL_ID} .gift-portal-icon{
        display:block!important;
        width:76px!important;
        height:76px!important;
        margin:0 auto!important;
        object-fit:contain!important;
      }
      #${PORTAL_ID} .gift-portal-kicker{
        margin:18px 0 10px!important;
        color:#5b7398!important;
        font-size:11px!important;
        font-weight:800!important;
        line-height:1.3!important;
        letter-spacing:.17em!important;
        text-transform:uppercase!important;
      }
      #${PORTAL_ID} .gift-portal-title{
        margin:0!important;
        color:#1d2b45!important;
        font-family:Georgia,"Times New Roman",serif!important;
        font-size:clamp(32px,7vw,48px)!important;
        font-weight:500!important;
        line-height:1.02!important;
        letter-spacing:-.045em!important;
      }
      #${PORTAL_ID} .gift-portal-message{
        max-width:390px!important;
        margin:18px auto 0!important;
        color:#53627a!important;
        font-size:15px!important;
        line-height:1.65!important;
      }
      #${PORTAL_ID} .gift-portal-signature{
        margin:24px 0 0!important;
        color:#3a6fc0!important;
        font-family:Georgia,"Times New Roman",serif!important;
        font-size:21px!important;
        font-style:italic!important;
        line-height:1.3!important;
      }
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-card{background:rgba(24,28,36,.6)!important;border-color:rgba(255,255,255,.12)!important;color:#eef2f8!important}
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-title{color:#f3f6fb!important}
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-message{color:#b9c3d3!important}
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-kicker{color:#9fb4d6!important}
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-signature{color:#9dc4f5!important}
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-close{background:rgba(255,255,255,.1)!important;border-color:rgba(255,255,255,.16)!important}
      html[data-theme="dark"] #${PORTAL_ID} .gift-portal-close svg{stroke:#eef2f8!important}
      @media(max-width:500px){
        #${PORTAL_ID}{padding:16px!important}
        #${PORTAL_ID} .gift-portal-card{
          max-height:calc(100dvh - 32px)!important;
          padding:44px 24px 32px!important;
          border-radius:28px!important;
        }
        #${PORTAL_ID} .gift-portal-icon{width:68px!important;height:68px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePortal(){
    ensureGlobalStyle();
    let portal=document.getElementById(PORTAL_ID);
    if(portal) return portal;

    portal=document.createElement('div');
    portal.id=PORTAL_ID;
    portal.setAttribute('aria-hidden','true');
    portal.innerHTML=`
      <button class="gift-portal-backdrop" type="button" aria-label="Cerrar"></button>
      <section class="gift-portal-card" role="dialog" aria-modal="true" aria-labelledby="giftPortalTitle">
        <button class="gift-portal-close" type="button" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        <img class="gift-portal-icon" src="gift.svg" alt="">
        <p class="gift-portal-kicker">UN REGALO MUSICAL PARA TI</p>
        <h2 class="gift-portal-title" id="giftPortalTitle">Hecho para compartir la música.</h2>
        <p class="gift-portal-message">Todo lo que encuentras aquí fue preparado con dedicación para que explorar los acordes sea sencillo, claro y especial.</p>
        <p class="gift-portal-signature">Con cariño, para quien ama la música.</p>
      </section>
    `;
    document.body.appendChild(portal);

    const close=()=>{
      portal.classList.remove('open');
      portal.setAttribute('aria-hidden','true');
      document.documentElement.style.overflow=portal.dataset.prevHtmlOverflow||'';
      document.body.style.overflow=portal.dataset.prevBodyOverflow||'';
      const opener=document.querySelector('gift-card-widget[data-gift-opener="true"]');
      if(opener){
        opener.removeAttribute('data-gift-opener');
        opener.focusTrigger?.();
      }
    };

    portal.querySelector('.gift-portal-backdrop').addEventListener('click',close);
    portal.querySelector('.gift-portal-close').addEventListener('click',close);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&portal.classList.contains('open')) close();
    });

    portal.openFrom=(widget)=>{
      document.querySelectorAll('gift-card-widget[data-gift-opener]').forEach(el=>el.removeAttribute('data-gift-opener'));
      widget.setAttribute('data-gift-opener','true');
      portal.dataset.prevHtmlOverflow=document.documentElement.style.overflow||'';
      portal.dataset.prevBodyOverflow=document.body.style.overflow||'';
      document.documentElement.style.overflow='hidden';
      document.body.style.overflow='hidden';
      portal.classList.add('open');
      portal.setAttribute('aria-hidden','false');
      requestAnimationFrame(()=>portal.querySelector('.gift-portal-close').focus());
    };

    return portal;
  }

  class GiftCardWidget extends HTMLElement{
    constructor(){
      super();
      this.attachShadow({mode:'open'});
    }

    connectedCallback(){
      if(this.shadowRoot.childElementCount) return;

      this.shadowRoot.innerHTML=`
        <style>
          :host{
            display:block;
            width:100%;
            margin-top:auto;
            color:var(--text,#171817);
            font-family:inherit;
          }
          *{box-sizing:border-box}
          button{
            -webkit-appearance:none;
            appearance:none;
            width:100%;
            min-height:76px;
            display:grid;
            grid-template-columns:46px minmax(0,1fr) 20px;
            align-items:center;
            gap:12px;
            padding:14px;
            border:1px solid color-mix(in srgb,#8bb7e6 45%,var(--line,#d7d8d2));
            border-radius:18px;
            background:linear-gradient(135deg,color-mix(in srgb,#9dcfff 22%,var(--surface,#fff)),color-mix(in srgb,#c4b0ff 10%,var(--surface,#fff)));
            color:var(--text,#171817);
            font:inherit;
            text-align:left;
            cursor:pointer;
            box-shadow:none;
            transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;
          }
          button:hover{
            transform:translateY(-2px);
            border-color:#8bb7e6;
            box-shadow:0 12px 28px rgba(40,80,140,.12);
          }
          button:active{transform:scale(.98)}
          button:focus-visible{
            outline:3px solid color-mix(in srgb,#8bb7e6 40%,transparent);
            outline-offset:3px;
          }
          img{
            display:block;
            width:46px;
            height:46px;
            object-fit:contain;
            background:transparent;
          }
          .copy{min-width:0}
          strong,small{display:block;padding:0;text-transform:none}
          strong{
            margin:0;
            color:var(--text,#171817);
            font-size:14px;
            font-weight:700;
            line-height:1.2;
            letter-spacing:-.02em;
          }
          small{
            margin:4px 0 0;
            color:var(--muted,#6b6e6a);
            font-size:11px;
            font-weight:400;
            line-height:1.35;
            letter-spacing:0;
          }
          svg{
            display:block;
            width:19px;
            height:19px;
            fill:none;
            stroke:var(--muted,#6b6e6a);
            stroke-width:2;
            stroke-linecap:round;
            stroke-linejoin:round;
          }
        </style>
        <button type="button" aria-haspopup="dialog" aria-label="Abrir regalo">
          <img src="gift.svg" alt="">
          <span class="copy">
            <strong>Un regalo para ti</strong>
            <small>Un mensaje especial para ti.</small>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>
      `;

      this.trigger=this.shadowRoot.querySelector('button');
      this.trigger.addEventListener('click',()=>ensurePortal().openFrom(this));
    }

    focusTrigger(){ this.trigger?.focus(); }
  }

  if(!customElements.get('gift-card-widget')){
    customElements.define('gift-card-widget',GiftCardWidget);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ensurePortal,{once:true});
  }else{
    ensurePortal();
  }
})();