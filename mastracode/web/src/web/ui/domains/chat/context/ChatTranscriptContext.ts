import { createContext } from 'react';

import type { SessionStateSnapshot } from '../hooks/useAgentControllerTranscript';
import type { TranscriptState } from '../services/transcript';

export interface ChatTranscriptApi {
  transcript: TranscriptState;
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean) => void;
  syncState: (state: SessionStateSnapshot) => void;
  reset: (threadId?: string, state?: SessionStateSnapshot) => void;
  resolvePrompt: (id: string) => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

export const ChatTranscriptContext = createContext<ChatTranscriptApi | null>(null);
