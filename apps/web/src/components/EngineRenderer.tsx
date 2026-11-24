import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import type { RemoteTrack } from "livekit-client";
import { apiUrl } from "../lib/api";

type EngineContributor = { id: string; display_name: string; provider_identity: string | null; audio_muted: boolean };
type EngineAsset = { id: string; asset_kind: "image" | "video" | "audio"; content_type: string; file_name: string | null };
type EngineState = {
  sessionId: string;
  title: string;
  selectedSourceIdentity: string | null;
  asset: EngineAsset | null;
  contributors: EngineContributor[];
};
type AudioEntry = { identity: string; track: RemoteTrack };

function EngineAudio({ track, muted }: { track: RemoteTrack; muted: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = document.createElement("audio");
    element.autoplay = true;
    element.controls = false;
    element.muted = muted;
    element.setAttribute("playsinline", "true");
    mount.current?.appendChild(element);
    track.attach(element);
    return () => { track.detach(element); element.remove(); };
  }, [track]);
  useEffect(() => {
    const element = mount.current?.querySelector("audio");
    if (element) element.muted = muted;
  }, [muted]);
  return <div ref={mount} className="engine-audio-track" aria-hidden="true"/>;
}

export default function EngineRenderer() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("sessionId") ?? "";
  const controlCode = params.get("controlCode") ?? "";
  const livekitUrl = params.get("url") ?? "";
  const token = params.get("token") ?? "";
  const [state, setState] = useState<EngineState | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const stageVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let active = true;
    if (!sessionId || !controlCode || !livekitUrl || !token) {
      setError("The server-side egress template is missing its connection parameters.");
      return;
    }
    const nextRoom = new Room({ adaptiveStream: true, dynacast: false });
    const update = () => setRevision(value => value + 1);
    nextRoom.on(RoomEvent.TrackSubscribed, update);
    nextRoom.on(RoomEvent.TrackUnsubscribed, update);
    nextRoom.on(RoomEvent.ParticipantConnected, update);
    nextRoom.on(RoomEvent.ParticipantDisconnected, update);
    nextRoom.on(RoomEvent.Disconnected, () => {
      if (active) setConnected(false);
      console.log("END_RECORDING");
    });
    void nextRoom.connect(livekitUrl, token).then(() => {
      if (!active) { void nextRoom.disconnect(); return; }
      setRoom(nextRoom);
      setConnected(true);
      console.log("START_RECORDING");
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : "The egress recorder could not join the contributor room.");
    });
    return () => {
      active = false;
      console.log("END_RECORDING");
      void nextRoom.disconnect();
    };
  }, [sessionId, controlCode, livekitUrl, token]);

  useEffect(() => {
    let active = true;
    const readState = async () => {
      try {
        const query = "?sessionId=" + encodeURIComponent(sessionId) + "&controlCode=" + encodeURIComponent(controlCode);
        const response = await fetch(apiUrl("/v1/public/engine/state" + query), { cache: "no-store" });
        const data = await response.json() as EngineState & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not read production controls.");
        if (active) setState(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Production controls are unavailable.");
      }
    };
    void readState();
    const timer = window.setInterval(() => { void readState(); }, 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [sessionId, controlCode]);

  const participants = useMemo(() => room ? [...room.remoteParticipants.values()] : [], [room, revision]);
  const selectedParticipant = participants.find(participant => participant.identity === state?.selectedSourceIdentity);
  const selectedVideo = selectedParticipant
    ? [...selectedParticipant.videoTrackPublications.values()].find(publication => publication.track)?.track as RemoteTrack | undefined
    : undefined;
  const audioTracks: AudioEntry[] = [];
  for (const participant of participants) {
    for (const publication of participant.audioTrackPublications.values()) {
      if (publication.track) audioTracks.push({ identity: participant.identity, track: publication.track as RemoteTrack });
    }
  }
  const mutedIdentities = new Set((state?.contributors ?? []).filter(contributor => contributor.audio_muted && contributor.provider_identity).map(contributor => contributor.provider_identity as string));
  const assetUrl = state?.asset
    ? apiUrl("/v1/public/engine/assets/" + encodeURIComponent(state.asset.id) + "?sessionId=" + encodeURIComponent(sessionId) + "&controlCode=" + encodeURIComponent(controlCode))
    : "";

  useEffect(() => {
    if (!stageVideo.current || !selectedVideo || state?.asset?.asset_kind === "image" || state?.asset?.asset_kind === "video") return;
    selectedVideo.attach(stageVideo.current);
    return () => { if (stageVideo.current) selectedVideo.detach(stageVideo.current); };
  }, [selectedVideo, state?.asset?.asset_kind]);

  return <main className="engine-canvas">
    <div className="engine-programme">
      {state?.asset?.asset_kind === "image" && assetUrl
        ? <img className="engine-main-media" src={assetUrl} alt="Selected programme image"/>
        : state?.asset?.asset_kind === "video" && assetUrl
          ? <video className="engine-main-media" src={assetUrl} autoPlay loop playsInline/>
          : selectedVideo
            ? <video className="engine-main-media" ref={stageVideo} autoPlay playsInline muted/>
            : <div className="engine-no-picture">GOZIE LIVE · Waiting for a programme source</div>}
      {state?.asset?.asset_kind === "audio" && assetUrl && <audio className="engine-imported-audio" src={assetUrl} autoPlay loop/>}
      <div className="engine-lower-third"><span>GOZIE LIVE</span><b>{state?.title ?? "Live broadcast"}</b></div>
    </div>
    <div className="engine-audio-bus">
      {audioTracks.map(entry => <EngineAudio key={entry.identity + ":" + entry.track.sid} track={entry.track} muted={mutedIdentities.has(entry.identity)}/>)}
    </div>
    {!connected && <div className="engine-status">{error || "Connecting production renderer…"}</div>}
  </main>;
}
