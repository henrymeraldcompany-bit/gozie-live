import { useEffect, useRef } from "react";
import type { RemoteTrack } from "livekit-client";
import { Track } from "livekit-client";

export default function TrackRenderer({ track, label }: { track: RemoteTrack; label?: string }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    const element = track.kind === Track.Kind.Video ? document.createElement("video") : document.createElement("audio");
    if (track.kind === Track.Kind.Video) {
      (element as HTMLVideoElement).autoplay = true;
      (element as HTMLVideoElement).playsInline = true;
      (element as HTMLVideoElement).muted = true;
    } else {
      (element as HTMLAudioElement).autoplay = true;
    }
    track.attach(element);
    const target = ref.current;
    if (target) {
      target.replaceWith(element);
      (element as HTMLVideoElement & HTMLAudioElement).dataset.track = "livekit";
      if (label) element.setAttribute("aria-label", label);
    }
    return () => { track.detach(element); element.remove(); };
  }, [track, label]);
  return <span ref={ref as React.RefObject<HTMLVideoElement & HTMLAudioElement>} className="track-mount" />;
}
