'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import jsonSchemaToZod from 'json-schema-to-zod';
import { mergeWith } from 'lodash';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ZodSchema, z } from 'zod';

import Icon from '@/components/icon';
import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';

import { constructObjFromStringPath } from '@/lib/object';
import { cn } from '@/lib/utils';

import { useIntegrationEventsAndEntities } from '@/domains/integrations/hooks/use-integration';
import { IntegrationSyncEvent } from '@/domains/integrations/types';
import { renderDynamicForm } from '@/domains/playground/components/event/event-dynamic-form';
import { resolveSerializedZodOutput } from '@/domains/workflows/utils';

import { useVectorFormContext } from '../context/vector-form-context';
import { VectorEntityData } from '../types';

const decodeParam = (syncParams: string) =>
  JSON.parse(Buffer.from(syncParams, 'base64').toString()) as Record<string, any>;

export const VectorProviderFormEntity = ({
  integration,
  entityIndex,
  currentEntityData,
  disabled,
}: {
  integration: string;
  entityIndex: number;
  currentEntityData: VectorEntityData;
  disabled: boolean;
}) => {
  const { entities, setEntities } = useVectorFormContext();
  const [syncParams, setSyncParams] = useState<Record<string, any>>({});

  const { events, setIntegration } = useIntegrationEventsAndEntities({
    page: 1,
    integration: integration,
  });

  const entityEvent = events?.find(val => val.entityType === currentEntityData.name)!;

  const [openEntities, setOpenEntities] = useState(false);
  const [openFields, setOpenFields] = useState(false);

  const block = entityEvent;

  const {
    control,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<z.infer<ZodSchema>>({
    resolver: zodResolver(block?.schema as any),
  });

  const formValues = watch();

  const schema = resolveSerializedZodOutput(jsonSchemaToZod(block?.schema));

  const { data: currentEntityDataArray } = entities?.find(en => en.integration === integration) || {};

  const allowedFieldTypes = ['SINGLE_LINE_TEXT', 'SINGLE_SELECT', 'NUMBER', 'FLOAT', 'LONG_TEXT'];

  const updateEntityEvent = (
    entt: IntegrationSyncEvent & { selectedFields?: string[]; syncParamss?: Record<string, any> },
  ) => {
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integration) {
        const newData = [...ent.data]?.map((d, index) => {
          if (index === entityIndex) {
            const { selectedFields, entityType, syncParamss, syncEvent } = entt;
            return {
              ...d,
              fields: selectedFields || d.fields,
              name: entityType,
              syncEvent,
              syncParams: Buffer.from(JSON.stringify(syncParamss || syncParams)).toString('base64'),
            };
          }
          return d;
        });
        return {
          ...ent,
          data: newData,
        };
      }
      return ent;
    });
    setEntities(newEntities);
  };

  function handleFieldChange({ key, value }: { key: keyof z.infer<ZodSchema>; value: any }) {
    const newFormValues = mergeWith(formValues, constructObjFromStringPath(key as string, value));
    setValue(key as any, value);
    setSyncParams(newFormValues);
    updateEntityEvent({ ...entityEvent, syncParamss: newFormValues });
  }

  const removeEntityEvent = (enttType: string) => {
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integration) {
        const newData = [...ent.data]?.filter(d => d.name !== enttType);

        return {
          ...ent,
          data: newData,
        };
      }

      return ent;
    });
    setEntities(newEntities);
  };

  const addNewEntityEvent = () => {
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integration) {
        const newData = [...ent.data, { index: '', name: '', fields: [], syncEvent: '' }];

        return {
          ...ent,
          data: newData,
        };
      }

      return ent;
    });
    setEntities(newEntities);
  };

  useEffect(() => {
    setIntegration(integration);
  }, [integration]);

  useEffect(() => {
    if (!currentEntityData.syncParams) {
      return;
    }
    const decodedSyncParam = decodeParam(currentEntityData.syncParams);
    reset(decodedSyncParam);
    setSyncParams(decodedSyncParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEntityData]);

  return (
    <div className="space-y-2">
      <div className="rounded pb-3.5 space-y-2 flex-1">
        <div className="space-y-1 pr-4">
          <div className="flex items-center justify-between">
            <Label className="text-gray-400 text-xs font-normal">Entity type</Label>

            {currentEntityDataArray?.length === 1 ? null : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: currentEntityData?.name ? 1 : 0.3, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  type: 'spring',
                  bounce: 0,
                  duration: 0.5,
                }}
              >
                <IconButton
                  icon="trash"
                  onClick={() => {
                    removeEntityEvent(currentEntityData?.name!);
                  }}
                  className="cursor-pointer p-0 text-mastra-el-1 flex items-center rounded"
                  title={`Remove entity item from ${integration}`}
                  size="xs"
                />
              </motion.div>
            )}
          </div>
          <SelectDropDown
            idKey="entityType"
            nameKey="entityType"
            open={openEntities}
            onOpenChange={open => {
              setOpenEntities(open);
            }}
            data={events?.map(ev => ({
              ...ev,
              isDisabled: currentEntityDataArray?.some(d => d.name === ev.entityType),
            }))}
            selectedValues={entityEvent ? [entityEvent] : []}
            setSelectedValues={values => {
              const ent = values?.[0];
              updateEntityEvent({ ...ent, selectedFields: [] });
              setOpenFields(true);
            }}
            placeholder="Search for entity"
            isSingleSelect
            withCheckbox={false}
            asRadio
            isDisabled={disabled}
          >
            <Button
              type="button"
              variant={'ghost'}
              className=" w-full py-5 mt-1 text-gray-300 flex items-center justify-start cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
            >
              {currentEntityData?.name ? currentEntityData.name : 'Search for entity'}

              <Icon name="down-caret" className="ml-auto" />
            </Button>
          </SelectDropDown>
        </div>
        {currentEntityData?.name ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.5,
            }}
          >
            <div className="space-y-2 px-4">
              <div className="space-y-1">
                <Label className="text-gray-400 text-xs font-normal">Fields</Label>
                <SelectDropDown
                  idKey="value"
                  nameKey="label"
                  open={openFields}
                  onOpenChange={setOpenFields}
                  data={
                    entityEvent?.fields
                      ?.filter(({ type }) => allowedFieldTypes?.includes(type))
                      ?.map(field => ({ label: field.displayName.toLowerCase() || field.name, value: field.name })) ||
                    []
                  }
                  selectedValues={currentEntityData.fields?.map(item => ({ label: item, value: item }))}
                  setSelectedValues={values => {
                    updateEntityEvent({ ...entityEvent, selectedFields: values?.map(({ value }) => value) });
                  }}
                  placeholder="Fields to sync"
                  withCheckbox={true}
                  isDisabled={disabled}
                >
                  <Button
                    type="button"
                    variant={'ghost'}
                    className=" w-full py-5 mt-1 text-gray-300 flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
                  >
                    {currentEntityData.fields.length ? (
                      <>
                        <span className="flex items-center  gap-1">
                          {currentEntityData.fields.slice(0, 5)?.map(field => (
                            <span className="text-xs rounded-full text-inherit px-2 py-1 bg-mastra-bg-9" key={field}>
                              {field}
                            </span>
                          ))}
                          <span
                            className={cn(
                              currentEntityData.fields.length > 5
                                ? 'text-xs italic text-inherit rounded-full px-2 py-1 bg-mastra-bg-9'
                                : '',
                            )}
                          >
                            {currentEntityData.fields.length > 5 ? `+ ${currentEntityData.fields.length - 5}` : ''}
                          </span>
                        </span>
                      </>
                    ) : (
                      'Select Fields'
                    )}

                    <Icon name="down-caret" className="ml-auto" />
                  </Button>
                </SelectDropDown>
              </div>
              {(schema as any)?.shape ? (
                <div className="space-x-1">
                  <Label className="text-gray-400 text-xs font-normal">Parameters</Label>
                  {renderDynamicForm({
                    schema: schema as ZodSchema,
                    block,
                    handleFieldChange,
                    control,
                    formValues,
                    errors,
                  })}
                </div>
              ) : (
                <></>
              )}
            </div>
          </motion.div>
        ) : null}
      </div>

      {currentEntityData?.name && entityIndex === (currentEntityDataArray?.length as number) - 1 ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{
            type: 'spring',
            bounce: 0,
            duration: 0.5,
          }}
        >
          <Button
            variant="ghost"
            type="button"
            size="sm"
            className="flex cursor-pointer items-center text-mastra-el-accent text-sm gap-2"
            onClick={() => {
              addNewEntityEvent();
            }}
          >
            <Icon name="plus-icon" />
            Add new entity
          </Button>
        </motion.div>
      ) : null}
    </div>
  );
};
