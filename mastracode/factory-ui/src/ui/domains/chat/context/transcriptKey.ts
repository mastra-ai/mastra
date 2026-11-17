import { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { threadPath } from '../../workspaces/services/factoryPaths';

interface TranscriptIdentity {
  sessionId: string;
  threadId?: string;
}

interface ThreadSession {
  sessionId: string;
  threadId: string;
}

const identityOf = ({ sessionId, threadId }: TranscriptIdentity) => `${sessionId}:${threadId ?? 'draft'}`;

export const TranscriptContinuationContext = createContext<((thread: ThreadSession) => void) | undefined>(undefined);

/** Each thread mounts its own transcript, except one its card's draft opened: that one keeps the draft's. */
export function useTranscriptKey(identity: TranscriptIdentity) {
  const [continued, setContinued] = useState<{ identity: string; key: string }>();
  const own = identityOf(identity);
  const key = continued?.identity === own ? continued.key : own;
  return { key, continueInto: (thread: ThreadSession) => setContinued({ identity: identityOf(thread), key }) };
}

export function useContinueIntoThread() {
  const continueInto = useContext(TranscriptContinuationContext);
  const navigate = useNavigate();
  if (!continueInto) throw new Error('useContinueIntoThread must be used within a ChatSessionBoundary');
  return (factoryId: string, thread: ThreadSession, state?: unknown) => {
    continueInto(thread);
    void navigate(threadPath(factoryId, thread), { replace: true, state });
  };
}
