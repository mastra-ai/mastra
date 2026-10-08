import type { CSSProperties } from 'react';

import type { KnowledgeFlowEdge, NodeFlowNode, RecordFlowNode } from './graphModel';
import { knowledgeScopes } from './knowledgeScope';

export type KnowledgeFlowNode = NodeFlowNode | RecordFlowNode;

export function isKnowledgeNode(node: KnowledgeFlowNode): node is NodeFlowNode {
  return node.type === 'knowledgeNode' && 'node' in node.data;
}

export function isRecordNode(node: KnowledgeFlowNode): node is RecordFlowNode {
  return node.type === 'knowledgeRecord' && 'record' in node.data;
}

interface KnowledgeNodeStyle extends CSSProperties {
  '--knowledge-color': string;
}

export function getKnowledgeNodeStyle(rung: NodeFlowNode['data']['node']['rung']): KnowledgeNodeStyle {
  return { '--knowledge-color': knowledgeScopes[rung].color };
}

interface KnowledgeEdgeStyle extends CSSProperties {
  '--knowledge-edge-stroke': string;
  '--knowledge-edge-width': number;
  '--knowledge-edge-opacity'?: number;
}

export function getKnowledgeEdgeStyle({
  source,
  target,
  data,
}: Pick<KnowledgeFlowEdge, 'source' | 'target' | 'data'>): KnowledgeEdgeStyle {
  if (data?.focused) {
    return {
      '--knowledge-edge-stroke': data.pinned ? 'var(--chart-amber)' : 'var(--chart-blue)',
      '--knowledge-edge-width': 2.5,
    };
  }
  if (data?.pinned) return { '--knowledge-edge-stroke': 'var(--chart-amber)', '--knowledge-edge-width': 2 };
  if (source.startsWith('record:') || target.startsWith('record:')) {
    return {
      '--knowledge-edge-stroke': 'var(--muted-foreground)',
      '--knowledge-edge-width': 1.2,
      '--knowledge-edge-opacity': 0.45,
    };
  }
  return { '--knowledge-edge-stroke': 'var(--border-strong)', '--knowledge-edge-width': 1.4 };
}

export function getMiniMapNodeColor(node: KnowledgeFlowNode): string {
  if ('record' in node.data) {
    return node.data.record.pinned ? 'var(--chart-amber)' : 'var(--muted-foreground)';
  }
  return knowledgeScopes[node.data.node.rung].color;
}

export function getRecordRingClass(pinned: boolean): string {
  return pinned ? 'ring-badge-amber-indicator ring-2' : 'ring-badge-blue-indicator ring-2';
}

export function getRecordBorderClass(pinned: boolean, expanded: boolean): string {
  if (expanded) return pinned ? 'border-badge-amber-indicator' : 'border-badge-blue-edge';
  return pinned ? 'border-badge-amber-edge' : 'border-border';
}
