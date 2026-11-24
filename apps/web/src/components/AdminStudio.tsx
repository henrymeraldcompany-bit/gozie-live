import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Camera, CircleHelp, Clapperboard, Copy, Eye, FileAudio, FileImage, FileVideo, LogOut, Mic, MonitorPlay, Radio, ShieldCheck, Upload, Users, Video, VolumeX } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Room } from "livekit-client";
import type { RemoteParticipant, RemoteTrack } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { apiRequest, getSupabase } from "../lib/api";
import TrackRenderer from "./TrackRenderer";

type Session = { id: string; title: string; status: string; scheduled_at: string | null; live_started_at?: string | null; ended_at?: string | null };
type Contributor = { id: string; display_name: string; status: string; audio_muted: boolean; provider_identity?: string | null };
type Asset = { id: string; asset_kind: string; content_type: string; file_name?: string };
type Recording = { id: string; created_at: string; expires_at: string; size_bytes: number | null; deleted_at: string | null };
type SessionDetail = { session: Session; contributors: Contributor[]; assets: Asset[]; recordings: Recording[]; viewerCount: number; mediaEngine: string };
type Shares = { contributorUrl: string; viewerUrl: string };
type OwnerTokens = { livekitUrl: string; monitorToken: string; programToken: string; mediaEngine: string };

