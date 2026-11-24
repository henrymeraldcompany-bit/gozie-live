export type SessionStatus = "scheduled" | "live" | "ended" | "failed";
export type ContributorStatus = "invited" | "connected" | "publishing" | "disconnected" | "removed";
export type ProgramSource = { kind: "camera"; participantId: string } | { kind: "image" | "video" | "audio"; assetId: string } | { kind: "offline" };
export interface BroadcastSession { id: string; title: string; startsAt: string | null; status: SessionStatus; }
export interface CameraContributor { id: string; displayName: string; status: ContributorStatus; audioMuted: boolean; }
