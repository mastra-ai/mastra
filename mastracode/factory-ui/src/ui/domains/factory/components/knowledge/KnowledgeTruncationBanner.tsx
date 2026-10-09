import { Txt } from '@mastra/playground-ui/components/Txt';
import type { KnowledgeGraphPayload } from '../../services/knowledge';
export function KnowledgeTruncationBanner({ payload }: { payload: KnowledgeGraphPayload }) {
  const parts: string[] = [];
  if (payload.truncated) parts.push(`showing the newest ${payload.nodes.length} nodes`);
  if (payload.outOfWindow.length > 0) parts.push(`${payload.outOfWindow.length} linked nodes outside the window`);
  if (payload.unresolvedCapped.count > 0) parts.push(`${payload.unresolvedCapped.count} links unresolved (capped)`);
  if (parts.length === 0) return null;
  return (
    <div className="bg-card pointer-events-none absolute bottom-4 left-1/2 z-10 max-w-80 -translate-x-1/2 rounded-md px-3 py-1">
      <Txt as="p" variant="caption" tone="muted" data-testid="knowledge-truncation-banner">
        Partial view — {parts.join(' · ')}
      </Txt>
    </div>
  );
}
