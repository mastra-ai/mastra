import type { WorkflowTrigger, UpdateTrigger, RefinedIntegrationEventTriggerProperties } from '@arkw/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { createId } from '@paralleldrive/cuid2';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { ScrollArea } from '@/components/ui/scroll-area';

import { useWorkflowContext } from '../../context/workflow-context';
import { schemaToFormFieldRenderer } from '../../schema';
import { customZodResolver } from '../../utils';
import { getWorkflowFormFieldMap } from '../utils/constants';
// import { events } from '../utils/fields';
import NextStep from '../utils/next-step';
import BlockHeader from '../utils/render-header';

import { TriggerConditionBox } from './trigger-condition-box';

interface WorkflowSidebarTriggerRecordTypeFormProps {
  trigger: WorkflowTrigger;
  onUpdateTrigger: (updatedTrigger: UpdateTrigger) => void;
  onEditTrigger: () => void;
}

export function WorkflowSidebarTriggerForm<T extends ZodSchema>({
  trigger,
  onUpdateTrigger,
  onEditTrigger,
}: WorkflowSidebarTriggerRecordTypeFormProps) {
  const { frameworkEvents, addNewBlankAction } = useWorkflowContext();
  const block = frameworkEvents.find(frameworkEvent => frameworkEvent.type === trigger.type);
  const isRecordType = trigger?.type?.toLocaleLowerCase()?.includes('record');

  const blockOutputSchemaTypeName = (block?.zodOutputSchema as any)?._def?.typeName;
  const blockSchemaTypeName = (block?.zodSchema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (block?.schema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (block?.zodSchema as any)?._def?.discriminator;

  const formRef = useRef<HTMLFormElement>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.infer<T>>({
    resolver:
      blockSchemaTypeName === 'ZodDiscriminatedUnion'
        ? customZodResolver(block?.schema as any, discriminatedUnionSchemaDiscriminator)
        : zodResolver(block?.schema as any),
    defaultValues: trigger?.payload?.value as any,
  });

  const handleAddNewAction = () => {
    const id = createId();

    addNewBlankAction({
      newAction: {
        id,
        type: '',
      },
      isParentATrigger: true,
    });

    //write to temp file
  };

  if (!block) {
    return null;
  }

  if (!block.schema) {
    //this renders the trigger form for triggers without schema
    return (
      <TriggerFormWithoutSchema
        trigger={trigger}
        block={block}
        blockOutputSchemaTypeName={blockOutputSchemaTypeName}
        onEditTrigger={onEditTrigger}
        onUpdateTrigger={onUpdateTrigger}
        handleAddNewAction={handleAddNewAction}
      />
    );
  }

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? watch(discriminatedUnionSchemaDiscriminator)
    : undefined;

  const allValues = watch();

  const schema =
    blockSchemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchemaOptions?.find(
          (option: any) => option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value === discriminatorValue,
        ) || z.object({ [discriminatedUnionSchemaDiscriminator]: z.string() })
      : block.schema;

  const onSubmit = (data: T) => {
    onUpdateTrigger({
      payload: {
        value: data,
      },
    });

    handleAddNewAction();
  };

  const handleNextStep = () => {
    onUpdateTrigger({
      payload: {
        value: allValues,
      },
    });

    handleAddNewAction();
  };

  function handleFieldChange({ key, value }: { key: keyof z.infer<T>; value: any }) {
    setValue<any>(key, value);
    onUpdateTrigger?.({
      payload: {
        value: { [key]: value },
      },
      ...(allValues[key] !== value && isRecordType ? { condition: undefined } : {}),
    });
  }

  return (
    <ScrollArea className="h-full" viewportClassName="kepler-workflows-scroll-area">
      <div className="flex h-full flex-col pb-5">
        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
          <BlockHeader
            title={block.label}
            icon={
              block.icon || {
                alt: 'dashboard icon',
                icon: 'dashboard',
              }
            }
            category={'trigger'}
            handleEditBlockType={() => onEditTrigger()}
          />
          <section className="flex flex-col gap-5 p-5">
            {Object.entries(((schema as any) || {}).shape).map(([field, schema]) => {
              if (schema instanceof z.ZodDefault) return;
              return (
                <div key={field} className="flex flex-col gap-1">
                  {schemaToFormFieldRenderer({
                    schemaField: field as string,
                    schema: schema as any,
                    schemaOptions: block.schemaOptions?.[field],
                    onFieldChange: handleFieldChange,
                    control,
                    renderFieldMap: getWorkflowFormFieldMap({ canUseVariables: field !== 'recordType' }),
                    errors,
                    values: allValues,
                  })}
                </div>
              );
            })}
          </section>

          {blockOutputSchemaTypeName === 'ZodDiscriminatedUnion' ? (
            <>
              {!!trigger.payload?.value ? (
                <div className="flex flex-col gap-5 p-5 pt-0">
                  {/*this renders the conditions for the trigger*/}
                  <TriggerConditionBox trigger={trigger} onUpdateTrigger={onUpdateTrigger} />
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col gap-5 p-5 pt-0">
              {/*this renders the conditions for the trigger*/}
              <TriggerConditionBox trigger={trigger} onUpdateTrigger={onUpdateTrigger} />
            </div>
          )}

          <hr className="bg-kp-border-1 text-kp-border-1 mx-5 h-[0.5px]" />

          <NextStep isTrigger className="mt-6 px-6" onAddNextStep={handleNextStep} />
        </form>
      </div>
    </ScrollArea>
  );
}

interface TriggerFormWithoutSchemaProps extends WorkflowSidebarTriggerRecordTypeFormProps {
  block: RefinedIntegrationEventTriggerProperties;
  blockOutputSchemaTypeName: string;
  handleAddNewAction: () => void;
}

const TriggerFormWithoutSchema = ({
  block,
  trigger,
  onUpdateTrigger,
  onEditTrigger,
  blockOutputSchemaTypeName,
  handleAddNewAction,
}: TriggerFormWithoutSchemaProps) => {
  return (
    <ScrollArea className="h-full" viewportClassName="kepler-workflows-scroll-area">
      <div className="flex h-full flex-col pb-5">
        <BlockHeader
          title={block.label}
          icon={block.icon || { alt: 'dashboard icon', icon: 'dashboard' }}
          category={'trigger'}
          handleEditBlockType={() => onEditTrigger()}
        />

        {blockOutputSchemaTypeName === 'ZodDiscriminatedUnion' ? (
          <>
            {!!trigger.payload?.value ? (
              <div className="flex flex-col gap-5 border-b-[0.3px] border-[#4F4F4F] p-6">
                <TriggerConditionBox trigger={trigger} onUpdateTrigger={onUpdateTrigger} />
              </div>
            ) : null}
          </>
        ) : !!blockOutputSchemaTypeName ? (
          <div className="flex flex-col gap-5 border-b-[0.3px] border-[#4F4F4F] p-6">
            <TriggerConditionBox trigger={trigger} onUpdateTrigger={onUpdateTrigger} />
          </div>
        ) : null}

        <NextStep isTrigger className="mt-6 px-6" onAddNextStep={handleAddNewAction} />
      </div>
    </ScrollArea>
  );
};
