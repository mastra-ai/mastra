import { WorkflowTrigger } from '@mastra/core';

import { Icon } from '@/components/icon';
import { Text } from '@/components/ui/text';
import { Tooltip, TooltipContent, TooltipPortal, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { lodashTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import { useIntegrationDetails } from '@/domains/integrations/hooks/use-integration';

import last from 'lodash/last';

import { useWorkflowContext } from '../../context/workflow-context';
import { extractConditions } from '../../utils';
import { FrameworkIcon } from '../utils/action-selector';

import { WorkflowGraphAddBlock } from './workflow-graph-add-block';

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-mastra-border-1',
  states: 'hover:border-mastra-border-5 focus:border-mastra-border-5',
  header: 'p-[10px] text-[13px] flex gap-[7px] items-center',
  details: 'bg-neutral-800 rounded-b-md p-[10px] text-[10px] text-left text-neutral-300',
};

export function TriggerBlock({ trigger }: { trigger: WorkflowTrigger }) {
  const { setSelectedBlock, frameworkEvents, selectedBlock, attemptedPublish, isTriggerValid } = useWorkflowContext();

  const concreteTrigger = frameworkEvents.find(systemEvent => systemEvent?.key === trigger?.type);

  const { integration } = useIntegrationDetails({
    name: concreteTrigger?.integrationName!,
  });

  const handleTriggerClick = () => {
    setSelectedBlock({
      type: 'trigger',
      block: trigger,
    });
  };

  if (!concreteTrigger)
    return (
      <>
        <div
          onClick={handleTriggerClick}
          className={cn(
            blockStyles.default,
            blockStyles.states,
            'bg-mastra-bg-3 flex min-w-[274px] gap-[10px] !border-dashed p-[10px]',
            {
              'border-mastra-border-5': selectedBlock?.type === 'trigger',
            },
          )}
          title="Trigger"
        >
          <div className={cn('flex gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
            <Icon name="enrich" className="text-mastra-el-4" />
            <Text className="text-mastra-el-4" size="xs" weight="medium">
              Trigger
            </Text>
          </div>
          <Text className="text-mastra-el-3 max-w-[120px] text-left text-[10px]">
            Select event that starts your workflow
          </Text>
        </div>
        <div
          role="presentation"
          className={cn('from-mastra-el-1 to-mastra-bg-1 relative h-[30px] w-[1px] bg-gradient-to-t')}
        />
        <WorkflowGraphAddBlock parentActionId="" isParentATrigger />
      </>
    );

  // for now, we recursively extract conditions to a flat array
  const conditions = extractConditions(trigger?.condition);

  const { label, integrationName } = concreteTrigger;

  return (
    <TooltipProvider>
      <div
        onClick={handleTriggerClick}
        className={cn(blockStyles.default, blockStyles.states, 'bg-mastra-bg-8 min-w-[17rem] rounded-[0.3125rem]', {
          'border-mastra-border-5': selectedBlock?.block?.id === trigger?.id,
        })}
      >
        <div className={cn(blockStyles.header)}>
          <div className={cn('flex items-center gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
            <FrameworkIcon
              icon={{ icon: integration?.logoUrl || 'dashboard', alt: integrationName || 'dashboard' }}
              className="text-current"
            />
            <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
              {label}
            </Text>
          </div>
          {attemptedPublish && !isTriggerValid && (
            <Tooltip>
              <TooltipTrigger>
                <div
                  className={cn('border-mastra-border-2 bg-mastra-bg-9 rounded-sm border-[0.4px] border-solid p-1', {})}
                >
                  <Icon name="warning-square" className="text-mastra-el-warning" />
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
      </div>
      <div
        role="presentation"
        className={cn('from-mastra-el-1 to-mastra-bg-1 relative h-[30px] w-[1px] bg-gradient-to-t')}
      />
      <WorkflowGraphAddBlock isParentATrigger parentActionId="" />
    </TooltipProvider>
  );
}
