interface R2ObjectBody {
  body: ReadableStream<Uint8Array> | null;
  httpMetadata?: { contentType?: string; contentDisposition?: string };
}
interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | string, options?: { httpMetadata?: { contentType?: string; contentDisposition?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}
interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  APP_ORIGIN: string;
  ENGINE_SHARED_SECRET: string;
  MEDIA_BUCKET: R2Bucket;
}
interface AuthUser { id: string; email?: string; user_metadata?: Record<string, unknown>; }
interface SessionRow {
  id: string; owner_id: string; title: string; status: string; scheduled_at: string | null;
  contributor_code_hash: string; viewer_code_hash: string; ended_at?: string | null;
}
interface ContributorRow { id: string; display_name: string; status: string; audio_muted: boolean; provider_identity: string | null; }
interface AssetRow { id: string; asset_kind: string; object_key: string; content_type: string; file_name?: string; created_at: string; }
const encoder = new TextEncoder();
const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...Object.fromEntries(new Headers(headers).entries()) } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const nowIso = () => new Date().toISOString();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const encodeText = (value: string) => b64url(encoder.encode(value));
const randomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return b64url(bytes);
};
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
function allowedOrigin(request: Request, env: Env): Headers {
  const origin = request.headers.get("origin") ?? "";
  const allowed = env.APP_ORIGIN && origin === env.APP_ORIGIN ? origin : "";
  return new Headers({
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type,X-Engine-Secret",
    "access-control-max-age": "86400",
    "vary": "Origin"
  });
}
function withCors(response: Response, cors: Headers): Response {
  const headers = new Headers(response.headers);
  cors.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function configReady(env: Env): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
}
async function db<T = unknown>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  if (!configReady(env)) throw new Error("Database is not configured. Add the Supabase URL, anon key, and service-role key as Worker secrets.");
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set("authorization", "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set("content-type", "application/json");
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, { ...init, headers });
  const body = await response.text();
  if (!response.ok) throw new Error("Database request failed (" + response.status + "): " + body.slice(0, 500));
  return (body ? JSON.parse(body) : null) as T;
}
async function authenticate(request: Request, env: Env): Promise<AuthUser> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Response("Sign-in required.", { status: 401 });
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: "Bearer " + token }
  });
  if (!response.ok) throw new Response("Your sign-in has expired. Sign in again.", { status: 401 });
  return await response.json() as AuthUser;
}
async function requireOwner(request: Request, env: Env, sessionId: string): Promise<{ user: AuthUser; session: SessionRow }> {
  const user = await authenticate(request, env);
  const rows = await db<SessionRow[]>(env, "broadcast_sessions?id=eq." + encodeURIComponent(sessionId) + "&owner_id=eq." + encodeURIComponent(user.id) + "&select=*&limit=1");
  if (!rows.length) throw new Response("Session not found.", { status: 404 });
  return { user, session: rows[0] };
}
async function liveKitToken(env: Env, input: {
  identity: string; name: string; room: string; canPublish: boolean; canSubscribe: boolean; ttlSeconds?: number;
}): Promise<string> {
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) throw new Error("LiveKit is not configured. Add LIVEKIT_API_KEY and LIVEKIT_API_SECRET as Worker secrets.");
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeText(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeText(JSON.stringify({
    iss: env.LIVEKIT_API_KEY,
    sub: input.identity,
    name: input.name.slice(0, 80),
    nbf: issuedAt - 5,
    iat: issuedAt,
    exp: issuedAt + (input.ttlSeconds ?? 21600),
    video: {
      room: input.room,
      roomJoin: true,
      canPublish: input.canPublish,
      canSubscribe: input.canSubscribe,
      canPublishData: false
    }
  }));
  const unsigned = header + "." + payload;
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.LIVEKIT_API_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned)));
  return unsigned + "." + b64url(signature);
}
async function jsonBody<T>(request: Request): Promise<T> {
  try { return await request.json() as T; } catch { throw new Response("A valid JSON request body is required.", { status: 400 }); }
}
function sessionRoom(id: string, suffix: "contributors" | "program"): string { return "gl-" + id + "-" + suffix; }
async function findSessionByCode(env: Env, code: string, type: "contributor" | "viewer"): Promise<SessionRow> {
  if (!code || code.length > 128) throw new Response("Invalid share code.", { status: 400 });
  const hash = await sha256(code);
  const column = type === "contributor" ? "contributor_code_hash" : "viewer_code_hash";
  const rows = await db<SessionRow[]>(env, "broadcast_sessions?" + column + "=eq." + hash + "&select=*&limit=1");
  if (!rows.length || rows[0].status === "ended" || rows[0].status === "failed") throw new Response("This session link is invalid or has expired.", { status: 404 });
  return rows[0];
}
async function issueOwnerTokens(env: Env, user: AuthUser, session: SessionRow) {
  const name = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Host");
  const [monitorToken, programToken] = await Promise.all([
    liveKitToken(env, { identity: "host-" + user.id, name, room: sessionRoom(session.id, "contributors"), canPublish: false, canSubscribe: true }),
    liveKitToken(env, { identity: "host-program-" + user.id, name, room: sessionRoom(session.id, "program"), canPublish: false, canSubscribe: true })
  ]);
  return { livekitUrl: env.LIVEKIT_URL, monitorToken, programToken, mediaEngine: "not-connected" };
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (path === "/health" && request.method === "GET") return json({ ok: true, service: "gozie-live-api", time: nowIso() });
  if (!configReady(env)) return fail("API database configuration is incomplete. Provision Supabase and set its Worker secrets.", 503);

  if (path === "/v1/sessions" && request.method === "GET") {
    const user = await authenticate(request, env);
    return json(await db(env, "broadcast_sessions?owner_id=eq." + encodeURIComponent(user.id) + "&select=id,title,status,scheduled_at,live_started_at,ended_at,created_at&order=created_at.desc&limit=50"));
  }
  if (path === "/v1/sessions" && request.method === "POST") {
    const user = await authenticate(request, env);
    const body = await jsonBody<{ title?: string; scheduledAt?: string | null }>(request);
    const title = (body.title ?? "").trim();
    if (!title || title.length > 120) return fail("Session title must be between 1 and 120 characters.");
    const displayName = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "GOZIE LIVE host").slice(0, 80);
    await db(env, "profiles?on_conflict=id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: user.id, display_name: displayName }) });
    const contributorCode = randomCode();
    const viewerCode = randomCode();
    const created = await db<SessionRow[]>(env, "broadcast_sessions", {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({
        owner_id: user.id, title, scheduled_at: body.scheduledAt || null, status: "scheduled",
        contributor_code_hash: await sha256(contributorCode), viewer_code_hash: await sha256(viewerCode)
      })
    });
    const session = created[0];
    return json({
      session,
      contributorCode,
      viewerCode,
      contributorUrl: new URL("/?mode=camera&code=" + encodeURIComponent(contributorCode), env.APP_ORIGIN).toString(),
      viewerUrl: new URL("/?mode=viewer&code=" + encodeURIComponent(viewerCode), env.APP_ORIGIN).toString()
    }, 201);
  }
  const joinContributor = path === "/v1/join/contributor";
  const joinViewer = path === "/v1/join/viewer";
  if (joinContributor && request.method === "POST") {
    const body = await jsonBody<{ code?: string; displayName?: string }>(request);
    const displayName = (body.displayName ?? "").trim();
    if (!displayName || displayName.length > 80) return fail("Enter a display name (maximum 80 characters).");
    const session = await findSessionByCode(env, body.code ?? "", "contributor");
    const identity = "cam-" + crypto.randomUUID();
    const rows = await db<ContributorRow[]>(env, "contributors", {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({ session_id: session.id, display_name: displayName, provider_identity: identity, status: "connected" })
    });
    const token = await liveKitToken(env, { identity, name: displayName, room: sessionRoom(session.id, "contributors"), canPublish: true, canSubscribe: false });
    return json({ session: { id: session.id, title: session.title }, contributor: rows[0], livekitUrl: env.LIVEKIT_URL, token }, 201);
  }
  if (joinViewer && request.method === "POST") {
    const body = await jsonBody<{ code?: string }>(request);
    const session = await findSessionByCode(env, body.code ?? "", "viewer");
    const identity = "viewer-" + crypto.randomUUID();
    const presence = await db<Array<{ id: string }>>(env, "viewer_presence", {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({ session_id: session.id, identity, expires_at: new Date(Date.now() + 60000).toISOString() })
    });
    const token = await liveKitToken(env, { identity, name: "Viewer", room: sessionRoom(session.id, "program"), canPublish: false, canSubscribe: true });
    return json({ session: { id: session.id, title: session.title, status: session.status }, presenceId: presence[0].id, livekitUrl: env.LIVEKIT_URL, token });
  }
  if (path === "/v1/viewer/heartbeat" && request.method === "POST") {
    const body = await jsonBody<{ presenceId?: string }>(request);
    if (!body.presenceId) return fail("Presence ID required.");
    await db(env, "viewer_presence?id=eq." + encodeURIComponent(body.presenceId), {
      method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ expires_at: new Date(Date.now() + 60000).toISOString(), last_seen_at: nowIso() })
    });
    return json({ ok: true });
  }

  const sessionMatch = path.match(/^\/v1\/sessions\/([0-9a-f-]+)(?:\/(.*))?$/i);
  if (sessionMatch) {
    const id = sessionMatch[1];
    const action = sessionMatch[2] ?? "";
    const { user, session } = await requireOwner(request, env, id);
    if (!action && request.method === "GET") {
      const [contributors, assets, recordings, viewers] = await Promise.all([
        db<ContributorRow[]>(env, "contributors?session_id=eq." + id + "&status=neq.removed&select=id,display_name,status,audio_muted,provider_identity,created_at&order=created_at.asc"),
        db<AssetRow[]>(env, "media_assets?session_id=eq." + id + "&select=id,asset_kind,content_type,file_name,created_at&order=created_at.desc"),
        db<Array<{ id: string; created_at: string; expires_at: string; deleted_at: string | null; size_bytes: number | null }>>(env, "recordings?session_id=eq." + id + "&select=id,created_at,expires_at,deleted_at,size_bytes&order=created_at.desc"),
        db<Array<{ id: string }>>(env, "viewer_presence?session_id=eq." + id + "&expires_at=gt." + encodeURIComponent(nowIso()) + "&select=id")
      ]);
      return json({ session, contributors, assets, recordings, viewerCount: viewers.length, mediaEngine: "not-connected" });
    }
    if (action === "owner-tokens" && request.method === "POST") return json(await issueOwnerTokens(env, user, session));
    if (action === "start" && request.method === "POST") {
      if (session.status === "ended") return fail("An ended session cannot be restarted.", 409);
      const updated = await db<SessionRow[]>(env, "broadcast_sessions?id=eq." + id, {
        method: "PATCH", headers: { prefer: "return=representation" },
        body: JSON.stringify({ status: "live", live_started_at: nowIso() })
      });
      return json({ session: updated[0], mediaEngine: "not-connected", broadcastOutput: "offline-until-engine-deployed" });
    }
    if (action === "end" && request.method === "POST") {
      const endedAt = nowIso();
      const updated = await db<SessionRow[]>(env, "broadcast_sessions?id=eq." + id, {
        method: "PATCH", headers: { prefer: "return=representation" },
        body: JSON.stringify({ status: "ended", ended_at: endedAt })
      });
      return json({ session: updated[0], recordingRetentionUntil: new Date(Date.now() + 7 * 86400000).toISOString(), mediaEngine: "not-connected" });
    }
    if (action === "production" && request.method === "POST") {
      const body = await jsonBody<{ command?: string; payload?: Record<string, unknown> }>(request);
      const allowed = new Set(["select-source", "mute-contributor", "set-audio-mix", "set-media-source", "start-recording", "stop-recording"]);
      if (!body.command || !allowed.has(body.command)) return fail("Unsupported production command.");
      const inserted = await db<Array<{ id: string }>>(env, "production_commands", {
        method: "POST", headers: { prefer: "return=representation" },
        body: JSON.stringify({ session_id: id, requested_by: user.id, command_type: body.command, payload: body.payload ?? {}, status: "pending" })
      });
      return json({ commandId: inserted[0].id, accepted: true, applied: false, mediaEngine: "not-connected", message: "Saved for the production engine. It has not been applied to a live programme." }, 202);
    }
    if (action === "assets" && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return fail("Choose an image, video, or audio file.");
      if (file.size > 100 * 1024 * 1024) return fail("This upload is over the 100 MB starter limit. Large uploads need direct multipart R2 upload.", 413);
      const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "";
      if (!type) return fail("Only image, video, and audio media files are accepted.");
      const objectKey = "sessions/" + id + "/assets/" + crypto.randomUUID();
      await env.MEDIA_BUCKET.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, contentDisposition: "inline" } });
      try {
        const inserted = await db<AssetRow[]>(env, "media_assets", {
          method: "POST", headers: { prefer: "return=representation" },
          body: JSON.stringify({ session_id: id, owner_id: user.id, asset_kind: type, object_key: objectKey, content_type: file.type, file_name: file.name.slice(0, 180), size_bytes: file.size })
        });
        return json({ asset: { ...inserted[0], size_bytes: file.size }, mediaEngine: "not-connected" }, 201);
      } catch (error) { await env.MEDIA_BUCKET.delete(objectKey); throw error; }
    }
    if (action === "recordings" && request.method === "GET") {
      return json(await db(env, "recordings?session_id=eq." + id + "&deleted_at=is.null&select=id,created_at,expires_at,size_bytes&order=created_at.desc"));
    }
    if (action.startsWith("assets/") && action.endsWith("/file") && request.method === "GET") {
      const assetId = action.split("/")[1];
      const rows = await db<AssetRow[]>(env, "media_assets?id=eq." + encodeURIComponent(assetId) + "&session_id=eq." + id + "&select=*&limit=1");
      if (!rows.length) return fail("Asset not found.", 404);
      const object = await env.MEDIA_BUCKET.get(rows[0].object_key);
      if (!object?.body) return fail("Asset file is unavailable.", 404);
      return new Response(object.body, { headers: { "content-type": rows[0].content_type, "cache-control": "private, no-store", "content-disposition": "inline" } });
    }
  }

  if (path === "/v1/internal/recordings" && request.method === "POST") {
    if (!env.ENGINE_SHARED_SECRET || request.headers.get("x-engine-secret") !== env.ENGINE_SHARED_SECRET) return fail("Not authorized.", 401);
    const body = await jsonBody<{ sessionId?: string; objectKey?: string; sizeBytes?: number; durationSeconds?: number }>(request);
    if (!body.sessionId || !body.objectKey || !body.objectKey.startsWith("sessions/" + body.sessionId + "/recordings/")) return fail("Recording metadata is invalid.");
    const sessions = await db<SessionRow[]>(env, "broadcast_sessions?id=eq." + encodeURIComponent(body.sessionId) + "&select=*&limit=1");
    if (!sessions.length || sessions[0].status !== "ended") return fail("Recording can only be finalized after the session ends.", 409);
    const endedAt = sessions[0].ended_at ? new Date(sessions[0].ended_at) : new Date();
    const expiresAt = new Date(endedAt.getTime() + 7 * 86400000).toISOString();
    const inserted = await db(env, "recordings", {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({ session_id: body.sessionId, object_key: body.objectKey, size_bytes: body.sizeBytes ?? null, duration_seconds: body.durationSeconds ?? null, expires_at: expiresAt })
    });
    return json({ recording: inserted, expiresAt }, 201);
  }

  const publicRecording = path.match(/^\/v1\/public\/recordings\/([0-9a-f-]+)$/i);
  if (publicRecording && request.method === "GET") {
    const code = url.searchParams.get("code") ?? "";
    const hash = await sha256(code);
    const records = await db<Array<{ id: string; session_id: string; object_key: string; expires_at: string; deleted_at: string | null }>>(env, "recordings?id=eq." + encodeURIComponent(publicRecording[1]) + "&select=*&limit=1");
    if (!records.length || records[0].deleted_at || new Date(records[0].expires_at).getTime() <= Date.now()) return fail("Recording is no longer available.", 404);
    const sessions = await db<SessionRow[]>(env, "broadcast_sessions?id=eq." + records[0].session_id + "&viewer_code_hash=eq." + hash + "&select=id&limit=1");
    if (!sessions.length) return fail("Invalid viewer link.", 403);
    const object = await env.MEDIA_BUCKET.get(records[0].object_key);
    if (!object?.body) return fail("Recording file is unavailable.", 404);
    return new Response(object.body, { headers: { "content-type": "video/mp4", "content-disposition": "attachment", "cache-control": "private, no-store" } });
  }
  return fail("Route not found.", 404);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = allowedOrigin(request, env);
    try { return withCors(await handle(request, env), cors); }
    catch (error) {
      if (error instanceof Response) return withCors(error.headers.get("content-type")?.includes("json") ? error : json({ error: await error.text() }, error.status), cors);
      return withCors(json({ error: error instanceof Error ? error.message : "Unexpected API error." }, 500), cors);
    }
  },
  async scheduled(_controller: { scheduledTime: number; cron: string }, env: Env): Promise<void> {
    if (!configReady(env)) throw new Error("Cleanup job requires Supabase configuration.");
    const expired = await db<Array<{ id: string; object_key: string }>>(env, "recordings?expires_at=lte." + encodeURIComponent(nowIso()) + "&deleted_at=is.null&select=id,object_key&limit=100");
    for (const recording of expired) {
      await env.MEDIA_BUCKET.delete(recording.object_key);
      await db(env, "recordings?id=eq." + recording.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ deleted_at: nowIso() }) });
    }
  }
};
