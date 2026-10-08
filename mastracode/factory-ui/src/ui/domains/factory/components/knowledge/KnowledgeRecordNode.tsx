import { cn } from '@mastra/playground-ui/utils/cn';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Pin } from 'lucide-react';
import { memo } from 'react';
import type { RecordFlowNode } from './graphModel';
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
        'flex items-center justify-center rounded-full border',
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
export const KnowledgeRecordNode = memo(RecordNodeComponent);
KnowledgeRecordNode.displayName = 'KnowledgeRecordNode';
