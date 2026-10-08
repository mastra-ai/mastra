import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Pin } from 'lucide-react';
import { memo } from 'react';
import type { NodeFlowNode, RecordFlowNode } from './graphModel';
import { shouldShowLabel } from './graphModel';
import { getKnowledgeNodeStyle } from './knowledgeStyles';

function NodeNodeComponent({ data }: NodeProps<NodeFlowNode>) {
  const { node, size, degree } = data;
  const labeled = shouldShowLabel(degree);
  const large = size >= 88;
  return (
    // A focused leaf's label extends beyond the circle without resizing it.
    <div data-testid="knowledge-node" data-node-id={node.id} className="relative" style={{ width: size, height: size }}>
      {/* A11: nodes never carry pin visuals — pins belong to their record
          markers (dot / line / junction). */}
      <div
        className="knowledge-circle shadow-raised flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border-2 text-center"
        style={getKnowledgeNodeStyle(node.rung)}
      >
        {labeled ? (
          <Txt
            as="span"
            variant={large ? 'label' : 'meta'}
            tone="ink"
            className="pointer-events-none line-clamp-3 max-w-[78%] break-words"
            title={node.name}
          >
            {node.name}
          </Txt>
        ) : null}
        {labeled && large ? (
          <Txt as="span" variant="eyebrow" tone="muted" className="mt-0.5">
            {node.kind.slice(0, 12)}
          </Txt>
        ) : null}
      </div>
      {!labeled ? (
        <div className="knowledge-leaf-label bg-card shadow-raised pointer-events-none absolute top-full left-1/2 mt-2 hidden -translate-x-1/2 rounded-md px-2 py-1 whitespace-nowrap">
          <Txt as="span" variant="label" tone="ink">
            {node.name}
          </Txt>
        </div>
      ) : null}
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
const NodeNode = memo(NodeNodeComponent);

/**
 * A11: a knowledge record rendered as its own tiny marker — a dot beside its node or
 * a junction where a multi-node record splits. Pinned records render as
 * the amber pin chip itself (the marker being a layout node is what keeps
 * the chip collision-clear of nodes).
 */
function RecordNodeComponent({ data }: NodeProps<RecordFlowNode>) {
  const { record, size } = data;
  return (
    <div
      data-testid="knowledge-record-node"
      data-record-id={record.id}
      data-pinned={record.pinned}
      className={cn(
        'flex items-center justify-center rounded-full border transition-shadow duration-fast motion-reduce:transition-none',
        // Neutral records stay distinct from scope-colored nodes and amber pins.
        record.pinned
          ? 'border-badge-amber-edge bg-badge-amber-strong text-badge-amber-foreground shadow-raised'
          : 'border-muted-foreground bg-muted-foreground',
      )}
      style={{ width: size, height: size }}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
      {record.pinned ? <Pin size={11} aria-label="Pinned record" /> : null}
    </div>
  );
}
const RecordNode = memo(RecordNodeComponent);

export const knowledgeNodeTypes = { knowledgeNode: NodeNode, knowledgeRecord: RecordNode };
