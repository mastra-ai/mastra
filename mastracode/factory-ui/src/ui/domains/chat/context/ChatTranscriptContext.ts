import { createContext } from 'react';

import type { ChatSessionPhase } from '../../workspaces/services/sessionStatus';
import type { SessionStateSnapshot } from '../services/runtime';
import type { OutgoingFile, TranscriptState } from '../services/transcript';

export interface LoadMoreHistory {
  hasMore: boolean;
  isLoading: boolean;
  load?: () => void;
}

export interface ChatTranscriptApi {
  transcript: TranscriptState;
  viewerId?: string;
  busy: boolean;
  phase: ChatSessionPhase | undefined;
  /** Session metadata or the thread's first message window is still loading; locks the composer. */
  initializing: boolean;
  /** The thread's first message window is still loading or merging; the transcript is not ready to show. */
  loadingHistory: boolean;
  initialHistoryReady: boolean;
  localUser: (text: string, steer?: boolean, files?: OutgoingFile[]) => string;
  failLocalUser: (id: string) => void;
  reset: (threadId?: string, state?: SessionStateSnapshot) => void;
  resolvePrompt: (id: string) => void;
  clearPending: () => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
  loadMore: LoadMoreHistory;
}

export const ChatTranscriptContext = createContext<ChatTranscriptApi | null>(null);
