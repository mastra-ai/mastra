import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useMessages } from './vnext-message-provider';

//the whole workflow execution state.

type VNextNetworkChatContextType = {
  executionSteps: Array<string>;
  steps: Record<string, any>;
  handleStep: (record: Record<string, any>) => void;
};

const VNextNetworkChatContext = createContext<VNextNetworkChatContextType | undefined>(undefined);

export const VNextNetworkChatProvider = ({ children, networkId }: { children: ReactNode; networkId: string }) => {
  const { appendToLastMessage, setMessages } = useMessages();
  const [state, setState] = useState<Omit<VNextNetworkChatContextType, 'handleStep'>>({
    executionSteps: [],
    steps: {},
  });

  useEffect(() => {
    const hasFinished = Boolean(state.steps?.['finish']);
    if (!hasFinished) return;

    const workflowStep = state.steps?.['workflow-step'];
    if (!workflowStep) return;

    const workflowStepResult = workflowStep?.['step-result'];
    if (!workflowStepResult) return;

    const workflowStepResultOutput = workflowStepResult?.output;
    if (!workflowStepResultOutput) return;

    setMessages(msgs => [
      ...msgs,
      {
        role: 'assistant',
        content: [{ type: 'text', text: `\`\`\`json\n${workflowStepResult?.output?.result}\`\`\`` }],
      },
    ]);
  }, [state, setMessages]);

  const handleStep = (record: Record<string, any>) => {
    if (record.type === 'tool-call-delta') {
      return appendToLastMessage(record.argsTextDelta);
    }

    if (record.type === 'tool-call-streaming-start') {
      return setMessages(msgs => [...msgs, { role: 'assistant', content: [{ type: 'text', text: '' }] }]);
    }

    const id = record?.type === 'finish' ? 'finish' : record.payload?.id;
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

  // console.log('state==', state);

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
