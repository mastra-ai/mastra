'use client';

import { useState } from 'react';

import { capitalizeFirstLetter } from '@/lib/string';

import { Icon } from '@/app/components/icon';
import { getParsedFrameworkApis } from '@/domains/workflows/utils';

import { useAgentFormContext } from '../context/agent-form-context';

import { DropdownPair, DropdownPairProps } from './tools-dropdown-pair';

interface ToolsMultiSelectProps {
  data: string;
}

export const ToolsMultiSelect = ({ data }: ToolsMultiSelectProps) => {
  const deserializedData = getParsedFrameworkApis(data);

  const groupedData = deserializedData.reduce((acc: Record<string, any>, curr) => {
    if (!acc[curr.integrationName]) {
      acc[curr.integrationName] = [];
    }
    acc[curr.integrationName].push(curr);
    return acc;
  }, {});

  const integrationKeys = Object.keys(groupedData).map(key => ({
    name: capitalizeFirstLetter(key),
    value: key,
    icon: key.toLowerCase(),
  }));

  const { setTools } = useAgentFormContext();

  return (
    <MultiDropdownSelector deserializedData={deserializedData} integrationKeys={integrationKeys} setTools={setTools} />
  );
};
type MultiDropdownSelectorProps = Omit<DropdownPairProps, 'setIntegrationKeys'>;

const MultiDropdownSelector = (props: MultiDropdownSelectorProps) => {
  const [dropdownPairs, setDropdownPairs] = useState<number[]>([0]);
  const [integrationKeys, setIntegrationKeys] = useState(props.integrationKeys);

  const addNewDropdownPair = () => {
    setDropdownPairs(prev => [...prev, prev.length]);
  };

  return (
    <div className="space-y-2">
      <h1 className="font-medium text-sm">
        Tools: <span className="bg-mastra-bg-4 rounded py-1 px-2 ">{dropdownPairs.length}</span>
      </h1>
      {dropdownPairs.map((_, index) => (
        <DropdownPair
          key={index}
          {...props}
          integrationKeys={integrationKeys}
          setIntegrationKeys={setIntegrationKeys}
        />
      ))}
      <button onClick={addNewDropdownPair} className="p-2 bg-mastra-bg-4 flex items-center text-white rounded ">
        <Icon name="plus-icon" className="w-3 h-3" />
      </button>
    </div>
  );
};

export default ToolsMultiSelect;
