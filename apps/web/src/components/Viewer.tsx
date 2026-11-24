import { useEffect, useRef, useState } from "react";
import { Clapperboard, Radio } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import type { RemoteTrack } from "livekit-client";
import { apiRequest, apiUrl } from "../lib/api";

type PublicSession = {
  session: { id: string; title: string; status: string; scheduled_at: string | null; ended_at: string | null };
  recordings: Array<{ id: string; expires_at: string; size_bytes: number | null }>;
};
type JoinResult = { session: { id: string; title: string; status: string }; presenceId: string; livekitUrl: string; token: string };
export default function Viewer({ code }: { code: string }) {
  const [joined, setJoined] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("checking");
  const [recordings, setRecordings] = useState<PublicSession["recordings"]>([]);
  const [error, setError] = useState("");
  const [videoTrack, setVideoTrack] = useState<RemoteTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<RemoteTrack | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!code) { setStatus("invalid"); setError("This viewer link is missing its session code."); return; }
    void apiRequest<PublicSession>("/v1/public/session?code="+encodeURIComponent(code))
      .then(result=>{setTitle(result.session.title);setStatus(result.session.status);setRecordings(result.recordings);})
      .catch(err=>{setStatus("invalid");setError(err instanceof Error?err.message:"This viewer link is invalid.");});
  },[code]);

  async function join() {
    setError("");
    try {
      const result = await apiRequest<JoinResult>("/v1/join/viewer", { method: "POST", body: JSON.stringify({ code }) });
      setTitle(result.session.title);
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) setVideoTrack(track);
        if (track.kind === Track.Kind.Audio) setAudioTrack(track);
        setStatus("connected");
      });
      room.on(RoomEvent.Disconnected, () => { setStatus("disconnected"); setVideoTrack(null); setAudioTrack(null); });
      await room.connect(result.livekitUrl, result.token);
      roomRef.current = room; setJoined(true); setStatus("connected");
      const videoPublication = [...room.remoteParticipants.values()].flatMap(p => [...p.videoTrackPublications.values()]).find(p => p.track);
      if (videoPublication?.track) setVideoTrack(videoPublication.track as RemoteTrack);
      const audioPublication = [...room.remoteParticipants.values()].flatMap(p => [...p.audioTrackPublications.values()]).find(p => p.track);
      if (audioPublication?.track) setAudioTrack(audioPublication.track as RemoteTrack);
      void apiRequest("/v1/viewer/heartbeat", { method: "POST", body: JSON.stringify({ presenceId: result.presenceId }) });
      const interval = window.setInterval(() => { void apiRequest("/v1/viewer/heartbeat", { method: "POST", body: JSON.stringify({ presenceId: result.presenceId }) }).catch(()=>undefined); }, 25000);
      room.on(RoomEvent.Disconnected, () => window.clearInterval(interval));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to join this programme."); }
  }
  useEffect(() => {
    if (videoTrack && video.current) videoTrack.attach(video.current);
    return () => { if (videoTrack && video.current) videoTrack.detach(video.current); };
  }, [videoTrack]);
  useEffect(() => {
    if (audioTrack && audio.current) audioTrack.attach(audio.current);
    return () => { if (audioTrack && audio.current) audioTrack.detach(audio.current); };
  }, [audioTrack]);
  useEffect(() => () => { void roomRef.current?.disconnect(); }, []);
  const apiCode = "?code="+encodeURIComponent(code);

  return <main className="public-shell viewer-shell">
    <header className="public-brand"><span className="brand-mark"><Radio size={20}/></span><span>GOZIE <b>LIVE</b></span><span className="public-role">VIEWER</span></header>
    <section className="viewer-page">
      <div className="viewer-title"><span className="eyebrow">LIVE PROGRAMME</span><h1>{title || "Watch the broadcast"}</h1><p>Audience members receive the host's final programme output, not the separate contributor camera feeds.</p></div>
      <div className="programme-player">
        {joined && videoTrack ? <video ref={video} autoPlay playsInline controls={false}/> : <div className="player-offline"><Clapperboard size={44}/><b>{joined ? "Programme output is not online yet" : status === "ended" ? "This session has ended" : status === "checking" ? "Checking session…" : "Programme output is offline"}</b><span>{joined ? "The production engine has not published a final video track." : status === "ended" ? "Available final programme recordings are listed below." : "Join the audience room to check for the live programme."}</span></div>}
      </div>
      <audio ref={audio} autoPlay/>
      <div className="viewer-status-row"><span className={status === "connected" ? "online-dot" : "status-dot"}/>{status==="connected"?"Connected to programme room":status==="ended"?"Session ended":status==="checking"?"Checking viewer link":status==="invalid"?"Invalid viewer link":status}</div>
      {error && <div className="inline-error">{error}</div>}
      {!joined && status !== "ended" && status !== "invalid" && <button className="primary-button" onClick={join} disabled={status==="checking"}>Join as viewer</button>}
      {joined && !videoTrack && <div className="setup-note">The stream server and final-programme publisher must be running before video can appear.</div>}
      {recordings.length>0 && <section className="recordings-public"><h2>Available recordings</h2>{recordings.map(item=><div className="public-recording" key={item.id}><span><b>Final programme recording</b><small>Available until {new Date(item.expires_at).toLocaleString()}</small></span><a className="secondary-button" href={apiUrl("/v1/public/recordings/"+item.id+apiCode)}>Download</a></div>)}</section>}
    </section>
    <footer className="public-footer">GOZIE LIVE · Broadcast quality depends on the source network and production infrastructure.</footer>
  </main>;
}
