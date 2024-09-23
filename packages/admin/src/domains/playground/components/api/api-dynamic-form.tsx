'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { RefinedIntegrationApi } from '@kpl/core/dist/types';
import React, { useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Control, FieldErrors, useForm } from 'react-hook-form';
import { z, ZodSchema } from 'zod';

import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { getWorkflowFormFieldMap } from '@/domains/workflows/components/utils/constants';
import BlockHeader from '@/domains/workflows/components/utils/render-header';
import ObjectArray from '@/domains/workflows/components/workflow-sidebar/config-forms/object-array';
import ReferenceSelect from '@/domains/workflows/components/workflow-sidebar/config-forms/reference-select';
import { useFrameworkApi } from '@/domains/workflows/hooks/use-framework-api';
import { schemaToFormFieldRenderer } from '@/domains/workflows/schema';
import { customZodResolver } from '@/domains/workflows/utils';

import { useApiPlaygroundContext } from '../../context/api-playground-context';
import { executeFrameworkApi } from '../../server-actions/execute-framework-action';
import { RunApiOrEvent } from '../run-button';

function DynamicForm({ showChangeButton, headerClassname }: { showChangeButton?: boolean; headerClassname?: string }) {
  const { selectedApi, setSelectedApi, keplerReferenceId, setKeplerReferenceId, setPayload } =
    useApiPlaygroundContext();
  const { frameworkApi, isLoading } = useFrameworkApi({
    apiType: selectedApi?.type!,
    integrationName: selectedApi?.integrationName!,
    referenceId: keplerReferenceId,
  });

  if (!selectedApi || !selectedApi?.schema) {
    return null;
  }

  const title = selectedApi.label;
  const icon = selectedApi.icon;
  const desc = selectedApi.description;

  return (
    <ScrollArea className="h-full w-full" viewportClassName="kepler-actions-form-scroll-area">
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
            setKeplerReferenceId('');
          }}
          showChangeButton={showChangeButton}
          classname={headerClassname}
        />
        <section className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-3 px-6">
            <Label className="capitalize flex gap-0.5" htmlFor="keplerReferenceId" aria-required={true}>
              <span className="text-red-500">*</span>
              <Text variant="secondary" className="text-kpl-el-3" size="xs">
                Reference ID to use execute the API
              </Text>
            </Label>

            <ReferenceSelect
              selected={keplerReferenceId}
              onSelect={({ value }: { value: any }) => {
                setKeplerReferenceId(value);
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
  const { setPayload, setApiResult, apiRunState, setApiRunState, keplerReferenceId, buttonContainer } =
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
      const { data, error, ok } = await executeFrameworkApi({
        api: block?.type!,
        payload: { data: values, ctx: { referenceId: keplerReferenceId } },
        integrationName: block?.integrationName!,
      });

      if (!ok) {
        setApiResult(JSON.stringify(error, null, 2));
        setApiRunState('fail');
      } else {
        setApiResult(
          JSON.stringify(
            data ?? {
              status: 'success',
            },
            null,
            2,
          ),
        );

        setApiRunState('success');
      }
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
}: {
  schema: ZodSchema;
  block: RefinedIntegrationApi;
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
        if (schema instanceof z.ZodArray && schema.element instanceof z.ZodObject) {
          return (
            <ObjectArray
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
