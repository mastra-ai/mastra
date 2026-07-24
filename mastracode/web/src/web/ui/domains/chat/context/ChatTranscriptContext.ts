import { createContext } from 'react';

import type { SessionStateSnapshot } from '../hooks/useAgentControllerTranscript';
import type { OutgoingFile, TranscriptState } from '../services/transcript';

/** Older-history load-more state, surfaced to the transcript scroll UI. */
export interface LoadMoreHistory {
  /** Whether older history may still exist beyond what is loaded. */
  hasMore: boolean;
  /** Whether an older-history fetch is currently in flight. */
  isLoading: boolean;
  /** Grow the history window and prepend the older messages, if available. */
  load?: () => void;
}

export interface ChatTranscriptApi {
  transcript: TranscriptState;
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean, files?: OutgoingFile[]) => void;
  reset: (threadId?: string, state?: SessionStateSnapshot) => void;
  resolvePrompt: (id: string) => void;
  clearPending: () => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
  loadMore: LoadMoreHistory;
}

export const ChatTranscriptContext = createContext<ChatTranscriptApi | null>(null);
