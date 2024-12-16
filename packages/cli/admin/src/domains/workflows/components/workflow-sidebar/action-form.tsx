'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ActionVariables, WorkflowAction, RefinedIntegrationApi } from '@mastra/core';
import { mergeWith } from 'lodash';
import React, { useEffect } from 'react';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { constructObjFromStringPath } from '@/lib/object';

import { systemLogics } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';
import { useFrameworkApi } from '../../hooks/use-framework-api';
import { schemaToFormFieldRenderer } from '../../schema';
import { customZodResolver } from '../../utils';
import { getWorkflowFormFieldMap } from '../utils/constants';
import NextStep from '../utils/next-step';
import BlockHeader from '../utils/render-header';

import ConditionsForm from './conditions-form';
import ObjectComponent from './config-forms/object-field';
import ReferenceSelect from './config-forms/reference-select';
import UnionComponent from './config-forms/union-field';

interface FormProps<T extends ZodSchema> {
  action: WorkflowAction;
  onUpdateAction: () => void;
  onBlur?: ({
    payload,
    variables,
  }: {
    payload: Record<string, any>;
    variables?: Record<string, ActionVariables>;
  }) => void;
  handleEditActionType: (action: WorkflowAction) => void;
}

function DynamicForm<T extends ZodSchema>({ action, onUpdateAction, onBlur, handleEditActionType }: FormProps<T>) {
  const { frameworkApis } = useWorkflowContext();
  const block = frameworkApis.find(fraeworkApi => fraeworkApi.type === action.type);
  const logicBlock = systemLogics.find(sampleAction => sampleAction.type === action.type);
  const { frameworkApi, isLoading } = useFrameworkApi({
    apiType: block?.type!,
    integrationName: block?.integrationName!,
    connectionId: action?.payload?.mastraConnectionId || '',
  });

  if (logicBlock) {
    //this renders the action form for when it's a condtion/logic type
    return <ConditionsForm actionId={action.id} block={logicBlock} />;
  }

  if (!block) {
    return null;
  }

  const title = block.label;
  const icon = block.icon;

  return (
    <ScrollArea className="h-full w-full" viewportClassName="mastra-actions-form-scroll-area">
      <div className="flex flex-col pb-5 h-full">
        <BlockHeader
          title={title}
          icon={
            icon || {
              alt: 'dashboard icon',
              icon: 'dashboard',
            }
          }
          category={'action'}
          handleEditBlockType={() => handleEditActionType(action)}
        />
        <div className="mt-5 px-6">
          <Text weight="medium" className="text-mastra-el-3">
            Inputs
          </Text>
        </div>
        <section className="flex flex-col py-6 gap-5">
          <div className="flex flex-col gap-3 px-6">
            <Label className="capitalize" htmlFor="mastraConnectionId" aria-required={true}>
              <Text variant="secondary" className="text-mastra-el-3" size="xs">
                Reference ID to use to execute the API
              </Text>
            </Label>

            <ReferenceSelect
              selected={action?.payload?.mastraConnectionId}
              onSelect={({ value }: { value: any }) => {
                onBlur?.({ payload: { ...(action?.payload || {}), mastraConnectionId: value } });
              }}
              integrationName={block?.integrationName}
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
            <InnerDynamicForm block={frameworkApi!} action={action} onUpdateAction={onUpdateAction} onBlur={onBlur} />
          )}
        </section>
      </div>
    </ScrollArea>
  );
}

interface InnerFormProps<T extends ZodSchema> {
  action: WorkflowAction;
  onUpdateAction: () => void;
  onBlur?: ({
    payload,
    variables,
  }: {
    payload: Record<string, any>;
    variables?: Record<string, ActionVariables>;
  }) => void;
  block: RefinedIntegrationApi;
}

