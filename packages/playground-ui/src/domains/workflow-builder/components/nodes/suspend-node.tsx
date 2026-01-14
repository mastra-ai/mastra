import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Hand } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { SuspendNodeData } from '../../types';

const SUSPEND_COLOR = '#ef4444'; // red-500

export const SuspendNode = memo(function SuspendNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as SuspendNodeData;

  const resumeSchemaProperties = nodeData.resumeSchema?.properties as Record<string, unknown> | undefined;
  const fieldCount = resumeSchemaProperties ? Object.keys(resumeSchemaProperties).length : 0;

  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={SUSPEND_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={nodeData.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${SUSPEND_COLOR}20` }}
          >
            <Hand className="w-4 h-4" style={{ color: SUSPEND_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{nodeData.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-red-500/20 !text-red-500">HUMAN</Badge>
        </div>

        <div className="space-y-1 text-xs">
          <div className="text-icon3">Waits for human input</div>
          {fieldCount > 0 ? (
            <div className="flex items-center gap-2 text-icon4">
              <span className="text-icon3">Fields:</span>
              <span>
                {fieldCount} input{fieldCount !== 1 ? 's' : ''} required
              </span>
            </div>
          ) : (
            <div className="text-amber-500 bg-amber-500/10 rounded px-2 py-1">No input schema defined</div>
          )}
        </div>
      </div>
    </BaseNode>
  );
});
