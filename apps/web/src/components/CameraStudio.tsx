import {useEffect,useRef,useState} from "react";
import {Camera,Radio,ShieldCheck} from "lucide-react";
import {apiRequest} from "../lib/api";
import RealtimeKitRoom from "./RealtimeKitRoom";

type JoinResult={
 session:{id:string;title:string};
 contributor:{id:string;display_name:string};
 leaveSecret:string;
 authToken:string;
 meetingId:string;
};

export default function CameraStudio({code}:{code:string}){
 const [displayName,setDisplayName]=useState("");
 const [sessionTitle,setSessionTitle]=useState("");
 const [authToken,setAuthToken]=useState("");
 const [contributorId,setContributorId]=useState("");
 const [leaveSecret,setLeaveSecret]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const intervalRef=useRef<number|null>(null);
 const joinedRef=useRef(false);

 useEffect(()=>{
  return()=>{
   if(intervalRef.current!==null)window.clearInterval(intervalRef.current);
   const id=contributorId,secret=leaveSecret;
   if(id&&secret)void apiRequest("/v1/contributors/presence",{method:"POST",body:JSON.stringify({contributorId:id,leaveSecret:secret,leave:true})}).catch(()=>{});
  };
 },[contributorId,leaveSecret]);

 async function join(event:React.FormEvent){
  event.preventDefault();
  setBusy(true);setError("");setNotice("");
  try{
   if(!code)throw new Error("This contributor link is incomplete. Ask the host for a new link.");
   const result=await apiRequest<JoinResult>("/v1/join/contributor",{
    method:"POST",
    body:JSON.stringify({code,displayName:displayName.trim()})
   });
   if(!result.authToken)throw new Error("The host service did not issue a camera access token.");
   setSessionTitle(result.session.title);
   setContributorId(result.contributor.id);
   setLeaveSecret(result.leaveSecret);
   setAuthToken(result.authToken);
   joinedRef.current=true;
   setNotice("Your camera account is admitted. Allow camera and microphone access in the meeting window.");
  }catch(reason){
   setError(reason instanceof Error?reason.message:"Could not join the camera session.");
  }finally{
   setBusy(false);
  }
 }

 async function leave(){
  if(intervalRef.current!==null)window.clearInterval(intervalRef.current);
  intervalRef.current=null;
  if(contributorId&&leaveSecret){
   await apiRequest("/v1/contributors/presence",{
    method:"POST",
    body:JSON.stringify({contributorId,leaveSecret,leave:true})
   }).catch(()=>{});
  }
  setAuthToken("");setContributorId("");setLeaveSecret("");
  setSessionTitle("");joinedRef.current=false;
  setNotice("You have left the camera meeting.");
 }

 useEffect(()=>{
  if(!contributorId||!leaveSecret||!authToken)return;
  const heartbeat=()=>void apiRequest("/v1/contributors/presence",{
   method:"POST",body:JSON.stringify({contributorId,leaveSecret})
  }).catch(()=>{});
  heartbeat();
  intervalRef.current=window.setInterval(heartbeat,20000);
  return()=>{if(intervalRef.current!==null)window.clearInterval(intervalRef.current);};
 },[contributorId,leaveSecret,authToken]);

 return <main className="camera-page">
  <header className="camera-header"><div className="brand-mark"><Radio/></div><div><b>GOZIE LIVE</b><small>Camera contributor</small></div><span className={authToken?"live-indicator":"status-pill"}>{authToken?"ADMITTED":"READY"}</span></header>
  <section className="camera-content">
   {!authToken?
    <form className="camera-join-card" onSubmit={join}>
     <span className="eyebrow">CONTRIBUTOR ACCESS</span>
     <h1>Join the camera team</h1>
     <p>Enter your display name. RealtimeKit will ask for camera and microphone access when you join.</p>
     <label>Your display name<input required minLength={2} maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="e.g. Front camera"/></label>
     {error&&<div className="inline-error">{error}</div>}
     <button className="primary-button full-width" disabled={busy||!code}>{busy?"Requesting camera access…":"Continue to camera meeting"}</button>
     <small className="muted">This contributor link cannot access host administration or other sessions.</small>
    </form>:
    <>
     <div className="camera-session-title"><span className="feed-live-dot"/><div><b>{sessionTitle}</b><small>Cloudflare RealtimeKit camera meeting</small></div></div>
     {notice&&<div className="inline-success"><ShieldCheck size={16}/>{notice}</div>}
     <RealtimeKitRoom authToken={authToken} role="camera" onLeave={()=>void leave()}/>
    </>
   }
  </section>
 </main>;
}
