import { Txt } from '@mastra/playground-ui/components/Txt';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { Pin } from 'lucide-react';
import { useImperativeHandle, useState } from 'react';
import type { Ref } from 'react';
import type { KnowledgeFlowEdge, NodeFlowNode, RecordFlowNode } from './graphModel';
import type { KnowledgeGraphNode, KnowledgeRung } from '../../services/knowledge';
const RUNG_LABELS: Record<KnowledgeRung, string> = { org: 'Org', resource: 'Project', thread: 'Session' };

type HoverCard = { x: number; y: number } & (
  | { kind: 'node'; node: NodeFlowNode }
  | { kind: 'edge'; edge: KnowledgeFlowEdge }
  | { kind: 'record'; record: RecordFlowNode }
);

export interface KnowledgeHoverHandle {
  show: (hover: HoverCard) => void;
  hide: () => void;
}

/** Hover updates stay in this small overlay, outside the canvas render path. */
export function KnowledgeGraphHover({
  ref,
  nodesById,
}: {
  ref: Ref<KnowledgeHoverHandle>;
  nodesById: Map<string, KnowledgeGraphNode>;
}) {
  const [hover, setHover] = useState<HoverCard>();
  useImperativeHandle(ref, () => ({ show: setHover, hide: () => setHover(undefined) }));
  if (!hover) return null;
  return <GraphHoverCard hover={hover} nodesById={nodesById} />;
}

function GraphHoverCard({ hover, nodesById }: { hover: HoverCard; nodesById: Map<string, KnowledgeGraphNode> }) {
  const style = { left: hover.x + 14, top: hover.y + 14 } as const;
  if (hover.kind === 'node') {
    const { node, degree } = hover.node.data;
    return (
      <div
        data-testid="knowledge-hover-card"
        className={`${overlaySurfaceStyle} pointer-events-none fixed z-50 min-w-48 rounded-lg p-3`}
        style={style}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <Txt as="span" variant="label" tone="ink">
            {node.name}
          </Txt>
        </div>
        {node.description?.trim() ? (
          <Txt
            as="p"
            variant="body-sm"
            tone="ink"
            data-testid="knowledge-hover-description"
            className="mb-2 line-clamp-3 max-w-72 break-words"
          >
            {node.description}
          </Txt>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Kind</dt>
          <dd className={textStyle({ variant: 'caption', tone: 'muted' })}>{node.kind}</dd>
          <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Scope</dt>
          <dd className={textStyle({ variant: 'caption', tone: 'muted' })}>{RUNG_LABELS[node.rung]}</dd>
          <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Knowledge records</dt>
          <dd className={textStyle({ variant: 'caption', tone: 'muted' })}>{node.recordCount}</dd>
          <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Links</dt>
          <dd className={textStyle({ variant: 'caption', tone: 'muted' })}>
            {degree.incoming} in · {degree.outgoing} out
          </dd>
          <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Updated</dt>
          <dd className={textStyle({ variant: 'caption', tone: 'muted' })}>
            {new Date(node.updatedAt).toLocaleString()}
          </dd>
        </dl>
      </div>
    );
  }
  if (hover.kind === 'record') {
    const { record } = hover.record.data;
    return (
      <div
        data-testid="knowledge-hover-card"
        className={`${overlaySurfaceStyle} pointer-events-none fixed z-50 max-w-72 rounded-lg p-3`}
        style={style}
      >
        <div className="text-foreground mb-1 flex items-center gap-1.5">
          <Txt as="span" variant="caption" className="block">
            Record
          </Txt>
          {record.pinned ? <Pin size={11} className="text-badge-amber-indicator" aria-label="Pinned" /> : null}
        </div>
        <Txt as="p" variant="body-sm" tone="muted">
          {record.text}
        </Txt>
      </div>
    );
  }
  if (hover.kind === 'edge') {
    const resolve = (id: string) => nodesById.get(id)?.name;
    const source = resolve(hover.edge.source);
    const target = resolve(hover.edge.target);
    return (
      <div
        data-testid="knowledge-hover-card"
        className={`${overlaySurfaceStyle} pointer-events-none fixed z-50 max-w-72 rounded-lg p-3`}
        style={style}
      >
        <Txt as="p" variant="caption" tone="ink">
          {source && target ? `${source} → ${target}` : 'Record'}
        </Txt>
        <Txt as="p" variant="body-sm" tone="muted" className="mt-0.5">
          {hover.edge.data?.text ?? 'Mentioned in a knowledge record'}
        </Txt>
      </div>
    );
  }
  return null;
}
