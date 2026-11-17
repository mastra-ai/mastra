interface TranscriptIdentity {
  sessionId: string;
  threadId?: string;
}

const continued = new Map<string, string>();

const identityOf = ({ sessionId, threadId }: TranscriptIdentity) => `${sessionId}:${threadId ?? 'draft'}`;

/** Each thread mounts its own transcript, except one its card's draft opened: that one keeps the draft's. */
export function transcriptKey(identity: TranscriptIdentity): string {
  const own = identityOf(identity);
  return continued.get(own) ?? own;
}

export function continueTranscript(from: TranscriptIdentity, to: TranscriptIdentity): void {
  continued.set(identityOf(to), transcriptKey(from));
}
