import type { ComponentProps } from 'react';
import { isReplayRecord, replayContext } from '../utils/replay';
import { ConversationReplayResult } from './conversation-replay-result';
import { ReplayTurnResult } from './replay-turn-result';

export function ReplayResult({
  result,
  onShowTrace,
}: ComponentProps<typeof ReplayTurnResult> & {
  onShowTrace?: (traceId: string) => void;
}) {
  if (replayContext(result.output)?.mode === 'conversation' && isReplayRecord(result.output)) {
    return <ConversationReplayResult output={result.output} onShowTrace={onShowTrace} />;
  }
  return <ReplayTurnResult result={result} />;
}
