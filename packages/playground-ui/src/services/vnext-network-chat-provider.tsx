import { createContext, useContext, ReactNode, useState } from 'react';
import { useMessages } from './vnext-message-provider';

//the whole workflow execution state.

type VNextNetworkChatContextType = {
  executionSteps: Array<string>;
  steps: Record<string, any>;
  workflows: Record<string, any>;
  agents: Record<string, any>;
  handleStep: (record: Record<string, any>) => void;
};

const VNextNetworkChatContext = createContext<VNextNetworkChatContextType | undefined>(undefined);

export const VNextNetworkChatProvider = ({ children, networkId }: { children: ReactNode; networkId: string }) => {
  const { appendToLastMessage, setMessages } = useMessages();
  const [state, setState] = useState<Omit<VNextNetworkChatContextType, 'handleStep'>>({
    executionSteps: [],
    steps: {},
    workflows: {},
    agents: {},
  });

  const handleStep = (record: Record<string, any>) => {
    if (record.type === 'tool-call-delta') {
      setState(current => ({
        ...current,
        agents: {
          ...current.agents,
          [record.name]: {
            ...current.agents[record.name],
            contentToShow: current.agents[record.name].contentToShow + record.argsTextDelta,
          },
        },
      }));

      appendToLastMessage(record.argsTextDelta);

      return;
    }

    if (record.type === 'tool-call-streaming-start') {
      setState(current => ({
        ...current,
        agents: {
          ...current.agents,
          [record.name]: {
            ...current.agents[record.name],
            contentToShow: '', // SETUP AN EMPTY CONTENT AT THE BEGINNING
          },
        },
      }));

      setMessages(msgs => [...msgs, { role: 'assistant', content: [{ type: 'text', text: '' }] }]);

      return;
    }

    const id = record?.type === 'finish' ? 'finish' : record.payload?.id;

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
