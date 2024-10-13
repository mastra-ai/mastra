'use client';

import { RefinedIntegrationApi } from '@mastra/core';
import { AnimatePresence, motion } from 'framer-motion';
import { snakeCase } from 'lodash';
import { useState } from 'react';

import SelectDropDown from '@/components/ui/select-dropdown';
import { iconArr } from '@/components/ui/svg/iconArr';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

import { ChildButton } from './child-button';
import { ParentButton } from './parent-button';

export interface DropdownPairProps {
  index: number;
  removeDropdownPair: (indexToRemove: number) => void;
  integrationKeys: Array<{ name: string; value: string; icon: string }>;
  setIntegrationKeys: React.Dispatch<React.SetStateAction<Array<{ name: string; value: string; icon: string }>>>;
  deserializedData: RefinedIntegrationApi[];
  setTools: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}

export const DropdownPair = ({
  index,
  removeDropdownPair,
  integrationKeys,
  deserializedData,
  setIntegrationKeys,
  setTools,
}: DropdownPairProps) => {
  const [parentIntegration, setParentIntegration] = useState<Array<{ name: string; value: string; icon: string }>>([]);
  const [childApi, setChildApi] = useState<Array<{ name: string; value: string; parent: string }>>([]);
  const [openParent, setOpenParent] = useState(false);
  const [openChild, setOpenChild] = useState(false);

  const apiArr = [] as Array<{ name: string; value: string; parent: string }>;

  parentIntegration.forEach(item => {
    //get the api for the integration
    const apisForIntegration = deserializedData
      .map(data => {
        if (data.integrationName === item.value) {
          {
            return data;
          }
        }
      })
      .filter(val => val !== undefined)
      .map(item => ({ name: snakeCase(item.label), value: item.label, parent: item.integrationName }));

    apiArr.push(...apisForIntegration);
  });

  return (
    <div className="flex gap-2 mb-1 rounded">
      <SelectDropDown<{ name: string; value: string; icon: string }>
        idKey="value"
        data={integrationKeys}
        selectedValues={parentIntegration}
        setSelectedValues={setParentIntegration}
        placeholder="Select System or integration"
        open={openParent}
        isSingleSelect
        onOpenChange={setOpenParent}
        iconRenderProp={item => {
          if (!iconArr.includes(item.icon)) {
            return <Icon name="system" />;
          }
          return <Icon name={item.icon as IconName} />;
        }}
      >
        <ParentButton parentIntegration={parentIntegration} onClick={() => setOpenParent(prev => !prev)} />
      </SelectDropDown>
      <AnimatePresence>
        {parentIntegration.length ? (
          <motion.div
            animate={{
              width: parentIntegration.length ? '206px' : 0,
            }}
            exit={{ width: 0 }}
            className="max-w-[206px]"
          >
            <div className="flex gap-2 items-center">
              <SelectDropDown<{ name: string; value: string; parent: string }>
                idKey="value"
                data={apiArr}
                selectedValues={childApi}
                setSelectedValues={setChildApi}
                placeholder="Select Api"
                open={openChild}
                onOpenChange={setOpenChild}
                onSelectItem={item => {
                  setTools(tools => ({
                    ...tools,
                    [item.name]: true,
                  }));
                }}
                onDeselectItem={item => {
                  setTools(tools => {
                    if (Object.keys(tools).includes(item.name)) {
                      delete tools[item.name];
                      return { ...tools };
                    }
                    return tools;
                  });
                }}
              >
                <ChildButton childApi={childApi} onClick={() => setOpenChild(prev => !prev)} />
              </SelectDropDown>
              <button
                onClick={() => removeDropdownPair(index)}
                className="p-2 bg-mastra-bg-4 flex items-center text-white rounded"
              >
                <Icon name="trash" className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
