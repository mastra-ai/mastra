import { HL } from './hairline-kernel';
const { Cam,fit,proj,facing,rings,ringAt,prism,solid,put,mk,poly,open,fillet,hull,seg,
  tween,tset,tval,tdone,pointer,register,disposer,reducedMotion }=HL;
function surface(points,lines=[]) {
  if(points.reduce((a,p,i)=>a+p[0]*points[(i+1)%points.length][1]-p[1]*points[(i+1)%points.length][0],0)<0)points=[...points].reverse();
  const start=points.reduce((a,p,i)=>p[0]+p[1]<points[a][0]+points[a][1]?i:a,0);
  points=points.slice(start).concat(points.slice(0,start));
  const edges=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]));
  const length=edges.reduce((a,b)=>a+b,0),extra=48-points.length;
  const counts=edges.map(d=>1+Math.floor(length?extra*d/length:extra/points.length));
  for(let left=48-counts.reduce((a,b)=>a+b,0),i=0;left>0;left--,i++)counts[i%counts.length]++;
  const outline=[];
  points.forEach((a,i)=>{const b=points[(i+1)%points.length];for(let j=0;j<counts[i];j++)outline.push(a[0]+(b[0]-a[0])*j/counts[i],a[1]+(b[1]-a[1])*j/counts[i]);});
  return outline.concat(Array.from({length:8},(_,i)=>lines[i]??[...points[0],...points[0]]).flat());}
const rounded=(points,radius=3)=>fillet(points,points.map(()=>radius));
const box=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const panel=(x,y,w,h,marks=false)=>surface(w&&h?rounded(box(x,y,w,h),8):box(x,y,w,h),marks?[[x+10,y+Math.min(14,h*.33),x+w*.6,y+Math.min(14,h*.33)],[x+10,y+Math.min(22,h*.67),x+w*.4,y+Math.min(22,h*.67)]]:[]);
const folded=panel(200,175,0,0),boardPanel=(x,y)=>panel(x,y,104,48);
const miniature=(n,axis,anchor=[314,148])=>anchor[axis]+(n-(axis?168:222))*.46;
const bays=[{axis:1,wall:40,back:27,lo:-52,hi:-10,end:142},{axis:0,wall:57,back:44,lo:-10,hi:28,end:145}];
const bayPoint=(bay,u,v,z)=>bay.axis===1?[u,v,z]:[v,u,z];
const bodyPose=scene=>scene==='factory'?[1,0,0]:[.46,miniature(0,0,scene==='setup'?[80,197]:undefined),miniature(0,1,scene==='setup'?[80,197]:undefined)];
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
  factory.push(slab(-48,102,34,28,7),slab(111,-8,28,34,7,6),folded);
  const code=factory.slice(0,3).map(q=>q.map((n,i)=>miniature(n,i%2)));
  const center=P(-21,107,13),repository=q=>q.map((n,i)=>(i%2?181:116)+(n-center[i%2])*1.65);
  code.push(repository(slab(-56,80,70,54,8,5,false)));
  for(const right of [false,true]) {
    const points=[[-40,102],[-27,89],[-22,94],[-31,103],[-22,112],[-27,117]];
    const ring=fillet(points.map(([x,y])=>{const u=(right?-42-x:x)+21,v=y-103;return [-21+(u+v)*Math.SQRT1_2,107+(-u+v)*Math.SQRT1_2];}),points.map(()=>1));
    code.push(repository(surface(ring.map(([x,y])=>P(x,y,14)),[])));
  }
  const a=repository(P(14,100,11)),b=P(-31,40,17).map((n,i)=>miniature(n,i)),c=P(-31,14,17).map((n,i)=>miniature(n,i));
  const codeLink=[...a,a[0]+24,a[1],...b,...c];
  return {P,front,factory,code,codeLink,workshop:factory.slice(0,3).map(q=>q.map((n,i)=>miniature(n,i%2,[80,197])))};}
function poses(scene,mode,objects) {if(scene==='setup')return [...objects.workshop,panel(148,48,104,42),mode==='individual'?panel(28,48,104,42):folded,mode==='shared'?folded:panel(268,48,104,42),panel(148,156,104,94),panel(268,156,104,94)];
  return corePoses(scene,mode,objects).concat([folded,folded]);}
