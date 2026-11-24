import { STATIC_ASSETS_GZIP_B64 } from "./generated-assets.js";
const enc = new TextEncoder();
const now = () => new Date().toISOString();
let appAssetsPromise = null;
async function serveAppAsset(pathname) {
    if (!appAssetsPromise) {
        appAssetsPromise = (async () => { const raw = atob(STATIC_ASSETS_GZIP_B64); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++)
            bytes[i] = raw.charCodeAt(i); const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")); return JSON.parse(await new Response(stream).text()); })();
    }
    const assets = await appAssetsPromise;
    const requested = pathname === "/" || pathname === "" ? "/index.html" : pathname;
    let key = requested;
    if (!(key in assets)) {
        if (key.startsWith("/assets/"))
            return new Response("Not found.", { status: 404 });
        key = "/index.html";
    }
    const type = key.endsWith(".html") ? "text/html; charset=utf-8" : key.endsWith(".js") ? "text/javascript; charset=utf-8" : key.endsWith(".css") ? "text/css; charset=utf-8" : key.endsWith(".svg") ? "image/svg+xml" : key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "application/octet-stream";
    return new Response(assets[key], { headers: { "content-type": type, "cache-control": key === "/index.html" ? "no-cache" : "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
const uuid = () => crypto.randomUUID();
const hex = (b) => [...b].map(x => x.toString(16).padStart(2, "0")).join("");
const random = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function hash(s) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))); }
function equal(a, b) { if (a.length !== b.length)
    return false; let x = 0; for (let i = 0; i < a.length; i++)
    x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
async function passHash(password, salt = random(16)) { const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 310000, hash: "SHA-256" }, key, 256); return salt + ":" + hex(new Uint8Array(bits)); }
async function passCheck(password, stored) { const [salt] = stored.split(":"); return !!salt && equal(await passHash(password, salt), stored); }
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...Object.fromEntries(new Headers(headers).entries()) } });
const fail = (message, status = 400) => json({ error: message }, status);
function cookie(req) { for (const part of (req.headers.get("cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "gl_session")
        return v.join("=");
} return ""; }
function setCookie(v, age) { return "gl_session=" + v + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + age; }
async function input(req) { try {
    return await req.json();
}
catch {
    throw new Response("Invalid JSON body.", { status: 400 });
} }
function appUrl(env, params) { const base = (env.APP_BASE_PATH || "/").startsWith("/") ? env.APP_BASE_PATH : "/" + env.APP_BASE_PATH; const u = new URL(base, env.APP_ORIGIN); u.search = new URLSearchParams(params).toString(); return u.toString(); }
async function auth(req, env) { const raw = cookie(req); if (!raw)
    throw new Response("Sign in to continue.", { status: 401 }); const row = await env.DB.prepare("SELECT u.id,u.email,u.display_name,u.email_verified FROM auth_sessions a JOIN users u ON u.id=a.user_id WHERE a.id=? AND a.expires_at>?").bind(await hash(raw), now()).first(); if (!row)
    throw new Response("Session expired. Sign in again.", { status: 401 }); if (!row.email_verified)
    throw new Response("Verify your email before signing in.", { status: 403 }); return row; }
async function owner(req, env, id) { const user = await auth(req, env); const session = await env.DB.prepare("SELECT * FROM broadcast_sessions WHERE id=? AND owner_id=?").bind(id, user.id).first(); if (!session)
    throw new Response("Session not found.", { status: 404 }); return { user, session }; }
async function sfu(env, path, method = "POST", data) { if (!env.REALTIME_SFU_APP_ID || !env.REALTIME_SFU_APP_SECRET)
    throw new Response("Cloudflare Realtime SFU is not configured.", { status: 503 }); const r = await fetch("https://rtc.live.cloudflare.com/v1/apps/" + env.REALTIME_SFU_APP_ID + path, { method, headers: { authorization: "Bearer " + env.REALTIME_SFU_APP_SECRET, "content-type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) }); const t = await r.text(); let d = {}; try {
    d = t ? JSON.parse(t) : {};
}
catch {
    d = { error: t };
} if (!r.ok)
    throw new Error("Realtime SFU error " + r.status + ": " + String(d.error || t).slice(0, 350)); return d; }
async function byCode(env, code, type) { if (!code || code.length > 160)
    throw new Response("Invalid share link.", { status: 400 }); const col = type === "viewer" ? "viewer_code_hash" : "contributor_code_hash"; const s = await env.DB.prepare("SELECT * FROM broadcast_sessions WHERE " + col + "=?").bind(await hash(code)).first(); if (!s || s.status === "ended")
    throw new Response("Share link invalid or expired.", { status: 404 }); return s; }
function room(env, id) { return env.SESSION_ROOMS.get(env.SESSION_ROOMS.idFromName(id)); }
async function roomPost(env, sid, action, data) { return room(env, sid).fetch(new Request("https://session/" + action, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) })); }
async function handle(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/\/$/, "") || "/", method = req.method;
    if (path === "/health") {
        let database = "unavailable";
        try {
            const probe = await env.DB.prepare("SELECT 1 AS ok").first();
            database = probe?.ok === 1 ? "connected" : "error";
        }
        catch {
            database = "error";
        }
        const status = {
            ok: database === "connected",
            service: "GOZIE LIVE",
            database,
            r2: env.MEDIA_BUCKET ? "configured" : "missing",
            realtimeSfu: env.REALTIME_SFU_APP_SECRET ? "configured" : "needs-worker-secret",
            emailVerification: env.EMAIL && env.EMAIL_FROM ? "configured" : "needs-sending-domain-and-email-binding",
            time: now()
        };
        return json(status, status.ok ? 200 : 503);
    }
    if (path === "/v1/auth/register" && method === "POST") {
        const x = await input(req), email = (x.email || "").trim().toLowerCase(), name = (x.displayName || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
            return fail("Enter a valid email.");
        if (name.length < 2 || name.length > 80)
            return fail("Display name must be 2–80 characters.");
        if ((x.password || "").length < 10)
            return fail("Password must be at least 10 characters.");
        if (!env.EMAIL || !env.EMAIL_FROM)
            return fail("Email verification is not active yet. Onboard a sending domain in Cloudflare Email Service first.", 503);
        if (await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first())
            return fail("An account already exists for this email.", 409);
        const userId = uuid();
        await env.DB.prepare("INSERT INTO users(id,email,password_hash,display_name,email_verified) VALUES(?,?,?,?,0)").bind(userId, email, await passHash(x.password), name).run();
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0"), digest = await hash(email + ":" + code + ":" + env.AUTH_SIGNING_SECRET), expires = new Date(Date.now() + 900000).toISOString();
        await env.DB.prepare("INSERT OR REPLACE INTO email_verification_codes(email,code_hash,expires_at,attempts) VALUES(?,?,?,0)").bind(email, digest, expires).run();
        try {
            await env.EMAIL.send({ to: email, from: env.EMAIL_FROM, subject: "Verify your GOZIE LIVE account", text: "Your verification code is " + code + ". It expires in 15 minutes.", html: "<p>Your GOZIE LIVE verification code:</p><h2>" + code + "</h2><p>Expires in 15 minutes.</p>" });
        }
        catch {
            await env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId).run();
            await env.DB.prepare("DELETE FROM email_verification_codes WHERE email=?").bind(email).run();
            return fail("Cloudflare Email Service rejected the sender. Check the sending domain and EMAIL_FROM setting.", 503);
        }
        return json({ ok: true, message: "Verification code sent." }, 201);
    }
    if (path === "/v1/auth/verify" && method === "POST") {
        const x = await input(req), email = (x.email || "").trim().toLowerCase(), code = (x.code || "").trim();
        const row = await env.DB.prepare("SELECT code_hash,expires_at,attempts FROM email_verification_codes WHERE email=?").bind(email).first();
        if (!row || row.expires_at < now() || row.attempts >= 5)
            return fail("Verification code expired. Register again.", 400);
        if (!/^\d{6}$/.test(code) || !equal(row.code_hash, await hash(email + ":" + code + ":" + env.AUTH_SIGNING_SECRET))) {
            await env.DB.prepare("UPDATE email_verification_codes SET attempts=attempts+1 WHERE email=?").bind(email).run();
            return fail("Incorrect verification code.", 400);
        }
        await env.DB.batch([env.DB.prepare("UPDATE users SET email_verified=1 WHERE email=?").bind(email), env.DB.prepare("DELETE FROM email_verification_codes WHERE email=?").bind(email)]);
        return json({ ok: true, message: "Email verified. You can sign in." });
    }
    if (path === "/v1/auth/login" && method === "POST") {
        const x = await input(req), u = await env.DB.prepare("SELECT id,email,password_hash,email_verified FROM users WHERE email=?").bind((x.email || "").trim().toLowerCase()).first();
        if (!u || !await passCheck(x.password || "", u.password_hash))
            return fail("Email or password is incorrect.", 401);
        if (!u.email_verified)
            return fail("Verify your email before signing in.", 403);
        const raw = random(), expires = new Date(Date.now() + 30 * 86400000).toISOString();
        await env.DB.prepare("INSERT INTO auth_sessions(id,user_id,expires_at) VALUES(?,?,?)").bind(await hash(raw), u.id, expires).run();
        return json({ ok: true, email: u.email }, 200, { "set-cookie": setCookie(raw, 2592000) });
    }
    if (path === "/v1/auth/session" && method === "GET") {
        const u = await auth(req, env);
        return json({ user: { id: u.id, email: u.email, displayName: u.display_name } });
    }
    if (path === "/v1/auth/logout" && method === "POST") {
        const raw = cookie(req);
        if (raw)
            await env.DB.prepare("DELETE FROM auth_sessions WHERE id=?").bind(await hash(raw)).run();
        return json({ ok: true }, 200, { "set-cookie": setCookie("", 0) });
    }
    if (path === "/v1/sessions" && method === "GET") {
        const u = await auth(req, env);
        return json((await env.DB.prepare("SELECT id,title,status,scheduled_at,live_started_at,ended_at,created_at FROM broadcast_sessions WHERE owner_id=? ORDER BY created_at DESC LIMIT 50").bind(u.id).all()).results);
    }
    if (path === "/v1/sessions" && method === "POST") {
        const u = await auth(req, env), x = await input(req), title = (x.title || "").trim();
        if (!title || title.length > 120)
            return fail("Session title must be 1–120 characters.");
        const sid = uuid(), contributorCode = random(), viewerCode = random();
        await env.DB.prepare("INSERT INTO broadcast_sessions(id,owner_id,title,status,scheduled_at,contributor_code_hash,viewer_code_hash,public_id) VALUES(?,?,?,'scheduled',?,?,?,?)").bind(sid, u.id, title, x.scheduledAt || null, await hash(contributorCode), await hash(viewerCode), random(12)).run();
        return json({ session: { id: sid, title, status: "scheduled", scheduled_at: x.scheduledAt || null }, contributorUrl: appUrl(env, { mode: "camera", code: contributorCode }), viewerUrl: appUrl(env, { mode: "viewer", code: viewerCode }) }, 201);
    }
    if (path === "/v1/join/contributor" && method === "POST") {
        const x = await input(req), s = await byCode(env, x.code || "", "contributor"), name = (x.displayName || "").trim();
        if (!name || name.length > 80)
            return fail("Enter a display name up to 80 characters.");
        const contributorId = uuid(), leaveSecret = random(), leaveHash = await hash(leaveSecret), admit = await roomPost(env, s.id, "admit", { contributorId, displayName: name, leaveSecretHash: leaveHash, maximum: 200 });
        if (!admit.ok)
            return fail("This session has reached its 200-camera limit.", 429);
        await env.DB.prepare("INSERT INTO contributors(id,session_id,display_name,status,last_seen_at,leave_secret_hash) VALUES(?,?,?,'connected',?,?)").bind(contributorId, s.id, name, now(), leaveHash).run();
        return json({ session: { id: s.id, title: s.title }, contributor: { id: contributorId, display_name: name }, leaveSecret }, 201);
    }
    if (path === "/v1/media/publish" && method === "POST") {
        const x = await input(req), s = await byCode(env, x.code, "contributor");
        const c = await env.DB.prepare("SELECT id,leave_secret_hash FROM contributors WHERE id=? AND session_id=?").bind(x.contributorId, s.id).first();
        if (!c || !equal(c.leave_secret_hash, await hash(x.leaveSecret || "")))
            return fail("Contributor access denied.", 403);
        if (!x.sessionDescription?.sdp || !Array.isArray(x.tracks) || !x.tracks.length || x.tracks.length > 2)
            return fail("Missing media offer or tracks.");
        const created = await sfu(env, "/sessions/new"), sfuId = created.sessionId;
        const result = await sfu(env, "/sessions/" + sfuId + "/tracks/new", "POST", { sessionDescription: x.sessionDescription, tracks: x.tracks.map(t => ({ location: "local", mid: t.mid, trackName: t.trackName })) });
        await env.DB.prepare("UPDATE contributors SET publisher_session_id=?,status='publishing',last_seen_at=? WHERE id=?").bind(sfuId, now(), c.id).run();
        await env.DB.batch(x.tracks.map(t => env.DB.prepare("INSERT OR REPLACE INTO contributor_publications(id,contributor_id,session_id,sfu_session_id,track_name,kind) VALUES(?,?,?,?,?,?)").bind(uuid(), c.id, s.id, sfuId, t.trackName, t.kind)));
        await roomPost(env, s.id, "publish", { contributorId: c.id, publisherSessionId: sfuId });
        return json({ sessionId: sfuId, sessionDescription: result.sessionDescription }, 201);
    }
    if (path === "/v1/contributors/presence" && method === "POST") {
        const x = await input(req), c = await env.DB.prepare("SELECT id,session_id,leave_secret_hash FROM contributors WHERE id=?").bind(x.contributorId).first();
        if (!c || !equal(c.leave_secret_hash, await hash(x.leaveSecret || "")))
            return fail("Invalid contributor presence credentials.", 403);
        await roomPost(env, c.session_id, x.leave ? "leave" : "heartbeat", { contributorId: c.id, leaveSecretHash: c.leave_secret_hash });
        await env.DB.prepare("UPDATE contributors SET status=?,last_seen_at=? WHERE id=?").bind(x.leave ? "disconnected" : "publishing", now(), c.id).run();
        return json({ ok: true });
    }
    if (path === "/v1/media/renegotiate" && method === "POST") {
        const x = await input(req), u = await auth(req, env);
        const sub = await env.DB.prepare("SELECT sfu_session_id FROM media_subscriptions WHERE id=? AND owner_id=?").bind(x.subscriptionId, u.id).first();
        if (!sub)
            return fail("Media subscription not found.", 404);
        await sfu(env, "/sessions/" + sub.sfu_session_id + "/renegotiate", "PUT", { sessionDescription: x.sessionDescription });
        return json({ ok: true });
    }
    const subscribe = path.match(/^\/v1\/sessions\/([0-9a-f-]+)\/subscribe$/i);
    if (subscribe && method === "POST") {
        const { user, session } = await owner(req, env, subscribe[1]), x = await input(req), ids = (x.contributorIds || []).slice(0, 12);
        if (!ids.length)
            return fail("Select cameras to preview.");
        const marks = ids.map(() => "?").join(","), rows = await env.DB.prepare("SELECT c.id,c.display_name,cp.sfu_session_id,cp.track_name,cp.kind FROM contributors c JOIN contributor_publications cp ON cp.contributor_id=c.id WHERE c.session_id=? AND c.status='publishing' AND c.id IN (" + marks + ") ORDER BY c.created_at").bind(session.id, ...ids).all();
        if (!rows.results.length)
            return fail("No active camera feeds are ready.", 409);
        const created = await sfu(env, "/sessions/new"), sid = created.sessionId, tracks = rows.results.map(r => ({ location: "remote", sessionId: r.sfu_session_id, trackName: r.track_name }));
        const result = await sfu(env, "/sessions/" + sid + "/tracks/new", "POST", { tracks }), subscriptionId = uuid();
        await env.DB.prepare("INSERT INTO media_subscriptions(id,session_id,owner_id,sfu_session_id) VALUES(?,?,?,?)").bind(subscriptionId, session.id, user.id, sid).run();
        return json({ subscriptionId, sessionId: sid, sessionDescription: result.sessionDescription, trackMap: rows.results.map((r, i) => ({ mid: result.tracks?.[i]?.mid, contributorId: r.id, displayName: r.display_name, trackName: r.track_name, kind: r.kind })) });
    }
    const sm = path.match(/^\/v1\/sessions\/([0-9a-f-]+)(?:\/(.*))?$/i);
    if (sm) {
        const { user, session } = await owner(req, env, sm[1]), action = sm[2] || "";
        if (!action && method === "GET") {
            const [cs, assets, recordings, viewers] = await Promise.all([
                env.DB.prepare("SELECT id,display_name,status,audio_muted,provider_identity,publisher_session_id,created_at FROM contributors WHERE session_id=? AND status!='removed' ORDER BY created_at").bind(session.id).all(),
                env.DB.prepare("SELECT id,asset_kind,content_type,file_name,created_at FROM media_assets WHERE session_id=? ORDER BY created_at DESC").bind(session.id).all(),
                env.DB.prepare("SELECT id,created_at,expires_at,deleted_at,size_bytes FROM recordings WHERE session_id=? AND deleted_at IS NULL AND expires_at>? ORDER BY created_at DESC").bind(session.id, now()).all(),
                env.DB.prepare("SELECT count(*) AS count FROM viewer_presence WHERE session_id=? AND expires_at>?").bind(session.id, now()).first()
            ]);
            const presence = await room(env, session.id).fetch(new Request("https://session/snapshot")), roomState = await presence.json();
            return json({ session, contributors: cs.results, assets: assets.results, recordings: recordings.results, viewerCount: viewers?.count || 0, activeCameraSlots: roomState.active || 0, mediaEngine: "camera-ingest" });
        }
        if (action === "share-links" && method === "POST") {
            const cc = random(), vc = random();
            await env.DB.prepare("UPDATE broadcast_sessions SET contributor_code_hash=?,viewer_code_hash=? WHERE id=?").bind(await hash(cc), await hash(vc), session.id).run();
            return json({ contributorUrl: appUrl(env, { mode: "camera", code: cc }), viewerUrl: appUrl(env, { mode: "viewer", code: vc }) });
        }
        if (action === "start" && method === "POST") {
            await env.DB.prepare("UPDATE broadcast_sessions SET status='live',live_started_at=? WHERE id=?").bind(now(), session.id).run();
            return json({ sessionId: session.id, mediaEngine: "camera-ingest-ready", programmeStatus: "not-configured", message: "Camera feeds can publish. The independent programme compositor is not deployed yet." }, 202);
        }
        if (action === "end" && method === "POST") {
            await env.DB.prepare("UPDATE broadcast_sessions SET status='ended',ended_at=? WHERE id=?").bind(now(), session.id).run();
            return json({ sessionId: session.id, mediaEngine: "ended", recordingAvailable: false, message: "Recording becomes available after the programme compositor is connected." });
        }
        if (action === "production" && method === "POST") {
            const x = await input(req), allowed = new Set(["select-source", "mute-contributor", "set-audio-mix", "set-media-source", "start-recording", "stop-recording"]);
            if (!allowed.has(x.command))
                return fail("Unsupported command.");
            await env.DB.prepare("INSERT INTO production_commands(id,session_id,requested_by,command_type,payload,status) VALUES(?,?,?,?,?,'pending')").bind(uuid(), session.id, user.id, x.command, JSON.stringify(x.payload || {})).run();
            if (x.command === "mute-contributor" && typeof x.payload?.contributorId === "string" && typeof x.payload?.muted === "boolean")
                await env.DB.prepare("UPDATE contributors SET audio_muted=? WHERE id=? AND session_id=?").bind(x.payload.muted ? 1 : 0, x.payload.contributorId, session.id).run();
            if (x.command === "set-audio-mix" && typeof x.payload?.muteAll === "boolean")
                await env.DB.prepare("UPDATE contributors SET audio_muted=? WHERE session_id=?").bind(x.payload.muteAll ? 1 : 0, session.id).run();
            return json({ accepted: true, applied: false, message: "Stored for the compositor. This command is not yet applied to a programme output." }, 202);
        }
        if (action === "assets" && method === "POST") {
            const form = await req.formData(), file = form.get("file");
            if (!(file instanceof File))
                return fail("Select a media file.");
            if (file.size > 100 * 1024 * 1024)
                return fail("Maximum upload size is 100 MB.", 413);
            const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "";
            if (!kind)
                return fail("Only image, video and audio files are accepted.");
            const key = "sessions/" + session.id + "/assets/" + uuid(), aid = uuid();
            await env.MEDIA_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
            await env.DB.prepare("INSERT INTO media_assets(id,session_id,owner_id,asset_kind,object_key,content_type,file_name,size_bytes) VALUES(?,?,?,?,?,?,?,?)").bind(aid, session.id, user.id, kind, key, file.type, file.name.slice(0, 180), file.size).run();
            return json({ asset: { id: aid, asset_kind: kind, content_type: file.type, file_name: file.name } }, 201);
        }
        if (action.startsWith("assets/") && action.endsWith("/file") && method === "GET") {
            const aid = action.split("/")[1], a = await env.DB.prepare("SELECT object_key,content_type FROM media_assets WHERE id=? AND session_id=?").bind(aid, session.id).first();
            if (!a)
                return fail("Asset not found.", 404);
            const obj = await env.MEDIA_BUCKET.get(a.object_key);
            if (!obj?.body)
                return fail("Asset missing.", 404);
            return new Response(obj.body, { headers: { "content-type": a.content_type, "cache-control": "private,no-store" } });
        }
    }
    if (path === "/v1/public/session" && method === "GET") {
        const s = await byCode(env, url.searchParams.get("code") || "", "viewer"), recs = await env.DB.prepare("SELECT id,expires_at,size_bytes FROM recordings WHERE session_id=? AND deleted_at IS NULL AND expires_at>?").bind(s.id, now()).all();
        return json({ session: { id: s.id, title: s.title, status: s.status, scheduled_at: s.scheduled_at, ended_at: s.ended_at }, recordings: recs.results, programmeAvailable: Boolean(s.programme_uid) });
    }
    if (path === "/v1/recordings/download" && method === "GET") {
        const u = await auth(req, env), rid = url.searchParams.get("id") || "", r = await env.DB.prepare("SELECT rec.object_key FROM recordings rec JOIN broadcast_sessions s ON s.id=rec.session_id WHERE rec.id=? AND s.owner_id=? AND rec.deleted_at IS NULL AND rec.expires_at>?").bind(rid, u.id, now()).first();
        if (!r)
            return fail("Recording unavailable.", 404);
        const obj = await env.MEDIA_BUCKET.get(r.object_key);
        if (!obj?.body)
            return fail("Recording file missing.", 404);
        return new Response(obj.body, { headers: { "content-type": "video/mp4", "content-disposition": "attachment", "cache-control": "private,no-store" } });
    }
    return fail("Not found.", 404);
}
export class SessionRoom {
    state;
    constructor(state) { this.state = state; state.blockConcurrencyWhile(async () => { state.storage.sql.exec("CREATE TABLE IF NOT EXISTS participants(id TEXT PRIMARY KEY,display_name TEXT NOT NULL,leave_hash TEXT NOT NULL,status TEXT NOT NULL,last_seen INTEGER NOT NULL,publisher_session_id TEXT)"); }); }
    async fetch(req) {
        const p = new URL(req.url).pathname, stamp = Date.now();
        if (req.method === "GET" && p === "/snapshot") {
            this.state.storage.sql.exec("UPDATE participants SET status='disconnected' WHERE status IN ('connected','publishing') AND last_seen<?", stamp - 60000);
            const rows = this.state.storage.sql.exec("SELECT id,display_name,status,publisher_session_id FROM participants WHERE status IN ('connected','publishing')").toArray();
            return json({ active: rows.length, participants: rows });
        }
        if (req.method !== "POST")
            return fail("Method not allowed.", 405);
        const x = await req.json();
        if (p === "/admit") {
            this.state.storage.sql.exec("UPDATE participants SET status='disconnected' WHERE status IN ('connected','publishing') AND last_seen<?", stamp - 60000);
            const found = this.state.storage.sql.exec("SELECT id FROM participants WHERE id=?", x.contributorId).toArray();
            if (!found.length) {
                const n = this.state.storage.sql.exec("SELECT count(*) AS n FROM participants WHERE status IN ('connected','publishing')").one();
                if (n.n >= 200)
                    return fail("The session has reached its 200-camera limit.", 429);
            }
            this.state.storage.sql.exec("INSERT OR REPLACE INTO participants(id,display_name,leave_hash,status,last_seen,publisher_session_id) VALUES(?,?,?,'connected',?,NULL)", x.contributorId, x.displayName, x.leaveSecretHash, stamp);
            return json({ ok: true });
        }
        if (p === "/heartbeat" || p === "/leave") {
            const row = this.state.storage.sql.exec("SELECT leave_hash FROM participants WHERE id=?", x.contributorId).one();
            if (!row || !equal(row.leave_hash, x.leaveSecretHash || ""))
                return fail("Invalid presence token.", 403);
            this.state.storage.sql.exec("UPDATE participants SET status=?,last_seen=? WHERE id=?", p === "/leave" ? "disconnected" : "connected", stamp, x.contributorId);
            return json({ ok: true });
        }
        if (p === "/publish") {
            this.state.storage.sql.exec("UPDATE participants SET status='publishing',last_seen=?,publisher_session_id=? WHERE id=?", stamp, x.publisherSessionId, x.contributorId);
            return json({ ok: true });
        }
        return fail("Unknown session operation.", 404);
    }
}
export default {
    async fetch(req, env) {
        try {
            const original = new URL(req.url), p = original.pathname;
            if (p === "/gozie-live")
                return Response.redirect(new URL("/gozie-live/", original), 308);
            const res = await handle(req, env);
            if (res.status !== 404 || p.startsWith("/v1/") || p === "/health")
                return res;
            const assetUrl = new URL(req.url);
            if (assetUrl.pathname === "/gozie-live/" || assetUrl.pathname.startsWith("/gozie-live/")) {
                assetUrl.pathname = assetUrl.pathname.slice("/gozie-live".length) || "/";
            }
            else if (assetUrl.pathname !== "/") {
                return res;
            }
            return serveAppAsset(assetUrl.pathname);
        }
        catch (e) {
            if (e instanceof Response)
                return e;
            return json({ error: e instanceof Error ? e.message : "Unexpected server error." }, 500);
        }
    },
    async scheduled(_controller, env) {
        const rows = await env.DB.prepare("SELECT id,object_key FROM recordings WHERE expires_at<=? AND deleted_at IS NULL LIMIT 100").bind(now()).all();
        for (const r of rows.results) {
            await env.MEDIA_BUCKET.delete(r.object_key);
            await env.DB.prepare("UPDATE recordings SET deleted_at=? WHERE id=?").bind(now(), r.id).run();
        }
        await env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at<=?").bind(now()).run();
        await env.DB.prepare("DELETE FROM viewer_presence WHERE expires_at<=?").bind(now()).run();
    }
};
