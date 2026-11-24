import { useState } from "react";
import { getSupabase } from "../lib/api";
import { LockKeyhole, Mail, Radio } from "lucide-react";

export default function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const supabase = getSupabase();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (!supabase) throw new Error("Authentication is not configured yet. The Supabase project and frontend environment values are required.");
      if (creating) {
        const result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
        if (result.error) throw result.error;
        setMessage("Account request submitted. Check your email for verification before signing in.");
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  return <div className="auth-wrap">
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-logo"><Radio size={24}/></div>
      <span className="eyebrow">GOZIE LIVE WORKSPACE</span>
      <h2>{creating ? "Create your host account" : "Welcome back"}</h2>
      <p>Sign in to create sessions and manage your broadcast studio.</p>
      {creating && <label>Display name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
      <label>Email address<div className="input-icon"><Mail size={16}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div></label>
      <label>Password<div className="input-icon"><LockKeyhole size={16}/><input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></div></label>
      {error && <div className="inline-error">{error}</div>}
      {message && <div className="inline-success">{message}</div>}
      <button className="primary-button full-width" disabled={busy}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</button>
      <button type="button" className="text-button" onClick={()=>{setCreating(!creating);setError("");setMessage("");}}>{creating ? "Already have an account? Sign in" : "New host? Create an account"}</button>
      {!supabase && <div className="setup-note">Setup required: add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> after creating the Supabase project.</div>}
    </form>
  </div>;
}