function corePoses(scene,mode,objects) {
  if(scene==='factory')return objects.factory;
  if(scene==='codebase')return objects.code;
  if(scene==='intake')return [panel(28,48,148,64),panel(28,186,104,48),panel(148,186,104,48),folded,folded,folded];
  return [panel(28,156,104,94,true),panel(148,156,104,94,true),panel(268,156,104,94,true),panel(148,48,104,42),
    mode==='individual'?panel(28,48,104,42):folded,mode==='shared'?folded:panel(268,48,104,42)];
}
function routes(scene,mode,objects) {const off=[200,175,200,175,200,175,200,175];
  if(scene==='factory')return [off,off,off];
  if(scene==='codebase')return [objects.codeLink,off,off];
  if(scene==='intake')return [[104,112,104,142,80,150,80,186],off,off];
  return [80,200,320].map((x,i)=>{const origin=mode==='individual'?x:mode==='hybrid'&&i===2?320:200;return [origin,90,origin,126,x,126,x,scene==='setup'&&i===0?184:156];});}
const curve=q=>`M${q[0]},${q[1]}C${q[2]},${q[3]} ${q[4]},${q[5]} ${q[6]},${q[7]}`;
const at=(q,t)=>[0,1].map(k=>(1-t)**3*q[k]+3*(1-t)**2*t*q[k+2]+3*(1-t)*t*t*q[k+4]+t**3*q[k+6]);
const ease=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const envelope=p=>ease(p/.1)*(1-ease((p-.88)/.1));
// Jobs enter free slots, then move up after the previous job leaves. Invisible resets close the loop.
const boardTracks=[
  [[0,28,186,1],[.6,28,186,1],[1.4,148,244,1],[3.5,148,244,1],[4.1,148,186,1],[5.2,148,186,1],[6,268,244,1],[7.7,268,244,1],[8.3,268,186,1],[11.8,268,186,1],[12.4,268,186,0],[13.2,28,186,0],[13.8,28,186,1],[14,28,186,1]],
  [[0,148,186,1],[2.4,148,186,1],[3.2,268,186,1],[6.8,268,186,1],[7.4,268,186,0],[9,28,186,0],[9.6,28,186,1],[10.6,28,186,1],[11.4,148,186,1],[14,148,186,1]],
];
function boardFrame(t,i) {
  const track=boardTracks[i-1],end=track.findIndex(q=>q[0]>t),a=track[Math.max(0,end-1)],b=track[end<0?track.length-1:end],v=ease((t-a[0])/(b[0]-a[0]||1));
  if(a[1]!==b[1]&&b[2]>a[2])return [...at([a[1],a[2],a[1],b[2]+32,b[1],b[2]+32,b[1],b[2]],v),1];
  return blend(a.slice(1),b.slice(1),v);}
// Clip in world space, then paint the inside behind the wall and the outside in front.
function cut(points,axis,limit,greater) {const result=[];points.forEach((b,i)=>{const a=points[(i+points.length-1)%points.length],inside=p=>greater?p[axis]>=limit:p[axis]<=limit;
    if(inside(a)!==inside(b))result.push(blend(a,b,(limit-a[axis])/(b[axis]-a[axis])));if(inside(b))result.push(b);});return result;
}
function ticket(P,index,shift,reveal,exterior) {
  const [x,y,w,h,d]=index===3?[-48,102,34,28,3]:[111,-8,28,34,6],{axis,wall:lip,back}=bays[index-3];
  const center=[x+w/2,y+h/2,7+d/2],pose=p=>p.map((v,k)=>center[k]+(v-center[k])*reveal+(k===axis?shift:0));
  const [ring]=rings(x,y,x+w,y+h,2,1),world=[7,7+d].flatMap(z=>ring.map(q=>pose([q.u,q.v,z]))),screen=world.map(p=>P(...p));
  const outline=hull(screen).map(p=>world[screen.findIndex(q=>q[0]===p[0]&&q[1]===p[1])]);
  const crop=points=>exterior?cut(points,axis,lip,true):cut(cut(points,axis,back,true),axis,lip,false),face=crop(outline);
  const edges=face.map((a,i)=>{const b=face[(i+1)%face.length];return Math.abs(a[axis]-b[axis])<.001&&[lip,back].some(v=>Math.abs(a[axis]-v)<.001)?'':seg(P(...a),P(...b));}).join('');
  const lines=[[[x+2,y+h-1,7+d],[x+w-2,y+h-1,7+d]],...[8,14].map((v,i)=>[[x+6,y+v,7+d],[x+w-6-i*4,y+v,7+d]])];
  const crease=lines.map(line=>open(crop(line.map(pose)).filter((p,i,a)=>a.findIndex(q=>q.every((v,k)=>v===p[k]))===i).map(p=>P(...p)))).join('');
  return [face.length>2?poly(face.map(p=>P(...p))):'',edges,crease];}
