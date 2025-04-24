export type MessageType = 'user' | 'assistant' | 'system' | 'memory' | 'developer';

export type MessageContentTextDetail = {
  type: 'text';
  text: string;
};

/**
 * Extended type for the content of a message that allows for multi-modal messages.
 */
export type MessageContent = string | MessageContentTextDetail[];

export type ChatMessage<AdditionalMessageOptions extends object = object> = {
  content: MessageContent;
  role: MessageType;
  options?: undefined | AdditionalMessageOptions;
};
