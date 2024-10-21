'use client';

import { createContext, ReactNode, SetStateAction, useContext, useEffect, useState } from 'react';

import { useParams } from 'next/navigation';

import { getAgent } from '../actions';
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

export type KnowledgeSource = {
  provider: string;
  indexes: string[];
};

interface AgentFormContextProps {
  agentInfo: AgentInfo;
  setAgentInfo: React.Dispatch<SetStateAction<AgentInfo>>;

  toolChoice: 'auto' | 'required';
  setToolChoice: React.Dispatch<SetStateAction<ToolChoice>>;

  tools: Record<string, boolean>;
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
  const { id } = useParams<{ id: string }>();
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
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(
    id
      ? []
      : [
          {
            provider: 'PINECONE',
            indexes: [],
          },
        ],
  );

  const fetchAgent = async (agentId: string) => {
    const agent = await getAgent(agentId);
    const { agentInstructions, model, outputs, name, tools } = agent;
    const { toolChoice, ...rest } = model || {};
    setAgentInfo({ agentInstructions, model: rest, name, outputs });
    setTools(tools);
    setToolChoice(toolChoice);
  };

  useEffect(() => {
    if (id) {
      fetchAgent(id);
    }
  }, [id]);

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
