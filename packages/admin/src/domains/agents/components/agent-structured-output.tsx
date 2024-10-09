'use client';

import { createId } from '@paralleldrive/cuid2';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { toTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import {
  ChildStructuredOutput,
  constructStructuredOutput,
  constructStrucuturedOutputArr,
  StructuredOutput,
  StructuredOutputType,
  structuredOutputTypes,
  StrucutedResponse,
} from '../utils';

export const AgentStructuredOutput = ({
  structuredResponse,
  onSaveOutput,
}: {
  structuredResponse: StrucutedResponse;
  onSaveOutput: (output: any) => void;
}) => {
  const { structuredOutput, childrenOutput } = constructStrucuturedOutputArr(structuredResponse);
  const [structuredOutputs, setStructuredOutputs] = useState<StructuredOutput[]>(() =>
    structuredOutput?.length
      ? structuredOutput
      : ([
          {
            name: '',
            id: createId(),
          },
        ] as unknown as StructuredOutput[]),
  );
  const [childrenOutputs, setChildrenOutputs] = useState<ChildStructuredOutput[]>(childrenOutput || []);

  const addNewKey = () => {
    const newStructuredOutputs = [...structuredOutputs, { name: '', id: createId() } as unknown as StructuredOutput];
    setStructuredOutputs(newStructuredOutputs);
  };

  const addNewChildKey = (parentKey: string) => {
    const newChildrenOutputs = [
      ...childrenOutputs,
      { name: '', id: createId(), parentKey } as unknown as ChildStructuredOutput,
    ];
    setChildrenOutputs(newChildrenOutputs);
  };

  const removeKey = (id: string) => {
    const keyToRemove = structuredOutputs?.find(item => item.id === id);
    if (keyToRemove) {
      const newStructuredOutputs = [...(structuredOutputs || [])]?.filter(sOpt => sOpt.id !== id);
      const newChildrenOutputs = [...(childrenOutputs || [])]?.filter(cOpt => cOpt.parentKey !== keyToRemove?.name);

      setStructuredOutputs(newStructuredOutputs);
      setChildrenOutputs(newChildrenOutputs);
    }
  };

  const removeChildKey = (id: string) => {
    const newChildrenOutputs = [...(childrenOutputs || [])]?.filter(cOpt => cOpt.id !== id);

    setChildrenOutputs(newChildrenOutputs);
  };

  const updateKeyName = (name: string, id: string) => {
    const newStructuredOutputs = [...(structuredOutputs || [])]?.map(sOpt => {
      if (sOpt.id === id) {
        return {
          ...sOpt,
          name,
        };
      }
      return sOpt;
    });

    setStructuredOutputs(newStructuredOutputs);
  };

  const updateChildKeyName = (name: string, id: string) => {
    const newChildrenOutputs = [...(childrenOutputs || [])]?.map(sOpt => {
      if (sOpt.id === id) {
        return {
          ...sOpt,
          name,
        };
      }
      return sOpt;
    });

    setChildrenOutputs(newChildrenOutputs);
  };

  const updateKeyType = (type: StructuredOutputType, id: string, isArrayItemType?: boolean) => {
    const parentItem = structuredOutputs?.find(item => item.id === id);
    const newStructuredOutputs = [...(structuredOutputs || [])]?.map(sOpt => {
      if (sOpt.id === id) {
        return {
          ...sOpt,
          ...(isArrayItemType ? { arrayItemType: type } : { type }),
        };
      }
      return sOpt;
    });

    if (type === 'object') {
      const newChildrenOutputs = [
        ...childrenOutputs,
        { name: '', parentKey: parentItem?.name, id: createId() } as unknown as ChildStructuredOutput,
      ];
      setChildrenOutputs(newChildrenOutputs);
    }

    setStructuredOutputs(newStructuredOutputs);
  };

  const updateChildKeyType = (type: StructuredOutputType, id: string) => {
    const newChildrenOutputs = [...(childrenOutputs || [])]?.map(sOpt => {
      if (sOpt.id === id) {
        return {
          ...sOpt,
          type,
        };
      }
      return sOpt;
    });

    setChildrenOutputs(newChildrenOutputs);
  };

  return (
    <div className="max-h-96 overflow-scroll">
      <ScrollArea>
        <div className="space-y-2 p-0.5">
          {structuredOutputs?.map((strOutput, index) => (
            <StructuredOutputItem
              key={strOutput.id}
              isLastStructuredOutput={index === structuredOutputs?.length - 1}
              childrenOutputs={childrenOutputs?.filter(({ parentKey }) => parentKey === strOutput.name)}
              addNewChildKey={addNewChildKey}
              addNewKey={addNewKey}
              updateChildKeyName={updateChildKeyName}
              updateKeyName={updateKeyName}
              updateChildKeyType={updateChildKeyType}
              updateKeyType={updateKeyType}
              removeChildKey={removeChildKey}
              removeKey={removeKey}
              structuredOutput={strOutput}
            />
          ))}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                const output = constructStructuredOutput(structuredOutputs, childrenOutputs);
                onSaveOutput(output);
              }}
            >
              Save output
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

const StructuredOutputItem = ({
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
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={structuredOutput.name}
          onChange={e => {
            updateKeyName(e.target.value, structuredOutput.id);
          }}
          className="w-52"
          placeholder="Enter item key"
          customSize="sm"
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
          <IconButton
            icon="trash"
            onClick={() => {
              removeKey(structuredOutput.id);
            }}
            className="cursor-pointer px-0"
            size="sm"
          />
        )}

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
              <p className="text-xs w-52 pl-2">Array item type</p>
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
              ) : (
                <IconButton
                  icon="trash"
                  onClick={() => {
                    removeChildKey(chOutput.id);
                  }}
                  className="cursor-pointer px-0"
                  size="sm"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
