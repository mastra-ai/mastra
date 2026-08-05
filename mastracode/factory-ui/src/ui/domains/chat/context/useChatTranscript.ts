import { useContext } from 'react';

import { ChatTranscriptContext } from './ChatTranscriptContext';
import type { ChatTranscriptApi } from './ChatTranscriptContext';

export function useChatTranscript(): ChatTranscriptApi {
  const ctx = useContext(ChatTranscriptContext);
  if (!ctx) throw new Error('useChatTranscript must be used within a ChatTranscriptContext');
  return ctx;
}
