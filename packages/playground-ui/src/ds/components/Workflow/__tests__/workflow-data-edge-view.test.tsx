// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { Position, ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowDataEdgeView } from '../graph/workflow-data-edge-view';

afterEach(cleanup);

function renderEdge(nodes: Node[]) {
  return render(
    <ReactFlowProvider initialNodes={nodes}>
      <svg>
        <WorkflowDataEdgeView
          id="source-target"
          source="source"
          target="target"
          sourceX={57}
          sourceY={184}
          targetX={68}
          targetY={346}
          sourcePosition={Position.Bottom}
          targetPosition={Position.Top}
        />
      </svg>
    </ReactFlowProvider>,
  );
}

describe('WorkflowDataEdgeView', () => {
  describe('when an ancestor canvas has scaled the DOM handle positions', () => {
    it.each([142, 260])('connects to the card edges at height %i in graph coordinates', height => {
      const { container } = renderEdge([
        { id: 'source', position: { x: 0, y: 122 }, measured: { width: 274, height }, data: {} },
        { id: 'target', position: { x: 0, y: 500 }, measured: { width: 274, height: 100 }, data: {} },
      ]);
      const path = container.querySelector('.react-flow__edge-path');
      expect(path?.getAttribute('d')).toMatch(new RegExp(`^M137,${122 + height} C.* 137,500$`));
      expect(path?.getAttribute('marker-end')).toBe(`url(#${container.querySelector('marker')?.id})`);
    });

    it('keeps links centered on different-width cards along parallel paths', () => {
      const { container } = renderEdge([
        { id: 'source', position: { x: 81, y: 0 }, measured: { width: 112, height: 38 }, data: {} },
        { id: 'target', position: { x: 400, y: 122 }, measured: { width: 274, height: 142 }, data: {} },
      ]);
      expect(container.querySelector('.react-flow__edge-path')?.getAttribute('d')).toMatch(/^M137,38 C.* 537,122$/);
    });
  });

  describe('when node measurements are not ready', () => {
    it('keeps the supplied edge positions until the nodes are measured', () => {
      const { container } = renderEdge([
        { id: 'source', position: { x: 0, y: 122 }, data: {} },
        { id: 'target', position: { x: 0, y: 500 }, data: {} },
      ]);
      expect(container.querySelector('.react-flow__edge-path')?.getAttribute('d')).toMatch(/^M57,184 C.* 68,346$/);
    });
  });
});
