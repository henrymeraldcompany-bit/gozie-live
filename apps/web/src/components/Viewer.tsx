import {useEffect,useState} from "react";
import {Clapperboard,Radio,Users} from "lucide-react";
import {apiRequest} from "../lib/api";
type Public={session:{id:string;title:string;status:string;scheduled_at:string|null;ended_at:string|null};recordings:Array<{id:string;expires_at:string;size_bytes:number|null}>;programmeAvailable:boolean};
export default function Viewer({code}:{code:string}){
 const [data,setData]=useState<Public|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 useEffect(()=>{if(!code){setError("This viewer link is incomplete.");setBusy(false);return;}apiRequest<Public>("/v1/public/session?code="+encodeURIComponent(code)).then(setData).catch(e=>setError(e instanceof Error?e.message:"Invalid viewer link.")).finally(()=>setBusy(false));},[code]);
 return <main className="viewer-page"><header className="camera-header"><div className="brand-mark"><Radio/></div><div><b>GOZIE LIVE</b><small>Live viewer</small></div><span className="status-pill">VIEWER</span></header><section className="viewer-content">
 {busy?<div className="empty-state"><Radio/><h2>Checking broadcast…</h2></div>:error?<div className="inline-error">{error}</div>:data?<><span className="eyebrow">PUBLIC BROADCAST</span><h1>{data.session.title}</h1><div className="viewer-screen"><Clapperboard size={42}/><h2>{data.programmeAvailable?"Programme feed is starting":"The programme is not live yet"}</h2><p>{data.programmeAvailable?"The final programme stream is being prepared.":"The host has not connected the final programme output. Check back when the broadcast begins."}</p><span className="status-pill">{data.session.status.toUpperCase()}</span></div><div className="viewer-info"><Users size={18}/><span>Viewer access only. This link cannot publish camera or microphone feeds.</span></div></>:null}
 </section></main>;
}
