type TextMessage = {
  type: 'text';
  content: string;
};

type ToolMessage = {
  type: 'tool';
  toolName: string;
  toolInput?: any;
  toolOutput?: any;
  args?: any;
  toolCallId: string;
  result?: any;
};

export type BadgeMessage = TextMessage | ToolMessage;
