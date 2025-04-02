import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Workflow } from 'lucide-react';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';
import { useContext } from 'react';
import { WorkflowNestedGraphContext } from '../context/workflow-nested-graph-context';

export type NestedNode = Node<
  {
    label: string;
    description?: string;
    withoutTopHandle?: boolean;
    withoutBottomHandle?: boolean;
    stepGraph: any;
    stepSubscriberGraph: any;
  },
  'nested-node'
>;

export function WorkflowNestedNode({ data }: NodeProps<NestedNode>) {
  const { label, withoutTopHandle, withoutBottomHandle, stepGraph, stepSubscriberGraph } = data;
  const { showNestedGraph } = useContext(WorkflowNestedGraphContext);
  return (
    <div className={cn('bg-[rgba(29,29,29,0.5)] rounded-md h-full overflow-scroll w-[274px]')}>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <div className="p-2 cursor-pointer" onClick={() => showNestedGraph({ label, stepGraph, stepSubscriberGraph })}>
        <div className="text-sm bg-mastra-bg-9 flex items-center gap-1.5 rounded-sm p-2 cursor-pointer">
          <Workflow className="text-current w-4 h-4" />
          <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
            {label}
          </Text>
        </div>
      </div>
      {!withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </div>
  );
}
