export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
