import { createContext } from 'react';

import type { TranscriptState } from '../services/transcript';

export type ChatRuntimeApi = Pick<
  TranscriptState,
  | 'usage'
  | 'followUpCount'
  | 'omProgress'
  | 'omPhase'
  | 'bufferingMessages'
  | 'bufferingObservations'
  | 'goal'
  | 'tokensPerSec'
>;

export const ChatRuntimeContext = createContext<ChatRuntimeApi | null>(null);
