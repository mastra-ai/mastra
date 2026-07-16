export interface LiveKitConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}

export type VoiceCallStatus = 'idle' | 'connecting' | 'active';

export type VoiceAgentState = 'initializing' | 'listening' | 'thinking' | 'speaking';

export interface VoiceCaptionSegment {
  id: string;
  role: 'user' | 'agent';
  text: string;
  final: boolean;
}

export interface VoiceCallControls {
  status: VoiceCallStatus;
  agentState: VoiceAgentState;
  captions: VoiceCaptionSegment[];
  /**
   * True when the server reports that Studio's default LiveKit connection route is not
   * registered: start() is a no-op and the UI shows setup guidance instead. Stays false
   * while availability is unknown (loading, legacy servers, failed capability request)
   * so calls fail open.
   */
  liveKitUnavailable: boolean;
  start: () => void;
  stop: () => void;
}
