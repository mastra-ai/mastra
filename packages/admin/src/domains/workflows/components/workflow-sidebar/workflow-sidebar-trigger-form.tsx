import type { WorkflowTrigger, UpdateTrigger, RefinedIntegrationEvent } from '@mastra/core';
import { createId } from '@paralleldrive/cuid2';
import { ZodSchema } from 'zod';

import { ScrollArea } from '@/components/ui/scroll-area';

import { useIntegrationDetails } from '@/domains/integrations/hooks/use-integration';

import { useWorkflowContext } from '../../context/workflow-context';
import NextStep from '../utils/next-step';
import BlockHeader from '../utils/render-header';

import { TriggerConditionBox } from './trigger-condition-box';

interface WorkflowSidebarTriggerEntityTypeFormProps {
  trigger: WorkflowTrigger;
  onUpdateTrigger: (updatedTrigger: UpdateTrigger) => void;
  onEditTrigger: () => void;
}

export function WorkflowSidebarTriggerForm<T extends ZodSchema>({
  trigger,
  onUpdateTrigger,
  onEditTrigger,
}: WorkflowSidebarTriggerEntityTypeFormProps) {
  const { frameworkEvents, addNewBlankAction } = useWorkflowContext();
  const block = frameworkEvents.find(frameworkEvent => frameworkEvent?.key === trigger.type);

  const handleAddNewAction = () => {
    const id = createId();

    addNewBlankAction({
      newAction: {
        id,
        type: '',
      },
      isParentATrigger: true,
    });
  };

  if (!block) {
    return null;
  }

  console.log({
    block,
  });

  return (
    <TriggerFormWithoutSchema
      trigger={trigger}
      block={block}
      onEditTrigger={onEditTrigger}
      onUpdateTrigger={onUpdateTrigger}
      handleAddNewAction={handleAddNewAction}
    />
  );
}

interface TriggerFormWithoutSchemaProps extends WorkflowSidebarTriggerEntityTypeFormProps {
  block: RefinedIntegrationEvent;
  handleAddNewAction: () => void;
}

const TriggerFormWithoutSchema = ({
  block,
  trigger,
  onUpdateTrigger,
  onEditTrigger,
  handleAddNewAction,
}: TriggerFormWithoutSchemaProps) => {
  const { integration } = useIntegrationDetails({ name: block.integrationName || '' });
  return (
    <ScrollArea className="h-full" viewportClassName="mastra-workflows-scroll-area">
      <div className="flex h-full flex-col pb-5">
        <BlockHeader
          title={block?.label!}
          icon={{ alt: integration?.name || 'dashboard icon', icon: integration?.logoUrl || 'dashboard' }}
          category={'trigger'}
          handleEditBlockType={() => onEditTrigger()}
        />

        {Object.entries((block?.schema as any)?.shape || {})?.length ? (
          <div className="flex flex-col gap-5 border-b-[0.3px] border-[#4F4F4F] p-6">
            <TriggerConditionBox trigger={trigger} onUpdateTrigger={onUpdateTrigger} />
          </div>
        ) : null}

        <NextStep isTrigger className="mt-6 px-6" onAddNextStep={handleAddNewAction} />
      </div>
    </ScrollArea>
  );
};
