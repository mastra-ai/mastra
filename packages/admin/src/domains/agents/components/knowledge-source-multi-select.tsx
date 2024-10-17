'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import SelectDropDown from '@/components/ui/select-dropdown';

import { Icon } from '@/app/components/icon';
import { VectorIndex } from '@/domains/rag/types';

import { useAgentFormContext } from '../context/agent-form-context';

interface KnowledgeSourceMultiSelectProps {
  indexes: VectorIndex[];
}

export const KnowledgeSourceMultiSelect = ({ indexes }: KnowledgeSourceMultiSelectProps) => {
  const router = useRouter();
  const [selectedIndexes, setSelectedIndexes] = useState<{ label: string; value: string }[]>([]);
  const options = indexes.map(item => {
    return {
      value: item.name,
      label: `PINECONE > ${item.name}`,
    };
  });

  const { setKnowledgeSources } = useAgentFormContext();

  return (
    <div className="space-y-2">
      <h1 className="font-medium text-sm">Knowledge Source</h1>
      <SelectDropDown<{ label: string; value: string }>
        idKey="value"
        nameKey="label"
        data={options}
        selectedValues={selectedIndexes}
        setSelectedValues={values => {
          setSelectedIndexes(values);
          setKnowledgeSources(prev =>
            prev.map(item => {
              if (item.provider === 'PINECONE') {
                item.indexes = values?.map(val => val.value);
              }
              return item;
            }),
          );
        }}
        placeholder="Select Indexes"
        onActionButtonClick={
          indexes?.length
            ? undefined
            : () => {
                router.push('/rag/create');
              }
        }
        actionButtonLabel="Create new index"
        actionButtonIcon={<Icon name="plus-icon" />}
      >
        <Button
          type="button"
          variant={'ghost'}
          className="w-full py-3 mt-1 text-gray-300 h-[unset] flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
        >
          {selectedIndexes.length ? (
            <span className="flex items-center flex-wrap gap-1">
              {selectedIndexes?.map(index => (
                <span
                  className="flex gap-2 items-center text-xs rounded-full text-inherit px-2 py-1 bg-mastra-bg-9"
                  key={index.value}
                >
                  <span className="text-xs">{index.label}</span>
                  <IconButton
                    icon="cancel"
                    size="sm"
                    type="button"
                    className="p-0 cursor-pointer"
                    onClick={e => {
                      e.stopPropagation();
                      setKnowledgeSources(prev =>
                        prev.map(item => {
                          if (item.provider === 'PINECONE') {
                            item.indexes = [...item.indexes]?.filter(val => val !== index.value);
                          }
                          return item;
                        }),
                      );
                      setSelectedIndexes(prev => prev.filter(({ value }) => value !== index.value));
                    }}
                  />
                </span>
              ))}
            </span>
          ) : (
            'Select Indexes'
          )}

          <Icon name="down-caret" className="ml-auto h-4 w-4" />
        </Button>
      </SelectDropDown>
    </div>
  );
};

export default KnowledgeSourceMultiSelect;
