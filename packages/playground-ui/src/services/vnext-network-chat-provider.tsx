import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useMessages } from './vnext-message-provider';
import { formatJSON } from '@/lib/formatting';

//the whole workflow execution state.

type VNextNetworkChatContextType = {
  executionSteps: Array<string>;
  steps: Record<string, any>;
  handleStep: (id: string, record: Record<string, any>) => void;
  runId?: string;
};

const VNextNetworkChatContext = createContext<VNextNetworkChatContextType | undefined>(undefined);

export const VNextNetworkChatProvider = ({ children, networkId }: { children: ReactNode; networkId: string }) => {
  const { setMessages } = useMessages();
  const [state, setState] = useState<Omit<VNextNetworkChatContextType, 'handleStep'>>({
    executionSteps: [],
    steps: {},
    runId: undefined,
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

    const run = async () => {
      const formatted = await formatJSON(workflowStepResult?.output?.result);

      setMessages(msgs => [
        ...msgs,
        { role: 'assistant', content: [{ type: 'text', text: `\`\`\`json\n${formatted}\`\`\`` }] },
      ]);
    };

    run();
  }, [state, setMessages]);

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
