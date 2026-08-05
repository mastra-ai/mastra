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
  start: () => void;
  stop: () => void;
}
