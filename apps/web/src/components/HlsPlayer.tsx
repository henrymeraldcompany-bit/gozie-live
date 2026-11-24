import {useEffect,useRef,useState} from "react";
import Hls from "hls.js";
import {Radio,Volume2} from "lucide-react";

export default function HlsPlayer({src,title="GOZIE LIVE programme"}:{src:string;title?:string}){
 const video=useRef<HTMLVideoElement>(null);
 const [error,setError]=useState("");
 const [playing,setPlaying]=useState(false);
 useEffect(()=>{
  const element=video.current;
  if(!element||!src)return;
  let hls:Hls|null=null;
  setError("");setPlaying(false);
  if(Hls.isSupported()){
   hls=new Hls({lowLatencyMode:true,enableWorker:true,backBufferLength:30});
   hls.loadSource(src);hls.attachMedia(element);
   hls.on(Hls.Events.ERROR,(_event,data)=>{
    if(data.fatal){
     if(data.type===Hls.ErrorTypes.NETWORK_ERROR)hls?.startLoad();
     else if(data.type===Hls.ErrorTypes.MEDIA_ERROR)hls?.recoverMediaError();
     else setError("The live programme cannot be loaded right now.");
    }
   });
  }else if(element.canPlayType("application/vnd.apple.mpegurl")){
   element.src=src;
  }else{
   setError("This browser does not support HLS playback.");
  }
  return()=>{hls?.destroy();element.pause();element.removeAttribute("src");element.load();};
 },[src]);
 return <div className="hls-player">
  <video ref={video} controls playsInline autoPlay muted={false} onPlaying={()=>setPlaying(true)} onWaiting={()=>setPlaying(false)} aria-label={title}/>
  {!playing&&<div className="hls-player-overlay"><Radio size={28}/><b>{error||"Waiting for the programme…"}</b><span>Press play if playback does not start automatically.</span></div>}
  <div className="hls-player-audio"><Volume2 size={13}/> Live HLS programme</div>
 </div>;
}
