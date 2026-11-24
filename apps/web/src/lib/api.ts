import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
export const apiUrl = (path: string) => apiBase ? apiBase + path : path;
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBase) {
    throw new Error("The GOZIE LIVE API is not connected yet. Configure VITE_API_BASE_URL in the GitHub Actions repository variables after deploying the API Worker.");
  }

  const headers = new Headers(init.headers);
  const isForm = init.body instanceof FormData;
  if (!isForm && init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const auth = await getSupabase()?.auth.getSession();
  const accessToken = auth?.data.session?.access_token;
  if (accessToken) headers.set("authorization", "Bearer " + accessToken);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new Error("Could not reach the GOZIE LIVE API. Check the Worker deployment and network connection.");
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data
      ? String((data as { error: unknown }).error)
      : String(data || "Request failed.");
    throw new Error(message);
  }
  return data as T;
}

export function apiConfigured(): boolean {
  return Boolean(apiBase);
}

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}
