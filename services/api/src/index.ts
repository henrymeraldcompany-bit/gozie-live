import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { STATIC_ASSETS_GZIP_B64 } from "./generated-assets.js";
interface D1Stmt {
 bind(...values: unknown[]): D1Stmt;
 first<T = unknown>(): Promise<T | null>;
 all<T = unknown>(): Promise<{results:T[]}>;
 run(): Promise<unknown>;
}
interface D1 { prepare(sql:string):D1Stmt; batch(stmts:D1Stmt[]):Promise<unknown[]>; }
interface Bucket { put(key:string,value:ReadableStream|ArrayBuffer|string,opts?:unknown):Promise<unknown>; get(key:string):Promise<{body:ReadableStream|null}|null>; delete(key:string):Promise<void>; }
interface Env {
 DB:D1; MEDIA_BUCKET:Bucket; SESSION_ROOMS:{idFromName(name:string):unknown;get(id:unknown):{fetch(req:Request):Promise<Response>}};
 REALTIMEKIT_ACCOUNT_ID:string; REALTIMEKIT_APP_ID:string; REALTIMEKIT_API_TOKEN:string;
 APP_ORIGIN:string; APP_BASE_PATH:string;
}
type User={id:string;email:string;display_name:string;email_verified:number};
type Session={id:string;owner_id:string;title:string;status:string;scheduled_at:string|null;live_started_at:string|null;ended_at:string|null;contributor_code_hash:string;viewer_code_hash:string;public_id:string;realtimekit_meeting_id?:string|null;realtimekit_livestream_id?:string|null;playback_url?:string|null;realtimekit_recording_id?:string|null;realtimekit_host_participant_id?:string|null};
const enc=new TextEncoder();
const now=()=>new Date().toISOString();
let appAssetsPromise: Promise<Record<string,string>> | null = null;
async function serveAppAsset(pathname:string):Promise<Response>{
 if(!appAssetsPromise){appAssetsPromise=(async()=>{const raw=atob(STATIC_ASSETS_GZIP_B64);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));return JSON.parse(await new Response(stream).text()) as Record<string,string>;})();}
 const assets=await appAssetsPromise;const requested=pathname==="/"||pathname===""?"/index.html":pathname;let key=requested;
 if(!(key in assets)){if(key.startsWith("/assets/"))return new Response("Not found.",{status:404});key="/index.html";}
 const type=key.endsWith(".html")?"text/html; charset=utf-8":key.endsWith(".js")?"text/javascript; charset=utf-8":key.endsWith(".css")?"text/css; charset=utf-8":key.endsWith(".svg")?"image/svg+xml":key.endsWith(".png")?"image/png":key.endsWith(".webp")?"image/webp":"application/octet-stream";
 return new Response(assets[key],{headers:{"content-type":type,"cache-control":key==="/index.html"?"no-cache":"public, max-age=31536000, immutable","x-content-type-options":"nosniff"}});
}
const uuid=()=>crypto.randomUUID();
const hex=(b:Uint8Array)=>[...b].map(x=>x.toString(16).padStart(2,"0")).join("");
const random=(n=32)=>hex(crypto.getRandomValues(new Uint8Array(n)));
async function hash(s:string){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))));}
function equal(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
const PASSWORD_HASH_ITERATIONS=310000;
const PASSWORD_HASH_BYTES=32;
async function derivePasswordHash(password:string,salt:string):Promise<Uint8Array>{
 // Workers caps native PBKDF2 at 100,000 iterations. Noble's audited
 // pure-JS PBKDF2 keeps the original 310,000-round hash byte-for-byte compatible.
 return pbkdf2Async(sha256,password,salt,{
  c:PASSWORD_HASH_ITERATIONS,
  dkLen:PASSWORD_HASH_BYTES,
  asyncTick:10
 });
}
async function passHash(password:string,salt=random(16)){
 const derived=await derivePasswordHash(password,salt);
 return salt+":"+hex(derived);
}
async function passCheck(password:string,stored:string){
 const [salt,expected,extra]=stored.split(":");
 if(extra!==undefined||!salt||!expected||!/^[a-f0-9]{32}$/i.test(salt)||!/^[a-f0-9]{64}$/i.test(expected))return false;
 return equal(hex(await derivePasswordHash(password,salt)),expected.toLowerCase());
}
const json=(data:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...Object.fromEntries(new Headers(headers).entries())}});
const fail=(message:string,status=400)=>json({error:message},status);
function cookie(req:Request){for(const part of (req.headers.get("cookie")||"").split(";")){const [k,...v]=part.trim().split("=");if(k==="gl_session")return v.join("=");}return "";}
function setCookie(v:string,age:number){return "gl_session="+v+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+age;}
async function input<T>(req:Request):Promise<T>{try{return await req.json() as T;}catch{throw new Response("Invalid JSON body.",{status:400});}}
function appUrl(env:Env,params:Record<string,string>){const base=(env.APP_BASE_PATH||"/").startsWith("/")?env.APP_BASE_PATH:"/"+env.APP_BASE_PATH;const u=new URL(base,env.APP_ORIGIN);u.search=new URLSearchParams(params).toString();return u.toString();}
async function auth(req:Request,env:Env):Promise<User>{const raw=cookie(req);if(!raw)throw new Response("Sign in to continue.",{status:401});const row=await env.DB.prepare("SELECT u.id,u.email,u.display_name,u.email_verified FROM auth_sessions a JOIN users u ON u.id=a.user_id WHERE a.id=? AND a.expires_at>?").bind(await hash(raw),now()).first<User>();if(!row)throw new Response("Session expired. Sign in again.",{status:401});if(!row.email_verified)throw new Response("Verify your email before signing in.",{status:403});return row;}
async function owner(req:Request,env:Env,id:string){const user=await auth(req,env);const session=await env.DB.prepare("SELECT * FROM broadcast_sessions WHERE id=? AND owner_id=?").bind(id,user.id).first<Session>();if(!session)throw new Response("Session not found.",{status:404});return {user,session};}
async function realtimeKit(env:Env,path:string,method="POST",payload?:unknown){
 if(!env.REALTIMEKIT_API_TOKEN||!env.REALTIMEKIT_ACCOUNT_ID||!env.REALTIMEKIT_APP_ID){
  throw new Response("Cloudflare RealtimeKit is not configured. Add the Realtime Admin API token as the REALTIMEKIT_API_TOKEN Worker secret.",{status:503});
 }
 const endpoint="https://api.cloudflare.com/client/v4/accounts/"+env.REALTIMEKIT_ACCOUNT_ID+"/realtime/kit/"+env.REALTIMEKIT_APP_ID+path;
 const response=await fetch(endpoint,{method,headers:{authorization:"Bearer "+env.REALTIMEKIT_API_TOKEN,"content-type":"application/json"},body:payload===undefined?undefined:JSON.stringify(payload)});
 const raw=await response.text();let data:any={};try{data=raw?JSON.parse(raw):{};}catch{data={error:raw};}
 if(!response.ok||data.success===false)throw new Error("Cloudflare RealtimeKit API error ("+response.status+"): "+String(data.errors?.[0]?.message||data.error||raw).slice(0,400));
 const responseData=data.data??data.result??data;
 return responseData.data??responseData;
}
async function ensureMeeting(env:Env,session:Session):Promise<string>{
 if(session.realtimekit_meeting_id)return session.realtimekit_meeting_id;
 const created=await realtimeKit(env,"/meetings","POST",{title:session.title,session_keep_alive_time_in_secs:600,live_stream_on_start:false,record_on_start:false});
 if(!created.id)throw new Error("RealtimeKit did not return a meeting ID.");
 await env.DB.prepare("UPDATE broadcast_sessions SET realtimekit_meeting_id=? WHERE id=?").bind(created.id,session.id).run();
 session.realtimekit_meeting_id=created.id;
 return created.id as string;
}
async function addRealtimeKitParticipant(env:Env,meetingId:string,identity:string,name:string,preset:string){
 return await realtimeKit(env,"/meetings/"+encodeURIComponent(meetingId)+"/participants","POST",{name,preset_name:preset,custom_participant_id:identity});
}
async function ensureHostParticipant(env:Env,session:Session,user:User){
 const meetingId=session.realtimekit_meeting_id;
 if(!meetingId)throw new Response("Start the session before opening the host studio.",{status:409});
 if(session.realtimekit_host_participant_id){
  const refreshed=await realtimeKit(env,"/meetings/"+encodeURIComponent(meetingId)+"/participants/"+encodeURIComponent(session.realtimekit_host_participant_id)+"/token","POST",{});
  if(refreshed.token)return {meetingId,participantId:session.realtimekit_host_participant_id,authToken:refreshed.token};
 }
 const participant=await addRealtimeKitParticipant(env,meetingId,"host-"+user.id,user.display_name||"GOZIE LIVE Host","gozie_host");
 if(!participant.id||!participant.token)throw new Error("RealtimeKit did not return host participant credentials.");
 await env.DB.prepare("UPDATE broadcast_sessions SET realtimekit_host_participant_id=? WHERE id=?").bind(participant.id,session.id).run();
 return {meetingId,participantId:participant.id,authToken:participant.token};
}
async function byCode(env:Env,code:string,type:"viewer"|"contributor"){if(!code||code.length>160)throw new Response("Invalid share link.",{status:400});const col=type==="viewer"?"viewer_code_hash":"contributor_code_hash";const s=await env.DB.prepare("SELECT * FROM broadcast_sessions WHERE "+col+"=?").bind(await hash(code)).first<Session>();if(!s||(s.status==="ended"&&type==="contributor"))throw new Response("Share link invalid or expired.",{status:404});return s;}
function room(env:Env,id:string){return env.SESSION_ROOMS.get(env.SESSION_ROOMS.idFromName(id));}
async function roomPost(env:Env,sid:string,action:string,data:unknown){return room(env,sid).fetch(new Request("https://session/"+action,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)}));}
async function handle(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url),path=url.pathname.replace(/\/$/,"")||"/",method=req.method;
 if(path==="/health"){
  let database="unavailable";
  try{const probe=await env.DB.prepare("SELECT 1 AS ok").first<{ok:number}>();database=probe?.ok===1?"connected":"error";}catch{database="error";}
  const status={
   ok:database==="connected",
   service:"GOZIE LIVE",
   database,
   r2:env.MEDIA_BUCKET?"configured":"missing",
   realtimeKit:env.REALTIMEKIT_API_TOKEN?"configured":"needs-REALTIMEKIT_API_TOKEN-secret",
   emailVerification:"not-required-password-based-host-accounts",
   time:now()
  };
  return json(status,status.ok?200:503);
 }
 if(path==="/v1/auth/register"&&method==="POST"){
  const x=await input<{email?:string;password?:string;displayName?:string}>(req),email=(x.email||"").trim().toLowerCase(),name=(x.displayName||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return fail("Enter a valid email.");
  if(name.length<2||name.length>80)return fail("Display name must be 2–80 characters.");
  if((x.password||"").length<10)return fail("Password must be at least 10 characters.");
  if(await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first())return fail("An account already exists for this email.",409);
  const userId=uuid();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,display_name,email_verified) VALUES(?,?,?,?,1)").bind(userId,email,await passHash(x.password!),name).run();
  return json({ok:true,message:"Your GOZIE LIVE host account has been created. Sign in to continue."},201);
 }
 if(path==="/v1/auth/login"&&method==="POST"){
  const x=await input<{email?:string;password?:string}>(req),u=await env.DB.prepare("SELECT id,email,password_hash,email_verified FROM users WHERE email=?").bind((x.email||"").trim().toLowerCase()).first<{id:string;email:string;password_hash:string;email_verified:number}>();
  if(!u||!await passCheck(x.password||"",u.password_hash))return fail("Email or password is incorrect.",401);
  const raw=random(),expires=new Date(Date.now()+30*86400000).toISOString();await env.DB.prepare("INSERT INTO auth_sessions(id,user_id,expires_at) VALUES(?,?,?)").bind(await hash(raw),u.id,expires).run();
  return json({ok:true,email:u.email},200,{"set-cookie":setCookie(raw,2592000)});
 }
 if(path==="/v1/auth/session"&&method==="GET"){const u=await auth(req,env);return json({user:{id:u.id,email:u.email,displayName:u.display_name}});}
 if(path==="/v1/auth/logout"&&method==="POST"){const raw=cookie(req);if(raw)await env.DB.prepare("DELETE FROM auth_sessions WHERE id=?").bind(await hash(raw)).run();return json({ok:true},200,{"set-cookie":setCookie("",0)});}
 if(path==="/v1/sessions"&&method==="GET"){const u=await auth(req,env);return json((await env.DB.prepare("SELECT id,title,status,scheduled_at,live_started_at,ended_at,created_at FROM broadcast_sessions WHERE owner_id=? ORDER BY created_at DESC LIMIT 50").bind(u.id).all()).results);}
 if(path==="/v1/sessions"&&method==="POST"){
  const u=await auth(req,env),x=await input<{title?:string;scheduledAt?:string|null}>(req),title=(x.title||"").trim();if(!title||title.length>120)return fail("Session title must be 1–120 characters.");
  const sid=uuid(),contributorCode=random(),viewerCode=random();await env.DB.prepare("INSERT INTO broadcast_sessions(id,owner_id,title,status,scheduled_at,contributor_code_hash,viewer_code_hash,public_id) VALUES(?,?,?,'scheduled',?,?,?,?)").bind(sid,u.id,title,x.scheduledAt||null,await hash(contributorCode),await hash(viewerCode),random(12)).run();
  return json({session:{id:sid,title,status:"scheduled",scheduled_at:x.scheduledAt||null},contributorUrl:appUrl(env,{mode:"camera",code:contributorCode}),viewerUrl:appUrl(env,{mode:"viewer",code:viewerCode})},201);
 }
 if(path==="/v1/join/contributor"&&method==="POST"){
  const x=await input<{code?:string;displayName?:string}>(req),s=await byCode(env,x.code||"","contributor"),name=(x.displayName||"").trim();
  if(!name||name.length>80)return fail("Enter a display name up to 80 characters.");
  if(!s.realtimekit_meeting_id||s.status!=="live")return fail("The host has not started this broadcast yet. Please try again when it is live.",409);
  const contributorId=uuid(),leaveSecret=random(),leaveHash=await hash(leaveSecret);
  const admission=await roomPost(env,s.id,"admit",{contributorId,displayName:name,leaveSecretHash:leaveHash,maximum:200});
  if(!admission.ok)return fail("This session has reached its 200-camera limit.",429);
  try{
   const participant=await addRealtimeKitParticipant(env,s.realtimekit_meeting_id,contributorId,name,"gozie_camera");
   if(!participant.id||!participant.token)throw new Error("RealtimeKit did not return camera participant credentials.");
   await env.DB.prepare("INSERT INTO contributors(id,session_id,display_name,status,last_seen_at,leave_secret_hash,realtimekit_participant_id) VALUES(?,?,?,'connected',?,?,?)").bind(contributorId,s.id,name,now(),leaveHash,participant.id).run();
   return json({session:{id:s.id,title:s.title},contributor:{id:contributorId,display_name:name},leaveSecret,authToken:participant.token,meetingId:s.realtimekit_meeting_id},201);
  }catch(error){
   await roomPost(env,s.id,"leave",{contributorId,leaveSecretHash:leaveHash}).catch(()=>undefined);
   throw error;
  }
 }

 if(path==="/v1/join/viewer"&&method==="POST"){
  const x=await input<{code?:string}>(req),s=await byCode(env,x.code||"","viewer"),presenceId=uuid(),identity="viewer-"+uuid();
  await env.DB.prepare("INSERT INTO viewer_presence(id,session_id,identity,created_at,last_seen_at,expires_at) VALUES(?,?,?, ?,?,?)").bind(presenceId,s.id,identity,now(),now(),new Date(Date.now()+60000).toISOString()).run();
  return json({presenceId,session:{id:s.id,title:s.title,status:s.status},playbackUrl:s.playback_url,programmeAvailable:Boolean(s.playback_url)});
 }
 if(path==="/v1/viewer/heartbeat"&&method==="POST"){
  const x=await input<{code?:string;presenceId?:string}>(req),s=await byCode(env,x.code||"","viewer");
  if(!x.presenceId)return fail("Viewer presence ID is required.");
  const updated=await env.DB.prepare("UPDATE viewer_presence SET last_seen_at=?,expires_at=? WHERE id=? AND session_id=?")
   .bind(now(),new Date(Date.now()+60000).toISOString(),x.presenceId,s.id).run();
  return json({ok:true});
 }
 if(path==="/v1/contributors/presence"&&method==="POST"){
  const x=await input<{contributorId:string;leaveSecret:string;leave?:boolean}>(req),c=await env.DB.prepare("SELECT id,session_id,leave_secret_hash,realtimekit_participant_id FROM contributors WHERE id=?").bind(x.contributorId).first<{id:string;session_id:string;leave_secret_hash:string;realtimekit_participant_id:string|null}>();
  if(!c||!equal(c.leave_secret_hash,await hash(x.leaveSecret||"")))return fail("Invalid contributor presence credentials.",403);
  const session=await env.DB.prepare("SELECT realtimekit_meeting_id FROM broadcast_sessions WHERE id=?").bind(c.session_id).first<{realtimekit_meeting_id:string|null}>();
  await roomPost(env,c.session_id,x.leave?"leave":"heartbeat",{contributorId:c.id,leaveSecretHash:c.leave_secret_hash});
  if(x.leave&&c.realtimekit_participant_id&&session?.realtimekit_meeting_id){
   await realtimeKit(env,"/meetings/"+encodeURIComponent(session.realtimekit_meeting_id)+"/participants/"+encodeURIComponent(c.realtimekit_participant_id),"DELETE").catch(()=>undefined);
  }
  await env.DB.prepare("UPDATE contributors SET status=?,last_seen_at=? WHERE id=?").bind(x.leave?"disconnected":"publishing",now(),c.id).run();
  return json({ok:true});
 }
 const sm=path.match(/^\/v1\/sessions\/([0-9a-f-]+)(?:\/(.*))?$/i);
 if(sm){
  const {user,session}=await owner(req,env,sm[1]),action=sm[2]||"";
  if(!action&&method==="GET"){
   const [cs,assets,recordings,viewers,roomResponse]=await Promise.all([
    env.DB.prepare("SELECT id,display_name,status,audio_muted,realtimekit_participant_id,created_at FROM contributors WHERE session_id=? AND status!='removed' ORDER BY created_at").bind(session.id).all(),
    env.DB.prepare("SELECT id,asset_kind,content_type,file_name,created_at FROM media_assets WHERE session_id=? ORDER BY created_at DESC").bind(session.id).all(),
    env.DB.prepare("SELECT id,provider_type,provider_recording_id,status,created_at,expires_at,deleted_at,size_bytes FROM recordings WHERE session_id=? AND deleted_at IS NULL AND expires_at>? ORDER BY created_at DESC").bind(session.id,now()).all(),
    env.DB.prepare("SELECT count(*) AS count FROM viewer_presence WHERE session_id=? AND expires_at>?").bind(session.id,now()).first<{count:number}>(),
    room(env,session.id).fetch(new Request("https://session/snapshot"))
   ]);
   const roomState=await roomResponse.json() as {active:number};
   return json({session,contributors:cs.results,assets:assets.results,recordings:recordings.results,viewerCount:viewers?.count||0,activeCameraSlots:roomState.active||0,mediaEngine:session.realtimekit_meeting_id?"realtimekit":"not-started",programmeAvailable:Boolean(session.playback_url),playbackUrl:session.playback_url});
  }
  if(action==="share-links"&&method==="POST"){
   const cc=random(),vc=random();
   await env.DB.prepare("UPDATE broadcast_sessions SET contributor_code_hash=?,viewer_code_hash=? WHERE id=?").bind(await hash(cc),await hash(vc),session.id).run();
   return json({contributorUrl:appUrl(env,{mode:"camera",code:cc}),viewerUrl:appUrl(env,{mode:"viewer",code:vc})});
  }
  if(action==="start"&&method==="POST"){
   if(session.status==="ended")return fail("An ended session cannot be restarted.",409);
   const meetingId=await ensureMeeting(env,session);
   let livestreamId=session.realtimekit_livestream_id||"",playbackUrl=session.playback_url||"";
   if(!livestreamId){
    const stream=await realtimeKit(env,"/meetings/"+encodeURIComponent(meetingId)+"/livestreams","POST",{name:"gozie-live-"+session.public_id,video_config:{width:1280,height:720}});
    const streamInfo=stream.livestream||stream;
    if(!streamInfo.id||!streamInfo.playback_url)throw new Error("RealtimeKit did not return a livestream playback URL.");
    livestreamId=streamInfo.id;playbackUrl=streamInfo.playback_url;
    await env.DB.prepare("UPDATE broadcast_sessions SET realtimekit_livestream_id=?,playback_url=? WHERE id=?").bind(livestreamId,playbackUrl,session.id).run();
   }
   const token=await ensureHostParticipant(env,{...session,realtimekit_meeting_id:meetingId},user);
   await env.DB.prepare("UPDATE broadcast_sessions SET status='live',live_started_at=COALESCE(live_started_at,?) WHERE id=?").bind(now(),session.id).run();
   return json({sessionId:session.id,meetingId,hostAuthToken:token.authToken,playbackUrl,mediaEngine:"realtimekit",programmeStatus:"livestream-created",message:"RealtimeKit meeting and final livestream have been created. Join the host room to bring cameras on air."},202);
  }
  if(action==="owner-token"&&method==="POST"){
   if(session.status!=="live"||!session.realtimekit_meeting_id)return fail("Start this session before opening the host room.",409);
   return json(await ensureHostParticipant(env,session,user));
  }
  if(action==="recording/start"&&method==="POST"){
   if(session.status!=="live"||!session.realtimekit_meeting_id)return fail("Start the live session before starting a recording.",409);
   if(session.realtimekit_recording_id){
    const current=await realtimeKit(env,"/recordings/"+encodeURIComponent(session.realtimekit_recording_id),"GET").catch(()=>null);
    if(current&&["INVOKED","RECORDING","UPLOADING"].includes(current.status))return json({recordingId:session.realtimekit_recording_id,status:current.status,alreadyRecording:true});
   }
   const recording=await realtimeKit(env,"/recordings","POST",{
    meeting_id:session.realtimekit_meeting_id,
    max_seconds:86400,
    realtimekit_bucket_config:{enabled:true},
    video_config:{codec:"H264",width:1280,height:720,export_file:true},
    audio_config:{channel:"stereo",codec:"AAC",export_file:false},
    file_name_prefix:"gozie-live-"+session.public_id
   });
   const recordingInfo=recording.recording||recording;
   if(!recordingInfo.id)throw new Error("RealtimeKit did not return a recording ID.");
   const providerRecordingId=recordingInfo.id,recordingId=uuid(),futureExpiry="2099-12-31T23:59:59.999Z",objectKey="realtimekit:"+providerRecordingId;
   await env.DB.prepare("INSERT INTO recordings(id,session_id,object_key,created_at,expires_at,provider_type,provider_recording_id,download_url,status) VALUES(?,?,?,?,?,'realtimekit',?,?,?)")
    .bind(recordingId,session.id,objectKey,now(),futureExpiry,recording.id,recordingInfo.download_url||null,recordingInfo.status||"INVOKED").run();
   await env.DB.prepare("UPDATE broadcast_sessions SET realtimekit_recording_id=? WHERE id=?").bind(providerRecordingId,session.id).run();
   return json({recordingId:providerRecordingId,status:recordingInfo.status||"INVOKED",message:"Composite recording has been requested from RealtimeKit."},202);
  }
  if(action==="recording/stop"&&method==="POST"){
   if(!session.realtimekit_recording_id)return fail("There is no recording to stop.",404);
   await realtimeKit(env,"/recordings/"+encodeURIComponent(session.realtimekit_recording_id),"PUT",{action:"stop"}).catch(()=>undefined);
   const details=await realtimeKit(env,"/recordings/"+encodeURIComponent(session.realtimekit_recording_id),"GET");
   const expiry=session.ended_at?new Date(new Date(session.ended_at).getTime()+7*86400000).toISOString():"2099-12-31T23:59:59.999Z";
   await env.DB.prepare("UPDATE recordings SET download_url=?,status=?,expires_at=?,size_bytes=? WHERE provider_recording_id=? AND session_id=?")
    .bind(details.download_url||null,details.status||"UPLOADING",expiry,details.file_size||null,session.realtimekit_recording_id,session.id).run();
   return json({recordingId:session.realtimekit_recording_id,status:details.status,downloadReady:Boolean(details.download_url),expiresAt:expiry});
  }
  if(action==="end"&&method==="POST"){
   if(session.status==="ended")return json({sessionId:session.id,mediaEngine:"ended",recordingRetentionUntil:session.ended_at?new Date(new Date(session.ended_at).getTime()+7*86400000).toISOString():null});
   const endedAt=now();
   if(session.realtimekit_recording_id){
    await realtimeKit(env,"/recordings/"+encodeURIComponent(session.realtimekit_recording_id),"PUT",{action:"stop"}).catch(()=>undefined);
    const detail=await realtimeKit(env,"/recordings/"+encodeURIComponent(session.realtimekit_recording_id),"GET").catch(()=>null);
    const expiry=new Date(new Date(endedAt).getTime()+7*86400000).toISOString();
    await env.DB.prepare("UPDATE recordings SET download_url=?,status=?,expires_at=?,size_bytes=? WHERE provider_recording_id=? AND session_id=?")
     .bind(detail?.download_url||null,detail?.status||"UPLOADING",expiry,detail?.file_size||null,session.realtimekit_recording_id,session.id).run();
   }
   if(session.realtimekit_meeting_id&&session.realtimekit_livestream_id){
    await realtimeKit(env,"/meetings/"+encodeURIComponent(session.realtimekit_meeting_id)+"/active-livestream/stop","POST",{}).catch(()=>undefined);
   }
   await env.DB.prepare("UPDATE broadcast_sessions SET status='ended',ended_at=? WHERE id=?").bind(endedAt,session.id).run();
   return json({sessionId:session.id,mediaEngine:"ended",recordingAvailable:Boolean(session.realtimekit_recording_id),recordingRetentionUntil:new Date(new Date(endedAt).getTime()+7*86400000).toISOString()});
  }
  if(action==="production"&&method==="POST"){
   const x=await input<{command:string;payload?:Record<string,unknown>}>(req),allowed=new Set(["select-source","mute-contributor","set-audio-mix","set-media-source","start-recording","stop-recording"]);
   if(!allowed.has(x.command))return fail("Unsupported command.");
   await env.DB.prepare("INSERT INTO production_commands(id,session_id,requested_by,command_type,payload,status) VALUES(?,?,?,?,?,'pending')").bind(uuid(),session.id,user.id,x.command,JSON.stringify(x.payload||{})).run();
   if(x.command==="mute-contributor"&&typeof x.payload?.contributorId==="string"&&typeof x.payload?.muted==="boolean"){
    const contributor=await env.DB.prepare("SELECT realtimekit_participant_id FROM contributors WHERE id=? AND session_id=?").bind(x.payload.contributorId,session.id).first<{realtimekit_participant_id:string|null}>();
    if(!contributor?.realtimekit_participant_id)return fail("Camera participant not found or not connected.",404);
    if(x.payload.muted&&session.realtimekit_meeting_id)await realtimeKit(env,"/meetings/"+encodeURIComponent(session.realtimekit_meeting_id)+"/active-session/mute","POST",{participant_ids:[contributor.realtimekit_participant_id]});
    await env.DB.prepare("UPDATE contributors SET audio_muted=? WHERE id=? AND session_id=?").bind(x.payload.muted?1:0,x.payload.contributorId,session.id).run();
    return json({accepted:true,applied:Boolean(x.payload.muted),message:x.payload.muted?"Participant microphone muted by the host.":"Use the host meeting controls to unmute this participant."},202);
   }
   if(x.command==="set-audio-mix"&&typeof x.payload?.muteAll==="boolean"){
    if(x.payload.muteAll&&session.realtimekit_meeting_id)await realtimeKit(env,"/meetings/"+encodeURIComponent(session.realtimekit_meeting_id)+"/active-session/mute-all","POST",{allow_unmute:true});
    await env.DB.prepare("UPDATE contributors SET audio_muted=? WHERE session_id=?").bind(x.payload.muteAll?1:0,session.id).run();
    return json({accepted:true,applied:Boolean(x.payload.muteAll),message:x.payload.muteAll?"All participant microphones muted.":"Use the RealtimeKit host controls to unmute participants."},202);
   }
   return json({accepted:true,applied:false,message:x.command==="select-source"?"Use RealtimeKit's spotlight/pin control in the host meeting to select the programme focus.": "Asset controls are stored; direct insertion into the programme mix is not connected yet."},202);
  }
  if(action==="assets"&&method==="POST"){
   const form=await req.formData(),file=form.get("file");if(!(file instanceof File))return fail("Select a media file.");if(file.size>100*1024*1024)return fail("Maximum upload size is 100 MB.",413);
   const kind=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":file.type.startsWith("audio/")?"audio":"";if(!kind)return fail("Only image, video and audio files are accepted.");
   const key="sessions/"+session.id+"/assets/"+uuid(),aid=uuid();await env.MEDIA_BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type}});
   await env.DB.prepare("INSERT INTO media_assets(id,session_id,owner_id,asset_kind,object_key,content_type,file_name,size_bytes) VALUES(?,?,?,?,?,?,?,?)").bind(aid,session.id,user.id,kind,key,file.type,file.name.slice(0,180),file.size).run();return json({asset:{id:aid,asset_kind:kind,content_type:file.type,file_name:file.name}},201);
  }
  if(action.startsWith("assets/")&&action.endsWith("/file")&&method==="GET"){
   const aid=action.split("/")[1],a=await env.DB.prepare("SELECT object_key,content_type FROM media_assets WHERE id=? AND session_id=?").bind(aid,session.id).first<{object_key:string;content_type:string}>();if(!a)return fail("Asset not found.",404);
   const obj=await env.MEDIA_BUCKET.get(a.object_key);if(!obj?.body)return fail("Asset missing.",404);return new Response(obj.body,{headers:{"content-type":a.content_type,"cache-control":"private,no-store"}});
  }
 }
 if(path==="/v1/public/session"&&method==="GET"){
  const s=await byCode(env,url.searchParams.get("code")||"","viewer");
  const recs=await env.DB.prepare("SELECT id,provider_type,status,expires_at,size_bytes FROM recordings WHERE session_id=? AND deleted_at IS NULL AND expires_at>? ORDER BY created_at DESC").bind(s.id,now()).all();
  return json({session:{id:s.id,title:s.title,status:s.status,scheduled_at:s.scheduled_at,ended_at:s.ended_at},recordings:recs.results,programmeAvailable:Boolean(s.playback_url),playbackUrl:s.playback_url});
 }
 if(path==="/v1/recordings/download"&&method==="GET"){
  const u=await auth(req,env),rid=url.searchParams.get("id")||"";
  const row=await env.DB.prepare("SELECT rec.provider_type,rec.provider_recording_id,rec.object_key FROM recordings rec JOIN broadcast_sessions s ON s.id=rec.session_id WHERE rec.id=? AND s.owner_id=? AND rec.deleted_at IS NULL AND rec.expires_at>?").bind(rid,u.id,now()).first<{provider_type:string;provider_recording_id:string|null;object_key:string}>();
  if(!row)return fail("Recording unavailable or expired.",404);
  if(row.provider_type==="realtimekit"&&row.provider_recording_id){
   const details=await realtimeKit(env,"/recordings/"+encodeURIComponent(row.provider_recording_id),"GET");
   if(!details.download_url)return fail("Recording is still being processed. Try again later.",409);
   const target=new URL(details.download_url);if(target.protocol!=="https:")return fail("Recording download URL is invalid.",502);
   return Response.redirect(target.toString(),302);
  }
  const obj=await env.MEDIA_BUCKET.get(row.object_key);if(!obj?.body)return fail("Recording file missing.",404);
  return new Response(obj.body,{headers:{"content-type":"video/mp4","content-disposition":"attachment","cache-control":"private,no-store"}});
 }
 if(path==="/v1/public/recordings/download"&&method==="GET"){
  const session=await byCode(env,url.searchParams.get("code")||"","viewer"),rid=url.searchParams.get("id")||"";
  const row=await env.DB.prepare("SELECT provider_type,provider_recording_id,object_key FROM recordings WHERE id=? AND session_id=? AND deleted_at IS NULL AND expires_at>?").bind(rid,session.id,now()).first<{provider_type:string;provider_recording_id:string|null;object_key:string}>();
  if(!row)return fail("Recording unavailable or expired.",404);
  if(row.provider_type==="realtimekit"&&row.provider_recording_id){
   const details=await realtimeKit(env,"/recordings/"+encodeURIComponent(row.provider_recording_id),"GET");
   if(!details.download_url)return fail("Recording is still being processed. Try again later.",409);
   const target=new URL(details.download_url);if(target.protocol!=="https:")return fail("Recording download URL is invalid.",502);
   return Response.redirect(target.toString(),302);
  }
  const obj=await env.MEDIA_BUCKET.get(row.object_key);if(!obj?.body)return fail("Recording file missing.",404);
  return new Response(obj.body,{headers:{"content-type":"video/mp4","content-disposition":"attachment","cache-control":"private,no-store"}});
 }
 return fail("Not found.",404);
}
export class SessionRoom {
 state:any;
 constructor(state:any){this.state=state;state.blockConcurrencyWhile(async()=>{state.storage.sql.exec("CREATE TABLE IF NOT EXISTS participants(id TEXT PRIMARY KEY,display_name TEXT NOT NULL,leave_hash TEXT NOT NULL,status TEXT NOT NULL,last_seen INTEGER NOT NULL,publisher_session_id TEXT)");});}
 async fetch(req:Request){
  const p=new URL(req.url).pathname,stamp=Date.now();
  if(req.method==="GET"&&p==="/snapshot"){this.state.storage.sql.exec("UPDATE participants SET status='disconnected' WHERE status IN ('connected','publishing') AND last_seen<?",stamp-60000);const rows=this.state.storage.sql.exec("SELECT id,display_name,status,publisher_session_id FROM participants WHERE status IN ('connected','publishing')").toArray();return json({active:rows.length,participants:rows});}
  if(req.method!=="POST")return fail("Method not allowed.",405);const x=await req.json() as any;
  if(p==="/admit"){this.state.storage.sql.exec("UPDATE participants SET status='disconnected' WHERE status IN ('connected','publishing') AND last_seen<?",stamp-60000);const found=this.state.storage.sql.exec("SELECT id FROM participants WHERE id=?",x.contributorId).toArray();if(!found.length){const n=this.state.storage.sql.exec("SELECT count(*) AS n FROM participants WHERE status IN ('connected','publishing')").one() as {n:number};if(n.n>=200)return fail("The session has reached its 200-camera limit.",429);}this.state.storage.sql.exec("INSERT OR REPLACE INTO participants(id,display_name,leave_hash,status,last_seen,publisher_session_id) VALUES(?,?,?,'connected',?,NULL)",x.contributorId,x.displayName,x.leaveSecretHash,stamp);return json({ok:true});}
  if(p==="/heartbeat"||p==="/leave"){const row=this.state.storage.sql.exec("SELECT leave_hash FROM participants WHERE id=?",x.contributorId).one() as {leave_hash:string}|null;if(!row||!equal(row.leave_hash,x.leaveSecretHash||""))return fail("Invalid presence token.",403);this.state.storage.sql.exec("UPDATE participants SET status=?,last_seen=? WHERE id=?",p==="/leave"?"disconnected":"connected",stamp,x.contributorId);return json({ok:true});}
  if(p==="/publish"){this.state.storage.sql.exec("UPDATE participants SET status='publishing',last_seen=?,publisher_session_id=? WHERE id=?",stamp,x.publisherSessionId,x.contributorId);return json({ok:true});}
  return fail("Unknown session operation.",404);
 }
}
export default {
 async fetch(req:Request,env:Env){
  try{
   const original=new URL(req.url),p=original.pathname;
   if(p==="/gozie-live")return Response.redirect(new URL("/gozie-live/",original),308);
   const res=await handle(req,env);
   if(res.status!==404||p.startsWith("/v1/")||p==="/health")return res;
   const assetUrl=new URL(req.url);
   if(assetUrl.pathname==="/gozie-live/"||assetUrl.pathname.startsWith("/gozie-live/")){
    assetUrl.pathname=assetUrl.pathname.slice("/gozie-live".length)||"/";
   }else if(assetUrl.pathname!=="/"){
    return res;
   }
   return serveAppAsset(assetUrl.pathname);
  }catch(e){if(e instanceof Response)return e;return json({error:e instanceof Error?e.message:"Unexpected server error."},500);}
 },
 async scheduled(_controller:unknown,env:Env){
  const rows=await env.DB.prepare("SELECT id,object_key,provider_type FROM recordings WHERE expires_at<=? AND deleted_at IS NULL LIMIT 100").bind(now()).all<{id:string;object_key:string;provider_type:string}>();
  for(const r of rows.results){
   if(r.provider_type!=="realtimekit")await env.MEDIA_BUCKET.delete(r.object_key);
   await env.DB.prepare("UPDATE recordings SET deleted_at=?,status='expired' WHERE id=?").bind(now(),r.id).run();
  }
  await env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at<=?").bind(now()).run();
  await env.DB.prepare("DELETE FROM viewer_presence WHERE expires_at<=?").bind(now()).run();
 }
};
