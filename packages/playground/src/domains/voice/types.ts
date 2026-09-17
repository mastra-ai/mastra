import type {
  VoiceCallStatus,
  VoiceAgentState,
  VoiceCaptionSegment,
} from '@mastra/playground-ui/components/ai/voice-call';
export type {
  VoiceCallStatus,
  VoiceAgentState,
  VoiceCaptionSegment,
} from '@mastra/playground-ui/components/ai/voice-call';

export interface LiveKitConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
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
