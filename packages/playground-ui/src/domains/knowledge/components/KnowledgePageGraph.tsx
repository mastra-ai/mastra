import type { NodeProps } from '@xyflow/react';
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Pin } from 'lucide-react';
import { memo, useMemo } from 'react';

import { runLayout } from '../lib/layout';
import { pageGraphEdges, toPageFlow } from '../lib/pageGraph';
import type { PageFlowEdge, PageFlowNode } from '../lib/pageGraph';
import type { KnowledgePageEdge, KnowledgePagePayload } from '../pageTypes';

import { Txt } from '@/ds/components/Txt';

import './knowledge.css';

const SCOPE_STYLE = { background: 'var(--card)', borderColor: 'var(--chart-blue)' };
const PAGE_STYLE = { background: 'var(--card)', borderColor: 'var(--border-strong)' };

type PageNodeData = PageFlowNode['data'] & { pinned: boolean };

function PageNodeComponent({ data }: NodeProps<PageFlowNode & { data: PageNodeData }>) {
  const { page, size, selected, pinned } = data;
  return (
    <div
      data-testid="knowledge-page-node"
      data-page-id={page.id}
      data-page-type={page.isScope ? 'scope' : 'page'}
      className="relative cursor-pointer"
      style={{ width: size, height: size }}
    >
      <div
        className="knowledge-circle flex size-full items-center justify-center overflow-hidden rounded-full border-2 text-center shadow-raised"
        data-selected={selected || undefined}
        style={page.isScope ? SCOPE_STYLE : PAGE_STYLE}
      >
        <Txt
          as="span"
          variant={size >= 88 ? 'label' : 'meta'}
          tone="ink"
          className="pointer-events-none line-clamp-3 max-w-[78%] break-words"
          title={page.name}
        >
          {page.name}
        </Txt>
      </div>
      {pinned ? (
        <span
          className="absolute -top-1 -right-1 rounded-full bg-badge-amber-strong p-0.5 text-badge-amber-foreground shadow-raised"
          aria-label="Pinned"
        >
          <Pin className="size-3" aria-hidden />
        </span>
      ) : null}
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}

const nodeTypes = { page: memo(PageNodeComponent) };

export interface KnowledgePageGraphProps {
  pages: KnowledgePagePayload[];
  /** Mention edges between pages; parent edges are derived from `pages`. */
  edges: KnowledgePageEdge[];
  pinnedIds?: readonly string[];
  selectedPageId?: string | null;
  onSelect: (page: KnowledgePagePayload) => void;
}

/**
 * The schema-4 Knowledge page graph: scopes and pages as circles sized by how often they are mentioned,
 * parent links as faint edges and mentions as solid ones. Layout is deterministic for the same pages.
 */
export function KnowledgePageGraph(props: KnowledgePageGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgePageGraphInner {...props} />
    </ReactFlowProvider>
  );
}

function KnowledgePageGraphInner({ pages, edges, pinnedIds = [], selectedPageId, onSelect }: KnowledgePageGraphProps) {
  const allEdges = useMemo(() => pageGraphEdges(pages, edges), [pages, edges]);
  const laidOut = useMemo(() => {
    const flow = toPageFlow(pages, allEdges);
    const positions = runLayout(
      flow.nodes.map(node => ({ id: node.id, size: node.data.size })),
      flow.edges.map(edge => ({ source: edge.source, target: edge.target })),
    );
    return { nodes: flow.nodes, edges: flow.edges, positions };
  }, [pages, allEdges]);

  const pinned = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const nodes = useMemo(
    () =>
      laidOut.nodes.map(node => {
        const center = laidOut.positions.get(node.id) ?? { x: 0, y: 0 };
        return {
          ...node,
          position: { x: center.x - node.data.size / 2, y: center.y - node.data.size / 2 },
          data: { ...node.data, selected: node.id === selectedPageId, pinned: pinned.has(node.id) },
        };
      }),
    [laidOut, selectedPageId, pinned],
  );
  const flowEdges = useMemo(
    () =>
      laidOut.edges.map(
        (edge): PageFlowEdge => ({
          ...edge,
          style:
            edge.data?.kind === 'parent'
              ? { stroke: 'var(--border-strong)', strokeDasharray: '4 4', opacity: 0.6 }
              : { stroke: 'var(--chart-blue)', strokeWidth: Math.min(1 + (edge.data?.count ?? 1), 4) },
        }),
      ),
    [laidOut],
  );

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Txt variant="body" tone="muted">
          No pages yet.
        </Txt>
      </div>
    );
  }

  return (
    <div className="size-full" data-testid="knowledge-page-graph">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={(_: unknown, node: PageFlowNode) => onSelect(node.data.page)}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="var(--border-strong)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
