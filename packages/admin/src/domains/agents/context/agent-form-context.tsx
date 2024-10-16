'use client';

import { createContext, ReactNode, SetStateAction, useContext, useState } from 'react';

import { StructuredResponse } from '../utils';

export type AgentInfo = {
  name: string;
  model: Model;
  agentInstructions: string;
  outputs: Outputs;
};

type Model = {
  provider: string;
  name: string;
};

type Outputs = {
  text: true;
  structured: StructuredResponse;
};

export type ToolChoice = 'auto' | 'required';

type KnowledgeSource = {
  provider: string;
  indexes: string[];
};

interface AgentFormContextProps {
  agentInfo: AgentInfo;
  setAgentInfo: React.Dispatch<SetStateAction<AgentInfo>>;

  toolChoice: 'auto' | 'required';
  setToolChoice: React.Dispatch<SetStateAction<ToolChoice>>;

  tools: Record<string, unknown>;
  setTools: React.Dispatch<SetStateAction<Record<string, unknown>>>;

  knowledgeSources: KnowledgeSource[];
  setKnowledgeSources: React.Dispatch<SetStateAction<KnowledgeSource[]>>;

  buttonContainer: HTMLDivElement | null;
  setButtonContainer: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;
}

export const AgentFormContext = createContext({} as AgentFormContextProps);

export const useAgentFormContext = () => {
  const context = useContext(AgentFormContext);
  if (!context) {
    throw new Error('useAgentFormContext must be used within a AgentFormProvider');
  }
  return context;
};

export const AgentFormProvider = ({ children }: { children: ReactNode }) => {
  const [agentInfo, setAgentInfo] = useState<AgentInfo>({
    name: '',
    agentInstructions: '',
    model: {
      provider: '',
      name: '',
    },
    outputs: {
      text: true,
      structured: {},
    },
  });
  const [buttonContainer, setButtonContainer] = useState<HTMLDivElement | null>(null);
  const [tools, setTools] = useState({});
  const [toolChoice, setToolChoice] = useState<ToolChoice>('auto');
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([
    {
      provider: 'PINECONE',
      indexes: [],
    },
  ]);

  return (
    <AgentFormContext.Provider
      value={{
        agentInfo,
        setAgentInfo,

        tools,
        setTools,

        toolChoice,
        setToolChoice,

        knowledgeSources,
        setKnowledgeSources,

        buttonContainer,
        setButtonContainer,
      }}
    >
      {children}
    </AgentFormContext.Provider>
  );
};
