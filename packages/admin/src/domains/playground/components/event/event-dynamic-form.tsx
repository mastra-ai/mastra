'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { RefinedIntegrationEvent } from '@kpl/core/dist/types';
import { mergeWith } from 'lodash';
import React, { useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { parse } from 'superjson';
import { z, ZodSchema } from 'zod';

import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { getErrorMessage } from '@/lib/error';
import { constructObjFromStringPath } from '@/lib/object';

import { getWorkflowFormFieldMap } from '@/domains/workflows/components/utils/constants';
import BlockHeader from '@/domains/workflows/components/utils/render-header';
import ObjectComponent from '@/domains/workflows/components/workflow-sidebar/config-forms/object-array';
import ReferenceSelect from '@/domains/workflows/components/workflow-sidebar/config-forms/reference-select';
import { useFrameworkEvent } from '@/domains/workflows/hooks/use-framework-event';
import { schemaToFormFieldRenderer } from '@/domains/workflows/schema';

import { useEventPlaygroundContext } from '../../context/event-playground-context';
import { triggerFrameworkEvent } from '../../server-actions/trigger-framework-event';
import { RunApiOrEvent } from '../run-button';

function EventDynamicForm({
  showChangeButton,
  headerClassname,
  icon = '',
}: {
  showChangeButton?: boolean;
  headerClassname?: string;
  icon?: string;
}) {
  const { selectedEvent, setSelectedEvent, keplerConnectionId, setKeplerConnectionId } = useEventPlaygroundContext();

  const { frameworkEvent, isLoading } = useFrameworkEvent({
    eventKey: selectedEvent?.key!,
    integrationName: selectedEvent?.integrationName!,
    connectionId: keplerConnectionId,
  });

  if (!selectedEvent) {
    return null;
  }

  const title = selectedEvent.label;
  // icon comes from framework

  return (
    <ScrollArea className="h-full w-full" viewportClassName="kepler-actions-form-scroll-area">
      <div className="flex flex-col h-full">
        <BlockHeader
          title={title as string}
          icon={
            icon
              ? { icon, alt: '' }
              : {
                  alt: 'dashboard icon',
                  icon: 'dashboard',
                }
          }
          category={'trigger'}
          handleEditBlockType={() => setSelectedEvent(undefined)}
          showChangeButton={showChangeButton}
          classname={headerClassname}
        />
        <section className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-3 px-6">
            <Label className="capitalize flex gap-0.5" htmlFor="keplerConnectionId" aria-required={true}>
              <span className="text-red-500">*</span>
              <Text variant="secondary" className="text-kpl-el-3" size="xs">
                Reference ID to use execute the event
              </Text>
            </Label>

            <ReferenceSelect
              selected={keplerConnectionId}
              onSelect={({ value }: { value: any }) => {
                setKeplerConnectionId(value);
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
  const { setPayload, setEventRunState, setEventResult, eventRunState, buttonContainer, keplerConnectionId } =
    useEventPlaygroundContext();
  const [isPending, startTransition] = useTransition();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<z.infer<T>>({
    resolver: zodResolver(block?.schema as any),
    // defaultValues: {}
  });

  const formValues = watch();

  useEffect(() => {
    if (isPending) {
      setEventRunState('loading');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

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

    startTransition(async () => {
      try {
        const res = await triggerFrameworkEvent({
          eventKey: block?.key!,
          payload: values,
          connectionId: keplerConnectionId,
          integrationName: block?.integrationName!,
        });

        if (!res.ok) {
          setEventRunState('fail');
          setEventResult(
            JSON.stringify(
              {
                error: res.error,
              },
              null,
              2,
            ),
          );
          return;
        }

        const parsedData = parse(res.data) as {
          event: any;
          workflowEvent?: any;
        };

        setEventResult(JSON.stringify(parsedData, null, 2));
        setEventRunState('success');
      } catch (e) {
        setEventRunState('fail');
        setEventResult(
          JSON.stringify(
            {
              error: getErrorMessage(e),
            },
            null,
            2,
          ),
        );
      }
    });
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
      {createPortal(
        <RunApiOrEvent
          context="event"
          eventIsRunning={eventRunState === 'loading'}
          onClick={async () => {
            if (eventRunState !== 'idle') {
              setEventResult('');
            }
            const isValid = await trigger();
            if (isValid) {
              await handleTriggerEvent();
            }
          }}
        />,
        buttonContainer as Element,
      )}
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
        if (schema instanceof z.ZodArray && schema.element instanceof z.ZodObject) {
          return (
            <ObjectComponent
              key={currentField}
              renderDynamicForm={renderDynamicForm}
              schema={schema}
              block={block}
              handleFieldChange={handleFieldChange}
              control={control}
              formValues={formValues}
              errors={errors}
              parentField={currentField}
            />
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
