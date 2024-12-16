'use client';

import { createId } from '@paralleldrive/cuid2';
import { useEffect, useState } from 'react';

import { CodeBlockDemo } from '@/components/code-block';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  ChildStructuredOutput,
  constructStructuredOutput,
  constructStrucuturedOutputArr,
  StructuredOutput,
  StructuredOutputType,
  StructuredResponse,
} from '../utils';

import { AgentStructuredOutputItem } from './agent-structured-output-item';

export const AgentStructuredOutput = ({
  structuredResponse,
  onSaveOutput,
}: {
  structuredResponse: StructuredResponse;
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
  const [childrenOutputs, setChildrenOutputs] = useState<ChildStructuredOutput[]>(() => childrenOutput || []);

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
      const newChildrenOutputs = [...childrenOutputs]?.filter(cOpt => cOpt.parentKey !== keyToRemove?.name);

      if (structuredOutputs?.length === 1) {
        setStructuredOutputs([
          {
            name: '',
            id: createId(),
          },
        ] as unknown as StructuredOutput[]);
      } else {
        const newStructuredOutputs = [...structuredOutputs]?.filter(sOpt => sOpt.id !== id);
        setStructuredOutputs(newStructuredOutputs);
      }

      setChildrenOutputs(newChildrenOutputs);
    }
  };

  const removeChildKey = (id: string) => {
    const currentChild = [...childrenOutputs]?.find(ch => ch.id === id);
    const parentChildren = [...childrenOutputs]?.filter(ch => ch.parentKey === currentChild?.parentKey);

    const newChildrenOutputs =
      parentChildren?.length === 1
        ? [...childrenOutputs]?.map(cOpt => {
            if (cOpt.id === id) {
              (cOpt.name = ''), (cOpt.type = '' as StructuredOutputType);
            }
            return cOpt;
          })
        : [...childrenOutputs]?.filter(cOpt => cOpt.id !== id);

    setChildrenOutputs(newChildrenOutputs);
  };

  const updateKeyName = (name: string, id: string) => {
    const newStructuredOutputs = [...structuredOutputs]?.map(sOpt => {
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
    const newStructuredOutputs = [...structuredOutputs]?.map(sOpt => {
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

    if (parentItem?.type === 'object' && type !== 'object') {
      const newChildrenOutputs = childrenOutputs?.filter(item => item.parentKey !== parentItem?.name);
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

  useEffect(() => {
    if (structuredOutputs.length) {
      const output = constructStructuredOutput(structuredOutputs, childrenOutputs);
      onSaveOutput(output);
    }
  }, [childrenOutputs, structuredOutputs]);

  const outputJSON = constructStructuredOutput(structuredOutputs, childrenOutputs);

  const formattedCode = JSON.stringify(outputJSON, null, '\t');

  return (
    <Tabs defaultValue="preview">
      <TabsList className="flex shrink-0 border-b">
        <TabsTrigger value="preview" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Output Preview
          </p>
        </TabsTrigger>
        <TabsTrigger value="json" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Output JSON
          </p>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <ScrollArea>
          <div className="max-h-80 h-80 space-y-2 p-0.5">
            {structuredOutputs?.map((strOutput, index) => (
              <AgentStructuredOutputItem
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
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="json">
        <ScrollArea>
          <div className="max-h-80 h-80 space-y-2 p-0.5">
            <CodeBlockDemo code={formattedCode} language="json" />
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};
