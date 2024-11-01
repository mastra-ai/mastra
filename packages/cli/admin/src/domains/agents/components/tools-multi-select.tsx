'use client';

import { snakeCase } from 'lodash';
import { useEffect, useState } from 'react';

import { Icon } from '@/components/icon';
import IconButton from '@/components/ui/icon-button';
import SelectDropDown from '@/components/ui/select-dropdown';
import { iconArr } from '@/components/ui/svg/iconArr';

import { capitalizeFirstLetter } from '@/lib/string';

import { getParsedFrameworkApis } from '@/domains/workflows/utils';
import { IconName } from '@/types/icons';

import { useAgentFormContext } from '../context/agent-form-context';

interface ToolsMultiSelectProps {
  data: string;
}

export const ToolsMultiSelect = ({ data }: ToolsMultiSelectProps) => {
  const deserializedData = getParsedFrameworkApis(data);
  const [selectedTools, setSelectedTools] = useState<{ label: string; value: string; icon: string }[]>([]);
  const [updatedFromContext, setUpdatedFromContext] = useState(false);

  const options = [...deserializedData].map(item => {
    const parent = item.integrationName;
    const child = item.type;

    return {
      value: child,
      label: `${capitalizeFirstLetter(parent)} > ${snakeCase(child)}`,
      icon: parent?.toLowerCase(),
    };
  });

  const { tools, setTools } = useAgentFormContext();

  useEffect(() => {
    if (tools && Object.keys(tools).length && !selectedTools.length && !updatedFromContext) {
      const sTools = options?.filter(({ value }) => Object.keys(tools)?.includes(value));
      setSelectedTools(sTools);
      setUpdatedFromContext(true);
    }
  }, [tools, selectedTools, options, updatedFromContext]);

  return (
    <div className="space-y-1.5">
      <p className="text-mastra-el-3 text-xs font-medium">
        Your tools: <span className="bg-mastra-bg-4 rounded py-1 px-2 ">{selectedTools.length}</span>
      </p>
      <SelectDropDown<{ label: string; value: string; icon: string }>
        idKey="value"
        nameKey="label"
        data={options}
        selectedValues={selectedTools}
        setSelectedValues={setSelectedTools}
        placeholder="Select your tools"
        onSelectItem={item => {
          setTools(tools => ({
            ...tools,
            [item.value]: true,
          }));
        }}
        iconRenderProp={item => {
          if (!iconArr.includes(item.icon)) {
            return <Icon name="system" />;
          }
          return <Icon name={item.icon as IconName} />;
        }}
        onDeselectItem={item => {
          setTools(tools => {
            if (Object.keys(tools).includes(item.value)) {
              delete tools[item.value];
              return { ...tools };
            }
            return tools;
          });
        }}
      >
        <div className="w-full py-3 mt-1 text-gray-300 h-[unset] flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs">
          {selectedTools.length ? (
            <span className="flex items-center flex-wrap gap-1">
              {selectedTools?.map(tool => (
                <span
                  className="flex gap-2 items-center text-xs rounded-full text-inherit px-2 py-1 bg-mastra-bg-9"
                  key={tool.value}
                >
                  <Icon name={!iconArr.includes(tool.icon) ? 'system' : (tool.icon as IconName)} />
                  <span className="text-xs">{tool.label}</span>
                  <IconButton
                    icon="cancel"
                    size="sm"
                    type={undefined}
                    className="p-0 cursor-pointer"
                    onClick={e => {
                      e.stopPropagation();
                      setTools(tools => {
                        if (Object.keys(tools).includes(tool.value)) {
                          delete tools[tool.value];
                          return { ...tools };
                        }
                        return tools;
                      });
                      setSelectedTools(prev => prev.filter(({ value }) => value !== tool.value));
                    }}
                  />
                </span>
              ))}
            </span>
          ) : (
            'Select your tools'
          )}

          <Icon name="down-caret" className="ml-auto h-4 w-4" />
        </div>
      </SelectDropDown>
    </div>
  );
};

export default ToolsMultiSelect;
