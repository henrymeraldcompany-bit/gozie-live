import {useEffect,useRef,useState} from "react";
import {Camera,Mic,MicOff,Radio,ShieldCheck,Video,VideoOff} from "lucide-react";
import {apiRequest} from "../lib/api";
import {createPeerConnection,waitForIce} from "../lib/realtime";
type Join={session:{id:string;title:string};contributor:{id:string};leaveSecret:string};
export default function CameraStudio({code}:{code:string}){
 const [displayName,setDisplayName]=useState(""),[sessionTitle,setSessionTitle]=useState(""),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false),[cameraOn,setCameraOn]=useState(true),[micOn,setMicOn]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
 const preview=useRef<HTMLVideoElement>(null),streamRef=useRef<MediaStream|null>(null),pcRef=useRef<RTCPeerConnection|null>(null),presence=useRef<{contributorId:string;leaveSecret:string}|null>(null),timer=useRef<number|null>(null);
 useEffect(()=>()=>{if(timer.current!==null)clearInterval(timer.current);const p=presence.current;if(p)void apiRequest("/v1/contributors/presence",{method:"POST",body:JSON.stringify({...p,leave:true})}).catch(()=>{});pcRef.current?.close();streamRef.current?.getTracks().forEach(t=>t.stop());},[]);
 async function join(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");let media:MediaStream|null=null,pc:RTCPeerConnection|null=null;try{
  if(!code)throw new Error("This contributor link is incomplete. Ask the host for a fresh link.");
  media=await navigator.mediaDevices.getUserMedia({audio:true,video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}}});
  const reservation=await apiRequest<Join>("/v1/join/contributor",{method:"POST",body:JSON.stringify({code,displayName:displayName.trim()})});presence.current={contributorId:reservation.contributor.id,leaveSecret:reservation.leaveSecret};
  pc=createPeerConnection();pcRef.current=pc;streamRef.current=media;if(preview.current)preview.current.srcObject=media;
  const trackMeta:Array<{mid:string;trackName:string;kind:string}>=[];
  for(const track of media.getTracks())pc.addTransceiver(track,{direction:"sendonly"});
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);await waitForIce(pc);
  for(const transceiver of pc.getTransceivers()){if(transceiver.sender.track&&transceiver.mid)trackMeta.push({mid:transceiver.mid,trackName:transceiver.sender.track.kind==="video"?"camera":"microphone",kind:transceiver.sender.track.kind});}
  const published=await apiRequest<{sessionDescription:{type:RTCSdpType;sdp:string}}>("/v1/media/publish",{method:"POST",body:JSON.stringify({code,contributorId:reservation.contributor.id,leaveSecret:reservation.leaveSecret,sessionDescription:pc.localDescription,tracks:trackMeta})});
  await pc.setRemoteDescription(published.sessionDescription);setSessionTitle(reservation.session.title);setConnected(true);
  timer.current=window.setInterval(()=>{const p=presence.current;if(p)void apiRequest("/v1/contributors/presence",{method:"POST",body:JSON.stringify(p)}).catch(()=>{});},15000);
  setMessage("Your camera feed is connected to Cloudflare Realtime. Keep this page open while contributing.");
 }catch(err){pc?.close();media?.getTracks().forEach(t=>t.stop());setError(err instanceof Error?err.message:"Could not connect your camera.");}finally{setBusy(false);}}
 function toggleCamera(){const track=streamRef.current?.getVideoTracks()[0];if(track){track.enabled=!track.enabled;setCameraOn(track.enabled);}}
 function toggleMic(){const track=streamRef.current?.getAudioTracks()[0];if(track){track.enabled=!track.enabled;setMicOn(track.enabled);}}
 async function leave(){if(timer.current!==null)clearInterval(timer.current);const p=presence.current;if(p)await apiRequest("/v1/contributors/presence",{method:"POST",body:JSON.stringify({...p,leave:true})}).catch(()=>{});pcRef.current?.close();streamRef.current?.getTracks().forEach(t=>t.stop());pcRef.current=null;streamRef.current=null;presence.current=null;setConnected(false);setMessage("You have left the camera session.");}
 return <main className="camera-page"><header className="camera-header"><div className="brand-mark"><Radio/></div><div><b>GOZIE LIVE</b><small>Camera contributor</small></div><span className={connected?"live-indicator":"status-pill"}>{connected?"CONNECTED":"READY"}</span></header>
  <section className="camera-content">{!connected?<form className="camera-join-card" onSubmit={join}><span className="eyebrow">CONTRIBUTOR ACCESS</span><h1>Join the camera team</h1><p>Enter your display name and allow camera and microphone access when your browser asks.</p><label>Your display name<input required maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="e.g. Front camera"/></label>{error&&<div className="inline-error">{error}</div>}<button className="primary-button full-width" disabled={busy||!code}>{busy?"Connecting camera…":"Enable camera and join"}</button><small className="muted">Only your camera and microphone tracks are published. You cannot access host controls.</small></form>:<><div className="camera-session-title"><span className="feed-live-dot"/> <div><b>{sessionTitle}</b><small>Sending live camera and microphone</small></div></div><div className="camera-local-preview">{<video ref={preview} autoPlay muted playsInline/>}</div><div className="camera-control-row"><button className="secondary-button" onClick={toggleCamera}>{cameraOn?<Video/>:<VideoOff/>}{cameraOn?"Camera on":"Camera off"}</button><button className="secondary-button" onClick={toggleMic}>{micOn?<Mic/>:<MicOff/>}{micOn?"Microphone on":"Microphone muted"}</button><button className="danger-button" onClick={()=>void leave()}>Leave session</button></div><div className="inline-success"><ShieldCheck size={16}/> {message}</div></>}</section>
 </main>;
}
