export const apiUrl=(path:string)=>path;
export async function apiRequest<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);
 if(init.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type","application/json");
 let response:Response;
 try{response=await fetch(path,{...init,headers,credentials:"same-origin"});}
 catch{throw new Error("Could not connect to GOZIE LIVE. Check your connection.");}
 const type=response.headers.get("content-type")||"",data=type.includes("application/json")?await response.json():await response.text();
 if(!response.ok)throw new Error(typeof data==="object"&&data&&"error" in data?String((data as {error:unknown}).error):String(data||"Request failed."));
 return data as T;
}
export function apiConfigured(){return true;}
export async function getCurrentUser(){return apiRequest<{user:{id:string;email:string;displayName:string}}>("/v1/auth/session");}
