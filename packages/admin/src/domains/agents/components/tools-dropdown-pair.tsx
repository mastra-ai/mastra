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
  id: string;
  removeDropdownPair: (id: string) => void;
  integrationKeys: Array<{ name: string; value: string; icon: string; type: string }>;
  deserializedData: RefinedIntegrationApi[];
  setTools: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}

export const DropdownPair = ({
  index,
  removeDropdownPair,
  integrationKeys,
  deserializedData,
  id,
  setTools,
}: DropdownPairProps) => {
  const [parentIntegration, setParentIntegration] = useState<
    Array<{ name: string; value: string; icon: string; type: string }>
  >([]);
  const [childApi, setChildApi] = useState<Array<{ name: string; value: string; parent: string }>>([]);
  const [openParent, setOpenParent] = useState(false);
  const [openChild, setOpenChild] = useState(false);

  const apiArr = [] as Array<{ name: string; value: string; parent: string }>;

  parentIntegration.forEach(item => {
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
      <SelectDropDown<{ name: string; value: string; icon: string; type: string }>
        idKey="value"
        data={integrationKeys}
        selectedValues={parentIntegration}
        setSelectedValues={setParentIntegration}
        placeholder="Select System or integration"
        open={openParent}
        isSingleSelect
        onOpenChange={setOpenParent}
        onSelectItem={item => {
          if (item.type === 'workflow') {
            setTools(tools => ({
              ...tools,
              [item.name]: true,
            }));
          }
        }}
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
        <div className="flex relative items-center gap-2">
          {parentIntegration.length && parentIntegration[0].type === 'integration' ? (
            <motion.div
              animate={{
                width: parentIntegration.length ? '206px' : 0,
              }}
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
              </div>
            </motion.div>
          ) : null}

          {index === 0 ? null : (
            <button
              onClick={() => {
                console.log('index', index);
                removeDropdownPair(id);
              }}
              className="p-2 absolute -right-10 group bg-mastra-bg-4 flex items-center text-white rounded"
            >
              <Icon name="trash" className="w-3 h-3 text-mastra-el-3 transition-colors group-hover:text-white" />
            </button>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
};
