import { createContext } from 'react';

import type { TranscriptState } from '../services/transcript';

export interface ChatTranscriptApi {
  transcript: TranscriptState;
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean) => void;
  resolvePrompt: (id: string) => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

export const ChatTranscriptContext = createContext<ChatTranscriptApi | null>(null);
