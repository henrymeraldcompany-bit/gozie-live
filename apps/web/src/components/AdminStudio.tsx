import {useEffect,useMemo,useState} from "react";
import {Activity,CalendarClock,Camera,Copy,Download,LogOut,Mic,MicOff,Play,Radio,RefreshCw,Share2,Square,Upload,Users,Video,VideoOff} from "lucide-react";
import {QRCodeSVG} from "qrcode.react";
import {apiRequest} from "../lib/api";
import RealtimeKitRoom from "./RealtimeKitRoom";
import HlsPlayer from "./HlsPlayer";

type Session={
 id:string;title:string;status:string;scheduled_at:string|null;live_started_at?:string|null;ended_at?:string|null;
 playback_url?:string|null;
};
type CameraRow={id:string;display_name:string;status:string;audio_muted:boolean;realtimekit_participant_id?:string|null};
type Asset={id:string;asset_kind:string;content_type:string;file_name:string;created_at?:string};
type Recording={id:string;provider_type:string;status:string;created_at:string;expires_at:string;size_bytes:number|null;deleted_at:string|null};
type Detail={
 session:Session;contributors:CameraRow[];assets:Asset[];recordings:Recording[];
 viewerCount:number;activeCameraSlots:number;mediaEngine:string;programmeAvailable:boolean;playbackUrl:string|null;
};
type Shares={contributorUrl:string;viewerUrl:string};

