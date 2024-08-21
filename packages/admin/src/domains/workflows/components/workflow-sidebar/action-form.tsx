'use client';

import type { ActionVariables, WorkflowAction, RefinedIntegrationAction } from '@arkw/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { mergeWith } from 'lodash';
import React, { useEffect } from 'react';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Text } from '@/components/ui/text';

import { constructObjFromStringPath } from '@/lib/object';

import { systemLogics } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';
import { schemaToFormFieldRenderer } from '../../schema';
import { customZodResolver } from '../../utils';
import { getWorkflowFormFieldMap } from '../utils/constants';
import NextStep from '../utils/next-step';
import BlockHeader from '../utils/render-header';

import ConditionsForm from './conditions-form';

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
  const { frameworkActions, attemptedPublish } = useWorkflowContext();
  const block = frameworkActions.find(frameworkAction => frameworkAction.type === action.type);
  const logicBlock = systemLogics.find(sampleAction => sampleAction.type === action.type);

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

  if (logicBlock) {
    //this renders the action form for when it's a condtion/logic type
    return <ConditionsForm actionId={action.id} block={logicBlock} />;
  }

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
      onBlur?.({ payload: { ...newFormValues }, variables: variables ? { [key]: variables } : undefined });
    } else {
      setValue<any>(key, value);
      if (attemptedPublish) {
        trigger();
      }
      const newFormValues = mergeWith(formValues, constructObjFromStringPath(key as string, value));
      onBlur?.({ payload: { ...newFormValues }, variables: variables ? { [key]: variables } : undefined });
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

  const title = block.label;
  const icon = block.icon;

  return (
    <ScrollArea className="h-full w-full" viewportClassName="kepler-actions-form-scroll-area">
      <div className="flex flex-col pb-5">
        <form onSubmit={handleSubmit(onUpdateAction)} className="flex h-full flex-col">
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
            <Text weight="medium" className="text-arkw-el-3">
              Inputs
            </Text>
          </div>
          <section className="flex flex-col gap-5 p-6 pb-0">
            {renderDynamicForm({
              schema,
              block,
              action,
              handleFieldChange,
              control,
              formValues,
              errors,
            })}
          </section>
          <NextStep actionId={action.id} className="mt-6 px-6" onAddNextStep={onUpdateAction} />
        </form>
      </div>
    </ScrollArea>
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
  block: RefinedIntegrationAction;
  action: WorkflowAction;
  handleFieldChange: ({ key, value, variables }: { key: any; value: any; variables?: ActionVariables }) => void;
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
                action,
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
              variables: action.variables,
              onFieldChange: handleFieldChange,
              control,
              renderFieldMap: getWorkflowFormFieldMap({
                canUseVariables: currentField !== 'entityType',
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