function FeedTile({ participant, onSelect, selected }: { participant: RemoteParticipant; onSelect: (identity: string) => void; selected: boolean }) {
  const video = [...participant.videoTrackPublications.values()].find(publication => publication.track)?.track as RemoteTrack | undefined;
  const audio = [...participant.audioTrackPublications.values()].find(publication => publication.track)?.track as RemoteTrack | undefined;
  return <button className={selected ? "feed-tile selected" : "feed-tile"} onClick={()=>onSelect(participant.identity)}>
    <div className="feed-video">
      {video ? <TrackRenderer track={video} label={participant.name || participant.identity}/> : <div className="feed-no-video"><Camera size={28}/></div>}
      {audio && <span className="feed-audio"><Activity size={12}/> Audio track</span>}
    </div>
    <div className="feed-label"><span><b>{participant.name || participant.identity}</b><small>{participant.identity}</small></span><span className="feed-live-dot"/></div>
    <span className="feed-action">{selected ? "Selected programme source" : "Select as programme source"}</span>
  </button>;
}
export default function AdminStudio({ userEmail }: { userEmail: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [title, setTitle] = useState("");
  const [schedule, setSchedule] = useState("");
  const [creating, setCreating] = useState(false);
  const [shares, setShares] = useState<Shares | null>(null);
  const [monitor, setMonitor] = useState<Room | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedSource, setSelectedSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshSessions = useCallback(async () => {
    const rows = await apiRequest<Session[]>("/v1/sessions");
    setSessions(rows);
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }, [selectedId]);
  const refreshDetail = useCallback(async () => {
    if (!selectedId) { setDetail(null); return; }
    const result = await apiRequest<SessionDetail>("/v1/sessions/" + selectedId);
    setDetail(result);
  }, [selectedId]);
  useEffect(() => { void refreshSessions().catch(err=>setError(err.message)); }, [refreshSessions]);
  useEffect(() => { void refreshDetail().catch(err=>setError(err.message)); }, [refreshDetail]);
  useEffect(() => {
    return () => { void monitor?.disconnect(); };
  }, [monitor]);

  const participants = useMemo(() => monitor ? [...monitor.remoteParticipants.values()] : [], [monitor, revision]);
  async function createSession(event: React.FormEvent) {
    event.preventDefault(); setCreating(true); setError(""); setMessage("");
    try {
      const result = await apiRequest<{session:Session;contributorUrl:string;viewerUrl:string}>("/v1/sessions", {
        method:"POST", body:JSON.stringify({title,scheduledAt:schedule ? new Date(schedule).toISOString() : null})
      });
      setShares({ contributorUrl:result.contributorUrl, viewerUrl:result.viewerUrl });
      setSelectedId(result.session.id); setTitle(""); setSchedule("");
      await refreshSessions();
      setMessage("Session created. Share the contributor and viewer links below.");
    } catch(err) { setError(err instanceof Error ? err.message : "Could not create session."); }
    finally { setCreating(false); }
  }
  async function generateLinks() {
    if (!selectedId) return;
    try {
      const result = await apiRequest<Shares>("/v1/sessions/"+selectedId+"/share-links",{method:"POST"});
      setShares(result); setMessage("New share links generated. Previous links have been replaced."); setError("");
    } catch(err) { setError(err instanceof Error ? err.message : "Could not create links."); }
  }
  async function connectMonitor() {
    if (!selectedId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const tokens = await apiRequest<OwnerTokens>("/v1/sessions/"+selectedId+"/owner-tokens",{method:"POST"});
      await monitor?.disconnect();
      const room = new Room({adaptiveStream:true,dynacast:true});
      room.on(RoomEvent.TrackSubscribed,()=>setRevision(value=>value+1));
      room.on(RoomEvent.TrackUnsubscribed,()=>setRevision(value=>value+1));
      room.on(RoomEvent.ParticipantConnected,()=>setRevision(value=>value+1));
      room.on(RoomEvent.ParticipantDisconnected,()=>setRevision(value=>value+1));
      await room.connect(tokens.livekitUrl,tokens.monitorToken);
      setMonitor(room); setMessage("Camera monitor connected. The programme engine is still a separate service.");
    } catch(err) { setError(err instanceof Error ? err.message : "Monitor connection failed."); }
    finally { setBusy(false); }
  }
  async function command(command: string,payload:Record<string,unknown>) {
    if (!selectedId) return;
    setError(""); setMessage("");
    try {
      const result = await apiRequest<{accepted:boolean;applied:boolean;message:string}>("/v1/sessions/"+selectedId+"/production",{
        method:"POST",body:JSON.stringify({command,payload})
      });
      setMessage(result.applied ? "Production control applied." : result.message);
      await refreshDetail();
    } catch(err) { setError(err instanceof Error ? err.message : "Production control failed."); }
  }
  async function sessionAction(action:"start"|"end") {
    if (!selectedId) return;
    try {
      await apiRequest<{session:Session;broadcastOutput?:string}>("/v1/sessions/"+selectedId+"/"+action,{method:"POST"});
      setMessage(action==="start" ? "Session marked live. The final programme remains offline until the production engine is deployed." : "Session ended. Recording retention is scheduled for seven days after the end time.");
      await refreshSessions(); await refreshDetail();
    } catch(err) { setError(err instanceof Error ? err.message : "Session update failed."); }
  }
  async function uploadFile(file:File) {
    if (!selectedId) return;
    const data=new FormData(); data.set("file",file);
    try { setBusy(true); await apiRequest("/v1/sessions/"+selectedId+"/assets",{method:"POST",body:data}); await refreshDetail(); setMessage("Media uploaded to the private R2 bucket. It is not yet on the programme."); }
    catch(err) { setError(err instanceof Error ? err.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  async function copy(value:string) {
    try { await navigator.clipboard.writeText(value); setMessage("Link copied to clipboard."); }
    catch { setMessage("Clipboard permission was unavailable. Select and copy the link manually."); }
  }
  const activeSession = detail?.session;
  const contributors = detail?.contributors ?? [];
  const assets = detail?.assets ?? [];
  const isLive = activeSession?.status === "live";
  return <div className="admin-layout">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Radio size={21}/></span><span>GOZIE <b>LIVE</b></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace-active"><MonitorPlay size={17}/> Production studio</div>
      <div className="sidebar-session-list"><span className="workspace-label">YOUR SESSIONS</span>
        {sessions.map(item=><button key={item.id} className={selectedId===item.id?"session-nav active":"session-nav"} onClick={()=>{setSelectedId(item.id);setShares(null);setSelectedSource("");}}><span className={item.status==="live"?"feed-live-dot":"status-dot"}/><span>{item.title}</span></button>)}
        {sessions.length===0 && <small>No sessions created yet.</small>}
      </div>
      <div className="sidebar-bottom"><ShieldCheck size={17}/> Signed in as {userEmail || "host"}</div>
    </aside>
    <section className="main-area">
      <header className="topbar">
        <div><div className="eyebrow">GOZIE LIVE / CONTROL ROOM</div><h1>Admin Studio</h1></div>
        <div className="top-actions"><span className="status-pill"><span className="dot"/> API connected when configured</span><button className="icon-button" aria-label="Help"><CircleHelp size={19}/></button><button className="avatar" title="Sign out" onClick={()=>void getSupabase()?.auth.signOut()}><LogOut size={16}/></button></div>
      </header>
      <div className="content">
        <div className="welcome-row"><div><h2>Your broadcast, in one place.</h2><p>Create a session, invite camera contributors, then manage the production.</p></div></div>
        {(error || message) && <div className={error?"inline-error":"inline-success"}>{error || message}</div>}
        <div className="studio-columns">
          <section className="session-card">
            <div className="section-heading"><div><span className="eyebrow">NEW BROADCAST</span><h3>Create a session</h3></div><span className="draft-tag">HOST CONTROL</span></div>
            <form className="stack-form" onSubmit={createSession}>
              <label>Session title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Sunday live broadcast"/></label>
              <label>Scheduled start <input type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)}/></label>
              <button className="primary-button" disabled={creating}>{creating?"Creating…":"Create session"}</button>
            </form>
          </section>
          <section className="session-card">
            <div className="section-heading"><div><span className="eyebrow">SELECTED SESSION</span><h3>{activeSession?.title ?? "Choose a session"}</h3></div><span className={isLive?"live-tag":"draft-tag"}>{activeSession?.status?.toUpperCase() ?? "NO SESSION"}</span></div>
            {activeSession ? <>
              <div className="session-meta"><span><Users size={15}/>{contributors.length} contributors</span><span><Eye size={15}/>{detail?.viewerCount ?? 0} viewers</span><span><Activity size={15}/>{detail?.mediaEngine==="connected"?"Engine connected":"Engine offline"}</span></div>
              <div className="action-row">
                <button className="secondary-button" onClick={()=>void generateLinks()}>Generate share links</button>
                {activeSession.status!=="ended" && <button className="primary-button" onClick={()=>void sessionAction(isLive?"end":"start")}>{isLive?"End session":"Mark session live"}</button>}
              </div>
            </>:<p className="muted">Create your first broadcast to see its controls here.</p>}
          </section>
        </div>

        {shares && <section className="session-card share-card"><div className="section-heading"><div><span className="eyebrow">INVITATION LINKS</span><h3>Share access to this session</h3></div></div><div className="share-grid">
          <div className="share-item"><QRCodeSVG value={shares.contributorUrl} size={112}/><div><b>Camera contributors</b><p>Send this to each person who should publish a camera and microphone feed.</p><div className="share-url">{shares.contributorUrl}</div><button className="secondary-button" onClick={()=>void copy(shares.contributorUrl)}><Copy size={14}/> Copy contributor link</button></div></div>
          <div className="share-item"><QRCodeSVG value={shares.viewerUrl} size={112}/><div><b>Viewers</b><p>Send this to the audience. They can only subscribe to the final programme room.</p><div className="share-url">{shares.viewerUrl}</div><button className="secondary-button" onClick={()=>void copy(shares.viewerUrl)}><Copy size={14}/> Copy viewer link</button></div></div>
        </div></section>}

        {activeSession && <>
          <div className="section-heading cameras-heading"><div><span className="eyebrow">LIVE INPUTS</span><h3>Camera monitor</h3></div><div className="section-actions"><span className="muted">{participants.length} active feeds · {contributors.length} admitted</span><button className="secondary-button" disabled={busy} onClick={()=>void connectMonitor()}>{busy?"Connecting…":"Connect monitor"}</button></div></div>
          {participants.length>0 ? <div className="feed-grid">{participants.map(participant=><FeedTile key={participant.identity} participant={participant} selected={selectedSource===participant.identity} onSelect={identity=>{setSelectedSource(identity);void command("select-source",{participantIdentity:identity});}}/>)}</div> : <div className="empty-grid"><div className="empty-icon"><Video size={26}/></div><h3>No camera previews currently connected</h3><p>Invite contributors and connect the camera monitor. LiveKit must be configured for real feeds to arrive.</p></div>}
          <section className="session-card production-card"><div className="section-heading"><div><span className="eyebrow">PROGRAMME OUTPUT</span><h3>Production controls</h3></div><span className="draft-tag">ENGINE OFFLINE</span></div>
            <div className="production-grid">
              <div><b>Selected source</b><p>{selectedSource || "No camera selected"}</p><small>Selection is saved as a production command; no final switch is applied until the engine is running.</small></div>
              <div><b>Contributor audio</b><p>Mute commands can be queued for the media engine.</p><button className="secondary-button" onClick={()=>void command("set-audio-mix",{muteAll:true})}><VolumeX size={15}/> Mute all contributor audio</button></div>
              <div><b>Master programme</b><p>Final output is published by the independent production engine.</p><span className="offline-text">No programme stream published</span></div>
            </div>
            {contributors.map(person=><div className="contributor-row" key={person.id}><span><b>{person.display_name}</b><small>{person.status}</small></span><button className="secondary-button" onClick={()=>void command("mute-contributor",{contributorId:person.id,muted:!person.audio_muted})}><Mic size={14}/>{person.audio_muted?"Unmute":"Mute"} mic</button></div>)}
          </section>

          <section className="session-card"><div className="section-heading"><div><span className="eyebrow">MEDIA LIBRARY</span><h3>Images, video and audio</h3></div><label className="upload-button"><Upload size={15}/> Add media<input type="file" accept="image/*,video/*,audio/*" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadFile(file);e.currentTarget.value="";}} hidden/></label></div>
            <p className="muted">Upload a media item to private R2 storage. It can be selected by the production engine after that service is deployed. Browser uploads are limited to 100 MB.</p>
            {assets.length>0 ? <div className="asset-list">{assets.map(asset=><div className="asset-row" key={asset.id}>{asset.asset_kind==="image"?<FileImage/>:asset.asset_kind==="video"?<FileVideo/>:<FileAudio/>}<span><b>{asset.file_name || asset.asset_kind}</b><small>{asset.content_type}</small></span><button className="secondary-button" onClick={()=>void command("set-media-source",{assetId:asset.id,kind:asset.asset_kind})}>Queue as source</button></div>)}</div>:<div className="asset-empty">No media uploaded to this session.</div>}
          </section>

          <section className="session-card"><div className="section-heading"><div><span className="eyebrow">RECORDINGS</span><h3>Final programme recordings</h3></div><Clapperboard size={20}/></div>
            {detail?.recordings?.length ? detail.recordings.map(recording=><div className="asset-row" key={recording.id}><Clapperboard/><span><b>Programme recording</b><small>Expires {new Date(recording.expires_at).toLocaleString()}</small></span><span className="offline-text">{recording.deleted_at?"Deleted":"Engine archive pending"}</span></div>) : <p className="muted">No recordings yet. Recording and playback become available after the production engine is deployed.</p>}
          </section>
        </>}
        <div className="notice"><ShieldCheck size={18}/><div><b>Production infrastructure status</b><p>API and database configuration are separate from media processing. Camera feeds, final-programme switching, audio mixing and recording require LiveKit plus the independent media engine. A status label or queued command does not mean a broadcast is running.</p></div></div>
      </div>
    </section>
  </div>;
}
