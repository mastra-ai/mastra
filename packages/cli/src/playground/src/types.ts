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

type OpenaiType = 'string' | 'number' | 'object' | 'array' | 'boolean';

export interface ApiEndpoint {
  tags: string[];
  endpoint: string;
  description: string;
  method: string;
  parameters: Array<{
    name: string;
    in: 'path' | 'query';
    required: boolean;
    schema: {
      type: OpenaiType;
    };
  }>;
  body?: {
    type: 'object';
    properties: {
      [key: string]: {
        type?: OpenaiType;
        oneOf?: {
          type: OpenaiType;
        }[];
      };
    };
  };
}
