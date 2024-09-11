import type { ActionWithParentCondition } from '@kepler/core';

import { cn } from '@/lib/utils';

import { useWorkflowContext } from '../../context/workflow-context';

import { ActionNode } from './workflow-node';

export function ActionBlock({ action }: { action: ActionWithParentCondition }) {
  const { setSelectedBlock } = useWorkflowContext();
  const { parentCondition, ...rest } = action || {};

  const handleActionClick = () => {
    setSelectedBlock({
      type: 'action',
      block: rest || {},
    });
  };

  return (
    <>
      <div role="presentation" className={cn('from-kp-el-2 to-kp-bg-1 relative h-[30px] w-[1px] bg-gradient-to-b')} />
      <ActionNode action={action} handleActionClick={handleActionClick} />
    </>
  );
}
