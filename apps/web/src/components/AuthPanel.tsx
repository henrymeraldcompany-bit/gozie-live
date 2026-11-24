import { useState } from "react";
import { getSupabase, apiConfigured } from "../lib/api";
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
      if (!supabase) throw new Error("Host sign-in is not configured. The Supabase project URL and anon key must be added to the Pages build variables.");
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
      {creating && <label>Display name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
      <label>Email address<div className="input-icon"><Mail size={16}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div></label>
      <label>Password<div className="input-icon"><LockKeyhole size={16}/><input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></div></label>
      {error && <div className="inline-error">{error}</div>}
      {message && <div className="inline-success">{message}</div>}
      <button className="primary-button full-width" disabled={busy || !supabase}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</button>
      <button type="button" className="text-button" onClick={()=>{setCreating(!creating);setError("");setMessage("");}}>{creating ? "Already have an account? Sign in" : "New host? Create an account"}</button>
      {!supabase && <div className="setup-note">Host authentication is awaiting setup: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the GitHub Actions repository variables.</div>}
      {!apiConfigured() && <div className="setup-note">The API Worker URL is also required. Add VITE_API_BASE_URL to the GitHub Actions repository variables after the API is deployed.</div>}
    </form>
  </div>;
}
