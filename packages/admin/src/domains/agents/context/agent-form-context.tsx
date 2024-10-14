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
// interface KnowledgeSourceWithExistingIndex {
//   index: string;
//   entities?: never;
// }

// interface KnowledgeSourceWithNewIndex {
//   index?: never;
//   entities: { integration: string; data: { name: string; fields: string[]; index: string; syncEvent: string }[] }[];
// }

export type KnowledgeSourceEntityData = {
  name: string;
  fields: string[];
  syncEvent: string;
  index: string;
};

type KnowledgeSource = {
  vector_provider: string;
  // index: string;
  resyncingInterval?: string;
  // entities?: { name: string; fields: string[]; index: string; syncEvent: string }[];
  entities?: { integration: string; data: KnowledgeSourceEntityData[] }[];
};

interface AgentFormContextProps {
  agentInfo: AgentInfo;
  setAgentInfo: React.Dispatch<SetStateAction<AgentInfo>>;

  toolChoice: 'auto' | 'required';
  setToolChoice: React.Dispatch<SetStateAction<ToolChoice>>;

  tools: Record<string, unknown>;
  setTools: React.Dispatch<SetStateAction<Record<string, unknown>>>;

  knowledgeSource: KnowledgeSource;
  setKnowledgeSource: React.Dispatch<SetStateAction<KnowledgeSource>>;

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
  const [knowledgeSource, setKnowledgeSource] = useState<KnowledgeSource>({
    vector_provider: '',
    // index: '',
    entities: [{ integration: '', data: [] }],
  } as KnowledgeSource);

  return (
    <AgentFormContext.Provider
      value={{
        agentInfo,
        setAgentInfo,

        tools,
        setTools,

        toolChoice,
        setToolChoice,

        knowledgeSource,
        setKnowledgeSource,

        buttonContainer,
        setButtonContainer,
      }}
    >
      {children}
    </AgentFormContext.Provider>
  );
};
