import {useEffect,useState} from "react";
import {Radio} from "lucide-react";
import AdminStudio from "./components/AdminStudio";
import AuthPanel from "./components/AuthPanel";
import CameraStudio from "./components/CameraStudio";
import Viewer from "./components/Viewer";
import EngineRenderer from "./components/EngineRenderer";
import {getCurrentUser,apiRequest} from "./lib/api";
type User={id:string;email:string;displayName:string};
type Mode="admin"|"camera"|"viewer"|"engine";
export default function App(){
 const params=new URLSearchParams(window.location.search),raw=params.get("mode"),mode:Mode=raw==="camera"||raw==="viewer"||raw==="engine"?raw:"admin",code=params.get("code")||"";
 const [user,setUser]=useState<User|null>(null),[checking,setChecking]=useState(mode==="admin");
 useEffect(()=>{if(mode!=="admin")return;let active=true;getCurrentUser().then(r=>{if(active)setUser(r.user);}).catch(()=>{if(active)setUser(null);}).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[mode]);
 if(mode==="engine")return <EngineRenderer/>;
 if(mode==="camera")return <CameraStudio code={code}/>;
 if(mode==="viewer")return <Viewer code={code}/>;
 if(checking)return <div className="loading-screen"><Radio size={26}/> Loading GOZIE LIVE…</div>;
 if(!user)return <AuthPanel onAuthenticated={async()=>{try{const r=await getCurrentUser();setUser(r.user);}catch{setUser(null);}}}/>;
 return <AdminStudio userEmail={user.email} onSignOut={async()=>{await apiRequest("/v1/auth/logout",{method:"POST"});setUser(null);}}/>;
}
