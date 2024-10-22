'use client';

import { useEffect, useState } from 'react';

import Icon from '@/components/icon';
import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import SelectDropDown from '@/components/ui/select-dropdown';

import { useGetWorkflows } from '@/domains/workflows/hooks/use-workflow';
import { WorkflowStatusEnum } from '@/domains/workflows/types';

import { useAgentFormContext } from '../context/agent-form-context';

export const WorkflowsMultiSelect = () => {
  const { workflows } = useGetWorkflows();
  const [selectedWorkflows, setSelectedWorkflows] = useState<{ label: string; value: string }[]>([]);
  const [updatedFromContext, setUpdatedFromContext] = useState(false);

  const publishedWorkflows = workflows?.filter(({ status }) => status === WorkflowStatusEnum.PUBLISHED);

  const options = [...publishedWorkflows].map(item => {
    return {
      value: item.title,
      label: item.id,
    };
  });

  const { tools, setTools } = useAgentFormContext();

  useEffect(() => {
    if (tools && Object.keys(tools).length && !selectedWorkflows.length && !updatedFromContext) {
      const sWflows = options?.filter(({ value }) => Object.keys(tools)?.includes(value));
      setSelectedWorkflows(sWflows);
      setUpdatedFromContext(true);
    }
  }, [tools, selectedWorkflows, options, updatedFromContext]);

  return (
    <div className="space-y-1.5">
      <p className="text-mastra-el-3 text-xs font-medium">
        Workflows: <span className="bg-mastra-bg-4 rounded py-1 px-2 ">{selectedWorkflows.length}</span>
      </p>
      <SelectDropDown<{ label: string; value: string }>
        idKey="value"
        nameKey="label"
        data={options}
        selectedValues={selectedWorkflows}
        setSelectedValues={setSelectedWorkflows}
        placeholder="Select workflows"
        onSelectItem={item => {
          setTools(tools => ({
            ...tools,
            [item.value]: true,
          }));
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
          {selectedWorkflows.length ? (
            <span className="flex items-center flex-wrap gap-1">
              {selectedWorkflows?.map(workflow => (
                <span
                  className="flex gap-2 items-center text-xs rounded-full text-inherit px-2 py-1 bg-mastra-bg-9"
                  key={workflow.value}
                >
                  <span className="text-xs">{workflow.label}</span>
                  <IconButton
                    icon="cancel"
                    size="sm"
                    type="button"
                    className="p-0 cursor-pointer"
                    onClick={e => {
                      e.stopPropagation();
                      setTools(tools => {
                        if (Object.keys(tools).includes(workflow.value)) {
                          delete tools[workflow.value];
                          return { ...tools };
                        }
                        return tools;
                      });
                      setSelectedWorkflows(prev => prev.filter(({ value }) => value !== workflow.value));
                    }}
                  />
                </span>
              ))}
            </span>
          ) : (
            'Select workflows'
          )}

          <Icon name="down-caret" className="ml-auto h-4 w-4" />
        </Button>
      </SelectDropDown>
    </div>
  );
};

export default WorkflowsMultiSelect;
