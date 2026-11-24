import {useEffect,useState} from "react";
import {Download,Radio,Users,Video} from "lucide-react";
import {apiRequest} from "../lib/api";
import HlsPlayer from "./HlsPlayer";

type Recording={id:string;provider_type:string;status:string;expires_at:string;size_bytes:number|null};
type PublicSession={session:{id:string;title:string;status:string;scheduled_at:string|null;ended_at:string|null};recordings:Recording[];programmeAvailable:boolean;playbackUrl:string|null};
type Join={presenceId:string;session:{id:string;title:string;status:string};programmeAvailable:boolean;playbackUrl:string|null};

export default function Viewer({code}:{code:string}){
 const [data,setData]=useState<PublicSession|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(true);

 useEffect(()=>{
  let active=true;
  let timer:number|null=null;
  if(!code){setError("This viewer link is incomplete.");setBusy(false);return;}
  const start=async()=>{
   try{
    const joined=await apiRequest<Join>("/v1/join/viewer",{method:"POST",body:JSON.stringify({code})});
    if(!active)return;
    const state=await apiRequest<PublicSession>("/v1/public/session?code="+encodeURIComponent(code));
    if(active)setData(state);
    timer=window.setInterval(()=>{
     void apiRequest("/v1/viewer/heartbeat",{method:"POST",body:JSON.stringify({code,presenceId:joined.presenceId})}).catch(()=>{});
     void apiRequest<PublicSession>("/v1/public/session?code="+encodeURIComponent(code)).then(result=>{if(active)setData(result);}).catch(()=>{});
    },20000);
   }catch(reason){
    if(active)setError(reason instanceof Error?reason.message:"This viewer link is invalid or expired.");
   }finally{if(active)setBusy(false);}
  };
  void start();
  return()=>{active=false;if(timer!==null)window.clearInterval(timer);};
 },[code]);

 return <main className="viewer-page viewer-shell">
  <header className="camera-header"><div className="brand-mark"><Radio/></div><div><b>GOZIE LIVE</b><small>Live viewer</small></div><span className="status-pill">VIEWER</span></header>
  <section className="viewer-content">
   {busy?<div className="empty-state"><Radio/><h2>Connecting to broadcast…</h2></div>:error?<div className="inline-error">{error}</div>:data?<>
    <div className="viewer-title"><span className="eyebrow">PUBLIC BROADCAST</span><h1>{data.session.title}</h1><p>{data.session.status==="live"?"The host is broadcasting now.":data.session.status==="ended"?"This broadcast has ended. Available recordings remain accessible until their expiry date.":"The host has not started this broadcast yet."}</p></div>
    {data.programmeAvailable&&data.playbackUrl?<HlsPlayer src={data.playbackUrl} title={data.session.title}/>:
     <div className="programme-player"><div className="player-offline"><Radio size={38}/><b>{data.session.status==="ended"?"Broadcast ended":"Programme not live yet"}</b><span>{data.session.status==="ended"?"Check the recording list below for the saved programme.":"The final programme will appear here when the host starts the broadcast."}</span></div></div>}
    <div className="viewer-status-row"><Users size={16}/><span>Viewer-only access · this link cannot publish cameras or access the host studio.</span></div>
    {data.recordings.length>0&&<section className="recordings-public"><h2><Video size={17}/> Available recordings</h2>
     {data.recordings.map(recording=><div className="public-recording" key={recording.id}><div><b>Programme recording</b><small>{recording.status} · available until {new Date(recording.expires_at).toLocaleString()}</small></div>
      <a className="secondary-button" href={"/v1/public/recordings/download?code="+encodeURIComponent(code)+"&id="+encodeURIComponent(recording.id)}><Download size={14}/> Download</a>
     </div>)}
    </section>}
   </>:null}
  </section>
  <footer className="public-footer">Powered by GOZIE LIVE</footer>
 </main>;
}
