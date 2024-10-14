'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';

import { cn } from '@/lib/utils';

import { useIntegrationEventsAndEntities } from '@/domains/integrations/hooks/use-integration';
import { IntegrationSyncEvent } from '@/domains/integrations/types';

import { KnowledgeSourceEntityData, useAgentFormContext } from '../context/agent-form-context';

export const AgentKnowledgeSourceEntity = ({
  integration,
  entityIndex,
  currentEntityData,
}: {
  integration: string;
  entityIndex: number;
  currentEntityData: KnowledgeSourceEntityData;
}) => {
  const { setSearchedEntity, events, setIntegration, isLoading } = useIntegrationEventsAndEntities({
    page: 1,
    integration: integration,
    pageSize: 40,
    searchedEntity: currentEntityData?.name,
  });

  const [index, setIndex] = useState('');

  const [openEntities, setOpenEntities] = useState(false);
  const [openFields, setOpenFields] = useState(false);

  const { knowledgeSource, setKnowledgeSource } = useAgentFormContext();

  const { entities } = knowledgeSource;

  const entityEvent = events?.find(val => val.entityType === currentEntityData.name)!;

  const { data: currentEntityDataArray } = entities?.find(en => en.integration === integration) || {};

  const allowedFieldTypes = ['SINGLE_LINE_TEXT', 'SINGLE_SELECT', 'NUMBER', 'FLOAT', 'LONG_TEXT'];

  const updateEntityEvent = (entt: IntegrationSyncEvent & { index?: string; selectedFields?: string[] }) => {
    const { entities } = knowledgeSource;
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integration) {
        const newData = [...ent.data]?.map((d, index) => {
          if (index === entityIndex) {
            const { selectedFields, entityType, index } = entt;
            return {
              ...d,
              fields: selectedFields || d.fields,
              name: entityType,
              index: index || d.index,
              syncEvent: entt.syncEvent,
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
    setKnowledgeSource(prev => {
      return { ...prev, entities: newEntities };
    });
  };

  const removeEntityEvent = (enttType: string) => {
    const { entities } = knowledgeSource;
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integration) {
        console.log({ ent });
        const newData = [...ent.data]?.filter(d => d.name !== enttType);
        console.log({ newData });

        return {
          ...ent,
          data: newData,
        };
      }

      return ent;
    });
    setKnowledgeSource(prev => {
      return { ...prev, entities: newEntities };
    });
  };

  const addNewEntityEvent = () => {
    const { entities } = knowledgeSource;
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
    setKnowledgeSource(prev => {
      return { ...prev, entities: newEntities };
    });
  };

  useEffect(() => {
    setIntegration(integration);
  }, [integration]);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="border border-mastra-border-1 rounded p-2 space-y-2 flex-1">
          <div className="space-y-1">
            <Label className="text-mastra-el-3 text-xs font-medium">Entity type</Label>
            <SelectDropDown
              idKey="entityType"
              nameKey="entityType"
              open={openEntities}
              onOpenChange={open => {
                setOpenEntities(open);
                !open && setOpenFields(true);
              }}
              data={events?.map(ev => ({
                ...ev,
                isDisabled: currentEntityDataArray?.some(d => d.name === ev.entityType),
              }))}
              selectedValues={entityEvent ? [entityEvent] : []}
              setSelectedValues={values => {
                const ent = values?.[0];
                updateEntityEvent({ ...ent, selectedFields: [] });
              }}
              placeholder="Search for entity"
              isSingleSelect
              withCheckbox={false}
              asRadio
              onSearch={setSearchedEntity}
              isSearching={isLoading}
            >
              <Button
                type="button"
                variant={'ghost'}
                className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
              >
                {currentEntityData?.name ? currentEntityData.name : 'Search for entity'}
              </Button>
            </SelectDropDown>
          </div>
          {currentEntityData ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                type: 'spring',
                bounce: 0,
                duration: 0.5,
              }}
              className="space-y-2"
            >
              <div className="space-y-1">
                <Label className="text-mastra-el-3 text-xs font-medium">Fields</Label>
                <SelectDropDown
                  idKey="value"
                  nameKey="label"
                  open={openFields}
                  onOpenChange={setOpenFields}
                  data={
                    entityEvent?.fields
                      ?.filter(({ type }) => allowedFieldTypes?.includes(type))
                      ?.map(field => ({ label: field.displayName || field.name, value: field.name })) || []
                  }
                  selectedValues={currentEntityData.fields?.map(item => ({ label: item, value: item }))}
                  setSelectedValues={values => {
                    updateEntityEvent({ ...entityEvent, selectedFields: values?.map(({ value }) => value) });
                  }}
                  placeholder="Fields to sync"
                  withCheckbox={true}
                >
                  <Button
                    type="button"
                    variant={'ghost'}
                    className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
                  >
                    {currentEntityData.fields.length ? (
                      <>
                        <span>
                          <span className="text-xs rounded-full px-2 py-1 bg-mastra-bg-9">
                            {currentEntityData.fields[0]}
                          </span>{' '}
                          <span
                            className={cn(
                              currentEntityData.fields.length > 1
                                ? 'text-xs italic text-mastra-el-3 rounded-full px-2 py-1 bg-mastra-bg-9'
                                : '',
                            )}
                          >
                            {currentEntityData.fields.length > 1 ? `+ ${currentEntityData.fields.length - 1}` : ''}
                          </span>
                        </span>
                      </>
                    ) : (
                      'Select Fields'
                    )}
                  </Button>
                </SelectDropDown>
              </div>

              <div className="space-y-1">
                <Label className="text-mastra-el-3 text-xs font-medium">Index name</Label>
                <Input
                  type={'text'}
                  className="placeholder:text-xs  py-5 bg-white/5 overflow-ellipsis"
                  placeholder={'Enter index name'}
                  autoComplete="false"
                  autoCorrect="false"
                  value={index}
                  onChange={e => {
                    setIndex(e.target.value);
                    updateEntityEvent({ ...entityEvent, index: e.target.value });
                  }}
                />
              </div>
            </motion.div>
          ) : null}
        </div>

        {currentEntityDataArray?.length === 1 ? null : (
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
            <IconButton
              icon="trash"
              onClick={() => {
                removeEntityEvent(currentEntityData?.name!);
              }}
              className="cursor-pointer p-2 bg-mastra-bg-4 flex items-center text-white rounded"
              title={`Remove entity item from ${integration}`}
              size="sm"
            />
          </motion.div>
        )}
      </div>

      {currentEntityData && entityIndex === (currentEntityDataArray?.length as number) - 1 ? (
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
          <IconButton
            icon="plus-icon"
            onClick={() => {
              addNewEntityEvent();
            }}
            className="cursor-pointer p-2 bg-mastra-bg-4 flex items-center text-white rounded"
            title={`Add new entity item for ${integration}`}
            size="sm"
          />
        </motion.div>
      ) : null}
    </div>
  );
};