function mount({stage,svg,read,onIntakeFrame},value) {
  const bag=disposer(),root=mk('g',{},svg),objects=geometry();let scene='factory',mode='shared',stagger=value,active=-1,clock=0,flow=tween(0),ready=false,labelDrawn=['',''];
  const links=routes(scene,mode,objects).map(q=>({el:mk('path',{class:'nf lo'},root),tw:q.map(v=>tween(v)),drawn:''}));
  const landing=mk('path',{class:'nf lo dash','data-role':'intake-landing',d:poly(rounded(box(28,186,104,48),8))+seg([76,210],[84,210])+seg([80,206],[80,214])},root);
  const packets=Array.from({length:3},()=>({el:mk('path',{class:'sil','data-role':'packet'},root),drawn:''})),assembly=mk('g',{},root);
  const foundation=solid(assembly);foundation.g.setAttribute('data-role','foundation');const parts=[solid(assembly),solid(assembly),solid(assembly),solid(assembly),solid(assembly)];const recess=mk('path',{class:'fo'},assembly),interior=mk('path',{class:'nf lo'},assembly),details=mk('path',{class:'nf lo'},assembly);
  const ticketLayers=[mk('g',{'data-depth':'inside'},assembly),mk('g',{'data-depth':'outside'},root)];
  const slices=ticketLayers.map(layer=>[3,4].map(()=>({paths:['fo','nf sil','nf lo'].map(cls=>mk('path',{class:cls},layer)),drawn:''})));
  parts[4].sil.setAttribute('data-depth','wall');
  let bodyTween=tween(['factory','codebase','setup'].includes(scene)?1:0),baseTween=tween(scene==='factory'?0:1),bodyDrawn='';
  let placement=bodyPose(scene).map(n=>tween(n));
  const panels=poses(scene,mode,objects).map((q,i)=>{
    const g=mk('g',{},root),face=mk('path',{class:i===3?'sil hi':'sil'},g),marks=mk('path',{class:'nf lo'},g);
    return {g,face,marks,tw:q.map(v=>tween(v)),drawn:''};
  });
  function order() {
    panels.forEach(panel=>root.append(panel.g));
    parts[3].g.after(parts[0].g,parts[1].g,recess,interior,ticketLayers[0]);
    packets.forEach(packet=>root.insertBefore(packet.el,assembly));
    if(scene==='codebase')packets.forEach(packet=>interior.after(packet.el));
    if(scene==='factory')interior.after(panels[3].g,panels[4].g);
    root.append(ticketLayers[1]);
  }
  order();function drawBody(amount,base,position) {
    const key=position.join()+amount+','+base;if(key===bodyDrawn)return;bodyDrawn=key;
    assembly.setAttribute('display',amount<.002?'none':'');if(amount<.002)return;
    const P=(...v)=>objects.P(...v).map((n,i)=>{const value=n*position[0]+position[i+1];return (i?190:200)+(value-(i?190:200))*amount;});
    const floor=7,lintel=28;const [foot,footInner]=rings(-66,-41,64,45,2,1);
    foundation.g.setAttribute('display',base<.002?'none':'');put(foundation,prism((...p)=>blend(P(0,0,0),P(...p),base),objects.front,foot,footInner,-5,0));
    bays.forEach((bay,i)=>{
      const a=bayPoint(bay,bay.lo,bay.back,0),b=bayPoint(bay,bay.hi,bay.end,0),[ring,inner]=rings(a[0],a[1],b[0],b[1],2,1);
      const anchor=P(...bayPoint(bay,(bay.lo+bay.hi)/2,bay.wall,0));
      parts[i].g.setAttribute('display',base>.998?'none':'');put(parts[i],prism((...p)=>blend(P(...p),anchor,base),objects.front,ring,inner,0,floor));
    });
    [[30,-34,16,16,0,93],[28,-36,20,20,89,96],[-60,-35,117,75,0,39]].forEach(([x,y,w,h,z,top],i)=>{
      const [ring,inner]=rings(x,y,x+w,y+h,2,1),shape=prism(P,objects.front,ring,inner,z,top);
      if(i===2){shape.crease='';shape.sil=poly(rounded([[-60,-35,39],[57,-35,39],[57,-35,0],...bays.slice().reverse().flatMap(b=>[bayPoint(b,b.axis===1?b.hi:b.lo,b.wall,0),bayPoint(b,b.axis===1?b.hi:b.lo,b.wall,lintel),bayPoint(b,b.axis===1?b.lo:b.hi,b.wall,lintel),bayPoint(b,b.axis===1?b.lo:b.hi,b.wall,0),b.axis===1?[-60,40,0]:[57,40,0]]),[-60,40,39]].map(p=>P(...p)),1.5));}
      put(parts[i+2],shape);
    });
    // A shallow jamb and one continuous belt meet the same opening; no boxed-in back wall.
    recess.setAttribute('d',bays.map(b=>poly([bayPoint(b,b.lo,b.wall,floor),bayPoint(b,b.lo,b.wall,lintel),bayPoint(b,b.hi,b.wall,lintel),bayPoint(b,b.hi,b.wall,floor)].map(p=>P(...p)))).join(''));
    interior.setAttribute('d',bays.map(b=>open([bayPoint(b,b.lo,b.wall,lintel),bayPoint(b,b.lo,b.wall-4,lintel),bayPoint(b,b.lo,b.wall-4,floor),bayPoint(b,b.lo,b.wall,floor)].map(p=>P(...p)))).join(''));
    details.setAttribute('d',[15,23].map(z=>seg(P(3,40,z),P(32,40,z))).join(''));
  }
  function drawPanel(panel,q,reveal=1) {
    const key=q.join(',')+','+reveal;if(panel.drawn===key)return;panel.drawn=key;
    const center=[0,1].map(k=>{const values=Array.from({length:48},(_,i)=>q[i*2+k]);return (Math.min(...values)+Math.max(...values))/2;});
    q=q.map((v,i)=>center[i%2]+(v-center[i%2])*reveal);
    panel.rendered=q;
    const points=Array.from({length:48},(_,i)=>[q[i*2],q[i*2+1]]);
    const area=Math.abs(points.reduce((a,p,i)=>a+p[0]*points[(i+1)%48][1]-p[1]*points[(i+1)%48][0],0));
    panel.g.setAttribute('display',area<1?'none':'');if(area<1)return;
    panel.face.setAttribute('d',poly(points));
    panel.marks.setAttribute('d',Array.from({length:8},(_,i)=>seg([q[96+i*4],q[97+i*4]],[q[98+i*4],q[99+i*4]])).join(''));
  }
  function tick(dt,now) {
    let moving=false;
    const quiet=reducedMotion();
    links.forEach(link=>{const q=link.tw.map(tw=>tval(tw,now)),key=q.join(',');if(key!==link.drawn){link.drawn=key;link.el.setAttribute('d',curve(q));}if(link.tw.some(tw=>!tdone(tw,now)))moving=true;});
    drawBody(tval(bodyTween,now),tval(baseTween,now),placement.map(tw=>tval(tw,now)));if(!tdone(bodyTween,now)||!tdone(baseTween,now)||placement.some(tw=>!tdone(tw,now)))moving=true;
    if(!ready&&!moving&&panels.every(p=>p.tw.every(tw=>tdone(tw,now)))){ready=true;tset(flow,1,now,0);}
    if(ready&&!quiet)clock+=Math.min(dt,.04);
    const weight=quiet?0:tval(flow,now),phase=(clock/9+.18)%1;
    landing.setAttribute('display',scene==='intake'&&ready&&!quiet&&[1,2].every(i=>{const [x,y,a]=boardFrame(clock%14,i);return a<.01||x>=132||y>=234;})?'':'none');
    ticketLayers.forEach(layer=>layer.setAttribute('display',scene==='factory'&&ready?'':'none'));
    panels.forEach((panel,i)=>{
      let q=panel.tw.map(tw=>tval(tw,now)),reveal=1,shift=0;
      if(scene==='factory'&&(i===3||i===4)&&weight>0) {
        const p=(phase+(i===4?.35:0))%1,origin=objects.P(0,0,0),end=objects.P(i===4?-92+92*ease(p):0,i===3?10-116*ease(p):0,0);
        shift=(i===3?10-116*ease(p):-92+92*ease(p))*weight;
        q=blend(q,objects.factory[i].map((v,k)=>v+end[k%2]-origin[k%2]),weight);reveal+= (envelope(p)-reveal)*weight;
      }
      if(scene==='intake'&&i>=1&&i<=2) {
        const [x,y,alpha]=boardFrame(clock%14,i);
        q=blend(q,boardPanel(x,y),weight);reveal+=(alpha-reveal)*weight;
        const xLabel=(i===1?36:156)+(x-(i===1?28:148))*weight,yLabel=194+(y-186)*weight,key=[xLabel,yLabel,reveal].join();if(key!==labelDrawn[i-1]){labelDrawn[i-1]=key;onIntakeFrame?.(i,xLabel,yLabel,ease((reveal-.65)/.35));}
      }
      drawPanel(panel,q,reveal);if(panel.tw.some(tw=>!tdone(tw,now)))moving=true;
      if(scene==='factory'&&ready&&(i===3||i===4)){panel.g.setAttribute('display','none');slices.forEach((layer,j)=>{const slice=layer[i-3],paths=ticket(objects.P,i,shift,reveal,j===1),key=paths.join();if(key!==slice.drawn){slice.drawn=key;paths.forEach((d,k)=>slice.paths[k].setAttribute('d',d));}slice.paths[1].classList.toggle('hi',panel.face.classList.contains('hi'));});}
    });
    packets.forEach((packet,i)=>{
      const route=links[scene==='codebase'?0:i].tw.map(tw=>tval(tw,now)),p=(clock/4.8+i/3)%1,point=at(route,ease(p));
      const alpha=scene==='factory'||scene==='intake'&&i>0?0:weight*envelope(p),key=point.join()+','+alpha;
      if(key===packet.drawn)return;packet.drawn=key;packet.el.setAttribute('display',alpha<.002?'none':'');if(alpha<.002)return;packet.el.setAttribute('d',poly(rounded(box(point[0]-3,point[1]-3.5*alpha,6,7*alpha))));
    });
    return moving||!quiet;
  }
  const loop=register(stage,tick);bag.add(loop.unregister);tick(0,performance.now());
  function retarget(immediate=false) {
    const now=performance.now();clock=0;ready=false;flow=tween(0);order();
    panels.forEach(panel=>{if(!immediate&&panel.rendered)panel.tw=panel.rendered.map(v=>tween(v));});
    poses(scene,mode,objects).forEach((q,i)=>q.forEach((v,k)=>{if(immediate)panels[i].tw[k]=tween(v);else tset(panels[i].tw[k],v,now,Math.abs(i-1)*stagger);}));
    routes(scene,mode,objects).forEach((q,i)=>q.forEach((v,k)=>{if(immediate)links[i].tw[k]=tween(v);else tset(links[i].tw[k],v,now,0);}));
    const body=['factory','codebase','setup'].includes(scene)?1:0,base=scene==='factory'?0:1;
    bodyPose(scene).forEach((v,i)=>{if(immediate)placement[i]=tween(v);else tset(placement[i],v,now,0);});
    if(immediate){bodyTween=tween(body);baseTween=tween(base);}else{tset(bodyTween,body,now,0);tset(baseTween,base,now,0);}
    active=-1;
    panels.forEach((panel,i)=>{panel.face.classList.toggle('hi',i===(scene==='factory'||scene==='codebase'||scene==='setup'?3:0));});read.textContent='rest';loop.wake();
  }
  function select(next) {
    if(active===next)return;active=next;
    const chosen=scene==='factory'?(next<1?3:next===1?1:4):scene==='codebase'?(next<1?3:1):scene==='intake'?(next<=0?0:1):scene==='setup'?(next<0?3:next===0?1:next+5):Math.max(next,0);
    panels.forEach((panel,i)=>panel.face.classList.toggle('hi',i===chosen));
    read.textContent=next<0?'rest':['source','in progress','ready'][next];loop.wake();
  }
  bag.add(pointer(stage,{move:([x,y])=>{if(x<5||x>395||y<25||y>285)return select(-1);select(scene==='intake'?(y<115?0:y<178?1:2):x<140?0:x<260?1:2);},leave:()=>select(-1)}));
  bag.add(()=>svg.replaceChildren());
  return {set:v=>{stagger=v;},setScene:(next,immediate=false)=>{scene=next;retarget(immediate);},setMode:next=>{if(mode!==next){mode=next;retarget();}},destroy:bag.dispose};}
export default {
  name:'journey',ambient:true,means:'Ideas enter a workshop and leave as reviewed work; its solids morph into the workspace being configured.',
  rules:[1,2,3,6,7,8,9],range:[20,40,60],tour:[[85,210],[200,145],[325,205],null],mount,
};
