import type { ReactNode } from 'react';

import { EnrichedThreadSwitch } from './enriched-thread-switch';
import { ThreadTracesLink } from './thread-traces-link';
import { EnrichedThread } from '@/domains/traces/components/enriched-thread';
import { useThreadTraces } from '@/domains/traces/hooks/use-thread-traces';

/**
 * The two halves of enriched mode both read `useThreadTraces`, so they share one
 * React Query entry: the header only needs to know whether traces exist, the pane
 * needs the traces themselves. Neither is mounted for a brand-new thread, which is
 * what keeps `chat/new` from querying traces at all.
 */

export function ThreadEnrichedSwitch({ threadId, agentId }: { threadId: string; agentId: string }) {
  const { hasTraces } = useThreadTraces(threadId);

  if (!hasTraces) return null;

  return (
    <div className="flex items-center gap-3">
      <ThreadTracesLink threadId={threadId} agentId={agentId} />
      <EnrichedThreadSwitch hasTraces={hasTraces} />
    </div>
  );
}

export function ThreadEnrichedView({ threadId, fallback }: { threadId: string; fallback: ReactNode }) {
  const { traces, hasTraces, isLoading } = useThreadTraces(threadId);

  // A stale `?enriched=true` link on a thread without traces reads as the plain chat
  // rather than an empty screen.
  if (isLoading || !hasTraces) return fallback;

  return <EnrichedThread traces={traces} />;
}
