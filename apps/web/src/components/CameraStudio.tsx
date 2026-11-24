import { useEffect, useRef, useState } from "react";
import { Camera, Mic, MicOff, Radio, ShieldCheck, Video, VideoOff } from "lucide-react";
import { createLocalTracks, Room } from "livekit-client";
import type { LocalTrack } from "livekit-client";
import { apiRequest } from "../lib/api";

type JoinResult = { session: { id: string; title: string }; contributor: { id: string }; livekitUrl: string; token: string };
export default function CameraStudio({ code }: { code: string }) {
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [connected, setConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const preview = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!connected || !preview.current) return;
    const videoTrack = tracks.find(track => track.kind === "video");
    if (!videoTrack) return;
    videoTrack.attach(preview.current);
    return () => { videoTrack.detach(preview.current!); };
  }, [connected, tracks]);

  async function join(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    let localTracks: LocalTrack[] = [];
    let nextRoom: Room | null = null;
    try {
      if (!code) throw new Error("This camera link is missing its session code. Ask the host for a new contributor link.");
      // Ask for camera/microphone permission before registering this person as connected.
      localTracks = await createLocalTracks({ audio: true, video: { facingMode: "user", resolution: { width: 1280, height: 720 } } });
      const result = await apiRequest<JoinResult>("/v1/join/contributor", { method: "POST", body: JSON.stringify({ code, displayName: displayName.trim() }) });
      nextRoom = new Room({ adaptiveStream: true, dynacast: true });
      await nextRoom.connect(result.livekitUrl, result.token);
      for (const track of localTracks) await nextRoom.localParticipant.publishTrack(track);
      setTracks(localTracks); setRoom(nextRoom); setSessionTitle(result.session.title); setConnected(true);
    } catch (err) {
      localTracks.forEach(track => { track.detach(); track.stop(); });
      await nextRoom?.disconnect();
      setError(err instanceof Error ? err.message : "Unable to join the camera room.");
    } finally { setBusy(false); }
  }
  async function toggleCamera() {
    if (!room) return;
    try { const next = !cameraOn; await room.localParticipant.setCameraEnabled(next); setCameraOn(next); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not change camera state."); }
  }
  async function toggleMic() {
    if (!room) return;
    try { const next = !micOn; await room.localParticipant.setMicrophoneEnabled(next); setMicOn(next); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not change microphone state."); }
  }
  async function leave() {
    tracks.forEach(track => { track.detach(); track.stop(); });
    await room?.disconnect();
    setTracks([]); setRoom(null); setConnected(false); setCameraOn(true); setMicOn(true);
  }

  return <main className="public-shell">
    <header className="public-brand"><span className="brand-mark"><Radio size={20}/></span><span>GOZIE <b>LIVE</b></span><span className="public-role">CAMERA STUDIO</span></header>
    <section className="public-card">
      <span className="eyebrow">CONTRIBUTOR CONNECTION</span>
      <h1>{connected ? sessionTitle : "Join the live camera room"}</h1>
      <p>{connected ? "Your phone is publishing to the host's camera monitor. Keep this page open while contributing." : "Enter the name the host should see. Your browser will ask permission to use your camera and microphone."}</p>
      {!connected ? <form onSubmit={join} className="stack-form">
        <label>Display name<input required maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Enter your name"/></label>
        {error && <div className="inline-error">{error}</div>}
        <button className="primary-button full-width" disabled={busy || !code}><Camera size={17}/>{busy ? "Connecting…" : "Allow camera and join"}</button>
        <div className="privacy-note"><ShieldCheck size={17}/> Your camera feed is sent to the host's private contributor room, not directly to viewers.</div>
      </form> : <>
        <div className="self-preview"><video ref={preview} autoPlay playsInline muted/><div className="preview-label"><span className="online-dot"/> CAMERA CONNECTED</div></div>
        {error && <div className="inline-error">{error}</div>}
        <div className="camera-controls">
          <button className={micOn ? "round-control" : "round-control off"} onClick={toggleMic}>{micOn ? <Mic/> : <MicOff/>}{micOn ? "Mic on" : "Mic off"}</button>
          <button className={cameraOn ? "round-control" : "round-control off"} onClick={toggleCamera}>{cameraOn ? <Video/> : <VideoOff/>}{cameraOn ? "Camera on" : "Camera off"}</button>
          <button className="danger-button" onClick={leave}>Leave room</button>
        </div>
      </>}
    </section>
    <footer className="public-footer">GOZIE LIVE · Camera capture may pause if your phone locks or the browser is sent to the background.</footer>
  </main>;
}
