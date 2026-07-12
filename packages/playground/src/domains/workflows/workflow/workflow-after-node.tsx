import { Badge } from '@mastra/playground-ui/components/Badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { ChevronDown, Footprints } from 'lucide-react';
import { useState } from 'react';

import { BADGE_COLORS, BADGE_ICONS } from './workflow-node-badges';

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
      className={cn('flex w-[274px] flex-col gap-2 rounded-md bg-surface4 p-2')}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />

      <CollapsibleTrigger className="flex w-full items-center justify-between">
        <Badge icon={<BADGE_ICONS.after className="text-current" style={{ color: BADGE_COLORS.after }} />}>AFTER</Badge>
        <Icon>
          <ChevronDown
            className={cn('text-neutral3 transition-transform', {
              'transform rotate-180': open,
            })}
          />
        </Icon>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2">
        {steps.map(step => (
          <div className="flex items-center gap-1.5 rounded-sm bg-surface5 p-2  text-sm" key={step}>
            <Footprints className="size-4 text-current" />
            <Txt variant="ui-xs" className="text-neutral6 capitalize">
              {step}
            </Txt>
          </div>
        ))}
      </CollapsibleContent>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </Collapsible>
  );
}
