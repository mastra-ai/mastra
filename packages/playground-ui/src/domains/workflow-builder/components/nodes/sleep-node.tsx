import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { SleepNodeData } from '../../types';

const SLEEP_COLOR = '#6b7280'; // gray-500

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export const SleepNode = memo(function SleepNode({ id, data, selected }: NodeProps<Node<SleepNodeData, 'sleep'>>) {
  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={SLEEP_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={data.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${SLEEP_COLOR}20` }}
          >
            <Clock className="w-4 h-4" style={{ color: SLEEP_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{data.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-gray-500/20 !text-gray-400">SLEEP</Badge>
        </div>

        <div className="text-xs">
          {data.sleepType === 'duration' ? (
            data.duration ? (
              <div className="flex items-center gap-2 text-icon4">
                <span className="text-icon3">Wait:</span>
                <span>{formatDuration(data.duration)}</span>
              </div>
            ) : (
              <div className="text-amber-500 bg-amber-500/10 rounded px-2 py-1">No duration set</div>
            )
          ) : (
            <div className="flex items-center gap-2 text-icon4">
              <span className="text-icon3">Until:</span>
              <span className="truncate">
                {data.timestamp && typeof data.timestamp === 'object'
                  ? (data.timestamp as { ref?: string }).ref || 'timestamp'
                  : 'timestamp'}
              </span>
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
});
