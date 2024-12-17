export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: any;
  isError?: boolean;
}

export interface ChatProps {
  agentId: string;
  initialMessages?: Message[];
}

export interface Agent {
  name: string;
  modelProvider: string;
  modelName: string;
  instructions: string;
}

export interface AgentWithTools extends Agent {
  tools: string[];
}
