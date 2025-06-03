import { createContext, useContext, ReactNode, useState } from 'react';

//the whole workflow execution state.

type VNextNetworkChatContextType = {
  executionSteps: Array<string>;
  steps: Record<string, any>;
  allSteps: Array<Record<string, any>>;
  workflows: Record<string, any>;
  agents: Record<string, any>;
  handleStep: (record: Record<string, any>) => void;
};

const VNextNetworkChatContext = createContext<VNextNetworkChatContextType | undefined>(undefined);

export const VNextNetworkChatProvider = ({ children, networkId }: { children: ReactNode; networkId: string }) => {
  // const []
  const [executionSteps, setExecutionSteps] = useState([] as Array<string>);
  const [allSteps, setAllSteps] = useState([] as Array<Record<string, any>>);
  const [workflows, setWorkflows] = useState({} as Record<string, any>);
  const [agents, setAgents] = useState({} as Record<string, any>);
  const [steps, setSteps] = useState({} as Record<string, any>);

  const handleStep = (record: Record<string, any>) => {
    //handle record
    // if (record.type === 'step-start') {
    // }
    if (record.type === 'tool-call-delta') return;
    if (record.type === 'tool-call-streaming-start') return;

    const id = record.payload?.id ?? record.payload?.runId;

    setAllSteps(current => [...current, record]);
    setExecutionSteps(current => [...current, id]);

    setSteps(current => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [record.type]: record.payload,
      },
    }));
  };

  return (
    <VNextNetworkChatContext.Provider value={{ executionSteps, steps, workflows, agents, handleStep, allSteps }}>
      {children}
    </VNextNetworkChatContext.Provider>
  );
};

export const useVNextNetworkChat = () => {
  const context = useContext(VNextNetworkChatContext);
  if (context === undefined) {
    throw new Error('useVNextNetworkChat must be used within a VNextNetworkChatProvider');
  }
  return context;
};
