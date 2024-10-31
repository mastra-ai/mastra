'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

import Image from 'next/image';

import Icon from '@/components/icon';
import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';
import { iconArr } from '@/components/ui/svg/iconArr';

import { capitalizeFirstLetter } from '@/lib/string';
import { cn } from '@/lib/utils';

import { useAvailableIntegrations } from '@/domains/integrations/hooks/use-integration';
import { IconName } from '@/types/icons';

import system from '../../../icons/system.svg';
import { useVectorFormContext } from '../context/vector-form-context';

import { VectorProviderFormEntity } from './vector-provider-form-entity';

export const VectorProviderFormIntegration = ({
  integrationIndex,
  integrationName,
  disabled,
}: {
  integrationIndex: number;
  integrationName: string;
  disabled: boolean;
}) => {
  const [openIntegration, setOpenIntegration] = useState(false);

  const { integrations } = useAvailableIntegrations();

  const { entities, setEntities } = useVectorFormContext();

  const { data: currentEntityDataArray } = entities?.find(en => en.integration === integrationName) || {};

  const updateIntegration = (int: string) => {
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
    setEntities(newEntities);
  };

  const removeIntegration = (int: string) => {
    const newEntities = [...(entities || [])]?.filter(ent => ent.integration !== int);
    setEntities(newEntities);
  };

  const addNewIntegration = () => {
    const newEntities = [...(entities || []), { integration: '', data: [] }];
    setEntities(newEntities);
  };

  const getIntegrationLogo = (int: string) => {
    return integrations?.find(({ name }) => int === name)?.logoUrl;
  };

  const logoUrl = getIntegrationLogo(integrationName);

  return (
    <div className={cn({ 'opacity-50': disabled })}>
      <div className={cn('flex items-end gap-2', integrationIndex > 0 ? 'border-t border-mastra-border-2 pt-6' : '')}>
        <div className="space-y-8 flex-1">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-gray-400 text-xs font-normal">Source</Label>
              <div className="flex items-center gap-2">
                {entities?.length === 1 ? null : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: integrationName ? 1 : 0.3, height: 'auto' }}
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
                      className="cursor-pointer p-0 text-mastra-el-1 flex items-center rounded"
                      size="xs"
                    />
                  </motion.div>
                )}
              </div>
            </div>
            <SelectDropDown
              isDisabled={disabled}
              idKey="value"
              nameKey="label"
              open={openIntegration}
              onOpenChange={setOpenIntegration}
              data={
                integrations
                  ?.filter(int => int.entityTypes?.length)
                  ?.map(({ name, logoUrl }) => ({
                    label: capitalizeFirstLetter(name),
                    value: name.toLowerCase(),
                    icon: logoUrl || 'system',
                    isDisabled: entities?.some(d => d.integration === name),
                  })) || []
              }
              selectedValues={
                integrationName
                  ? [
                      {
                        label: capitalizeFirstLetter(integrationName),
                        value: integrationName,
                        icon: logoUrl || 'system',
                        isDisabled: false,
                      },
                    ]
                  : []
              }
              setSelectedValues={values => {
                const int = values?.[0];
                updateIntegration(int?.value);
              }}
              placeholder="Source"
              isSingleSelect
              asRadio
              withCheckbox={false}
            >
              <Button
                type="button"
                variant={'ghost'}
                className="w-full text-gray-300 py-5 mt-1 flex items-center justify-start cursor-default rounded bg-mastra-bg-3 gap-2 border-[0.5px] border-mastra-border-1 px-2 text-xs"
              >
                {integrationName ? (
                  <span className="flex items-center gap-2">
                    {iconArr?.includes(logoUrl || '') ? (
                      <Icon name={logoUrl as IconName} className={cn('h-3 w-3')} />
                    ) : (
                      <Image src={logoUrl || system} alt={integrationName} width={16} height={16} />
                    )}

                    <span>{capitalizeFirstLetter(integrationName)}</span>
                  </span>
                ) : (
                  'Select integration'
                )}

                <Icon name="down-caret" className="ml-auto" />
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
            >
              <div className="space-y-4 flex-1">
                {currentEntityDataArray?.map((data, index) => (
                  <VectorProviderFormEntity
                    key={data.name}
                    integration={integrationName}
                    entityIndex={index}
                    currentEntityData={data}
                    disabled={disabled}
                  />
                ))}
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
