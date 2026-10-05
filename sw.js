/* Círculos Music · modo sin internet
   Guarda la web en el dispositivo para que abra aunque no haya conexión.
   Páginas: primero la red (siempre lo más nuevo) y, sin conexión, la copia guardada.
   Archivos: la copia guardada al instante y se actualiza en segundo plano. */
const VERSION='circulos-v12';
const CORE=[
  './','index.html','acordes.html','manifest.webmanifest',
  'style.css','shell.css','circulos.css','chords-library.css','polish.css','tutorial.css',
  'shell.js','circulos.js','chords-library.js','circle-chords.js','piano-sound.js','piano-voicing.js',
  'gift-ui.js','share.js','favoritos.js','tutorial.js','leave-guard.js',
  'chords-data.json','logo.svg','logo-dark.svg','gift.svg','hero-light.webp',
  'favicon-32.png','favicon-64.png','apple-touch-icon.png','icon-192.png','icon-512.png','icon-maskable-512.png'
];
const SOUNDS=['C3','Ds3','Fs3','A3','C4','Ds4','Fs4','A4','C5','Ds5','Fs5','A5','C6']
  .map(n=>`sounds/piano/${n}.mp3`);

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(VERSION);
    await cache.addAll(CORE);
    // Sonidos del piano: si alguno falla no detiene la instalación
    await Promise.all(SOUNDS.map(u=>cache.add(u).catch(()=>{})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Guarda una respuesta y borra las versiones viejas del mismo archivo (?v=…) */
async function save(request,response){
  if(!response||!response.ok||response.type==='opaque')return;
  const cache=await caches.open(VERSION);
  const url=new URL(request.url);
  if(url.origin===location.origin){
    const old=await cache.keys(request,{ignoreSearch:true});
    await Promise.all(old.filter(r=>r.url!==request.url).map(r=>cache.delete(r)));
  }
  await cache.put(request,response);
}

async function networkFirst(request){
  try{
    // no-cache: pregunta siempre al servidor si la página cambió (así nunca se ve una versión vieja)
    const response=await fetch(request.url,{cache:'no-cache',credentials:'same-origin'});
    if(!response.ok)throw new Error(response.status);
    save(request,response.clone());
    return response;
  }catch(err){
    return (await caches.match(request,{ignoreSearch:true}))||(await caches.match('index.html'))||Response.error();
  }
}

async function staleWhileRevalidate(event,request){
  const cached=await caches.match(request);
  const update=fetch(request).then(response=>{save(request,response.clone());return response;});
  if(cached){event.waitUntil(update.catch(()=>{}));return cached;}
  try{return await update;}
  catch(err){return (await caches.match(request,{ignoreSearch:true}))||Response.error();}
}

async function cacheFirst(request){
  const cached=await caches.match(request,{ignoreSearch:true});
  if(cached)return cached;
  const response=await fetch(request);
  save(request,response.clone());
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin===location.origin){
    if(request.mode==='navigate'||request.destination==='document')event.respondWith(networkFirst(request));
    else if(url.pathname.includes('/sounds/'))event.respondWith(cacheFirst(request));
    else event.respondWith(staleWhileRevalidate(event,request));
    return;
  }
  // Librería de Firebase (versión fija): se guarda para que favoritos funcione sin conexión
  if(url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/'))event.respondWith(cacheFirst(request));
  // Lo demás (sincronización con la nube) va directo a internet
});
