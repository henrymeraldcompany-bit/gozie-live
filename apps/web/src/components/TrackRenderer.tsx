import { useEffect, useRef } from "react";
import type { RemoteTrack } from "livekit-client";
import { Track } from "livekit-client";

export default function TrackRenderer({ track, label }: { track: RemoteTrack; label?: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mount = container.current;
    if (!mount) return;
    const element = track.kind === Track.Kind.Video ? document.createElement("video") : document.createElement("audio");
    if (track.kind === Track.Kind.Video) {
      const video = element as HTMLVideoElement;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
    } else {
      (element as HTMLAudioElement).autoplay = true;
    }
    if (label) element.setAttribute("aria-label", label);
    mount.appendChild(element);
    track.attach(element);
    return () => {
      track.detach(element);
      element.remove();
    };
  }, [track, label]);
  return <div ref={container} className="track-mount" />;
}
