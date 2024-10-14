'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';

import { capitalizeFirstLetter } from '@/lib/string';
import { cn } from '@/lib/utils';

import { useAvailableIntegrations } from '@/domains/integrations/hooks/use-integration';

import { useAgentFormContext } from '../context/agent-form-context';

const vectorProviders = [{ label: 'PINECONE', value: 'PINECONE' }];

const indexes = [
  {
    label: 'Teams',
    value: 'teams',
  },
  {
    label: 'Startups',
    value: 'startups',
  },
];

const resyncingIntervals = [
  { label: '15 minutes', value: '15_mins' },
  { label: '30 minutes', value: '30_mins' },
  { label: '1 hour', value: '1_hr' },
  { label: '6 hours', value: '6_hrs' },
  { label: '24 hours', value: '24_hrs' },
  { label: 'Weekly', value: 'weekly' },
];

export const AgentKnowledgeSource = () => {
  const [isNewIndex, setIsNewIndex] = useState(false);
  const { knowledgeSource, setKnowledgeSource } = useAgentFormContext();
  const [entities, setEntities] = useState(['1']);

  const { integrations } = useAvailableIntegrations();

  const { vector_provider, index, resyncingInterval } = knowledgeSource || {};

  // let allEntities: {
  //   entity: string;
  //   integrationName: string;
  //   logoUrl: string;
  // }[] = [];

  // integrations?.forEach(int => {
  //   const entties = int.entityTypes?.map(ent => ({ entity: ent, integrationName: int.name, logoUrl: int.logoUrl }));

  //   allEntities.push(...entties);
  // });

  // const entityNames = entities?.map(({ name }) => name);

  // const entityOptions = (currentEnt: string) =>
  //   allEntities
  //     ?.map(ent => ({
  //       label: `${capitalize(ent.integrationName)} > ${capitalize(ent.entity)}`,
  //       value: `${ent.integrationName}.${ent.entity}`,
  //       icon: ent.logoUrl,
  //     }))
  //     ?.filter(({ value }) => value === currentEnt || !entityNames?.includes(value));

  // const updateEntityName = (name: string, i: number) => {
  //   if (entities) {
  //     const newEntities = [...entities]?.map((entity, entIndex) => {
  //       if (entIndex === i) {
  //         entity.name = name;
  //         entity.index = index;
  //         entity.fields = [];
  //       }
  //       return entity;
  //     });

  //     setKnowledgeSource(prev => ({ ...prev, entities: newEntities }));
  //   }
  // };

  // const updateEntityFields = (fields: string[], i: number) => {
  //   if (entities) {
  //     const newEntities = [...entities]?.map((entity, entIndex) => {
  //       if (entIndex === i) {
  //         entity.fields = fields;
  //       }
  //       return entity;
  //     });

  //     setKnowledgeSource(prev => ({ ...prev, entities: newEntities }));
  //   }
  // };

  // const createLabel = (ent: string) => {
  //   return ent
  //     ?.split('.')
  //     ?.map(item => capitalize(item))
  //     ?.join(' > ');
  // };

  return (
    <section className="space-y-2">
      <h1 className="font-medium text-sm">Knowledge source:</h1>

      <div className="space-y-1">
        <Label className="text-mastra-el-3 text-xs font-medium">Vector provider</Label>
        <SelectDropDown
          idKey="value"
          nameKey="label"
          data={vectorProviders}
          selectedValues={[{ label: vector_provider, value: vector_provider }]}
          setSelectedValues={values => {
            setKnowledgeSource(prev => ({ ...prev, vector_provider: values?.[0]?.value }));
          }}
          placeholder="Vector provider"
          isSingleSelect
          withCheckbox={false}
        >
          <Button
            type="button"
            variant={'ghost'}
            className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
          >
            {vector_provider || 'Select vector provider'}
          </Button>
        </SelectDropDown>
      </div>

      <div className="space-y-1">
        <Label className="text-mastra-el-3 text-xs font-medium">Available Indexes</Label>
        {/* <SelectDropDown
          idKey="value"
          nameKey="label"
          data={indexes}
          selectedValues={[{ label: index, value: index }]}
          setSelectedValues={values => {
            setKnowledgeSource(prev => ({ ...prev, index: values?.[0]?.value }));
          }}
          placeholder="Index"
          withCheckbox={false}
          withAddNewFromSearchValueButton
          addNewFromSearchValueButtonAction={async newIndex => {
            setIsNewIndex(true);
            setKnowledgeSource(prev => ({ ...prev, index: newIndex }));
            return { label: newIndex, value: newIndex };
          }}
        >
          <Button
            type="button"
            variant={'ghost'}
            className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
          >
            {index || 'Select index'}
          </Button>
        </SelectDropDown> */}
        <div className="flex justify-between items-center">
          <p className="text-[0.6em] text-mastra-el-3 italic">No available index</p>
          <Button size="sm" variant="outline" onClick={() => setIsNewIndex(true)}>
            Add new index
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isNewIndex ? (
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
              <Label className="text-mastra-el-3 text-xs font-medium">Index name</Label>
              <Input
                type={'text'}
                className="placeholder:text-xs  py-5 bg-white/5 overflow-ellipsis"
                placeholder={'Enter index name'}
                autoComplete="false"
                autoCorrect="false"
                value={index}
                onChange={e => {
                  setKnowledgeSource(prev => ({ ...prev, index: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-mastra-el-3 text-xs font-medium">Resyncing Interval</Label>
              <SelectDropDown
                idKey="value"
                nameKey="label"
                data={resyncingIntervals}
                selectedValues={[{ label: resyncingInterval, value: resyncingInterval }]}
                setSelectedValues={values => {
                  setKnowledgeSource(prev => ({ ...prev, resyncingInterval: values?.[0]?.value }));
                }}
                placeholder="Resyncing interval"
                isSingleSelect
                withCheckbox={false}
              >
                <Button
                  type="button"
                  variant={'ghost'}
                  className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
                >
                  {resyncingInterval
                    ? resyncingIntervals?.find(({ value }) => value === resyncingInterval)?.label
                    : 'Select resyncing interval'}
                </Button>
              </SelectDropDown>
            </div>

            <div className="space-y-2">
              <Label className="text-mastra-el-3 text-xs font-medium">Entities to sync</Label>
              {entities?.map(ent => (
                <AgentKnowledgeSourceEntity
                  key={ent}
                  addNewEntity={() => {
                    setEntities(prev => [...prev, 'new']);
                  }}
                />
              ))}
            </div>

            {/* {entities?.map((ent, ind) => (
              <div className="flex items-end">
                <div className="border border-mastra-border-1 rounded p-2 space-y-2">
                  <SelectDropDown
                    idKey="value"
                    nameKey="label"
                    data={entityOptions(ent.name)}
                    iconRenderProp={item => (
                      <IntegrationLogo imageSize={10} logoUrl={item.icon} name={item?.value?.split('.')?.[1]} />
                    )}
                    selectedValues={[{ label: createLabel(ent.name), value: ent.name, icon: '' }]}
                    setSelectedValues={values => {
                      updateEntityName(values?.[0]?.value, ind);
                    }}
                    placeholder="Entity"
                    isSingleSelect
                    withCheckbox={false}
                  >
                    <Button
                      type="button"
                      variant={'ghost'}
                      className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
                    >
                      {ent?.name ? (
                        <span className="flex gap-2 items-center">
                          <IntegrationLogo
                            imageSize={10}
                            logoUrl={entityOptions(ent.name)?.find(({ value }) => value === ent.name)?.icon || ''}
                            name={ent?.name?.split('.')?.[1]}
                          />
                          <span>{createLabel(ent.name)}</span>
                        </span>
                      ) : (
                        'Select entity'
                      )}
                    </Button>
                  </SelectDropDown>
                  {ent?.name ? (
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
                      <SelectDropDown
                        idKey="value"
                        nameKey="label"
                        data={['name', 'id', 'email']?.map(item => ({ label: item, value: item }))}
                        selectedValues={ent.fields?.map(item => ({ label: item, value: item }))}
                        setSelectedValues={values => {
                          updateEntityFields(
                            values?.map(({ value }) => value),
                            ind,
                          );
                        }}
                        placeholder="Fields to sync"
                        withCheckbox={true}
                      >
                        <Button
                          type="button"
                          variant={'ghost'}
                          className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
                        >
                          {ent?.fields?.length
                            ? `${ent?.fields?.[0]} ${ent?.fields?.length > 1 ? `+${ent?.fields?.length - 1}` : ''}`
                            : 'Select resyncing interval'}
                        </Button>
                      </SelectDropDown>
                    </motion.div>
                  ) : null}
                </div>
              </div>
            ))} */}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};

const AgentKnowledgeSourceEntity = ({ addNewEntity }: { addNewEntity?: () => void }) => {
  const [integration, setIntegration] = useState('');
  const [entity, setEntity] = useState('');
  const [fields, setFields] = useState<string[]>([]);

  const { integrations } = useAvailableIntegrations();

  return (
    <div className="space-y-2">
      <div className="border border-mastra-border-1 rounded p-2 space-y-2 flex-1">
        <SelectDropDown
          idKey="value"
          nameKey="label"
          data={
            integrations?.map(({ name }) => ({
              label: capitalizeFirstLetter(name),
              value: name,
              icon: name?.toLowerCase(),
            })) || []
          }
          selectedValues={
            integration
              ? [{ label: capitalizeFirstLetter(integration), value: integration, icon: integration?.toLowerCase() }]
              : []
          }
          setSelectedValues={values => {
            setIntegration(values?.[0]?.value);
          }}
          placeholder="Integration"
          isSingleSelect
          withCheckbox={false}
        >
          <Button
            type="button"
            variant={'ghost'}
            className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
          >
            {integration ? capitalizeFirstLetter(integration) : 'Select integration'}
          </Button>
        </SelectDropDown>
        {integration ? (
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
            <SelectDropDown
              idKey="value"
              nameKey="label"
              data={[
                { label: 'Contacts', value: 'contacts' },
                { label: 'Email', value: 'email' },
              ]}
              selectedValues={[{ label: capitalizeFirstLetter(entity), value: entity }]}
              setSelectedValues={values => {
                setEntity(values?.[0]?.value);
              }}
              placeholder="Entity"
              isSingleSelect
              withCheckbox={false}
            >
              <Button
                type="button"
                variant={'ghost'}
                className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
              >
                Select entity
              </Button>
            </SelectDropDown>
          </motion.div>
        ) : null}
        {entity ? (
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
            <SelectDropDown
              idKey="value"
              nameKey="label"
              data={['name', 'id', 'email']?.map(item => ({ label: item, value: item }))}
              selectedValues={fields?.map(item => ({ label: item, value: item }))}
              setSelectedValues={values => {
                setFields(values?.map(({ value }) => value));
              }}
              placeholder="Fields to sync"
              withCheckbox={true}
            >
              <Button
                type="button"
                variant={'ghost'}
                className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
              >
                {fields.length ? (
                  <>
                    <span>
                      <span className="text-xs rounded-full px-2 py-1 bg-mastra-bg-9">{fields[0]}</span>{' '}
                      <span
                        className={cn(
                          fields.length > 1
                            ? 'text-xs italic text-mastra-el-3 rounded-full px-2 py-1 bg-mastra-bg-9'
                            : '',
                        )}
                      >
                        {fields.length > 1 ? `+ ${fields.length - 1}` : ''}
                      </span>
                    </span>
                  </>
                ) : (
                  'Select Fields'
                )}
              </Button>
            </SelectDropDown>
          </motion.div>
        ) : null}
      </div>

      {addNewEntity ? (
        <IconButton
          icon="plus-icon"
          onClick={() => {
            addNewEntity();
          }}
          className="cursor-pointer p-2 bg-mastra-bg-4 flex items-center text-white rounded"
          title="Add new output item"
          size="sm"
        />
      ) : null}
    </div>
  );
};
