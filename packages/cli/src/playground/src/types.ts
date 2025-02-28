export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: any;
  isError?: boolean;
}

export interface ChatProps {
  agentId: string;
  agentName?: string;
  threadId?: string;
  initialMessages?: Message[];
  memory?: boolean;
  url?: string;
}
