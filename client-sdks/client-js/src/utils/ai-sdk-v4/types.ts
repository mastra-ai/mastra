// Type shapes vendored from @ai-sdk/ui-utils@1.2.11, @ai-sdk/provider@1.x and @ai-sdk/provider-utils@2.x
// (Apache-2.0, Copyright Vercel, Inc.).

export type JSONValue = null | string | number | boolean | { [value: string]: JSONValue } | Array<JSONValue>;

export type FinishReason = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';

export type Source = {
  sourceType: 'url';
  id: string;
  url: string;
  title?: string;
  providerMetadata?: Record<string, Record<string, JSONValue>>;
};

export interface ToolCall<NAME extends string, ARGS> {
  toolCallId: string;
  toolName: NAME;
  args: ARGS;
}

export interface ToolResult<NAME extends string, ARGS, RESULT> {
  toolCallId: string;
  toolName: NAME;
  args: ARGS;
  result: RESULT;
}

export type ToolInvocation =
  | ({ state: 'partial-call'; step?: number } & ToolCall<string, any>)
  | ({ state: 'call'; step?: number } & ToolCall<string, any>)
  | ({ state: 'result'; step?: number } & ToolResult<string, any, any>);

export interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
}

export type TextUIPart = {
  type: 'text';
  text: string;
};

export type ReasoningUIPart = {
  type: 'reasoning';
  reasoning: string;
  details: Array<{ type: 'text'; text: string; signature?: string } | { type: 'redacted'; data: string }>;
};

export type ToolInvocationUIPart = {
  type: 'tool-invocation';
  toolInvocation: ToolInvocation;
};

export type SourceUIPart = {
  type: 'source';
  source: Source;
};

export type FileUIPart = {
  type: 'file';
  mimeType: string;
  data: string;
};

export type StepStartUIPart = {
  type: 'step-start';
};

export interface Message {
  id: string;
  createdAt?: Date;
  content: string;
  /** @deprecated Use `parts` instead. */
  reasoning?: string;
  experimental_attachments?: Attachment[];
  role: 'system' | 'user' | 'assistant' | 'data';
  /** @deprecated Data messages will be removed. */
  data?: JSONValue;
  annotations?: JSONValue[] | undefined;
  /** @deprecated Use `parts` instead. */
  toolInvocations?: Array<ToolInvocation>;
  parts?: Array<TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart>;
}

export type UIMessage = Message & {
  parts: Array<TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart>;
};

export type UseChatOptions = {
  onToolCall?: ({ toolCall }: { toolCall: ToolCall<string, unknown> }) => void | Promise<unknown> | unknown;
};