function InnerDynamicForm<T extends ZodSchema>({ block, action, onUpdateAction, onBlur }: InnerFormProps<T>) {
  const { attemptedPublish } = useWorkflowContext();

  const blockSchemaTypeName = (block?.zodSchema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (block?.schema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (block?.zodSchema as any)?._def?.discriminator;

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
        ? customZodResolver(block?.schema as any, discriminatedUnionSchemaDiscriminator)
        : zodResolver(block?.schema as any),
    defaultValues: action.payload as any,
  });

  const formValues = watch();

  useEffect(() => {
    if (attemptedPublish && action.payload) {
      trigger();
    }
  }, [attemptedPublish]);

  if (!block || !block?.schema) {
    return null;
  }

  function handleFieldChange({
    key,
    value,
    variables,
  }: {
    key: keyof z.infer<T>;
    value: any;
    variables?: ActionVariables;
  }) {
    if (key === discriminatedUnionSchemaDiscriminator) {
      reset({ [key]: value });
      const newFormValues = constructObjFromStringPath(key as string, value);
      onBlur?.({
        payload: { ...newFormValues, mastraConnectionId: action?.payload?.mastraConnectionId },
        variables: variables ? { [key]: variables } : undefined,
      });
    } else {
      setValue<any>(key, value);
      if (attemptedPublish) {
        trigger();
      }
      const newFormValues = mergeWith(formValues, constructObjFromStringPath(key as string, value));
      onBlur?.({
        payload: { ...newFormValues, mastraConnectionId: action?.payload?.mastraConnectionId },
        variables: variables ? { [key]: variables } : undefined,
      });
    }
  }

  const discriminatorValue = discriminatedUnionSchemaDiscriminator
    ? watch(discriminatedUnionSchemaDiscriminator)
    : undefined;

  const schema =
    blockSchemaTypeName === 'ZodDiscriminatedUnion'
      ? discriminatedUnionSchemaOptions?.find(
          (option: any) => option?.shape?.[discriminatedUnionSchemaDiscriminator]?._def?.value === discriminatorValue,
        ) || z.object({ [discriminatedUnionSchemaDiscriminator]: z.string() })
      : block?.schema;

  return (
    <>
      <form onSubmit={handleSubmit(onUpdateAction)} className="flex flex-col gap-5 px-6 pb-0">
        {renderDynamicForm({
          schema,
          block,
          action,
          handleFieldChange,
          control,
          formValues,
          errors,
        })}
      </form>
      <NextStep actionId={action.id} className="mt-6 px-6" onAddNextStep={onUpdateAction} />
    </>
  );
}

export default DynamicForm;

function renderDynamicForm({
  schema,
  block,
  action,
  handleFieldChange,
  control,
  formValues,
  errors,
  parentField,
}: {
  schema: ZodSchema;
  block: RefinedIntegrationApi;
  action: WorkflowAction;
  handleFieldChange: ({ key, value, variables }: { key: any; value: any; variables?: ActionVariables }) => void;
  control: Control<any, any>;
  formValues: any;
  parentField?: string;
  errors: FieldErrors<any>;
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
        action,
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
    action,
  });
}

function resolveSchemaComponent({
  schema,
  parentField,
  block,
  action,
  handleFieldChange,
  control,
  formValues,
  errors,
  isArray = false,
  isNullable = false,
  isOptional = false,
}: {
  schema: ZodSchema;
  parentField: string;
  block: RefinedIntegrationApi;
  action: WorkflowAction;
  handleFieldChange: ({ key, value }: { key: any; value: any }) => void;
  control: Control<any, any>;
  formValues: any;
  errors: FieldErrors<any>;
  isArray?: boolean;
  isNullable?: boolean;
  isOptional?: boolean;
}) {
  const currentField = parentField;

  if (schema instanceof z.ZodDefault) return;
  if (schema instanceof z.ZodOptional) {
    return resolveSchemaComponent({
      schema: schema?._def?.innerType as any,
      parentField: currentField,
      block,
      action,
      handleFieldChange,
      control,
      formValues,
      errors,
      isOptional: true,
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
          action={action}
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
        action,
        isNullable: true,
        isOptional,
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
          action={action}
          isOptional={isOptional}
        />
      </div>
    );
  }

  if (schema instanceof z.ZodArray) {
    return resolveSchemaComponent({
      schema: schema.element as any,
      parentField: currentField,
      block,
      action,
      handleFieldChange,
      control,
      formValues,
      errors,
      isArray: true,
      isOptional,
    });
  }

  const fieldFromDescription = (schema as ZodSchema)?._def?.description?.split('::')[1];

  return (
    <div key={currentField} className="flex flex-col gap-2">
      {schemaToFormFieldRenderer({
        schemaField: currentField as string,
        schema: schema as any,
        schemaOptions: block.schemaOptions?.[currentField],
        onFieldChange: handleFieldChange,
        variables: action.variables,
        control,
        renderFieldMap: getWorkflowFormFieldMap({
          canUseVariables: currentField !== 'entityType',
          fieldFromDescription,
        }),
        values: formValues,
        errors,
        isOptional,
      })}
    </div>
  );
}
