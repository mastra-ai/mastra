import { memo, useState, useCallback, useMemo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { useTestRunnerStore } from '../../store/test-runner-store';

export interface DataEdgeData {
  /** Optional label to show on the edge */
  label?: string;
}

// CSS for animated flow
const animatedFlowStyle = `
@keyframes flowAnimation {
  from {
    stroke-dashoffset: 24;
  }
  to {
    stroke-dashoffset: 0;
  }
}
`;

/**
 * Custom edge component with:
 * - Hover state with delete button
 * - Animated flow during test runs
 * - Optional label display
 */
export const DataEdge = memo(function DataEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const deleteEdge = useWorkflowBuilderStore(state => state.deleteEdge);
  const isTestRunning = useTestRunnerStore(state => state.isRunning);
  const currentRun = useTestRunnerStore(state => state.currentRun);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteEdge(id);
    },
    [id, deleteEdge],
  );

  const edgeData = data as DataEdgeData | undefined;

  // Determine if this edge is active (source completed, target running/completed)
  const edgeState = useMemo(() => {
    if (!currentRun || !isTestRunning) return 'idle';

    // Parse source and target from edge
    const sourceStep = currentRun.steps[source];
    const targetStep = currentRun.steps[target];

    if (sourceStep?.status === 'completed' && targetStep?.status === 'running') {
      return 'flowing';
    }
    if (sourceStep?.status === 'completed' && targetStep?.status === 'completed') {
      return 'completed';
    }
    if (sourceStep?.status === 'running') {
      return 'waiting';
    }
    if (sourceStep?.status === 'failed' || targetStep?.status === 'failed') {
      return 'failed';
    }
    return 'idle';
  }, [currentRun, isTestRunning, source, target]);

  return (
    <>
      {/* Invisible wider path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Inject animation styles */}
      <style>{animatedFlowStyle}</style>

      {/* Visible edge path */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isHovered || selected ? 3 : 2,
          stroke:
            edgeState === 'flowing'
              ? '#22c55e'
              : edgeState === 'completed'
                ? '#22c55e'
                : edgeState === 'failed'
                  ? '#ef4444'
                  : isHovered || selected
                    ? '#60a5fa'
                    : '#6b7280',
          transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
          ...(edgeState === 'flowing' && {
            strokeDasharray: '8 4',
            animation: 'flowAnimation 0.5s linear infinite',
          }),
        }}
      />

      {/* Glow effect on hover */}
      {(isHovered || selected) && (
        <path
          d={edgePath}
          fill="none"
          strokeWidth={8}
          stroke="#60a5fa"
          strokeOpacity={0.2}
          style={{ pointerEvents: 'none' }}
        />
      )}

      <EdgeLabelRenderer>
        {/* Delete button - shown on hover, hidden during test run */}
        {isHovered && !isTestRunning && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleDelete}
              className={cn(
                'w-5 h-5 rounded-full',
                'bg-red-500 hover:bg-red-600 hover:scale-110',
                'flex items-center justify-center',
                'text-white shadow-lg',
                'transition-all duration-150 ease-out',
              )}
              aria-label="Delete connection"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Optional label */}
        {edgeData?.label && !isHovered && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            <div className="px-2 py-0.5 rounded bg-surface3 border border-border1 text-xs text-icon4">
              {edgeData.label}
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
