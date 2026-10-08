import { Txt } from '@mastra/playground-ui/components/Txt';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { NodeFlowNode } from './graphModel';
import { shouldShowLabel } from './graphModel';
import { getKnowledgeNodeStyle } from './knowledgeStyles';
function NodeNodeComponent({ data }: NodeProps<NodeFlowNode>) {
  const { node, size, degree } = data;
  const labeled = shouldShowLabel(degree);
  const large = size >= 88;
  return (
    // A focused leaf's label extends beyond the circle without resizing it.
    <div
      data-testid="knowledge-node"
      data-node-id={node.id}
      className="relative"
      style={{ ...getKnowledgeNodeStyle(node.rung), width: size, height: size }}
    >
      {/* A11: nodes never carry pin visuals — pins belong to their record
          markers (dot / line / junction). */}
      <div className="knowledge-circle shadow-raised flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border-2 text-center">
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
        <div className="knowledge-leaf-label bg-card shadow-raised pointer-events-none absolute top-full left-1/2 mt-2 rounded-md px-2 py-1 whitespace-nowrap">
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
export const KnowledgeNode = memo(NodeNodeComponent);
KnowledgeNode.displayName = 'KnowledgeNode';
