import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
export const apiUrl = (path: string) => apiBase + path;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isForm = init.body instanceof FormData;
  if (!isForm && init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const auth = await getSupabase()?.auth.getSession();
  const accessToken = auth?.data.session?.access_token;
  if (accessToken) headers.set("authorization", "Bearer " + accessToken);
  const response = await fetch(apiUrl(path), { ...init, headers });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data ? String((data as {error:unknown}).error) : String(data || "Request failed.");
    throw new Error(message);
  }
  return data as T;
}
export function apiConfigured(): boolean {
  return Boolean(apiBase && import.meta.env.VITE_API_BASE_URL);
}
