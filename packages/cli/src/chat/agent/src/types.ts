export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatProps {
  agentId: string;
  initialMessages?: Message[];
}
