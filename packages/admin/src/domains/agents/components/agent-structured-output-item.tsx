'use client';

import { useState } from 'react';

import IconButton from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { toTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import { ChildStructuredOutput, StructuredOutput, StructuredOutputType, structuredOutputTypes } from '../utils';

export const AgentStructuredOutputItem = ({
  structuredOutput,
  isLastStructuredOutput,
  childrenOutputs,
  addNewKey,
  addNewChildKey,
  updateChildKeyName,
  updateChildKeyType,
  updateKeyName,
  updateKeyType,
  removeKey,
  removeChildKey,
}: {
  structuredOutput: StructuredOutput;
  isLastStructuredOutput: boolean;
  childrenOutputs: ChildStructuredOutput[];
  addNewKey: () => void;
  addNewChildKey: (parentKey: string) => void;
  updateChildKeyName: (name: string, id: string) => void;
  updateChildKeyType: (type: StructuredOutputType, id: string) => void;
  updateKeyName: (name: string, id: string) => void;
  updateKeyType: (type: StructuredOutputType, id: string, isArrayItemType?: boolean) => void;
  removeKey: (id: string) => void;
  removeChildKey: (id: string) => void;
}) => {
  const [collapse, setCollapse] = useState(false);

  const getChildOutputTypes = (currentType: StructuredOutputType) => {
    if (currentType === 'object') {
      return ['string', 'number', 'date', 'boolean'];
    }
    if (currentType === 'array') {
      return ['string', 'number', 'date', 'object'];
    }

    return [...structuredOutputTypes];
  };

  return (
    <div className="space-y-2 flex gap-2 items-center">
      {isLastStructuredOutput ? (
        <IconButton
          icon="plus-icon"
          onClick={() => {
            addNewKey();
          }}
          className="cursor-pointer px-0"
          title="Add new output item"
          size="sm"
        />
      ) : (
        <div className="w-4"></div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={structuredOutput.name}
          onChange={e => {
            updateKeyName(e.target.value, structuredOutput.id);
          }}
          className="w-52"
          placeholder="Enter item key"
          customSize="sm"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          type="text"
        />

        <Select
          value={structuredOutput.type || ''}
          onValueChange={value => {
            updateKeyType(value as StructuredOutputType, structuredOutput.id);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            {[...structuredOutputTypes].map(item => (
              <SelectItem key={item} value={item}>
                {toTitleCase(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <IconButton
          icon="trash"
          onClick={() => {
            removeKey(structuredOutput.id);
          }}
          className="cursor-pointer px-0 ml-2 text-mastra-el-3"
          size="sm"
        />

        {childrenOutputs?.length ? (
          <IconButton
            icon="down-caret"
            onClick={() => {
              setCollapse(!collapse);
            }}
            className={cn('cursor-pointer px-0 transition-transform', collapse && 'rotate-180')}
            size="sm"
          />
        ) : null}
      </div>
      {collapse ? null : (
        <div className="space-y-2">
          {structuredOutput.type === 'array' ? (
            <div className="flex items-center gap-2">
              <p className="text-xs w-52 text-right pr-2 text-mastra-el-6/80 italic">Array item type</p>
              <Select
                value={structuredOutput.arrayItemType || ''}
                onValueChange={value => {
                  updateKeyType(value as StructuredOutputType, structuredOutput.id, true);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {[...getChildOutputTypes(structuredOutput.type)].map(item => (
                    <SelectItem key={item} value={item}>
                      {toTitleCase(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {childrenOutputs?.map((chOutput, chIndex) => (
            <div className="flex items-center gap-2" key={chOutput.id}>
              <div className="w-1 h-1 rounded-full bg-white ml-2" />
              <Input
                value={chOutput.name}
                onChange={e => {
                  updateChildKeyName(e.target.value, chOutput.id);
                }}
                className="w-[190px]"
                placeholder="Enter item key"
                customSize="sm"
              />

              <Select
                value={chOutput.type || ''}
                onValueChange={value => {
                  updateChildKeyType(value as StructuredOutputType, chOutput.id);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {[...getChildOutputTypes(structuredOutput.arrayItemType || structuredOutput.type)].map(item => (
                    <SelectItem key={item} value={item}>
                      {toTitleCase(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <IconButton
                icon="trash"
                onClick={() => {
                  removeChildKey(chOutput.id);
                }}
                className="cursor-pointer px-0"
                size="sm"
              />

              {chIndex === childrenOutputs?.length - 1 ? (
                <IconButton
                  icon="plus-icon"
                  onClick={() => {
                    addNewChildKey(structuredOutput.name);
                  }}
                  className="cursor-pointer px-0"
                  title="Add new item to object"
                  size="sm"
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
