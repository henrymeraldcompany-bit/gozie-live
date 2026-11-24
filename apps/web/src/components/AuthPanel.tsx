import {useState} from "react";
import {LockKeyhole,Mail,Radio,UserRound} from "lucide-react";
import {apiRequest} from "../lib/api";

export default function AuthPanel({onAuthenticated}:{onAuthenticated:()=>void}){
 const [mode,setMode]=useState<"signin"|"register">("signin");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [name,setName]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");

 async function submit(event:React.FormEvent){
  event.preventDefault();
  setBusy(true);setError("");setMessage("");
  try{
   if(mode==="register"){
    const result=await apiRequest<{message:string}>("/v1/auth/register",{
     method:"POST",
     body:JSON.stringify({email,password,displayName:name})
    });
    setMessage(result.message);
    await apiRequest("/v1/auth/login",{
     method:"POST",
     body:JSON.stringify({email,password})
    });
    onAuthenticated();
   }else{
    await apiRequest("/v1/auth/login",{
     method:"POST",
     body:JSON.stringify({email,password})
    });
    onAuthenticated();
   }
  }catch(err){
   setError(err instanceof Error?err.message:"Request failed.");
  }finally{
   setBusy(false);
  }
 }

 return <div className="auth-wrap">
  <form className="auth-card" onSubmit={submit}>
   <div className="auth-logo"><Radio size={24}/></div>
   <span className="eyebrow">GOZIE LIVE WORKSPACE</span>
   <h2>{mode==="register"?"Create your host account":"Welcome back"}</h2>
   <p>{mode==="signin"?"Sign in to create sessions and manage your broadcast studio.":"Create a host account with your email address and a strong password."}</p>
   {mode==="register"&&<label>Display name
    <div className="input-icon"><UserRound size={16}/><input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></div>
   </label>}
   <label>Email address
    <div className="input-icon"><Mail size={16}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div>
   </label>
   <label>Password
    <div className="input-icon"><LockKeyhole size={16}/><input type="password" required minLength={mode==="register"?10:1} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="register"?"At least 10 characters":"Your password"}/></div>
   </label>
   {error&&<div className="inline-error">{error}</div>}
   {message&&<div className="inline-success">{message}</div>}
   <button className="primary-button full-width" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in":"Create account"}</button>
   <button type="button" className="text-button" onClick={()=>{setError("");setMessage("");setMode(mode==="signin"?"register":"signin");}}>{mode==="signin"?"New host? Create an account":"Back to sign in"}</button>
   <div className="setup-note">Host accounts and sign-in sessions are stored securely in Cloudflare D1. Registration does not require an external email service. Use a unique email address and a strong password.</div>
  </form>
 </div>;
}
