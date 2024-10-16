'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { RefinedIntegrationApi } from '@mastra/core/dist/types';
import React, { useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { parse } from 'superjson';
import { z, ZodSchema } from 'zod';

import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { getWorkflowFormFieldMap } from '@/domains/workflows/components/utils/constants';
import BlockHeader from '@/domains/workflows/components/utils/render-header';
import ObjectComponent from '@/domains/workflows/components/workflow-sidebar/config-forms/object-field';
import ReferenceSelect from '@/domains/workflows/components/workflow-sidebar/config-forms/reference-select';
import UnionComponent from '@/domains/workflows/components/workflow-sidebar/config-forms/union-field';
import { useFrameworkApi } from '@/domains/workflows/hooks/use-framework-api';
import { schemaToFormFieldRenderer } from '@/domains/workflows/schema';
import { IntegrationFieldTypeEnum } from '@/domains/workflows/types';
import { customZodResolver } from '@/domains/workflows/utils';

import { useApiPlaygroundContext } from '../../context/api-playground-context';
import { callFrameworkApi } from '../../server-actions/execute-framework-action';
import { RunApiOrEvent } from '../run-button';

function DynamicForm({ showChangeButton, headerClassname }: { showChangeButton?: boolean; headerClassname?: string }) {
  const { selectedApi, setSelectedApi, mastraConnectionId, setMastraConnectionId, setPayload } =
    useApiPlaygroundContext();
  const { frameworkApi, isLoading } = useFrameworkApi({
    apiType: selectedApi?.type!,
    integrationName: selectedApi?.integrationName!,
    connectionId: mastraConnectionId,
  });

  if (!selectedApi || !selectedApi?.schema) {
    return null;
  }

  const title = selectedApi.label;
  const icon = selectedApi.icon;
  const desc = selectedApi.description;

  return (
    <ScrollArea className="h-full w-full" viewportClassName="mastra-actions-form-scroll-area">
      <div className="flex flex-col h-full">
        <BlockHeader
          title={title}
          integrationName={selectedApi.integrationName}
          description={desc}
          icon={
            icon || {
              alt: 'dashboard icon',
              icon: 'dashboard',
            }
          }
          category={'action'}
          handleEditBlockType={() => {
            setSelectedApi(undefined);
            setPayload({});
            setMastraConnectionId('');
          }}
          showChangeButton={showChangeButton}
          classname={headerClassname}
        />
        <section className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-3 px-6">
            <Label className="capitalize flex gap-0.5" htmlFor="mastraConnectionId" aria-required={true}>
              <span className="text-red-500">*</span>
              <Text variant="secondary" className="text-mastra-el-3" size="xs">
                Reference ID to use to execute the API
              </Text>
            </Label>

            <ReferenceSelect
              selected={mastraConnectionId}
              onSelect={({ value }: { value: any }) => {
                setMastraConnectionId(value);
              }}
              integrationName={selectedApi?.integrationName}
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
            <InnerDynamicForm block={frameworkApi!} />
          )}
        </section>
      </div>
    </ScrollArea>
  );
}

function InnerDynamicForm<T extends ZodSchema>({ block }: { block: RefinedIntegrationApi }) {
  const { setPayload, setApiResult, apiRunState, setApiRunState, mastraConnectionId, buttonContainer } =
    useApiPlaygroundContext();
  const [isPending, startTransition] = useTransition();

  const blockSchemaTypeName = (block?.zodSchema as any)?._def?.typeName;
  const discriminatedUnionSchemaOptions = (block?.schema as any)?._def?.options;
  const discriminatedUnionSchemaDiscriminator = (block?.zodSchema as any)?._def?.discriminator;

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<z.infer<T>>({
    resolver:
      blockSchemaTypeName === 'ZodDiscriminatedUnion'
        ? customZodResolver(block?.schema as any, discriminatedUnionSchemaDiscriminator)
        : zodResolver(block?.schema as any),
    // defaultValues: {}
  });

  const formValues = watch();

  useEffect(() => {
    if (isPending) {
      setApiRunState('loading');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  if (!block || !block?.schema) {
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
      : block?.schema;

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
    console.log('running action....');
    const parser = block?.schema;
    let values = formValues;

    if (parser) {
      values = (parser as ZodSchema).parse(formValues);
    }

    startTransition(async () => {
      const { data, error, ok } = await callFrameworkApi({
        api: block?.type!,
        payload: { data: values, ctx: { connectionId: mastraConnectionId } },
        integrationName: block?.integrationName!,
      });

      if (!ok) {
        setApiResult(JSON.stringify(error, null, 2));
        setApiRunState('fail');
        return;
      }

      const parsedData = parse(data as any);

      setApiResult(JSON.stringify(parsedData, null, 2));
      setApiRunState('success');
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit(() => {})} className="flex flex-col gap-8 p-6 pb-0 h-full">
        {renderDynamicForm({
          schema,
          block,
          handleFieldChange,
          control,
          formValues,
          errors,
        })}
      </form>

      {createPortal(
        <RunApiOrEvent
          context="api"
          apiIsRunning={apiRunState === 'loading'}
          onClick={async () => {
            const isValid = await trigger();
            if (isValid) {
              await handleRunAction();
            }
          }}
        />,
        buttonContainer as Element,
      )}
    </>
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
  isOptional = false,
}: {
  schema: ZodSchema;
  block: RefinedIntegrationApi;
  handleFieldChange: ({ key, value }: { key: any; value: any }) => void;
  control: Control<any, any>;
  formValues: any;
  parentField?: string;
  errors: FieldErrors<any>;
  isOptional?: boolean;
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
  isNullable = false,
}: {
  schema: ZodSchema;
  parentField: string;
  block: RefinedIntegrationApi;
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
            schemaOptions: block.schemaOptions?.[currentField],
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
            schemaOptions: block.schemaOptions?.[currentField],
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
        schemaOptions: block.schemaOptions?.[currentField],
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
