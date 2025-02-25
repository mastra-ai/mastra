import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Footprints } from 'lucide-react';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

export type DefaultNode = Node<
  {
    label: string;
    description?: string;
    withoutTopHandle?: boolean;
    withoutBottomHandle?: boolean;
  },
  'default-node'
>;

export function WorkflowDefaultNode({ data }: NodeProps<DefaultNode>) {
  const { label, description, withoutTopHandle, withoutBottomHandle } = data;
  return (
    <div className={cn('bg-mastra-bg-8 rounded-md w-[274px]')}>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <div className="p-2">
        <div className="text-sm bg-mastra-bg-9 flex items-center gap-[6px] rounded-sm  p-2">
          <Footprints className="text-current w-4 h-4" />
          <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
            {label}
          </Text>
        </div>
      </div>
      {description && (
        <div className="bg-mastra-bg-4 rounded-b-md p-2 text-[10px] text-left text-mastra-el-4">{description}</div>
      )}
      {!withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </div>
  );
}
