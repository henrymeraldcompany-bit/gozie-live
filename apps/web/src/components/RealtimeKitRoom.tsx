import {useEffect,useState} from "react";
import {Radio,LogOut} from "lucide-react";
import {useRealtimeKitClient,RealtimeKitProvider,useRealtimeKitMeeting} from "@cloudflare/realtimekit-react";
import {RtkMeeting} from "@cloudflare/realtimekit-react-ui";

type Role="host"|"camera";
function MeetingSurface(){
 const {meeting}=useRealtimeKitMeeting();
 return <RtkMeeting mode="fill" meeting={meeting} showSetupScreen={true}/>;
}
export default function RealtimeKitRoom({authToken,role,onLeave}:{authToken:string;role:Role;onLeave:()=>void}){
 const [meeting,initMeeting]=useRealtimeKitClient();
 const [error,setError]=useState("");
 const [leaving,setLeaving]=useState(false);
 useEffect(()=>{
  let active=true;
  void Promise.resolve(initMeeting({
   authToken,
   defaults:{audio:role==="camera",video:role==="camera"}
  })).catch((reason:unknown)=>{
   if(active)setError(reason instanceof Error?reason.message:"Could not initialize the RealtimeKit meeting.");
  });
  return()=>{active=false;};
 },[authToken,role,initMeeting]);
 useEffect(()=>()=>{if(meeting)void meeting.leave().catch(()=>{});},[meeting]);
 async function leave(){
  if(leaving)return;
  setLeaving(true);
  try{await meeting?.leave();}
  catch(reason){setError(reason instanceof Error?reason.message:"Could not leave the meeting cleanly.");}
  finally{onLeave();setLeaving(false);}
 }
 return <section className={"rtk-room rtk-room-"+role}>
  <header className="rtk-room-header">
   <div><span className="eyebrow">{role==="host"?"HOST CONTROL ROOM":"CAMERA CONTRIBUTOR"}</span><h3>{role==="host"?"Live production meeting":"Your camera connection"}</h3></div>
   <button type="button" className="danger-button" onClick={()=>void leave()} disabled={leaving}><LogOut size={15}/>{leaving?"Leaving…":"Leave meeting"}</button>
  </header>
  {error&&<div className="inline-error">{error}</div>}
  {!meeting?<div className="rtk-room-loading"><Radio size={23}/><span>Connecting to Cloudflare RealtimeKit…</span></div>:
   <RealtimeKitProvider value={meeting}><div className="rtk-meeting-frame"><MeetingSurface/></div></RealtimeKitProvider>}
 </section>;
}
