'use client';

import type { RefinedIntegrationEvent } from '@arkw/core/dist/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { mergeWith } from 'lodash';
import React from 'react';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { constructObjFromStringPath } from '@/lib/object';
import { toast } from '@/lib/toast';

import { getWorkflowFormFieldMap } from '@/domains/workflows/components/utils/constants';
import BlockHeader from '@/domains/workflows/components/utils/render-header';
import ReferenceSelect from '@/domains/workflows/components/workflow-sidebar/config-forms/reference-select';
import { useFrameworkEvent } from '@/domains/workflows/hooks/use-framework-event';
import { schemaToFormFieldRenderer } from '@/domains/workflows/schema';

import { useEventPlaygroundContext } from '../providers/event-playground-provider';
import { triggerFrameworkEvent } from '../server-actions/trigger-framework-event';

import TriggerEvent from './event-runner';

function EventDynamicForm<T extends ZodSchema>() {
  const { selectedEvent, setSelectedEvent, arkwReferenceId, setArkwReferenceId } = useEventPlaygroundContext();

  const { frameworkEvent, isLoading } = useFrameworkEvent({
    eventKey: selectedEvent?.key!,
    integrationName: selectedEvent?.integrationName!,
    referenceId: arkwReferenceId,
  });

  if (!selectedEvent) {
    return null;
  }

  const title = selectedEvent.label;
  // icon comes from framework
  const icon = '';

  return (
    <ScrollArea className="h-full w-full" viewportClassName="kepler-actions-form-scroll-area">
      <div className="flex flex-col h-full">
        <BlockHeader
          title={title as string}
          icon={
            icon || {
              alt: 'dashboard icon',
              icon: 'dashboard',
            }
          }
          category={'trigger'}
          handleEditBlockType={() => setSelectedEvent(undefined)}
        />
        <div className="mt-5 px-6">
          <Text weight="medium" className="text-arkw-el-3">
            Inputs
          </Text>
        </div>
        <section className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-3 px-6">
            <Label className="capitalize flex gap-1" htmlFor="arkwReferenceId" aria-required={true}>
              <span className="text-red-500">*</span>
              <Text variant="secondary" className="text-arkw-el-3" size="xs">
                Reference ID to use execute the event
              </Text>
            </Label>

            <ReferenceSelect
              selected={arkwReferenceId}
              onSelect={({ value }: { value: any }) => {
                setArkwReferenceId(value);
              }}
              integrationName={selectedEvent?.integrationName!}
            />
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-5 px-6">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ) : (
            <InnerEventDynamicForm block={frameworkEvent!} />
          )}
        </section>
      </div>
    </ScrollArea>
  );
}

function InnerEventDynamicForm<T extends ZodSchema>({ block }: { block: RefinedIntegrationEvent }) {
  const { setPayload, payload, arkwReferenceId } = useEventPlaygroundContext();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.infer<T>>({
    resolver: zodResolver(block?.schema as any),
    // defaultValues: {}
  });

  const formValues = watch();

  if (!block || !block?.schema) {
    return null;
  }

  const schema = block?.schema;

  function handleFieldChange({ key, value }: { key: keyof z.infer<T>; value: any }) {
    const newFormValues = mergeWith(formValues, constructObjFromStringPath(key as string, value));
    setValue(key as any, value);
    setPayload(newFormValues);
  }

  async function handleTriggerEvent() {
    let values = formValues;

    try {
      await triggerFrameworkEvent({
        eventKey: block?.key!,
        payload: values,
        referenceId: arkwReferenceId,
        integrationName: block?.integrationName!,
      });
      toast.success('Event triggered successfully');
    } catch (error) {
      toast.error('Event trigger failed');
      console.error({ error });
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(() => {})} className="flex flex-col gap-5 px-6 pb-0 h-full">
        {renderDynamicForm({
          schema: schema as ZodSchema,
          block,
          handleFieldChange,
          control,
          formValues,
          errors,
        })}
      </form>
      <TriggerEvent
        className="px-6"
        onTriggerEvent={async () => {
          await handleTriggerEvent();
        }}
      />
    </>
  );
}

export default EventDynamicForm;

function renderDynamicForm({
  schema,
  block,
  handleFieldChange,
  control,
  formValues,
  errors,
  parentField,
}: {
  schema: ZodSchema;
  block: RefinedIntegrationEvent;
  handleFieldChange: ({ key, value }: { key: any; value: any }) => void;
  control: Control<any, any>;
  formValues: any;
  parentField?: string;
  errors: FieldErrors<any>;
}) {
  return (
    <>
      {Object?.entries(((schema as any) || {}).shape).map(([field, schema]) => {
        const currentField = parentField ? `${parentField}.${field}` : field;
        if (schema instanceof z.ZodDefault) return;
        if (schema instanceof z.ZodObject) {
          return (
            <React.Fragment key={currentField}>
              {renderDynamicForm({
                schema,
                block,
                handleFieldChange,
                control,
                formValues,
                errors,
                parentField: currentField,
              })}
            </React.Fragment>
          );
        }

        const fieldFromDescription = (schema as ZodSchema)?._def?.description?.split('::')[1];

        return (
          <div key={currentField} className="flex flex-col gap-1">
            {schemaToFormFieldRenderer({
              schemaField: currentField as string,
              schema: schema as any,
              // schemaOptions: block.schemaOptions?.[currentField],
              onFieldChange: handleFieldChange,
              control,
              renderFieldMap: getWorkflowFormFieldMap({
                canUseVariables: false,
                fieldFromDescription,
              }),
              values: formValues,
              errors,
            })}
          </div>
        );
      })}
    </>
  );
}
