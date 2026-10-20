import { useContext } from 'react';

import { ChatSessionContext } from '../context/ChatSessionContext';
import { ChatTranscriptContext } from '../context/ChatTranscriptContext';
import { RunErrorContinueButton } from './RunErrorContinueButton';

export function RunErrorContinueAction({ entryId }: { entryId: string }) {
  const session = useContext(ChatSessionContext);
  const transcript = useContext(ChatTranscriptContext);
  if (!session?.sessionEnabled || !transcript) return null;
  const latest = transcript.transcript.entries.at(-1);
  if (latest?.id !== entryId) return null;
  return <RunErrorContinueButton />;
}
