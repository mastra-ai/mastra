/** A playback URL, normally signed with a short expiry by your storage provider. */
export interface LiveKitRecording {
  url: string;
  expiresAt?: string;
}

export type LiveKitRecordingResponse = ({ status: 'ready' } & LiveKitRecording) | { status: 'unavailable' };
