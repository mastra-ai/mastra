export type MessageType = 'user' | 'assistant' | 'system' | 'memory' | 'developer';

export type ChatMessage<AdditionalMessageOptions extends object = object> = {
  content: MessageContent;
  role: MessageType;
  options?: undefined | AdditionalMessageOptions;
};

export type MessageContentTextDetail = {
  type: 'text';
  text: string;
};

/**
 * Extended type for the content of a message that allows for multi-modal messages.
 */
export type MessageContent = string | MessageContentTextDetail[];

export type ObjectEntries<T extends Record<string, any>> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];
