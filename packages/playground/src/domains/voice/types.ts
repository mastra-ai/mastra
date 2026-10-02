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
  /** False only once the server has reported the connection route missing, so unknown availability still allows calls. */
  isLiveKitAvailable: boolean;
  start: () => void;
  stop: () => void;
}
