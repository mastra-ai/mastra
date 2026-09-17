import type { Phase } from '../data';
const composerStatus: Record<Phase, string> = {
  complete: 'Ready',
  streaming: 'Responding…',
  stopped: 'Response stopped',
  question: 'Waiting for your answer',
  approval: 'Waiting for approval',
  declined: 'Ready',
  error: 'Reply failed',
  'tool-error': 'Tool failed',
};

export function ConversationComposerStatus({ phase, reading }: { phase?: Phase; reading: boolean }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {reading ? 'Reading attachments…' : composerStatus[phase ?? 'complete']}
    </span>
  );
}
