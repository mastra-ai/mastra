export interface AgentFormData {
  id: string;
  name: string;
  description: string;
  provider: string;
  modelId: string;
  instructions: string;
  workflowIds: string[];
  agentIds: Array<{ agentId: string; from: 'CODE' | 'CONFIG' }>;
  toolIds: string[];
  scorerIds: string[];
  memoryConfig: {
    lastMessages: number;
    semanticRecall: {
      enabled: boolean;
      topK: number;
      messageRange: number;
    };
    workingMemory: {
      enabled: boolean;
      scope: 'thread' | 'resource';
    };
    threads: {
      generateTitle: boolean;
    };
  };
}

export interface FormErrors {
  [key: string]: string;
}
