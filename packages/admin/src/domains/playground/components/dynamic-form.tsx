'use client';

import type { RefinedIntegrationAction } from '@arkw/core';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Text } from '@/components/ui/text';

import { toast } from '@/lib/toast';

import { getWorkflowFormFieldMap } from '@/domains/workflows/components/utils/constants';
import BlockHeader from '@/domains/workflows/components/utils/render-header';
import { schemaToFormFieldRenderer } from '@/domains/workflows/schema';
import { customZodResolver } from '@/domains/workflows/utils';

import { useActionPlaygroundContext } from '../providers/action-playground-provider';
import { executeFrameworkAction } from '../server-actions/execute-framework-actions';

import ExecuteAction from './action-runner';

function DynamicForm<T extends ZodSchema>() {
  const { selectedAction, setSelectedAction, setPayload } = useActionPlaygroundContext();

  const blockSchemaTypeName = (selectedAction?.zodSchema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (selectedAction?.schema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (selectedAction?.zodSchema as any)?._def?.discriminator;

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    trigger,
    formState: { errors },
  } = useForm<z.infer<T>>({
    resolver:
      blockSchemaTypeName === 'ZodDiscriminatedUnion'
        ? customZodResolver(selectedAction?.schema as any, discriminatedUnionSchemaDiscriminator)
        : zodResolver(selectedAction?.schema as any),
    // defaultValues: {}
  });

  const formValues = watch();

  if (!selectedAction || !selectedAction?.schema) {
    return null;
  }

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? watch(discriminatedUnionSchemaDiscriminator)
    : undefined;

  const schema =
    blockSchemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchemaOptions?.find(
          (option: any) => option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value === discriminatorValue,
        ) || z.object({ [discriminatedUnionSchemaDiscriminator]: z.string() })
      : selectedAction?.schema;

  const title = selectedAction.label;
  const icon = selectedAction.icon;

  function handleFieldChange({ key, value }: { key: keyof z.infer<T>; value: any }) {
    if (key === discriminatedUnionSchemaDiscriminator) {
      setValue(key as any, value);
      setPayload({ ...formValues, [key]: value });
    } else {
      setValue(key as any, value);
      setPayload({ ...formValues, [key]: value });
    }
  }

  async function handleRunAction() {
    const parser = selectedAction?.schema;
    let values = formValues;

    try {
      if (parser) {
        values = (parser as ZodSchema).parse(formValues);
      }
      await executeFrameworkAction({
        action: selectedAction?.type!,
        payload: { data: values, ctx: { referenceId: `1` } },
        integrationName: selectedAction?.integrationName!,
      });
      toast.success('Action executed successfully');
    } catch (error) {
      toast.error('Action execution failed');
      console.error({ error });
    }
  }

  return (
    <ScrollArea className="h-full w-full" viewportClassName="kepler-actions-form-scroll-area">
      <div className="flex flex-col h-full">
        <form onSubmit={handleSubmit(() => {})} className="flex h-full flex-col">
          <BlockHeader
            title={title}
            icon={
              icon || {
                alt: 'dashboard icon',
                icon: 'dashboard',
              }
            }
            category={'action'}
            handleEditBlockType={() => setSelectedAction(undefined)}
          />
          <div className="mt-5 px-6">
            <Text weight="medium" className="text-kp-el-3">
              Inputs
            </Text>
          </div>
          <section className="flex flex-col gap-5 p-6 pb-0 h-full">
            {renderDynamicForm({
              schema,
              block: selectedAction,
              handleFieldChange,
              control,
              formValues,
              errors,
            })}
          </section>
          <ExecuteAction
            className=""
            onRunAction={async () => {
              const isValid = await trigger();
              if (isValid) {
                await handleRunAction();
              }
            }}
          />
        </form>
      </div>
    </ScrollArea>
  );
}

export default DynamicForm;

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
  block: RefinedIntegrationAction;
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
              schemaOptions: block.schemaOptions?.[currentField],
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
