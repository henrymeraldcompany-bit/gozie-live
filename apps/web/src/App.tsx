import { useState } from "react";
import { Activity, Camera, CircleHelp, Clapperboard, Eye, LayoutDashboard, Radio, ShieldCheck, Users, Video } from "lucide-react";

type Studio = "admin" | "camera" | "viewer";

export default function App() {
  const [studio, setStudio] = useState<Studio>("admin");
  const [sessionTitle, setSessionTitle] = useState("Sunday Live Broadcast");
  const [isLive, setIsLive] = useState(false);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Radio size={21} /></span><span>GOZIE <b>LIVE</b></span></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className={studio === "admin" ? "nav-item active" : "nav-item"} onClick={() => setStudio("admin")}><LayoutDashboard size={18}/> Admin studio</button>
        <button className={studio === "camera" ? "nav-item active" : "nav-item"} onClick={() => setStudio("camera")}><Camera size={18}/> Camera studio</button>
        <button className={studio === "viewer" ? "nav-item active" : "nav-item"} onClick={() => setStudio("viewer")}><Eye size={18}/> Viewer preview</button>
        <div className="sidebar-bottom"><ShieldCheck size={17}/> Secure production workspace</div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div><div className="eyebrow">GOZIE LIVE / CONTROL ROOM</div><h1>{studio === "admin" ? "Admin Studio" : studio === "camera" ? "Camera Studio" : "Viewer Preview"}</h1></div>
          <div className="top-actions"><span className="status-pill"><span className="dot"/> System foundation</span><button className="icon-button" aria-label="Help"><CircleHelp size={19}/></button><button className="avatar">HC</button></div>
        </header>

        <div className="content">
          {studio === "admin" && <>
            <div className="welcome-row"><div><h2>Your broadcast, in one place.</h2><p>Prepare your session and manage the live production workflow.</p></div><button className="primary-button" onClick={() => setIsLive(!isLive)}><Radio size={16}/>{isLive ? "End demo state" : "Start demo state"}</button></div>
            <section className="session-card">
              <div className="section-heading"><div><span className="eyebrow">CURRENT SESSION</span><h3>Session setup</h3></div><span className={isLive ? "live-tag" : "draft-tag"}>{isLive ? "DEMO LIVE STATE" : "NOT CONNECTED"}</span></div>
              <label htmlFor="session-title">Session title</label><input id="session-title" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} />
              <div className="session-meta"><span><Users size={16}/> 0 contributors</span><span><Eye size={16}/> 0 viewers</span><span><Activity size={16}/> Media engine not connected</span></div>
            </section>
            <div className="section-heading cameras-heading"><div><span className="eyebrow">PRODUCTION</span><h3>Camera monitor</h3></div><span className="muted">0 feeds connected</span></div>
            <div className="empty-grid">
              <div className="empty-icon"><Video size={27}/></div><h3>No camera feeds yet</h3><p>Camera contributors will appear here after the camera publishing service is connected.</p><button className="secondary-button" onClick={() => setStudio("camera")}>Open camera studio</button>
            </div>
            <div className="notice"><ShieldCheck size={18}/><div><b>Infrastructure setup required</b><p>This interface is a starter foundation. LiveKit credentials, authenticated session tokens, server-side video switching, audio mixing, and recording are not connected yet.</p></div></div>
          </>}
          {studio === "camera" && <div className="panel-page"><span className="eyebrow">CONTRIBUTOR PORTAL</span><h2>Share a camera feed</h2><p>Camera contributors will join with a session-specific link and publish from their phone after granting browser permissions.</p><div className="camera-placeholder"><Camera size={32}/><b>Camera preview unavailable</b><span>Connect the session API and LiveKit publishing flow to enable camera sharing.</span></div><label>Display name</label><input placeholder="Enter your name" /><button className="primary-button" disabled>Connect camera (coming soon)</button></div>}
          {studio === "viewer" && <div className="panel-page"><span className="eyebrow">PUBLIC VIEWER</span><h2>Watch the programme</h2><p>Viewers will receive only the final programme output selected by the admin.</p><div className="viewer-placeholder"><Clapperboard size={36}/><b>Programme output is offline</b><span>The final broadcast player will appear here when the media engine is deployed.</span></div></div>}
        </div>
      </section>
    </main>
  );
}
