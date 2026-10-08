import { Background, BackgroundVariant, MiniMap, ReactFlow, useReactFlow } from '@xyflow/react';
import { memo } from 'react';
import type { RefObject } from 'react';
import type { KnowledgeGraphProps } from './KnowledgeGraph';
import type { KnowledgeHoverHandle } from './KnowledgeGraphHover';
import { knowledgeEdgeTypes } from './KnowledgeGraphLink';
import { knowledgeNodeTypes } from './KnowledgeGraphNodes';
import type { KnowledgeFlowEdge } from './graphModel';
import type { KnowledgeScene } from './knowledgeScene';
import { getMiniMapNodeColor, isKnowledgeNode, isRecordNode } from './knowledgeStyles';
import type { KnowledgeFlowNode } from './knowledgeStyles';

export type KnowledgeGraphEvents = Pick<KnowledgeGraphProps, 'onNodeClick' | 'onEdgeClick' | 'onClearFocus'>;

const keyboardDirections: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

function KnowledgeGraphCanvasComponent({
  scene,
  events,
  hoverRef,
}: {
  scene: KnowledgeScene;
  events: RefObject<KnowledgeGraphEvents>;
  hoverRef: RefObject<KnowledgeHoverHandle | null>;
}) {
  const flow = useReactFlow<KnowledgeFlowNode, KnowledgeFlowEdge>();
  function selectNode(node: KnowledgeFlowNode) {
    hoverRef.current?.hide();
    if (isRecordNode(node)) {
      const record = node.data.record;
      const [source = '', target = source] = record.nodeIds;
      events.current.onEdgeClick({ source, target, recordId: record.id });
    } else if (isKnowledgeNode(node)) events.current.onNodeClick(node.data.node);
  }
  function selectEdge(edge: KnowledgeFlowEdge) {
    hoverRef.current?.hide();
    const source = edge.source.startsWith('record:') ? edge.target : edge.source;
    if (!source.startsWith('record:'))
      events.current.onEdgeClick({ source, target: edge.target, recordId: edge.data?.recordId ?? '' });
  }
  return (
    <ReactFlow<KnowledgeFlowNode, KnowledgeFlowEdge>
      defaultNodes={scene.nodes}
      defaultEdges={scene.edges}
      nodeTypes={knowledgeNodeTypes}
      edgeTypes={knowledgeEdgeTypes}
      minZoom={0.05}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      elementsSelectable={false}
      selectNodesOnDrag={false}
      ariaLabelConfig={{
        'node.a11yDescription.default':
          'Press Enter or Space to open details, Escape to return to the overview, or arrow keys to move the node.',
      }}
      panOnScroll
      panOnScrollSpeed={1}
      zoomOnScroll={false}
      zoomOnPinch
      onNodeClick={(_, node) => selectNode(node)}
      onPaneClick={() => events.current.onClearFocus()}
      onEdgeClick={(_, edge) => selectEdge(edge)}
      onKeyDown={event => {
        if (!(event.target instanceof Element)) return;
        const target = event.target.closest('.react-flow__node, .react-flow__edge');
        const id = target?.getAttribute('data-id');
        if (!id) return;
        if (event.key === 'Escape') {
          events.current.onClearFocus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const node = flow.getNode(id);
          const edge = flow.getEdge(id);
          if (node) selectNode(node);
          else if (edge) selectEdge(edge);
        } else if (keyboardDirections[event.key] && flow.getNode(id)) {
          event.preventDefault();
          const direction = keyboardDirections[event.key]!;
          const distance = event.shiftKey ? 40 : 10;
          flow.updateNode(id, node => ({
            position: {
              x: node.position.x + direction.x * distance,
              y: node.position.y + direction.y * distance,
            },
          }));
        }
      }}
      onNodeMouseEnter={(event, node) => {
        if (isRecordNode(node))
          hoverRef.current?.show({ kind: 'record', x: event.clientX, y: event.clientY, record: node });
        else if (isKnowledgeNode(node))
          hoverRef.current?.show({ kind: 'node', x: event.clientX, y: event.clientY, node });
      }}
      onNodeMouseLeave={() => hoverRef.current?.hide()}
      onEdgeMouseEnter={(event, edge) =>
        hoverRef.current?.show({ kind: 'edge', x: event.clientX, y: event.clientY, edge })
      }
      onEdgeMouseLeave={() => hoverRef.current?.hide()}
      onNodeDragStart={() => hoverRef.current?.hide()}
      onMoveStart={() => hoverRef.current?.hide()}
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="var(--border-strong)" />
      <MiniMap<KnowledgeFlowNode>
        position="bottom-left"
        pannable
        zoomable
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
        nodeColor={getMiniMapNodeColor}
        nodeStrokeColor="transparent"
        nodeStrokeWidth={3}
        nodeBorderRadius={999}
        maskColor="var(--scrim)"
      />
    </ReactFlow>
  );
}

// Selection belongs to sibling overlays/controllers. These immutable scene/ref
// props prevent it from traversing React Flow's node and edge renderers.
export const KnowledgeGraphCanvas = memo(KnowledgeGraphCanvasComponent);
KnowledgeGraphCanvas.displayName = 'KnowledgeCanvas';
