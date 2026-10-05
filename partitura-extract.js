/* Círculos Music · Extrae de una página de PDF (pdf.js) los símbolos de texto con su posición exacta y las líneas y rellenos dibujados. */
(function(root){
'use strict';
const mul=(m,n)=>[m[0]*n[0]+m[1]*n[2],m[0]*n[1]+m[1]*n[3],m[2]*n[0]+m[3]*n[2],m[2]*n[1]+m[3]*n[3],m[4]*n[0]+m[5]*n[2]+n[4],m[4]*n[1]+m[5]*n[3]+n[5]];
const apply=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
async function extractPage(page,OPS){
  const ol=await page.getOperatorList();
  const glyphs=[],segs=[],fills=[];
  let ctm=[1,0,0,1,0,0];const stack=[];
  let tm=[1,0,0,1,0,0],tlm=[1,0,0,1,0,0],font=null,fontName='',size=1,cs=0,ws=0,hs=1,lead=0,rise=0,lw=1;
  let path=[];                       // subpaths de la ruta en construcción
  const fontCache={};
  const getFont=n=>{if(n in fontCache)return fontCache[n];let f=null;try{f=page.commonObjs.get(n);}catch(e){try{f=page.objs.get(n);}catch(e2){}}return fontCache[n]=f;};
  const moveText=(tx,ty)=>{tlm=mul([1,0,0,1,tx,ty],tlm);tm=tlm.slice();};
  const show=arr=>{
    for(const g of arr){
      if(typeof g==='number'){tm=mul([1,0,0,1,-g/1000*size*hs,0],tm);continue;}
      const m=mul(tm,ctm),[x,y]=apply(m,0,rise),sc=Math.hypot(m[2],m[3]);
      glyphs.push({ch:g.unicode||'',font:fontName,x,y,size:Math.abs(size)*sc,w:(g.width||0)/1000*Math.abs(size)*hs*Math.hypot(m[0],m[1])});
      const adv=((g.width||0)/1000*size+cs+(g.isSpace?ws:0))*hs;
      tm=mul([1,0,0,1,adv,0],tm);
    }
  };
  for(let i=0;i<ol.fnArray.length;i++){
    const f=ol.fnArray[i],a=ol.argsArray[i];
    switch(f){
      case OPS.save:stack.push({ctm:ctm.slice(),lw});break;
      case OPS.restore:{const s=stack.pop();if(s){ctm=s.ctm;lw=s.lw;}break;}
      case OPS.transform:ctm=mul(a,ctm);break;
      case OPS.setLineWidth:lw=a[0];break;
      case OPS.beginText:tm=[1,0,0,1,0,0];tlm=[1,0,0,1,0,0];break;
      case OPS.setFont:{fontName=a[0];font=getFont(a[0]);size=a[1];break;}
      case OPS.setTextMatrix:tm=a.slice();tlm=a.slice();break;
      case OPS.moveText:moveText(a[0],a[1]);break;
      case OPS.setLeadingMoveText:lead=-a[1];moveText(a[0],a[1]);break;
      case OPS.nextLine:moveText(0,-lead);break;
      case OPS.setLeading:lead=a[0];break;
      case OPS.setCharSpacing:cs=a[0];break;
      case OPS.setWordSpacing:ws=a[0];break;
      case OPS.setHScale:hs=a[0]/100;break;
      case OPS.setTextRise:rise=a[0];break;
      case OPS.showText:case OPS.showSpacedText:show(a[0]);break;
      case OPS.nextLineShowText:moveText(0,-lead);show(a[0]);break;
      case OPS.nextLineSetSpacingShowText:ws=a[0];cs=a[1];moveText(0,-lead);show(a[2]);break;
      case OPS.constructPath:{
        const ops=a[0],args=a[1];let k=0,cur=null,sub=null;
        for(const op of ops){
          if(op===OPS.moveTo){cur=apply(ctm,args[k],args[k+1]);k+=2;sub={pts:[cur],curve:false};path.push(sub);}
          else if(op===OPS.lineTo){cur=apply(ctm,args[k],args[k+1]);k+=2;if(!sub){sub={pts:[cur],curve:false};path.push(sub);}else sub.pts.push(cur);}
          else if(op===OPS.curveTo){const p1=apply(ctm,args[k],args[k+1]),p2=apply(ctm,args[k+2],args[k+3]);cur=apply(ctm,args[k+4],args[k+5]);k+=6;if(sub){sub.pts.push(p1,p2,cur);sub.curve=true;}}
          else if(op===OPS.curveTo2||op===OPS.curveTo3){const p1=apply(ctm,args[k],args[k+1]);cur=apply(ctm,args[k+2],args[k+3]);k+=4;if(sub){sub.pts.push(p1,cur);sub.curve=true;}}
          else if(op===OPS.closePath){if(sub&&sub.pts.length)sub.pts.push(sub.pts[0]);}
          else if(op===OPS.rectangle){const x=args[k],y=args[k+1],w=args[k+2],h=args[k+3];k+=4;const p=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]].map(q=>apply(ctm,q[0],q[1]));sub={pts:p,curve:false,rect:true};path.push(sub);}
        }
        break;
      }
      case OPS.stroke:case OPS.closeStroke:{
        const scale=Math.hypot(ctm[0],ctm[1])||1;
        for(const s of path)for(let j=1;j<s.pts.length;j++){if(s.curve)continue;const[p,q]=[s.pts[j-1],s.pts[j]];segs.push({x0:p[0],y0:p[1],x1:q[0],y1:q[1],lw:lw*scale});}
        for(const s of path)if(s.curve){const b=bbox(s.pts,'stroke');b.curve=true;fills.push(b);}
        path=[];break;
      }
      case OPS.fill:case OPS.eoFill:case OPS.fillStroke:case OPS.eoFillStroke:case OPS.closeFillStroke:case OPS.closeEOFillStroke:{
        const stroked=f===OPS.fillStroke||f===OPS.eoFillStroke||f===OPS.closeFillStroke||f===OPS.closeEOFillStroke;
        const scale=Math.hypot(ctm[0],ctm[1])||1;
        for(const s of path){
          const b0=bbox(s.pts,'x');
          if(stroked&&!s.curve&&!s.rect&&(b0.w<0.01||b0.h<0.01)){for(let j=1;j<s.pts.length;j++){const[p,q]=[s.pts[j-1],s.pts[j]];segs.push({x0:p[0],y0:p[1],x1:q[0],y1:q[1],lw:lw*scale});}continue;}const b=bbox(s.pts,'fill');b.curve=s.curve;b.rect=!!s.rect;
          // rectángulos finos rellenos = líneas
          if(s.rect&&b.h<1.2&&b.w>b.h*3)segs.push({x0:b.x0,y0:(b.y0+b.y1)/2,x1:b.x1,y1:(b.y0+b.y1)/2,lw:b.h});
          else if(s.rect&&b.w<1.2&&b.h>b.w*3)segs.push({x0:(b.x0+b.x1)/2,y0:b.y0,x1:(b.x0+b.x1)/2,y1:b.y1,lw:b.w});
          else fills.push(b);}
        path=[];break;
      }
      case OPS.endPath:path=[];break;
    }
  }
  // nombre real de cada fuente
  const names={};for(const g of glyphs){if(!(g.font in names)){const fo=getFont(g.font);names[g.font]=(fo&&(fo.name||fo.loadedName))||g.font;}g.fontName=names[g.font];}
  const vp=page.view;
  return {glyphs,segs,fills,width:vp[2]-vp[0],height:vp[3]-vp[1]};
}
function bbox(pts,kind){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const[p,q]of pts){x0=Math.min(x0,p);x1=Math.max(x1,p);y0=Math.min(y0,q);y1=Math.max(y1,q);}return{x0,y0,x1,y1,w:x1-x0,h:y1-y0,kind,pts:pts.length<=16?pts:null};}
const api={extractPage};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PartituraExtract=api;
})(typeof self!=='undefined'?self:this);
