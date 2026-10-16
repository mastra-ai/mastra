/**
 * Shapes of messages Mastra has stored in the past.
 *
 * Format-2 `MastraDBMessage` parts and format-1 `MastraMessageV1` rows were modelled on the
 * AI SDK v4 message types. Mastra no longer depends on AI SDK v4, but stored rows still have
 * these shapes, so they are described here.
 */

export type JSONValue = null | string | number | boolean | { [value: string]: JSONValue } | Array<JSONValue>;

export type ProviderMetadata = Record<string, Record<string, JSONValue>>;

export type DataContent = string | Uint8Array | ArrayBuffer | Buffer;

// --- Format-1 (MastraMessageV1) content parts ---

export interface TextPart {
  type: 'text';
  text: string;
  providerOptions?: ProviderMetadata;
  experimental_providerMetadata?: ProviderMetadata;
}

export interface ImagePart {
  type: 'image';
  image: DataContent | URL;
  mimeType?: string;
  providerOptions?: ProviderMetadata;
  experimental_providerMetadata?: ProviderMetadata;
}

export interface FilePart {
  type: 'file';
  data: DataContent | URL;
  filename?: string;
  mimeType: string;
  providerOptions?: ProviderMetadata;
  experimental_providerMetadata?: ProviderMetadata;
}

export interface ReasoningPart {
  type: 'reasoning';
  text: string;
  signature?: string;
  providerOptions?: ProviderMetadata;
  experimental_providerMetadata?: ProviderMetadata;
}

export interface RedactedReasoningPart {
  type: 'redacted-reasoning';
  data: string;
  providerOptions?: ProviderMetadata;
  experimental_providerMetadata?: ProviderMetadata;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: unknown;
  providerOptions?: ProviderMetadata;
  experimental_providerMetadata?: ProviderMetadata;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  experimental_content?: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType?: string }>;
  isError?: boolean;
  providerOptions?: ProviderMetadata;
  experimental_providerMetadata?: ProviderMetadata;
}

export type UserContent = string | Array<TextPart | ImagePart | FilePart>;
export type AssistantContent =
  | string
  | Array<TextPart | FilePart | ReasoningPart | RedactedReasoningPart | ToolCallPart>;
export type ToolContent = Array<ToolResultPart>;

type MessageBase = { providerOptions?: ProviderMetadata; experimental_providerMetadata?: ProviderMetadata };

export type LegacySystemMessage = MessageBase & { role: 'system'; content: string };
export type LegacyCoreMessage =
  | LegacySystemMessage
  | (MessageBase & { role: 'user'; content: UserContent })
  | (MessageBase & { role: 'assistant'; content: AssistantContent })
  | (MessageBase & { role: 'tool'; content: ToolContent });

// --- Format-2 (MastraDBMessage) parts ---

export type ToolInvocation =
  | { state: 'partial-call' | 'call'; step?: number; toolCallId: string; toolName: string; args: any }
  | { state: 'result'; step?: number; toolCallId: string; toolName: string; args: any; result: any };

export interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
}

export type Source = {
  sourceType: 'url';
  id: string;
  url: string;
  title?: string;
  providerMetadata?: ProviderMetadata;
};

export type TextUIPart = { type: 'text'; text: string };
export type ReasoningUIPart = {
  type: 'reasoning';
  reasoning: string;
  details: Array<{ type: 'text'; text: string; signature?: string } | { type: 'redacted'; data: string }>;
};
export type ToolInvocationUIPart = { type: 'tool-invocation'; toolInvocation: ToolInvocation };
export type SourceUIPart = { type: 'source'; source: Source };
export type FileUIPart = { type: 'file'; mimeType: string; data: string };
export type StepStartUIPart = { type: 'step-start' };

export type LegacyUIPart =
  | TextUIPart
  | ReasoningUIPart
  | ToolInvocationUIPart
  | SourceUIPart
  | FileUIPart
  | StepStartUIPart;

export interface LegacyUIMessage {
  id: string;
  createdAt?: Date;
  content: string;
  reasoning?: string;
  experimental_attachments?: Attachment[];
  role: 'system' | 'user' | 'assistant' | 'data';
  data?: JSONValue;
  annotations?: JSONValue[] | undefined;
  toolInvocations?: Array<ToolInvocation>;
  parts: Array<LegacyUIPart>;
}
