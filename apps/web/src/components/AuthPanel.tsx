import {useState} from "react";
import {LockKeyhole,Mail,Radio,UserRound,ShieldCheck} from "lucide-react";
import {apiRequest} from "../lib/api";
export default function AuthPanel({onAuthenticated}:{onAuthenticated:()=>void}){
 const [mode,setMode]=useState<"signin"|"register"|"verify">("signin"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");try{
  if(mode==="register"){const r=await apiRequest<{message:string}>("/v1/auth/register",{method:"POST",body:JSON.stringify({email,password,displayName:name})});setMessage(r.message);setMode("verify");}
  else if(mode==="verify"){const r=await apiRequest<{message:string}>("/v1/auth/verify",{method:"POST",body:JSON.stringify({email,code})});setMessage(r.message);setMode("signin");}
  else{await apiRequest("/v1/auth/login",{method:"POST",body:JSON.stringify({email,password})});onAuthenticated();}
 }catch(err){setError(err instanceof Error?err.message:"Request failed.");}finally{setBusy(false);}}
 return <div className="auth-wrap"><form className="auth-card" onSubmit={submit}>
  <div className="auth-logo"><Radio size={24}/></div><span className="eyebrow">GOZIE LIVE WORKSPACE</span>
  <h2>{mode==="register"?"Create your host account":mode==="verify"?"Verify your email":"Welcome back"}</h2>
  <p>{mode==="signin"?"Sign in to create sessions and manage your broadcast studio.":mode==="register"?"Register your host account with an email address and password.":"Enter the six-digit code sent to your email address."}</p>
  {mode==="register"&&<label>Display name<div className="input-icon"><UserRound size={16}/><input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></div></label>}
  <label>Email address<div className="input-icon"><Mail size={16}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" readOnly={mode==="verify"}/></div></label>
  {mode!=="verify"&&<label>Password<div className="input-icon"><LockKeyhole size={16}/><input type="password" required minLength={mode==="register"?10:1} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="register"?"At least 10 characters":"Your password"}/></div></label>}
  {mode==="verify"&&<label>Verification code<div className="input-icon"><ShieldCheck size={16}/><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code"/></div></label>}
  {error&&<div className="inline-error">{error}</div>}{message&&<div className="inline-success">{message}</div>}
  <button className="primary-button full-width" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in":mode==="register"?"Create account":"Verify email"}</button>
  <button type="button" className="text-button" onClick={()=>{setError("");setMessage("");setMode(mode==="signin"?"register":"signin");}}>{mode==="signin"?"New host? Create an account":"Back to sign in"}</button>
  {mode==="verify"&&<button type="button" className="text-button" onClick={()=>setMode("register")}>Use a different email address</button>}
  <div className="setup-note">Secure sign-in and session storage run on Cloudflare. Email registration requires a verified sending domain in Cloudflare Email Service.</div>
 </form></div>;
}
