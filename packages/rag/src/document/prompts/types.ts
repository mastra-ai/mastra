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

export type BasePromptTemplateOptions<TemplatesVar extends readonly string[]> = {
  templateVars?:
    | TemplatesVar
    // loose type for better type inference
    | readonly string[];
  options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>;
};

export type PromptTemplateOptions<TemplatesVar extends readonly string[]> = BasePromptTemplateOptions<TemplatesVar> & {
  template: string;
};
