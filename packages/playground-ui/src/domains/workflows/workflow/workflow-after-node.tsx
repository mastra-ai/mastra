import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Fragment, useState } from 'react';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { Highlight, themes } from 'prism-react-renderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Footprints } from 'lucide-react';

export type AfterNode = Node<
  {
    steps: string[];
  },
  'after-node'
>;

export function WorkflowAfterNode({ data }: NodeProps<AfterNode>) {
  const { steps } = data;
  const [open, setOpen] = useState(true);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('bg-mastra-bg-3 rounded-md w-[274px] flex flex-col p-2 gap-2')}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />

      <CollapsibleTrigger className="flex items-center justify-between w-full">
        <Text
          size={'xs'}
          weight="medium"
          className="text-mastra-el-3 bg-mastra-bg-11 my-auto block rounded-[0.125rem] px-2 py-1 text-[10px] w-fit"
        >
          AFTER
        </Text>
        <ChevronDown
          className={cn('w-4 h-4 transition-transform', {
            'transform rotate-180': open,
          })}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2">
        {steps.map(step => (
          <div className="text-sm bg-mastra-bg-9 flex items-center gap-[6px] rounded-sm  p-2" key={step}>
            <Footprints className="text-current w-4 h-4" />
            <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
              {step}
            </Text>
          </div>
        ))}
      </CollapsibleContent>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </Collapsible>
  );
}
