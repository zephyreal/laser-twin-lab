export function createScene(canvas,getState,onPart){
 let yaw=-.72,zoom=1,pitch=.52,points=new Map(),lastX=0,lastY=0,dragged=false,pinch=0,selected='laser',hit=[];
 const parts={laser:[-105,80,100],platform:[0,0,65],coolant:[145,70,50],gas:[155,-60,65],door:[0,-90,100]};
 function project(x,y,z,w,h){let a=x*Math.cos(yaw)-y*Math.sin(yaw),b=x*Math.sin(yaw)+y*Math.cos(yaw),scale=Math.min(w/560,h/360)*zoom;return [w*.55+a*scale,h*.64+(b*Math.sin(pitch)-z*Math.cos(pitch))*scale,b*Math.cos(pitch)+z*Math.sin(pitch)]}
 function draw(time){const r=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(r.width*ratio)||canvas.height!==Math.round(r.height*ratio)){canvas.width=r.width*ratio;canvas.height=r.height*ratio}const c=canvas.getContext('2d'),w=r.width,h=r.height;c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);c.fillStyle='#edf1e9';c.fillRect(0,0,w,h);let faces=[],s=getState();
 const face=(v,color,part,stroke='#879e8b')=>faces.push({v:v.map(p=>project(...p,w,h)),color,part,stroke});
 const box=(x,y,z,dx,dy,dz,color,part)=>{face([[x,y,z+dz],[x+dx,y,z+dz],[x+dx,y+dy,z+dz],[x,y+dy,z+dz]],color[0],part);face([[x,y,z],[x+dx,y,z],[x+dx,y,z+dz],[x,y,z+dz]],color[1],part);face([[x+dx,y,z],[x+dx,y+dy,z],[x+dx,y+dy,z+dz],[x+dx,y,z+dz]],color[2],part);face([[x,y+dy,z],[x,y,z],[x,y,z+dz],[x,y+dy,z+dz]],color[2],part);face([[x,y+dy,z],[x+dx,y+dy,z],[x+dx,y+dy,z+dz],[x,y+dy,z+dz]],color[1],part)};
 // Floor grid and soft machine footprint.
 c.strokeStyle='#dce4d5';c.lineWidth=.6;for(let n=-280;n<=280;n+=28){for(const axis of [0,1]){let p=axis?project(-280,n,0,w,h):project(n,-230,0,w,h),q=axis?project(280,n,0,w,h):project(n,230,0,w,h);c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(q[0],q[1]);c.stroke()}}
 const metal=['#d7e0d2','#a6b7a2','#bdcbb6'],dark=['#54705e','#385743','#46634e'],white=['#fafbf6','#cbd8c4','#e0e9d9'];
 box(-100,-75,6,200,150,30,metal,'platform');for(let x of [-90,80])for(let y of [-65,55])box(x,y,0,12,12,15,dark,'platform');box(-90,-65,36,180,130,12,dark,'platform');
 for(let y=-55;y<60;y+=18)box(-82,y,48,164,3,3,metal,'platform');box(-48,-36,51,96,72,4,['#cbd1c4','#a2ad9e','#b9c3b1'],'platform');box(-1,-36,55,2,72,1,['#98ab8c','#758b68','#889b7b'],'platform');
 if(s.clamped)for(let x of [-52,44]){box(x,-25,53,8,50,9,dark,'platform');box(x,-25,62,8,8,5,white,'platform')}
 for(let x of [-95,82])box(x,42,48,13,14,120,metal,'platform');box(-95,42,168,190,16,14,white,'platform');
 const progress=s.running?Math.min(1,(Date.now()-s.startedAt)/8000):s.welded?1:0;let y=-27+progress*54;
 box(-13,y,110,26,25,52,dark,'laser');box(-7,y+5,88,14,15,22,metal,'laser');box(-3,y+9,80,6,7,8,['#c5ac68','#8d7a46','#b49b58'],'laser');
 box(-180,35,5,60,70,112,white,'laser');box(-179,34,77,58,2,31,dark,'laser');box(-169,31,86,26,2,14,[s.power?'#8db785':'#647a60','#485a42','#6b825c'],'laser');for(let z=18;z<65;z+=6)box(-170,32,z,40,2,2,dark,'laser');
 box(125,40,5,55,65,67,white,'coolant');box(124,39,40,53,2,20,dark,'coolant');for(let z=13;z<35;z+=5)box(132,37,z,39,2,2,metal,'coolant');
 box(142,-90,5,27,28,105,['#9aae8b','#7c936f','#8fa47c'],'gas');box(150,-83,110,11,12,11,metal,'gas');box(142,-82,121,27,7,4,dark,'gas');
 // Enclosure posts and translucent front gate.
 for(let x of [-104,98])for(let y1 of [-80,78])box(x,y1,36,5,5,160,metal,'door');box(-104,78,191,207,5,5,white,'door');box(-104,-80,191,207,5,5,white,'door');
 let doorY=s.door?-80:-126;face([[-98,doorY,49],[96,doorY,49],[96,doorY,184],[-98,doorY,184]],s.door?'#b0c6af36':'#ccd8c626','door','#9caf9690');box(77,doorY-2,102,4,4,28,dark,'door');
 faces.sort((a,b)=>a.v.reduce((n,p)=>n+p[2],0)/a.v.length-b.v.reduce((n,p)=>n+p[2],0)/b.v.length);hit=[];
 for(const f of faces){c.beginPath();f.v.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fillStyle=f.color;c.fill();c.strokeStyle=f.part===selected?'#718c6990':f.stroke;c.lineWidth=f.part===selected?.9:.35;c.stroke();hit.push(f)}
 if(s.running){let p=project(0,y+12,56,w,h),q=project(0,y+12,80,w,h);let g=c.createRadialGradient(p[0],p[1],0,p[0],p[1],24);g.addColorStop(0,'#fff5ba');g.addColorStop(.2,'#f6cc77');g.addColorStop(1,'#f4a74400');c.fillStyle=g;c.fillRect(p[0]-25,p[1]-25,50,50);c.strokeStyle='#f5cb70';c.lineWidth=2;c.beginPath();c.moveTo(...p.slice(0,2));c.lineTo(...q.slice(0,2));c.stroke()}
 const status=project(-100,48,202,w,h);c.fillStyle=s.emergency?'#d87356':s.running?'#7bb18a':s.power?'#d0b55c':'#aab7a0';c.beginPath();c.arc(status[0],status[1],5,0,Math.PI*2);c.fill();
 }
 function inside(p,vs){let yes=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++){if(((vs[i][1]>p[1])!==(vs[j][1]>p[1]))&&(p[0]<(vs[j][0]-vs[i][0])*(p[1]-vs[i][1])/(vs[j][1]-vs[i][1])+vs[i][0]))yes=!yes}return yes}
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);points.set(e.pointerId,[e.clientX,e.clientY]);lastX=e.clientX;lastY=e.clientY;dragged=false;if(points.size===2){let v=[...points.values()];pinch=Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1])}});
 canvas.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,[e.clientX,e.clientY]);if(points.size===2){let v=[...points.values()],d=Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1]);if(pinch>0)zoom=Math.max(.65,Math.min(1.6,zoom*d/pinch));pinch=d;dragged=true}else{let dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.abs(dx)+Math.abs(dy)>2)dragged=true;yaw+=dx*.008;pitch=Math.max(.25,Math.min(.9,pitch+dy*.003));lastX=e.clientX;lastY=e.clientY}});
 canvas.addEventListener('pointerup',e=>{points.delete(e.pointerId);if(!dragged){const r=canvas.getBoundingClientRect(),p=[e.clientX-r.left,e.clientY-r.top];const f=[...hit].reverse().find(f=>inside(p,f.v));if(f){selected=f.part;onPart(f.part)}}});canvas.addEventListener('pointercancel',e=>points.delete(e.pointerId));canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(1.6,zoom-e.deltaY*.001))},{passive:false});
 return {draw,select:p=>selected=p,rotate:d=>yaw+=d,zoom:d=>zoom=Math.max(.65,Math.min(1.6,zoom+d)),reset:()=>{yaw=-.72;zoom=1;pitch=.52}};
}
