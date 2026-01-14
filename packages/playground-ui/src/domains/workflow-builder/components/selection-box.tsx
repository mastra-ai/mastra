import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';

interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface SelectionBoxProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Box selection component that allows selecting multiple nodes by dragging.
 * Renders a selection rectangle and updates the store with intersecting nodes.
 */
export function SelectionBox({ containerRef }: SelectionBoxProps) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const reactFlow = useReactFlow();
  const selectNodes = useWorkflowBuilderStore(state => state.selectNodes);
  const nodes = useWorkflowBuilderStore(state => state.nodes);

  // Convert screen coordinates to flow coordinates
  const screenToFlow = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const bounds = containerRef.current.getBoundingClientRect();
      return reactFlow.screenToFlowPosition({
        x: screenX - bounds.left,
        y: screenY - bounds.top,
      });
    },
    [containerRef, reactFlow],
  );

  // Check if a node intersects with the selection rectangle
  const nodeIntersectsRect = useCallback(
    (
      nodeX: number,
      nodeY: number,
      nodeWidth: number,
      nodeHeight: number,
      rect: { x: number; y: number; width: number; height: number },
    ) => {
      return !(
        nodeX + nodeWidth < rect.x ||
        nodeX > rect.x + rect.width ||
        nodeY + nodeHeight < rect.y ||
        nodeY > rect.y + rect.height
      );
    },
    [],
  );

  // Handle mouse down - start selection
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Only start selection on left click on the pane (not on nodes)
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;

      // Check if clicking on the pane background (not a node or other element)
      const isPane =
        target.classList.contains('react-flow__pane') || target.classList.contains('react-flow__background');

      if (!isPane) return;

      // Check if shift is held for additive selection
      if (!e.shiftKey) {
        // Clear selection if not shift-clicking
        selectNodes([]);
      }

      const flowPos = screenToFlow(e.clientX, e.clientY);

      setSelectionRect({
        startX: flowPos.x,
        startY: flowPos.y,
        currentX: flowPos.x,
        currentY: flowPos.y,
      });
      setIsSelecting(true);
    },
    [screenToFlow, selectNodes],
  );

  // Handle mouse move - update selection rectangle
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSelecting || !selectionRect) return;

      const flowPos = screenToFlow(e.clientX, e.clientY);

      setSelectionRect(prev =>
        prev
          ? {
              ...prev,
              currentX: flowPos.x,
              currentY: flowPos.y,
            }
          : null,
      );
    },
    [isSelecting, selectionRect, screenToFlow],
  );

  // Handle mouse up - finalize selection
  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selectionRect) {
      setIsSelecting(false);
      setSelectionRect(null);
      return;
    }

    // Calculate the normalized rectangle
    const rect = {
      x: Math.min(selectionRect.startX, selectionRect.currentX),
      y: Math.min(selectionRect.startY, selectionRect.currentY),
      width: Math.abs(selectionRect.currentX - selectionRect.startX),
      height: Math.abs(selectionRect.currentY - selectionRect.startY),
    };

    // Only select if the rectangle has some size
    if (rect.width > 5 && rect.height > 5) {
      // Find intersecting nodes
      const selectedIds = nodes
        .filter(node => {
          const nodeWidth = 274; // Default node width
          const nodeHeight = 80; // Approximate node height
          return nodeIntersectsRect(node.position.x, node.position.y, nodeWidth, nodeHeight, rect);
        })
        .map(node => node.id);

      if (selectedIds.length > 0) {
        selectNodes(selectedIds);
      }
    }

    setIsSelecting(false);
    setSelectionRect(null);
  }, [isSelecting, selectionRect, nodes, nodeIntersectsRect, selectNodes]);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, handleMouseDown, handleMouseMove, handleMouseUp]);

  // Don't render if not selecting
  if (!isSelecting || !selectionRect) return null;

  // Calculate screen coordinates for the selection box
  const rect = {
    x: Math.min(selectionRect.startX, selectionRect.currentX),
    y: Math.min(selectionRect.startY, selectionRect.currentY),
    width: Math.abs(selectionRect.currentX - selectionRect.startX),
    height: Math.abs(selectionRect.currentY - selectionRect.startY),
  };

  // Convert flow coordinates back to screen for rendering
  const startScreen = reactFlow.flowToScreenPosition({ x: rect.x, y: rect.y });
  const endScreen = reactFlow.flowToScreenPosition({ x: rect.x + rect.width, y: rect.y + rect.height });

  const containerBounds = containerRef.current?.getBoundingClientRect();
  if (!containerBounds) return null;

  const screenRect = {
    left: startScreen.x - containerBounds.left,
    top: startScreen.y - containerBounds.top,
    width: endScreen.x - startScreen.x,
    height: endScreen.y - startScreen.y,
  };

  return (
    <div
      className={cn('absolute pointer-events-none z-50', 'border-2 border-cyan-500 bg-cyan-500/10', 'rounded-sm')}
      style={{
        left: screenRect.left,
        top: screenRect.top,
        width: screenRect.width,
        height: screenRect.height,
      }}
    />
  );
}
