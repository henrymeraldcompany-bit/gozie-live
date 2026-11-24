import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import AdminStudio from "./components/AdminStudio";
import AuthPanel from "./components/AuthPanel";
import CameraStudio from "./components/CameraStudio";
import Viewer from "./components/Viewer";
import EngineRenderer from "./components/EngineRenderer";
import { getSupabase } from "./lib/api";

type Mode = "admin" | "camera" | "viewer" | "engine";
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const rawMode = params.get("mode");
  const mode: Mode = rawMode === "camera" || rawMode === "viewer" || rawMode === "engine" ? rawMode : "admin";
  const code = params.get("code") ?? "";
  const supabase = getSupabase();
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    void supabase.auth.getSession().then(({data})=>{
      setSignedIn(Boolean(data.session)); setEmail(data.session?.user.email ?? ""); setChecking(false);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session)=>{
      setSignedIn(Boolean(session)); setEmail(session?.user.email ?? "");
    });
    return ()=>subscription.unsubscribe();
  }, [supabase]);

  if (mode === "engine") return <EngineRenderer/>;
  if (mode === "camera") return <CameraStudio code={code}/>;
  if (mode === "viewer") return <Viewer code={code}/>;
  if (checking) return <div className="loading-screen"><Radio size={26}/> Loading GOZIE LIVE…</div>;
  if (!signedIn) return <AuthPanel/>;
  return <AdminStudio userEmail={email}/>;
}
