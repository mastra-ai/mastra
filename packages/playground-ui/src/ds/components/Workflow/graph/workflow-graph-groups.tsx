import { useViewport } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { GitFork } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';

export interface WorkflowGraphGroup {
  id: string;
  label: string;
  description: string;
  nodeIds: string[];
}

export function WorkflowGraphGroups({ nodes, groups }: { nodes: Node[]; groups: WorkflowGraphGroup[] }) {
  const { x, y, zoom } = useViewport();
  return (
    <div className="workflow-group-viewport" style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}>
      {groups.map(group => {
        const members = nodes.flatMap(node => {
          if (!group.nodeIds.includes(node.id) || !node.measured?.width || !node.measured.height) return [];
          return [{ x: node.position.x, y: node.position.y, width: node.measured.width, height: node.measured.height }];
        });
        if (!members.length || members.length !== group.nodeIds.length) return null;
        const left = Math.min(...members.map(node => node.x)) - 20;
        const top = Math.min(...members.map(node => node.y)) - 54;
        const right = Math.max(...members.map(node => node.x + node.width)) + 20;
        const bottom = Math.max(...members.map(node => node.y + node.height)) + 20;
        return (
          <div
            key={group.id}
            className="workflow-parallel-group"
            style={{ transform: `translate(${left}px, ${top}px)`, width: right - left, height: bottom - top }}
          >
            <div className="workflow-parallel-heading">
              <Badge size="xs" variant="blue" emphasis="muted" icon={<GitFork aria-hidden />}>
                {group.label}
              </Badge>
              <span>{group.description}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
