import {useEffect,useRef} from "react";
export default function TrackRenderer({track,label}:{track:MediaStreamTrack;label:string}){
 const ref=useRef<HTMLMediaElement>(null);
 useEffect(()=>{const stream=new MediaStream([track]);if(ref.current)ref.current.srcObject=stream;return()=>{if(ref.current)ref.current.srcObject=null;};},[track]);
 return track.kind==="video"?<video ref={ref as React.RefObject<HTMLVideoElement>} autoPlay muted playsInline aria-label={label}/>:<audio ref={ref as React.RefObject<HTMLAudioElement>} autoPlay aria-label={label}/>;
}
