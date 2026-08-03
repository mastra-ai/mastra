import { buildThreadRailTurns, ThreadRail } from '@mastra/playground-ui/components/ThreadRail';

import { useChatTranscript } from '../context/useChatTranscript';

/** Positions the shared conversation rail without owning its presentation or interaction behavior. */
export function ThreadRailLayer() {
  const { transcript } = useChatTranscript();
  const messages = transcript.entries.flatMap(entry => (entry.kind === 'message' ? [entry.message] : []));
  const turns = buildThreadRailTurns(messages);

  if (turns.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-y-0 left-4 z-20 hidden @[58rem]:block">
      <ThreadRail turns={turns} className="pointer-events-auto sticky top-1/2 -translate-y-1/2" />
    </div>
  );
}