export default function AdminStudio({userEmail,onSignOut}:{userEmail:string;onSignOut:()=>void}){
 const [sessions,setSessions]=useState<Session[]>([]);
 const [selectedId,setSelectedId]=useState("");
 const [detail,setDetail]=useState<Detail|null>(null);
 const [title,setTitle]=useState("");
 const [schedule,setSchedule]=useState("");
 const [shares,setShares]=useState<Shares|null>(null);
 const [hostToken,setHostToken]=useState("");
 const [busy,setBusy]=useState(false);
 const [recordingBusy,setRecordingBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [showShares,setShowShares]=useState(false);

 const refreshSessions=async()=>{
  const rows=await apiRequest<Session[]>("/v1/sessions");
  setSessions(rows);
  if(!selectedId&&rows.length)setSelectedId(rows[0].id);
 };
 const refreshDetail=async(id=selectedId)=>{
  if(!id){setDetail(null);return;}
  const result=await apiRequest<Detail>("/v1/sessions/"+id);
  setDetail(result);
 };
 useEffect(()=>{void refreshSessions().catch(e=>setError(e.message));},[]);
 useEffect(()=>{
  setDetail(null);setShares(null);setShowShares(false);setHostToken("");
  if(!selectedId)return;
  let active=true;
  const load=async()=>{
   try{
    const result=await apiRequest<Detail>("/v1/sessions/"+selectedId);
    if(active)setDetail(result);
   }catch(reason){if(active)setError(reason instanceof Error?reason.message:"Could not load session.");}
  };
  void load();
  const timer=window.setInterval(()=>{if(active)void load();},8000);
  return()=>{active=false;window.clearInterval(timer);};
 },[selectedId]);

 useEffect(()=>{
  if(!selectedId||detail?.session.status!=="live"||hostToken)return;
  let active=true;
  apiRequest<{authToken:string}>("/v1/sessions/"+selectedId+"/owner-token",{method:"POST"})
   .then(result=>{if(active)setHostToken(result.authToken);})
   .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:"Could not reconnect the host meeting.");});
  return()=>{active=false;};
 },[selectedId,detail?.session.status,hostToken]);

 const activeCameraCount=useMemo(()=>detail?.contributors.filter(c=>c.status!=="disconnected"&&c.status!=="removed").length??0,[detail]);
 const liveRecording=detail?.recordings.find(r=>!r.deleted_at&&["INVOKED","RECORDING","UPLOADING","PROCESSING"].includes((r.status||"").toUpperCase()));

 async function createSession(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   const result=await apiRequest<{session:Session;contributorUrl:string;viewerUrl:string}>("/v1/sessions",{
    method:"POST",body:JSON.stringify({title,scheduledAt:schedule?new Date(schedule).toISOString():null})
   });
   setTitle("");setSchedule("");setSessions(current=>[result.session,...current]);setSelectedId(result.session.id);
   setShares({contributorUrl:result.contributorUrl,viewerUrl:result.viewerUrl});setShowShares(true);setMessage("Your session has been created.");
  }catch(reason){setError(reason instanceof Error?reason.message:"Could not create a session.");}
  finally{setBusy(false);}
 }
 async function getLinks(){
  if(!selectedId)return;
  setError("");setMessage("");
  try{const result=await apiRequest<Shares>("/v1/sessions/"+selectedId+"/share-links",{method:"POST"});setShares(result);setShowShares(true);setMessage("New contributor and viewer links created. Older links are now invalid.");}
  catch(reason){setError(reason instanceof Error?reason.message:"Could not generate share links.");}
 }
 async function copyLink(value:string){
  try{await navigator.clipboard.writeText(value);setMessage("Link copied.");}
  catch{setMessage(value);}
 }
 async function start(){
  if(!selectedId)return;
  setBusy(true);setError("");setMessage("");
  try{
   const result=await apiRequest<{hostAuthToken:string;message:string}>("/v1/sessions/"+selectedId+"/start",{method:"POST"});
   setHostToken(result.hostAuthToken);setMessage(result.message);await refreshDetail();await refreshSessions();
  }catch(reason){setError(reason instanceof Error?reason.message:"Could not start the broadcast.");}
  finally{setBusy(false);}
 }
 async function end(){
  if(!selectedId||!window.confirm("End this broadcast? Contributors will no longer be able to join."))return;
  setBusy(true);setError("");
  try{
   const result=await apiRequest<{recordingAvailable:boolean;recordingRetentionUntil:string}>("/v1/sessions/"+selectedId+"/end",{method:"POST"});
   setHostToken("");setMessage(result.recordingAvailable?"Broadcast ended. The composite recording is being finalized.":"Broadcast ended.");
   await refreshDetail();await refreshSessions();
  }catch(reason){setError(reason instanceof Error?reason.message:"Could not end the broadcast.");}
  finally{setBusy(false);}
 }
 async function startRecording(){
  if(!selectedId)return;
  setRecordingBusy(true);setError("");
  try{
   const result=await apiRequest<{recordingId:string;status:string}>("/v1/sessions/"+selectedId+"/recording/start",{method:"POST"});
   setMessage("Composite recording requested ("+result.status+").");
   await refreshDetail();
  }catch(reason){setError(reason instanceof Error?reason.message:"Could not start recording.");}
  finally{setRecordingBusy(false);}
 }
 async function stopRecording(){
  if(!selectedId)return;
  setRecordingBusy(true);setError("");
  try{
   const result=await apiRequest<{downloadReady:boolean;status:string}>("/v1/sessions/"+selectedId+"/recording/stop",{method:"POST"});
   setMessage(result.downloadReady?"Recording finalized and ready to download.":"Recording stop requested; the file may still be processing.");
   await refreshDetail();
  }catch(reason){setError(reason instanceof Error?reason.message:"Could not stop recording.");}
  finally{setRecordingBusy(false);}
 }
 async function muteContributor(contributor:CameraRow){
  try{
   const next=!contributor.audio_muted;
   const result=await apiRequest<{applied:boolean;message:string}>("/v1/sessions/"+selectedId+"/production",{
    method:"POST",body:JSON.stringify({command:"mute-contributor",payload:{contributorId:contributor.id,muted:next}})
   });
   setMessage(result.message);await refreshDetail();
  }catch(reason){setError(reason instanceof Error?reason.message:"Could not change microphone state.");}
 }
 async function muteAll(){
  try{
   const result=await apiRequest<{applied:boolean;message:string}>("/v1/sessions/"+selectedId+"/production",{
    method:"POST",body:JSON.stringify({command:"set-audio-mix",payload:{muteAll:true}})
   });
   setMessage(result.message);await refreshDetail();
  }catch(reason){setError(reason instanceof Error?reason.message:"Could not mute participant microphones.");}
 }
 async function upload(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];if(!file||!selectedId)return;
  const form=new FormData();form.append("file",file);
  setError("");setMessage("");
  try{await apiRequest("/v1/sessions/"+selectedId+"/assets",{method:"POST",body:form});setMessage("Media uploaded to your private Cloudflare R2 library.");await refreshDetail();}
  catch(reason){setError(reason instanceof Error?reason.message:"Upload failed.");}
  finally{event.target.value="";}
 }
 const isLive=detail?.session.status==="live";
 return <main className="studio-shell">
  <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Radio/></div><div><b>GOZIE LIVE</b><small>Cloudflare broadcast studio</small></div></div><div className="topbar-actions"><span className="user-email">{userEmail}</span><button className="icon-button" onClick={onSignOut} title="Sign out"><LogOut size={18}/></button></div></header>
  <section className="studio-heading"><div><span className="eyebrow">CONTROL ROOM</span><h1>Broadcast studio</h1><p>Create sessions, invite contributors and manage your live programme.</p></div><span className="status-pill"><span className="feed-live-dot"/> Cloudflare platform</span></section>
  {error&&<div className="inline-error">{error}</div>}{message&&<div className="inline-success">{message}</div>}
  <div className="studio-layout">
   <aside className="studio-sidebar">
    <div className="panel-heading"><h3>Your sessions</h3><span>{sessions.length}</span></div>
    <form className="create-session-form" onSubmit={createSession}>
     <label>Session title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Sunday Live Service"/></label>
     <label>Schedule (optional)<input type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)}/></label>
     <button className="primary-button full-width" disabled={busy}>{busy?"Working…":"Create session"}</button>
    </form>
    <div className="session-list">{sessions.map(session=><button key={session.id} className={selectedId===session.id?"session-item selected":"session-item"} onClick={()=>setSelectedId(session.id)}><span className="session-status-dot"/><span><b>{session.title}</b><small>{session.status} · {new Date(session.scheduled_at||session.live_started_at||Date.now()).toLocaleString()}</small></span></button>)}</div>
    <button className="secondary-button full-width" onClick={()=>void refreshSessions()}><RefreshCw size={15}/> Refresh sessions</button>
   </aside>
   <section className="studio-main">
    {!detail?<div className="empty-state"><Radio size={34}/><h2>Select or create a session</h2><p>Your control room will appear here.</p></div>:<>
     <div className="session-overview"><div><span className="eyebrow">SELECTED SESSION</span><h2>{detail.session.title}</h2><p>Session status: <b>{detail.session.status}</b></p></div>
      <div className="overview-actions">
       <button className="secondary-button" onClick={()=>void getLinks()}><Share2 size={16}/> Share links</button>
       {!isLive&&detail.session.status!=="ended"?<button className="primary-button" onClick={()=>void start()} disabled={busy}><Play size={16}/> Start broadcast</button>:null}
       {isLive?<button className="danger-button" onClick={()=>void end()} disabled={busy}><Square size={15}/> End broadcast</button>:null}
       {detail.session.status==="ended"?<span className="status-pill">Broadcast ended</span>:null}
      </div>
     </div>
     {showShares&&shares&&<div className="share-grid">
      <div className="share-card"><div><b>Camera contributor link</b><small>Send this link only to camera operators.</small><input readOnly value={shares.contributorUrl}/><button className="text-button" onClick={()=>void copyLink(shares.contributorUrl)}><Copy size={14}/> Copy link</button></div><QRCodeSVG value={shares.contributorUrl} size={92}/></div>
      <div className="share-card"><div><b>Viewer link</b><small>Share this with your audience.</small><input readOnly value={shares.viewerUrl}/><button className="text-button" onClick={()=>void copyLink(shares.viewerUrl)}><Copy size={14}/> Copy link</button></div><QRCodeSVG value={shares.viewerUrl} size={92}/></div>
     </div>}
     <div className="metrics-row">
      <div className="metric-card"><Camera/><b>{detail.activeCameraSlots??activeCameraCount}/200</b><small>Active contributor slots</small></div>
      <div className="metric-card"><Users/><b>{detail.viewerCount}</b><small>Viewers connected</small></div>
      <div className="metric-card"><Video/><b>{activeCameraCount}</b><small>Camera participants</small></div>
     </div>
     <div className="section-heading"><div><h3>Camera and host control room</h3><p>RealtimeKit supports host spotlight/pin controls and paginated participant views.</p></div><span className="status-pill">{activeCameraCount} contributors admitted</span></div>
     {isLive&&hostToken?<RealtimeKitRoom key={selectedId} authToken={hostToken} role="host" onLeave={()=>setHostToken("")}/>:
      isLive?<div className="empty-state compact"><Radio size={28}/><h3>Host controls connecting</h3><p>Use Rejoin host controls if this takes too long.</p><button className="secondary-button" onClick={()=>void apiRequest<{authToken:string}>("/v1/sessions/"+selectedId+"/owner-token",{method:"POST"}).then(r=>setHostToken(r.authToken)).catch(e=>setError(e.message))}>Rejoin host controls</button></div>:
      <div className="empty-state compact"><Camera size={28}/><h3>{detail.session.status==="ended"?"This broadcast has ended":"Start the broadcast to open the host room"}</h3><p>Once started, the host room will allow you to see admitted camera feeds, pin or spotlight participants and manage meeting permissions.</p></div>}
     <div className="programme-panel">
      <div><span className="eyebrow">FINAL PROGRAMME</span><h3>Audience livestream</h3><p>{detail.playbackUrl?"One HLS programme URL is assigned to all viewers.":"The livestream URL is created when the broadcast starts."}</p></div>
      {detail.playbackUrl?<HlsPlayer src={detail.playbackUrl} title={detail.session.title}/>:<div className="offline-preview"><Radio size={28}/><b>Programme has not started</b><small>Start the broadcast to create the audience stream.</small></div>}
     </div>
     <div className="section-heading recording-heading"><div><h3>Programme recording</h3><p>Start a composite recording of the RealtimeKit meeting. The retention period is seven days after the session ends.</p></div>
      {isLive&&!liveRecording?<button className="primary-button" onClick={()=>void startRecording()} disabled={recordingBusy}><Radio size={15}/> Start recording</button>:null}
      {isLive&&liveRecording?<button className="danger-button" onClick={()=>void stopRecording()} disabled={recordingBusy}><Square size={15}/> Stop recording</button>:null}
     </div>
     <div className="asset-list">
      {detail.recordings.map(recording=><div className="asset-item" key={recording.id}><span>MP4</span><div><b>Composite programme recording</b><small>{recording.status} · expires {new Date(recording.expires_at).toLocaleDateString()}</small></div><a className="secondary-button" href={"/v1/recordings/download?id="+encodeURIComponent(recording.id)}><Download size={14}/> Download</a></div>)}
      {!detail.recordings.length&&<p className="muted">No recordings have been created for this session.</p>}
     </div>
     <div className="section-heading"><div><h3>Contributor roster</h3><p>Individual microphone mute is available from the host controls and this roster.</p></div><button className="secondary-button" onClick={()=>void muteAll()} disabled={!isLive||!detail.contributors.length}><MicOff size={15}/> Mute all</button></div>
     <div className="asset-list">
      {detail.contributors.map(contributor=><div className="asset-item" key={contributor.id}><span>{contributor.status==="disconnected"?"OFFLINE":"CAM"}</span><div><b>{contributor.display_name}</b><small>{contributor.status}{contributor.audio_muted?" · microphone muted":""}</small></div><button className="secondary-button" onClick={()=>void muteContributor(contributor)} disabled={!isLive||contributor.status==="disconnected"}>{contributor.audio_muted?<Mic size={14}/>:<MicOff size={14}/>} {contributor.audio_muted?"Unmute":"Mute"}</button></div>)}
      {!detail.contributors.length&&<p className="muted">No camera contributors have joined yet.</p>}
     </div>
     <div className="section-heading"><div><h3>Media library</h3><p>Upload private images, videos and audio to Cloudflare R2.</p></div><label className="secondary-button upload-button"><Upload size={15}/> Add media<input type="file" accept="image/*,video/*,audio/*" hidden onChange={upload}/></label></div>
     <div className="asset-list">
      {detail.assets.map(asset=><div className="asset-item" key={asset.id}><span>{asset.asset_kind.toUpperCase()}</span><div><b>{asset.file_name}</b><small>{asset.content_type}</small></div><span className="status-pill">Stored in R2</span></div>)}
      {!detail.assets.length&&<p className="muted">No uploaded media yet.</p>}
     </div>
     <div className="setup-note">Media uploads are stored in R2, but automatic picture replacement and imported audio mixing have not been connected to the live programme yet. The RealtimeKit host controls can spotlight/pin camera participants; a custom scene compositor and independent audio mixer remain future work.</div>
    </>}
   </section>
  </div>
 </main>;
}
