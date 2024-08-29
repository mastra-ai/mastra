'use client';

import type { RefinedIntegrationEvent } from '@arkw/core/dist/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { mergeWith } from 'lodash';
import React from 'react';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Text } from '@/components/ui/text';

import { constructObjFromStringPath } from '@/lib/object';
import { toast } from '@/lib/toast';

import { getWorkflowFormFieldMap } from '@/domains/workflows/components/utils/constants';
import BlockHeader from '@/domains/workflows/components/utils/render-header';
import { schemaToFormFieldRenderer } from '@/domains/workflows/schema';
import { customZodResolver } from '@/domains/workflows/utils';

import { useEventPlaygroundContext } from '../providers/event-playground-provider';
import { triggerFrameworkEvent } from '../server-actions/trigger-framework-event';

import TriggerEvent from './event-runner';

function EventDynamicForm<T extends ZodSchema>() {
  const { selectedEvent, setSelectedEvent, setPayload } = useEventPlaygroundContext();

  const discriminatedUnionSchemaOptions = (selectedEvent?.schema as any)?._def?.options;

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<z.infer<T>>({
    resolver: zodResolver(selectedEvent?.schema as any),
    // defaultValues: {}
  });

  const formValues = watch();

  if (!selectedEvent || !selectedEvent?.schema) {
    return null;
  }

  const schema = selectedEvent.schema;
  typeof selectedEvent?.schema === `function`
    ? selectedEvent?.schema({ ctx: { referenceId: `1` } })
    : selectedEvent.schema;

  const title = selectedEvent.label;
  // icon comes from framework
  const icon = '';

  function handleFieldChange({ key, value }: { key: keyof z.infer<T>; value: any }) {
    const newFormValues = mergeWith(formValues, constructObjFromStringPath(key as string, value));
    setValue(key as any, value);
    setPayload(newFormValues);
  }

  async function handleTriggerEvent() {
    const parser = selectedEvent?.schema;
    let values = formValues;

    try {
      await triggerFrameworkEvent({
        eventKey: selectedEvent?.key!,
        payload: values,
        referenceId: '1',
      });
      toast.success('Event triggered successfully');
    } catch (error) {
      toast.error('Event trigger failed');
      console.error({ error });
    }
  }

  return (
    <ScrollArea className="h-full w-full" viewportClassName="kepler-actions-form-scroll-area">
      <div className="flex flex-col h-full">
        <form onSubmit={handleSubmit(() => {})} className="flex h-full flex-col">
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
          <section className="flex flex-col gap-5 p-6 pb-0 h-full">
            {renderDynamicForm({
              schema: schema as ZodSchema,
              block: selectedEvent,
              handleFieldChange,
              control,
              formValues,
              errors,
            })}
          </section>
          <TriggerEvent
            className=""
            onTriggerEvent={async () => {
              await handleTriggerEvent();
            }}
          />
        </form>
      </div>
    </ScrollArea>
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
      {Object.entries(((schema as any) || {}).shape).map(([field, schema]) => {
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
