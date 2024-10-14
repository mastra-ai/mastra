'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';
import { iconArr } from '@/components/ui/svg/iconArr';

import { capitalizeFirstLetter } from '@/lib/string';
import { cn } from '@/lib/utils';

import Icon from '@/app/components/icon';
import { useAvailableIntegrations } from '@/domains/integrations/hooks/use-integration';
import { IconName } from '@/types/icons';

import { useAgentFormContext } from '../context/agent-form-context';

import { AgentKnowledgeSourceEntity } from './agent-knowledge-source-entity';

export const AgentKnowledgeSourceIntegration = ({
  integrationIndex,
  integrationName,
}: {
  integrationIndex: number;
  integrationName: string;
}) => {
  // const [integration, setIntegration] = useState({ name: '', icon: '' });

  const [openIntegration, setOpenIntegration] = useState(false);

  const { integrations } = useAvailableIntegrations();

  const { knowledgeSource, setKnowledgeSource } = useAgentFormContext();

  const { entities } = knowledgeSource;

  const { data: currentEntityDataArray } = entities?.find(en => en.integration === integrationName) || {};

  const updateIntegration = (int: string) => {
    const { entities } = knowledgeSource;
    const newEntities = [...(entities || [])]?.map(ent => {
      if (ent.integration === integrationName) {
        return {
          integration: int,
          data: [
            {
              index: '',
              name: '',
              fields: [],
              syncEvent: '',
            },
          ],
        };
      }

      return ent;
    });
    setKnowledgeSource(prev => {
      return { ...prev, entities: newEntities };
    });
  };

  const removeIntegration = (int: string) => {
    const { entities } = knowledgeSource;
    const newEntities = [...(entities || [])]?.filter(ent => ent.integration !== int);
    setKnowledgeSource(prev => {
      return { ...prev, entities: newEntities };
    });
  };

  const addNewIntegration = () => {
    const { entities } = knowledgeSource;
    const newEntities = [...(entities || []), { integration: '', data: [] }];
    setKnowledgeSource(prev => {
      return { ...prev, entities: newEntities };
    });
  };

  const getIntegrationLogo = (int: string) => {
    return integrations?.find(({ name }) => int === name)?.logoUrl;
  };

  const logoUrl = getIntegrationLogo(integrationName);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="border border-mastra-border-1 rounded p-2 space-y-2 flex-1">
          <div className="space-y-1">
            <Label className="text-mastra-el-3 text-xs font-medium">Integration</Label>
            <SelectDropDown
              idKey="value"
              nameKey="label"
              open={openIntegration}
              onOpenChange={setOpenIntegration}
              data={
                integrations
                  ?.filter(int => int.entityTypes?.length)
                  ?.map(({ name, logoUrl }) => ({
                    label: capitalizeFirstLetter(name),
                    value: name,
                    icon: logoUrl,
                    isDisabled: entities?.some(d => d.integration === name),
                  })) || []
              }
              selectedValues={
                integrationName
                  ? [
                      {
                        label: capitalizeFirstLetter(integrationName),
                        value: integrationName,
                        icon: logoUrl!,
                        isDisabled: false,
                      },
                    ]
                  : []
              }
              setSelectedValues={values => {
                const int = values?.[0];
                updateIntegration(int?.value);
              }}
              placeholder="Integration"
              isSingleSelect
              asRadio
              withCheckbox={false}
            >
              <Button
                type="button"
                variant={'ghost'}
                className="w-full py-5 mt-1 flex items-center justify-start cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1 px-2 text-xs"
              >
                {integrationName ? (
                  <span className="flex items-center gap-2">
                    {iconArr?.includes(logoUrl || '') ? (
                      <Icon name={logoUrl as IconName} className={cn('h-3 w-3')} />
                    ) : (
                      <Image src={logoUrl!} alt={integrationName} width={16} height={16} />
                    )}

                    <span>{capitalizeFirstLetter(integrationName)}</span>
                  </span>
                ) : (
                  'Select integration'
                )}
              </Button>
            </SelectDropDown>
          </div>
          {integrationName ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                type: 'spring',
                bounce: 0,
                duration: 0.5,
              }}
              className="border border-mastra-border-1 rounded p-2 space-y-2 flex-1"
            >
              {currentEntityDataArray?.map((data, index) => (
                <AgentKnowledgeSourceEntity
                  key={data.name}
                  integration={integrationName}
                  entityIndex={index}
                  currentEntityData={data}
                />
              ))}
            </motion.div>
          ) : null}
        </div>

        {entities?.length === 1 ? null : (
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
                removeIntegration(integrationName);
              }}
              className="cursor-pointer p-2 bg-mastra-bg-4 flex items-center text-white rounded"
              size="sm"
            />
          </motion.div>
        )}
      </div>

      {integrationName && integrationIndex === (entities?.length as number) - 1 ? (
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
              addNewIntegration();
            }}
            className="cursor-pointer p-2 bg-mastra-bg-4 flex items-center text-white rounded"
            size="sm"
          />
        </motion.div>
      ) : null}
    </div>
  );
};
