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
