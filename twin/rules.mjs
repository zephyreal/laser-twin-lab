export const initial = () => ({power:false,coolant:false,gas:false,clamped:false,door:false,homed:false,laser:false,running:false,welded:false,done:false,p:1500,v:25,startedAt:null,errors:0,events:[],version:0});
export const labels={power:'接通总电源',coolant:'开启冷却',gas:'开启保护气',clamp:'装夹工件',door:'关闭安全门',home:'运动平台回零',parameters:'应用工艺参数',laser:'激光器使能',weld:'开始焊接',finish:'完成焊接',laserOff:'关闭激光使能',gasOff:'关闭保护气',coolantOff:'关闭冷却',powerOff:'关闭总电源',emergency:'急停',reset:'解除急停'};
export function transition(previous,action,now=Date.now()){
 const s=structuredClone(previous); const kind=action.kind; let error='';const need=(ok,msg)=>{if(!ok&&!error)error=msg};
 if(s.done)return {state:s,error:'本次实训已提交，请开始新任务。'};
 if(!Object.hasOwn(labels,kind))return {state:s,error:'未知操作'};
 if(s.emergency&&kind!=='reset')need(false,'急停已触发，请先解除急停；设备不会自动恢复运行。');
 switch(kind){
 case 'power':need(!s.power,'总电源已接通');if(!error)s.power=true;break;
 case 'coolant':need(s.power&&!s.coolant,'请先接通电源；冷却不可重复开启');if(!error)s.coolant=true;break;
 case 'gas':need(s.power&&!s.gas,'请先接通电源；保护气不可重复开启');if(!error)s.gas=true;break;
 case 'clamp':need(s.power&&!s.laser&&!s.door&&!s.clamped,'请在通电、开门且激光未使能时装夹');if(!error)s.clamped=true;break;
 case 'door':need(s.clamped&&!s.door,'请先装夹工件；安全门不可重复关闭');if(!error)s.door=true;break;
 case 'home':need(s.power&&s.door&&s.clamped&&!s.laser&&!s.homed,'请完成装夹、关门，并在激光未使能时回零');if(!error)s.homed=true;break;
 case 'parameters':need(!s.laser&&s.homed&&!s.welded,'请先回零；焊接完成后不可修改本次工艺参数');need(Number.isFinite(action.p)&&Number.isFinite(action.v)&&action.p>=600&&action.p<=2400&&action.v>=10&&action.v<=50,'参数超出教学模型范围');if(!error){s.p=action.p;s.v=action.v;s.configured=true}break;
 case 'laser':need(s.power&&s.coolant&&s.gas&&s.clamped&&s.door&&s.homed&&s.configured&&!s.laser,'需完成供电、冷却、供气、装夹、关门、回零与设参');if(!error)s.laser=true;break;
 case 'weld':need(s.laser&&s.coolant&&s.gas&&s.door&&!s.running&&!s.welded,'请完成激光使能和联锁检查；每次任务仅焊接一次');if(!error){s.running=true;s.startedAt=now;s.weldP=s.p;s.weldV=s.v}break;
 case 'finish':need(s.running&&now-s.startedAt>=8000,'焊接过程尚未完成，请等待 8 秒');if(!error){s.running=false;s.welded=true;s.finishedAt=now}break;
 case 'laserOff':need(s.laser&&!s.running,'请等待焊接完成；紧急情况请按急停');if(!error)s.laser=false;break;
 case 'gasOff':need(!s.laser&&!s.running&&s.gas,'先关闭激光使能，再关闭保护气');if(!error)s.gas=false;break;
 case 'coolantOff':need(!s.laser&&!s.running&&!s.gas&&s.coolant,'先关闭激光使能和保护气，再关闭冷却');if(!error)s.coolant=false;break;
 case 'powerOff':need(s.power&&!s.coolant&&!s.gas&&!s.laser&&!s.running,'请先关闭激光、保护气和冷却');if(!error)s.power=false;break;
 case 'emergency':s.laser=false;s.running=false;s.emergency=true;s.startedAt=null;break;
 case 'reset':need(s.emergency===true,'当前没有急停报警');if(!error)s.emergency=false;break;
 }
 if(error)s.errors=Math.min(100,s.errors+1);
 s.events.push({kind,ok:!error,time:now,...(kind==='parameters'&&!error?{p:s.p,v:s.v}:{}),...(error?{message:error}:{})});s.events=s.events.slice(-250);s.version++;return {state:s,error};
}
export function grade(s){const ok=k=>s.events.some(e=>e.kind===k&&e.ok);const energy=(s.weldP??s.p)/(s.weldV??s.v);const breakdown=[{name:'设备准备',max:30,score:['power','coolant','gas','clamp','door','home'].filter(ok).length*5},{name:'工艺参数',max:20,score:ok('parameters')?(energy>=54&&energy<=66?20:10):0},{name:'焊接执行',max:20,score:s.welded?20:ok('weld')?5:0},{name:'规范停机',max:20,score:s.welded&&!s.power&&!s.laser&&!s.gas&&!s.coolant&&['laserOff','gasOff','coolantOff','powerOff'].every(ok)?20:0},{name:'联锁与操作规范',max:10,score:s.events.length?Math.max(0,10-s.errors*2):0}];return {total:breakdown.reduce((a,b)=>a+b.score,0),breakdown,errors:s.errors,energy:Math.round(energy*10)/10,version:'rubric-1.0'};}
export function nextStep(s){if(s.done)return '本次实训已提交，可查看评分明细。';if(s.emergency)return '解除急停，检查设备状态后重新使能。';if(s.welded){if(s.laser)return '焊接完成，请关闭激光使能。';if(s.gas)return '关闭保护气。';if(s.coolant)return '关闭冷却系统。';if(s.power)return '关闭总电源。';return '流程完成，提交本次实训并查看评分。'}if(s.running)return '正在执行 8 秒示范焊接，请观察设备与曲线。';if(!s.power)return '接通总电源，开始设备准备。';if(!s.coolant)return '开启冷却系统。';if(!s.gas)return '开启保护气。';if(!s.clamped)return '装夹工件，确认固定。';if(!s.door)return '关闭安全门，建立安全联锁。';if(!s.homed)return '执行运动平台回零。';if(!s.configured)return '应用工艺参数，目标线能量 54–66 J/mm。';if(!s.laser)return '确认各项联锁满足后，使能激光器。';return '开始焊接，观察运动轨迹和熔透响应。'}
