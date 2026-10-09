import { HL } from './hairline-kernel';

const { Cam,fit,proj,facing,rings,ringAt,prism,solid,put,mk,poly,open,fillet,hull,seg,
  tween,tset,tval,tdone,pointer,register,disposer }=HL;
// Equal perimeter samples let the same six solids morph between physical and product views.
function surface(points,lines=[]) {
  // Keep every rounded corner; spend the extra vertices along long straight edges.
  if(points.reduce((a,p,i)=>a+p[0]*points[(i+1)%points.length][1]-p[1]*points[(i+1)%points.length][0],0)<0)points=[...points].reverse();
  const start=points.reduce((a,p,i)=>p[0]+p[1]<points[a][0]+points[a][1]?i:a,0);
  points=points.slice(start).concat(points.slice(0,start));
  const edges=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]));
  const length=edges.reduce((a,b)=>a+b,0),extra=48-points.length;
  const counts=edges.map(d=>1+Math.floor(length?extra*d/length:extra/points.length));
  for(let left=48-counts.reduce((a,b)=>a+b,0),i=0;left>0;left--,i++)counts[i%counts.length]++;
  const outline=[];
  points.forEach((a,i)=>{const b=points[(i+1)%points.length];for(let j=0;j<counts[i];j++)outline.push(a[0]+(b[0]-a[0])*j/counts[i],a[1]+(b[1]-a[1])*j/counts[i]);});
  return outline.concat(Array.from({length:8},(_,i)=>lines[i]??[...points[0],...points[0]]).flat());
}
const rounded=points=>fillet(points,points.map(()=>3));
const box=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const panel=(x,y,w,h,marks=false)=>surface(w&&h?rounded(box(x,y,w,h)):box(x,y,w,h),marks?[[x+10,y+14,x+w*.6,y+14],[x+10,y+22,x+w*.4,y+22]]:[]);
const folded=panel(200,175,0,0);
function geometry() {
  const C=Cam(45,.5,1.25);
  fit(C,[[-60,140,0],[144,-35,0],[-60,-35,96],[56,40,0]],200,157);
  const P=proj(C),front=facing(C),line=(a,b)=>[...P(...a),...P(...b)];
  const slab=(x,y,w,h,z,d=3,etched=true)=>{
    const [ring,inner]=rings(x,y,x+w,y+h,2,1),top=ringAt(P,ring,z+d);
    return surface(hull([...ringAt(P,ring,z),...top]),[[...P(x+2,y+h-1,z+d),...P(x+w-2,y+h-1,z+d)],...(etched?[8,14].map((offset,i)=>[...P(x+6,y+offset,z+d),...P(x+w-6-i*4,y+offset,z+d)]):[])]);
  };
  const factory=[0,1,2].map(i=>{
    const x=-60+i*39,profile=fillet([[x,39],[x,70],[x+36,45],[x+38,39]],[1,2,2,1]);
    return surface(hull(profile.flatMap(([u,z])=>[P(u,-35,z),P(u,40,z)])),[line([x+1,39,68],[x+35,39,44]),line([x+35,39,44],[x+35,-34,44])]);
  });
  factory.push(slab(-48,102,34,28,8),slab(111,-8,28,34,8,6),folded);
  // The selected repository is a solid code cartridge docking into the Factory base.
  const code=factory.slice(0,3);
  code.push(slab(-56,80,70,54,8,5,false));
  for(const right of [false,true]) {
    const points=[[-40,102],[-27,89],[-22,94],[-31,103],[-22,112],[-27,117]];
    const ring=fillet(points.map(([x,y])=>{const u=(right?-42-x:x)+21,v=y-103;return [-21+(u+v)*Math.SQRT1_2,107+(-u+v)*Math.SQRT1_2];}),points.map(()=>1));
    code.push(surface(ring.map(([x,y])=>P(x,y,14)),[]));
  }
  return {P,front,factory,code};
}
function poses(scene,mode,objects) {
  if(scene==='factory')return objects.factory;
  if(scene==='codebase')return objects.code;
  if(scene==='intake')return [panel(28,48,148,64),panel(28,186,104,72),panel(148,186,104,44,true),panel(268,186,104,44,true),panel(28,271,104,20,true),folded];
  return [panel(28,156,104,94,true),panel(148,156,104,94,true),panel(268,156,104,94,true),panel(148,48,104,42),
    mode==='individual'?panel(28,48,104,42):folded,mode==='shared'?folded:panel(268,48,104,42)];
}
function routes(scene,mode) {
  const off=[200,175,200,175,200,175,200,175];
  if(scene==='factory'||scene==='codebase')return [off,off,off];
  if(scene==='intake')return [[104,112,104,142,80,150,80,186],off,off];
  return [80,200,320].map((x,i)=>{const origin=mode==='individual'?x:mode==='hybrid'&&i===2?320:200;return [origin,90,origin,126,x,126,x,156];});
}
const curve=q=>`M${q[0]},${q[1]}C${q[2]},${q[3]} ${q[4]},${q[5]} ${q[6]},${q[7]}`;
const at=(q,t)=>[0,1].map(k=>(1-t)**3*q[k]+3*(1-t)**2*t*q[k+2]+3*(1-t)*t*t*q[k+4]+t**3*q[k+6]);
function mount({stage,svg,read},value) {
  const bag=disposer(),root=mk('g',{},svg),objects=geometry();
  let scene='factory',mode='shared',stagger=value,active=-1,delivery=tween(0),packetOn=false;
  const links=routes(scene,mode).map(q=>({el:mk('path',{class:'nf lo'},root),tw:q.map(v=>tween(v)),drawn:''}));
  const packet=mk('path',{class:'sil'},root),assembly=mk('g',{},root);
  const parts=[solid(assembly),solid(assembly),solid(assembly),solid(assembly),solid(assembly)];
  const details=mk('path',{class:'nf lo'},assembly);
  let bodyTween=tween(scene==='factory'||scene==='codebase'?1:0),baseTween=tween(scene==='codebase'?1:0),bodyDrawn='',packetDrawn='';
  const panels=poses(scene,mode,objects).map((q,i)=>{
    const g=mk('g',{},root),face=mk('path',{class:i===3?'sil hi':'sil'},g),marks=mk('path',{class:'nf lo'},g);
    return {g,face,marks,tw:q.map(v=>tween(v)),lift:tween(0),drawn:''};
  });
  function drawBody(amount,base) {
    const key=amount+','+base;if(key===bodyDrawn)return;bodyDrawn=key;
    assembly.setAttribute('display',amount<.002?'none':'');if(amount<.002)return;
    const P=(...v)=>objects.P(...v).map((n,i)=>(i?190:200)+(n-(i?190:200))*amount);
    const feet=[[-68,-43,134,190,-8,0],[-59,42,76,94,0,5]];
    [[-52,38,40,104,0,7],[54,-14,91,46,0,7],[30,-34,16,16,0,93],[28,-36,20,20,89,96],[-60,-35,117,75,0,39]].forEach((values,i)=>{
      const [x,y,w,h,z,top]=values.map((v,k)=>i<2?v+(feet[i][k]-v)*base:v);
      const [ring,inner]=rings(x,y,x+w,y+h,2,1);put(parts[i],prism(P,objects.front,ring,inner,z,top));
    });
    const wall=(x,z)=>P(x,40,z),side=(y,z)=>P(57,y,z);
    details.setAttribute('d',[
      open(rounded([wall(-49,8),wall(-49,31),wall(-13,31),wall(-13,8)])),
      open(rounded([side(-9,8),side(-9,31),side(26,31),side(26,8)])),
      ...[15,23].map(z=>seg(wall(3,z),wall(32,z))),
    ].join(''));
  }
  function drawPanel(panel,q,lift) {
    const key=q.join(',')+lift;if(panel.drawn===key)return;panel.drawn=key;
    const points=Array.from({length:48},(_,i)=>[q[i*2],q[i*2+1]-lift]);
    const area=Math.abs(points.reduce((a,p,i)=>a+p[0]*points[(i+1)%48][1]-p[1]*points[(i+1)%48][0],0));
    panel.g.setAttribute('display',area<1?'none':'');if(area<1)return;
    panel.rendered=q.map((v,k)=>k%2?v-lift:v);panel.face.setAttribute('d',poly(points));
    panel.marks.setAttribute('d',Array.from({length:8},(_,i)=>seg([q[96+i*4],q[97+i*4]-lift],[q[98+i*4],q[99+i*4]-lift])).join(''));
  }
  function tick(_dt,now) {
    let moving=false;
    links.forEach(link=>{const q=link.tw.map(tw=>tval(tw,now)),key=q.join(',');if(key!==link.drawn){link.drawn=key;link.el.setAttribute('d',curve(q));}if(link.tw.some(tw=>!tdone(tw,now)))moving=true;});
    drawBody(tval(bodyTween,now),tval(baseTween,now));if(!tdone(bodyTween,now)||!tdone(baseTween,now))moving=true;
    panels.forEach((panel,i)=>{
      let q=panel.tw.map(tw=>tval(tw,now));
      if((scene==='factory'&&i===3||scene==='codebase'&&i>=3)&&tdone(bodyTween,now)&&panel.tw.every(tw=>tdone(tw,now))) {
        const distance=scene==='codebase'?30:52;
        const origin=objects.P(0,0,0),end=objects.P(0,-distance*Math.min(tval(delivery,now)*2,1),0);
        q=q.map((v,k)=>v+end[k%2]-origin[k%2]);
      }
      drawPanel(panel,q,tval(panel.lift,now));if(panel.tw.some(tw=>!tdone(tw,now))||!tdone(panel.lift,now))moving=true;
    });
    const progress=tval(delivery,now),route=routes(scene,mode)[scene==='accounts'?Math.max(active,0):0],point=at(route,progress),key=point.join(',')+packetOn;
    if(key!==packetDrawn){packetDrawn=key;packet.setAttribute('d',poly(rounded(box(point[0]-4,point[1]-5,8,10))));packet.setAttribute('display',packetOn&&scene!=='factory'&&scene!=='codebase'&&progress>.01&&progress<.99?'':'none');}
    if(!tdone(delivery,now))moving=true;return moving;
  }
  const loop=register(stage,tick);bag.add(loop.unregister);tick(0,performance.now());
  function retarget(immediate=false) {
    const now=performance.now();
    panels.forEach(panel=>{if(!immediate&&panel.rendered)panel.tw=panel.rendered.map(v=>tween(v));panel.lift=tween(0);});
    poses(scene,mode,objects).forEach((q,i)=>q.forEach((v,k)=>{if(immediate)panels[i].tw[k]=tween(v);else tset(panels[i].tw[k],v,now,Math.abs(i-1)*stagger);}));
    routes(scene,mode).forEach((q,i)=>q.forEach((v,k)=>{if(immediate)links[i].tw[k]=tween(v);else tset(links[i].tw[k],v,now,0);}));
    const body=scene==='factory'||scene==='codebase'?1:0,base=scene==='codebase'?1:0;
    if(immediate){bodyTween=tween(body);baseTween=tween(base);}else{tset(bodyTween,body,now,0);tset(baseTween,base,now,0);}
    active=-1;packetOn=false;delivery=tween(0);
    panels.forEach((panel,i)=>{tset(panel.lift,0,now,0);panel.face.classList.toggle('hi',i===(scene==='factory'||scene==='codebase'?3:0));});read.textContent='rest';loop.wake();
  }
  function select(next) {
    if(active===next)return;active=next;const now=performance.now();
    if(next===0){delivery=tween(0);packetOn=false;}else if(next>0){packetOn=true;tset(delivery,next===1?.5:1,now,0);}
    const chosen=scene==='factory'?(next<1?3:next===1?1:4):scene==='codebase'?(next<1?3:1):scene==='intake'?(next<=0?0:1):Math.max(next,0);
    panels.forEach((panel,i)=>{
      const lift=scene==='factory'&&i===4&&next===2?3:0;
      tset(panel.lift,lift,now,Math.abs(i-chosen)*stagger);panel.face.classList.toggle('hi',i===chosen);
    });
    read.textContent=next<0?'rest':['source','in progress','ready'][next];loop.wake();
  }
  bag.add(pointer(stage,{move:([x,y])=>{if(x<5||x>395||y<25||y>285)return select(-1);select(scene==='intake'?(y<115?0:y<178?1:2):x<140?0:x<260?1:2);},leave:()=>select(-1)}));
  bag.add(()=>svg.replaceChildren());
  return {set:v=>{stagger=v;},setScene:(next,immediate=false)=>{scene=next;retarget(immediate);},setMode:next=>{if(mode!==next){mode=next;retarget();}},destroy:bag.dispose};
}
export default {
  name:'journey',means:'Ideas enter a workshop and leave as reviewed work; its solids morph into the workspace being configured.',
  rules:[1,2,3,6,7,8,9],range:[20,40,60],tour:[[85,210],[200,145],[325,205],null],mount,
};
