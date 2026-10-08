import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { Pin } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { KnowledgeFlowEdge } from './graphModel';
import { getKnowledgeEdgeStyle } from './knowledgeStyles';
import { useKnowledgeNodeGeometry } from './useKnowledgeNodeGeometry';

function KnowledgeLinkComponent({ id, source, target, data }: EdgeProps<KnowledgeFlowEdge>) {
  // Floating edge: anchor both ends on the circle rims along the angle between
  // the node centers, rather than at fixed handles.
  const pinned = data?.pinned ?? false;
  const hasPinBadge = pinned && !source.startsWith('record:') && !target.startsWith('record:');
  const sourceNode = useKnowledgeNodeGeometry(source);
  const targetNode = useKnowledgeNodeGeometry(target);
  if (!sourceNode || !targetNode) return null;
  const sourceSize = sourceNode.size;
  const targetSize = targetNode.size;
  const sx = sourceNode.x + sourceSize / 2;
  const sy = sourceNode.y + sourceSize / 2;
  const tx = targetNode.x + targetSize / 2;
  const ty = targetNode.y + targetSize / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const startX = sx + ux * (sourceSize / 2);
  const startY = sy + uy * (sourceSize / 2);
  const endX = tx - ux * (targetSize / 2);
  const endY = ty - uy * (targetSize / 2);
  // Organic arc: bow perpendicular to the line, direction keyed to the edge id
  // so parallel edges don't stack. Gentle: capped so long edges never rainbow.
  const side = id.charCodeAt(id.length - 1) % 2 === 0 ? 1 : -1;
  const bow = side * Math.min(22, length * 0.07);
  const controlX = (startX + endX) / 2 + -uy * bow;
  const controlY = (startY + endY) / 2 + ux * bow;
  const path = `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`;
  const edgeStyle = getKnowledgeEdgeStyle({ source, target, data });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={edgeStyle}
        data-knowledge-record-id={data?.recordId}
        data-knowledge-pinned={pinned}
      />
      {hasPinBadge ? (
        <EdgeLabelRenderer>
          <span
            data-knowledge-edge-id={id}
            // Nodes always render above lines and their badges — no z lift.
            className={cn('shadow-raised bg-badge-amber-strong text-badge-amber-foreground absolute rounded-full p-1')}
            style={{
              zIndex: 0,
              // Quadratic bezier midpoint: B(0.5) = 0.25·start + 0.5·control + 0.25·end
              transform: `translate(-50%, -50%) translate(${0.25 * startX + 0.5 * controlX + 0.25 * endX}px, ${0.25 * startY + 0.5 * controlY + 0.25 * endY}px)`,
            }}
          >
            <Pin size={11} aria-label="Pinned relationship" />
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
const KnowledgeLink = memo(KnowledgeLinkComponent);
KnowledgeLink.displayName = 'KnowledgeLink';

export const knowledgeEdgeTypes = { knowledgeLink: KnowledgeLink };
