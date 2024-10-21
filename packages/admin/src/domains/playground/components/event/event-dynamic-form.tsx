'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { RefinedIntegrationEvent } from '@mastra/core/dist/types';
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
import ObjectComponent from '@/domains/workflows/components/workflow-sidebar/config-forms/object-field';
import ReferenceSelect from '@/domains/workflows/components/workflow-sidebar/config-forms/reference-select';
import UnionComponent from '@/domains/workflows/components/workflow-sidebar/config-forms/union-field';
import { useFrameworkEvent } from '@/domains/workflows/hooks/use-framework-event';
import { schemaToFormFieldRenderer } from '@/domains/workflows/schema';
import { IntegrationFieldTypeEnum } from '@/domains/workflows/types';

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
  const { selectedEvent, setSelectedEvent, mastraConnectionId, setMastraConnectionId } = useEventPlaygroundContext();

  const { frameworkEvent, isLoading } = useFrameworkEvent({
    eventKey: selectedEvent?.key!,
    integrationName: selectedEvent?.integrationName!,
    connectionId: mastraConnectionId,
  });

  if (!selectedEvent) {
    return null;
  }

  const title = selectedEvent.label;

  return (
    <ScrollArea className="h-full w-full" viewportClassName="mastra-actions-form-scroll-area">
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
            <Label className="capitalize flex gap-0.5" htmlFor="mastraConnectionId" aria-required={true}>
              <span className="text-red-500">*</span>
              <Text variant="secondary" className="text-mastra-el-3" size="xs">
                Reference ID to use to execute the event
              </Text>
            </Label>

            <ReferenceSelect
              selected={mastraConnectionId}
              onSelect={({ value }: { value: any }) => {
                setMastraConnectionId(value);
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
  const { setPayload, setEventRunState, setEventResult, eventRunState, buttonContainer, mastraConnectionId } =
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
          connectionId: mastraConnectionId,
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

export function renderDynamicForm({
  schema,
  block,
  handleFieldChange,
  control,
  formValues,
  errors,
  parentField,
  isNullable,
}: {
  schema: ZodSchema;
  block: RefinedIntegrationEvent;
  handleFieldChange: ({ key, value }: { key: any; value: any }) => void;
  control: Control<any, any>;
  formValues: any;
  parentField?: string;
  errors: FieldErrors<any>;
  isNullable?: boolean;
}) {
  if (schema instanceof z.ZodObject) {
    return Object.entries(((schema as any) || {})?.shape).map(([field, innerSchema]) => {
      const currentField = parentField ? `${parentField}.${field}` : field;
      return resolveSchemaComponent({
        schema: innerSchema as any,
        parentField: currentField,
        block,
        handleFieldChange,
        control,
        formValues,
        errors,
        isNullable,
      });
    });
  }

  return resolveSchemaComponent({
    schema,
    parentField: parentField!,
    block,
    handleFieldChange,
    control,
    formValues,
    errors,
    isNullable,
  });
}

function resolveSchemaComponent({
  schema,
  parentField,
  block,
  handleFieldChange,
  control,
  formValues,
  errors,
  isArray = false,
  isOptional = false,
  isNullable,
}: {
  schema: ZodSchema;
  parentField: string;
  block: RefinedIntegrationEvent;
  handleFieldChange: ({ key, value }: { key: any; value: any }) => void;
  control: Control<any, any>;
  formValues: any;
  errors: FieldErrors<any>;
  isArray?: boolean;
  isOptional?: boolean;
  isNullable?: boolean;
}) {
  const currentField = parentField;

  if (schema instanceof z.ZodDefault) return;
  if (schema instanceof z.ZodOptional) {
    return resolveSchemaComponent({
      schema: schema?._def?.innerType as any,
      parentField: currentField,
      block,
      handleFieldChange,
      control,
      formValues,
      errors,
      isOptional: true,
      isNullable,
    });
  }
  if (schema instanceof z.ZodObject) {
    return (
      <div key={currentField} className="flex flex-col gap-8 py-8">
        <ObjectComponent
          renderDynamicForm={renderDynamicForm}
          schema={schema}
          block={block}
          handleFieldChange={handleFieldChange}
          control={control}
          formValues={formValues}
          errors={errors}
          parentField={currentField}
          isArray={isArray}
          isOptional={isOptional}
        />
      </div>
    );
  }
  if (schema instanceof z.ZodUnion) {
    if (schema.options.some((s: z.ZodType) => s instanceof z.ZodNull)) {
      const nonNullSchema = schema.options.find((s: z.ZodType) => !(s instanceof z.ZodNull));

      return resolveSchemaComponent({
        schema: z.optional(nonNullSchema) as any,
        parentField: currentField,
        block,
        handleFieldChange,
        control,
        formValues,
        errors,
        isNullable: true,
      });
    }
    return (
      <div key={currentField} className="flex flex-col gap-8 py-8">
        <UnionComponent
          renderDynamicForm={renderDynamicForm}
          schema={schema}
          block={block}
          handleFieldChange={handleFieldChange}
          control={control}
          formValues={formValues}
          errors={errors}
          parentField={currentField}
          isOptional={isOptional}
          isNullable={isNullable}
        />
      </div>
    );
  }

  if (schema instanceof z.ZodArray) {
    if (schema._def.type instanceof z.ZodString) {
      return (
        <div key={currentField} className="flex flex-col gap-2">
          {schemaToFormFieldRenderer({
            schemaField: currentField as string,
            schema: schema as any,
            schemaOptions: (block as any).schemaOptions?.[currentField],
            onFieldChange: handleFieldChange,
            control,
            renderFieldMap: getWorkflowFormFieldMap({
              canUseVariables: false,
              fieldFromDescription: IntegrationFieldTypeEnum.CREATABLE_SELECT,
              isNullable,
            }),
            values: formValues,
            errors,
            isOptional,
            isNullable,
          })}
        </div>
      );
    }

    if (schema._def.type instanceof z.ZodEnum) {
      return (
        <div key={currentField} className="flex flex-col gap-2">
          {schemaToFormFieldRenderer({
            schemaField: currentField as string,
            schema: schema as any,
            schemaOptions: (block as any).schemaOptions?.[currentField],
            onFieldChange: handleFieldChange,
            control,
            renderFieldMap: getWorkflowFormFieldMap({
              canUseVariables: false,
              fieldFromDescription: IntegrationFieldTypeEnum.MULTI_SELECT,
              isNullable,
            }),
            values: formValues,
            errors,
            isOptional,
            isNullable,
          })}
        </div>
      );
    }

    return resolveSchemaComponent({
      schema: schema.element as any,
      parentField: currentField,
      block,
      handleFieldChange,
      control,
      formValues,
      errors,
      isArray: true,
      isOptional,
      isNullable,
    });
  }

  const fieldFromDescription = (schema as ZodSchema)?._def?.description?.split('::')[1];

  return (
    <div key={currentField} className="flex flex-col gap-2">
      {schemaToFormFieldRenderer({
        schemaField: currentField as string,
        schema: schema as any,
        onFieldChange: handleFieldChange,
        control,
        renderFieldMap: getWorkflowFormFieldMap({
          canUseVariables: false,
          fieldFromDescription,
          isNullable,
        }),
        values: formValues,
        errors,
        isOptional,
        isNullable,
      })}
    </div>
  );
}
