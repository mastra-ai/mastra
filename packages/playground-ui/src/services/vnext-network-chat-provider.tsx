import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

//the whole workflow execution state.

type VNextNetworkChatContextType = {
  executionSteps: Array<string>;
  steps: Record<string, any>;
  handleStep: (id: string, record: Record<string, any>) => void;
  runId?: string;
};

const VNextNetworkChatContext = createContext<VNextNetworkChatContextType | undefined>(undefined);

export const VNextNetworkChatProvider = ({ children, networkId }: { children: ReactNode; networkId: string }) => {
  const [state, setState] = useState<Omit<VNextNetworkChatContextType, 'handleStep'>>({
    executionSteps: [],
    steps: {},
    runId: undefined,
  });

  const handleStep = (uuid: string, record: Record<string, any>) => {
    const id = record?.type === 'finish' ? 'finish' : record.type === 'start' ? 'start' : record.payload?.id;
    if (id.includes('mapping_')) return;

    setState(current => {
      const currentMetadata = current?.steps?.[id]?.metadata;

      let startTime = currentMetadata?.startTime;
      let endTime = currentMetadata?.endTime;

      if (record.type === 'step-start') {
        startTime = Date.now();
      }

      if (record.type === 'step-finish') {
        endTime = Date.now();
      }

      return {
        ...current,
        runId: current?.runId || record?.payload?.runId,
        executionSteps: current.steps[id] ? current.executionSteps : [...current.executionSteps, id],
        steps: {
          ...current.steps,
          [id]: {
            ...(current.steps[id] || {}),
            [record.type]: record.payload,
            metadata: {
              startTime,
              endTime,
            },
          },
        },
      };
    });
  };

  console.log('state==', state);

  return (
    <VNextNetworkChatContext.Provider value={{ ...state, handleStep }}>{children}</VNextNetworkChatContext.Provider>
  );
};

export const useVNextNetworkChat = () => {
  const context = useContext(VNextNetworkChatContext);
  if (context === undefined) {
    throw new Error('useVNextNetworkChat must be used within a VNextNetworkChatProvider');
  }
  return context;
};
