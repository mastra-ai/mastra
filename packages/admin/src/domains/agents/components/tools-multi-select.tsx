'use client';

import { snakeCase } from 'lodash';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import SelectDropDown from '@/components/ui/select-dropdown';
import { iconArr } from '@/components/ui/svg/iconArr';

import { capitalizeFirstLetter } from '@/lib/string';

import { Icon } from '@/app/components/icon';
import { useGetWorkflows } from '@/domains/workflows/hooks/use-workflow';
import { WorkflowStatusEnum } from '@/domains/workflows/types';
import { getParsedFrameworkApis } from '@/domains/workflows/utils';
import { IconName } from '@/types/icons';

import { ToolChoice, useAgentFormContext } from '../context/agent-form-context';

interface ToolsMultiSelectProps {
  data: string;
}

export const ToolsMultiSelect = ({ data }: ToolsMultiSelectProps) => {
  const { workflows } = useGetWorkflows();
  const deserializedData = getParsedFrameworkApis(data);
  const [selectedTools, setSelectedTools] = useState<{ label: string; value: string; icon: string }[]>([]);

  const publishedWorkflows = workflows?.filter(({ status }) => status === WorkflowStatusEnum.PUBLISHED);

  const options = [...publishedWorkflows, ...deserializedData].map(item => {
    const parent = 'status' in item ? 'workflow' : (item as any).integrationName;
    const child = 'status' in item ? (item as any).title : (item as any).type;

    return {
      value: child,
      label: `${capitalizeFirstLetter(parent)} > ${snakeCase(child)}`,
      icon: parent?.toLowerCase(),
    };
  });

  const { setTools, setToolChoice } = useAgentFormContext();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="font-medium text-sm">
          Tools: <span className="bg-mastra-bg-4 rounded py-1 px-2 ">{selectedTools.length}</span>
        </h1>
        <SelectDropDown<{ label: string; value: string; icon: string }>
          idKey="value"
          nameKey="label"
          data={options}
          selectedValues={selectedTools}
          setSelectedValues={setSelectedTools}
          placeholder="Select tools"
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
          <Button
            type="button"
            variant={'ghost'}
            className="w-full py-3 mt-1 text-gray-300 h-[unset] flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
          >
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
                      type="button"
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
              'Select Tools'
            )}

            <Icon name="down-caret" className="ml-auto h-4 w-4" />
          </Button>
        </SelectDropDown>
      </div>

      <div className="flex gap-2 justify-between">
        <p className="text-xs font-medium">Tool choice:</p>
        <RadioGroup
          onValueChange={val => setToolChoice(val as ToolChoice)}
          defaultValue="auto"
          className="flex items-center"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="auto" id="auto" />
            <Label htmlFor="auto">Auto</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="required" id="required" />
            <Label htmlFor="required">Required</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};

export default ToolsMultiSelect;
