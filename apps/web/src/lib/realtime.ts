export async function waitForIce(pc:RTCPeerConnection,timeoutMs=12000):Promise<void>{
 if(pc.iceGatheringState==="complete")return;
 await new Promise<void>((resolve,reject)=>{
  const timer=window.setTimeout(()=>{cleanup();reject(new Error("Network candidate gathering timed out. Check your connection and retry."));},timeoutMs);
  const done=()=>{if(pc.iceGatheringState==="complete"){cleanup();resolve();}};
  const cleanup=()=>{window.clearTimeout(timer);pc.removeEventListener("icegatheringstatechange",done);};
  pc.addEventListener("icegatheringstatechange",done);done();
 });
}
export function createPeerConnection(){return new RTCPeerConnection({iceServers:[{urls:"stun:stun.cloudflare.com:3478"}]});}
