export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

export interface ChatProps {
  agentId: string;
  agentName?: string;
  threadId?: string;
  initialMessages?: Message[];
  memory?: boolean;
  buildUrl?: string;
}
