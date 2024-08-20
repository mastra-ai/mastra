import { WorkflowTrigger } from '@arkw/core';

import { Text } from '@/components/ui/text';
import { Tooltip, TooltipContent, TooltipPortal, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { lodashTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

import last from 'lodash/last';

import { useWorkflowContext } from '../../context/workflow-context';
import { extractConditions } from '../../utils';
import { FrameworkIcon } from '../utils/action-selector';

import { WorkflowGraphAddBlock } from './workflow-graph-add-block';

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-border',
  states: 'hover:border-accent focus:border-accent',
  header: 'p-[10px] text-[13px] flex gap-[7px] items-center',
  details: 'bg-neutral-800 rounded-b-md p-[10px] text-[10px] text-left text-neutral-300',
};

export function TriggerBlock({ trigger }: { trigger: WorkflowTrigger }) {
  const { setSelectedBlock, frameworkEvents, selectedBlock, attemptedPublish, isTriggerValid } = useWorkflowContext();

  const concreteTrigger = frameworkEvents.find(systemEvent => systemEvent.type === trigger?.type);

  const handleTriggerClick = () => {
    setSelectedBlock({
      type: 'trigger',
      block: trigger,
    });
  };

  if (!concreteTrigger)
    return (
      <>
        <button
          onClick={handleTriggerClick}
          className={cn(
            blockStyles.default,
            blockStyles.states,
            'bg-transparent flex min-w-[274px] gap-[10px] !border-dashed p-[10px]',
            {
              'border-accent': selectedBlock?.type === 'trigger',
            },
          )}
          title="New action"
        >
          <div className={cn('flex gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
            <Icon name="enrich" />
            <Text size="xs" weight="medium">
              Trigger
            </Text>
          </div>
          <Text className="max-w-[120px] text-left text-[10px]">Select event that starts your workflow</Text>
        </button>
        <div
          role="presentation"
          className={cn('from-accent to-transparent relative h-[30px] w-[1px] bg-gradient-to-t')}
        />
        <WorkflowGraphAddBlock parentActionId="" isParentATrigger />
      </>
    );

  // for now, we recursively extract conditions to a flat array
  const conditions = extractConditions(trigger?.condition);

  const { label, icon } = concreteTrigger;

  return (
    <TooltipProvider>
      <button
        type="button"
        onClick={handleTriggerClick}
        className={cn(blockStyles.default, blockStyles.states, 'bg-transparent min-w-[17rem] rounded-[0.3125rem]', {
          'border-accent': selectedBlock?.block?.id === trigger?.id,
        })}
      >
        <div className={cn(blockStyles.header)}>
          <span className={cn('border-border bg-transparent rounded-sm border-[0.4px] border-solid p-2', {})}>
            <FrameworkIcon icon={icon} className="text-current" />
          </span>
          <Text size="xs" weight="medium" className="text-kp-el-6 capitalize">
            {label}
          </Text>
          {attemptedPublish && !isTriggerValid && (
            <Tooltip>
              <TooltipTrigger>
                <div className={cn('border-border bg-transparent rounded-sm border-[0.4px] border-solid p-1', {})}>
                  <Icon name="warning-square" className="text-[#F09A56]" />
                </div>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent side="top" className="bg-dialog-bg rounded-md p-1 px-3">
                  Has unfilled required input(s)
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}
        </div>

        {conditions?.length ? (
          <div className={cn(blockStyles.details)}>
            {conditions.map((condition, index) => (
              <div key={index}>
                {condition.conj ? <span className="font-extrabold">{condition.conj.toLocaleUpperCase()}</span> : null}
                <p>
                  When{' '}
                  <i>
                    {lodashTitleCase(last(condition.field?.split('.')) || '')} <b>{condition.operator}</b>{' '}
                    {condition.value as any}
                  </i>
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </button>
      <div
        role="presentation"
        className={cn('from-accent to-transparent relative h-[30px] w-[1px] bg-gradient-to-t')}
      />
      <WorkflowGraphAddBlock isParentATrigger parentActionId="" />
    </TooltipProvider>
  );
}
