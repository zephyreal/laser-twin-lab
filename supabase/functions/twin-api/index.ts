import { initial, transition, grade } from '../_shared/rules.mjs';
const origin='https://zephyreal.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rest(path:string,method='GET',body?:unknown){const response=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json().catch(()=>null);if(!response.ok)throw new Error('Database request failed');return value;}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply({error:'Origin not allowed'},403);
 if(Number(req.headers.get('content-length')||0)>12000)return reply({error:'请求过大'},413);
 try{
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return reply({error:'请先登录'},401);
 // Validate with Auth service; never trust a decoded JWT or client identity.
 const userResponse=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});
 if(!userResponse.ok)return reply({error:'登录已过期'},401);
 const user=await userResponse.json();
 const profiles=await rest('twin_profiles?id=eq.'+encodeURIComponent(user.id)+'&select=*');
 const profile=profiles[0];if(!profile)return reply({error:'账号尚未加入课程，请联系教师'},403);
 const raw=await req.text();if(raw.length>12000)return reply({error:'请求过大'},413);
 let body;try{body=JSON.parse(raw)}catch{return reply({error:'请求格式错误'},400)}
 const op=body.op;
 if(op==='me')return reply({profile});
 if(op==='history'){let attempts=await rest('twin_attempts?user_id=eq.'+user.id+'&status=eq.submitted&select=id,created_at,submitted_at,score&order=created_at.desc&limit=100');return reply({attempts})}
 if(op==='teacher_history'){
  if(profile.role!=='teacher')return reply({error:'仅教师可查看'},403);
  const attempts=await rest('twin_attempts?status=eq.submitted&select=id,created_at,score,profile:twin_profiles(student_id,display_name,class_name)&order=created_at.desc&limit=1000');return reply({attempts});
 }
 if(op==='provision'){
  if(profile.role!=='teacher')return reply({error:'仅教师可创建账号'},403);
  const {student_id,display_name,class_name,password}=body;
  if(typeof student_id!=='string'||!/^[a-z0-9_-]{3,32}$/.test(student_id)||typeof display_name!=='string'||display_name.length<1||display_name.length>40||typeof class_name!=='string'||class_name.length>40||typeof password!=='string'||password.length<10||password.length>128)return reply({error:'账号信息不合法，密码至少 10 位'},400);
  const existing=await rest('twin_profiles?student_id=eq.'+encodeURIComponent(student_id)+'&select=id');if(existing.length)return reply({error:'学号已存在'},409);
  const created=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({email:student_id+'@students.laser-twin.invalid',password,email_confirm:true})});
  if(!created.ok)return reply({error:'账号创建失败，可能已存在或密码不符合要求'},400);
  const account=await created.json();
  try{await rest('twin_profiles','POST',{id:account.id,student_id,display_name,class_name,role:'student'})}catch{
   await fetch(url+'/auth/v1/admin/users/'+account.id,{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key}});
   return reply({error:'课程档案创建失败，请重试'},500);
  }
  return reply({ok:true});
 }
 if(op==='start'){
  const recent=await rest('twin_attempts?user_id=eq.'+user.id+'&created_at=gte.'+encodeURIComponent(new Date(Date.now()-60000).toISOString())+'&select=id');
  if(recent.length>=5)return reply({error:'开始过于频繁，请一分钟后重试'},429);
  await rest('twin_attempts?user_id=eq.'+user.id+'&status=eq.active','PATCH',{status:'abandoned'});
  let rows=await rest('twin_attempts','POST',{user_id:user.id,state:initial()});return reply({attempt:rows[0]});
 }
 if(!['action','submit'].includes(op))return reply({error:'未知操作'},400);
 if(typeof body.attempt_id!=='string'||!/^[0-9a-f-]{36}$/.test(body.attempt_id))return reply({error:'任务编号无效'},400);
 const rows=await rest('twin_attempts?id=eq.'+body.attempt_id+'&user_id=eq.'+user.id+'&select=*');const attempt=rows[0];
 if(!attempt)return reply({error:'找不到本人的任务'},404);
 if(op==='submit'&&attempt.status==='submitted')return reply({attempt});
 if(attempt.status!=='active')return reply({error:'任务已结束，请开始新任务'},409);
 if(op==='submit'){
  if(attempt.state.running)return reply({error:'请等待焊接结束或急停后再提交'},400);
  const score=grade(attempt.state),state={...attempt.state,done:true};
  const updated=await rest('twin_attempts?id=eq.'+attempt.id+'&user_id=eq.'+user.id+'&status=eq.active&version=eq.'+attempt.version,'PATCH',{state,score,status:'submitted',submitted_at:new Date().toISOString(),version:attempt.version+1});
  if(!updated.length)return reply({error:'状态已变化，请重新提交'},409);return reply({attempt:updated[0]});
 }
 if(typeof body.request_id!=='string'||body.request_id.length>64)return reply({error:'请求编号无效'},400);
 if(attempt.last_request_id===body.request_id)return reply({attempt});
 if(attempt.state.events.length>=240)return reply({error:'本次操作已达上限，请提交后开始新任务'},400);
 if(!body.action||typeof body.action.kind!=='string')return reply({error:'操作无效'},400);
 // Only the action name and numeric inputs are accepted. State, timestamps,
 // score, owner and role supplied by clients are deliberately ignored.
 const result=transition(attempt.state,{kind:body.action.kind,p:body.action.p,v:body.action.v},Date.now());
 const updated=await rest('twin_attempts?id=eq.'+attempt.id+'&user_id=eq.'+user.id+'&status=eq.active&version=eq.'+attempt.version,'PATCH',{state:result.state,version:attempt.version+1,last_request_id:body.request_id});
 if(!updated.length)return reply({error:'另一个页面更新了本次任务，请刷新后重新开始'},409);
 return reply({attempt:updated[0],error:result.error||null});
 }catch{return reply({error:'服务暂时不可用，请稍后重试'},500)}
});
