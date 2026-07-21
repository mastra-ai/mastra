import { createContext } from 'react';

import type { SessionStateSnapshot } from '../hooks/useAgentControllerTranscript';
import type { OutgoingFile, TranscriptState } from '../services/transcript';

export interface ChatTranscriptApi {
  transcript: TranscriptState;
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean, files?: OutgoingFile[]) => void;
  reset: (threadId?: string, state?: SessionStateSnapshot) => void;
  resolvePrompt: (id: string) => void;
  clearPending: () => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

export const ChatTranscriptContext = createContext<ChatTranscriptApi | null>(null);
