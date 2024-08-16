'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { RefinedIntegrationAction } from 'core';
import React from 'react';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Text } from '@/components/ui/text';

import { getWorkflowFormFieldMap } from '@/domains/workflows/components/utils/constants';
import BlockHeader from '@/domains/workflows/components/utils/render-header';
import { schemaToFormFieldRenderer } from '@/domains/workflows/schema';
import { customZodResolver } from '@/domains/workflows/utils';

import { useActionPlaygroundContext } from '../providers/action-playground-provider';

function DynamicForm<T extends ZodSchema>() {
  const { selectedAction, setSelectedAction } = useActionPlaygroundContext();

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

  // function handleFieldChange({
  //   key,
  //   value,
  //   variables,
  // }: {
  //   key: keyof z.infer<T>;
  //   value: any;
  //   variables?: ActionVariables;
  // }) {
  //   if (key === discriminatedUnionSchemaDiscriminator) {
  //     reset({ [key]: value });
  //     const newFormValues = constructObjFromStringPath(key as string, value);
  //     onBlur?.({ payload: { ...newFormValues }, variables: variables ? { [key]: variables } : undefined });
  //   } else {
  //     setValue<any>(key, value);
  //     if (attemptedPublish) {
  //       trigger();
  //     }
  //     const newFormValues = mergeWith(formValues, constructObjFromStringPath(key as string, value));
  //     onBlur?.({ payload: { ...newFormValues }, variables: variables ? { [key]: variables } : undefined });
  //   }
  // }

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

  return (
    <ScrollArea className="h-full w-full" viewportClassName="kepler-actions-form-scroll-area">
      <div className="flex flex-col pb-5">
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
          <section className="flex flex-col gap-5 p-6 pb-0">
            {renderDynamicForm({
              schema,
              block: selectedAction,
              handleFieldChange: () => ({}),
              control,
              formValues,
              errors,
            })}
          </section>
          {/* <NextStep actionId={action.id} className="mt-6 px-6" onAddNextStep={onUpdateAction} /> */}
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
  handleFieldChange: () => {};
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
