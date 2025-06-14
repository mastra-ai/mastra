import type {
  FilePart,
  ImagePart,
  ReasoningPart,
  RedactedReasoningPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from './content-part';

type ProviderOptions = any;
type ProviderMetadata = any;
/**
 A system message. It can contain system information.

 Note: using the "system" part of the prompt is strongly preferred
 to increase the resilience against prompt injection attacks,
 and because not all providers support several system messages.
 */
export type CoreSystemMessage = {
  role: 'system';
  content: string;

  /**
Additional provider-specific metadata. They are passed through
to the provider from the AI SDK and enable provider-specific
functionality that can be fully encapsulated in the provider.
 */
  providerOptions?: ProviderOptions;

  /**
@deprecated Use `providerOptions` instead.
 */
  experimental_providerMetadata?: ProviderMetadata;
};

/**
A user message. It can contain text or a combination of text and images.
 */
export type CoreUserMessage = {
  role: 'user';
  content: UserContent;

  /**
Additional provider-specific metadata. They are passed through
to the provider from the AI SDK and enable provider-specific
functionality that can be fully encapsulated in the provider.
 */
  providerOptions?: ProviderOptions;

  /**
@deprecated Use `providerOptions` instead.
*/
  experimental_providerMetadata?: ProviderMetadata;
};

/**
Content of a user message. It can be a string or an array of text and image parts.
 */
export type UserContent = string | Array<TextPart | ImagePart | FilePart>;

/**
An assistant message. It can contain text, tool calls, or a combination of text and tool calls.
 */
export type CoreAssistantMessage = {
  role: 'assistant';
  content: AssistantContent;

  /**
Additional provider-specific metadata. They are passed through
to the provider from the AI SDK and enable provider-specific
functionality that can be fully encapsulated in the provider.
 */
  providerOptions?: ProviderOptions;

  /**
@deprecated Use `providerOptions` instead.
*/
  experimental_providerMetadata?: ProviderMetadata;
};

/**
Content of an assistant message.
It can be a string or an array of text, image, reasoning, redacted reasoning, and tool call parts.
 */
export type AssistantContent =
  | string
  | Array<TextPart | FilePart | ReasoningPart | RedactedReasoningPart | ToolCallPart>;

/**
A tool message. It contains the result of one or more tool calls.
 */
export type CoreToolMessage = {
  role: 'tool';
  content: ToolContent;

  /**
Additional provider-specific metadata. They are passed through
to the provider from the AI SDK and enable provider-specific
functionality that can be fully encapsulated in the provider.
 */
  providerOptions?: ProviderOptions;

  /**
@deprecated Use `providerOptions` instead.
*/
  experimental_providerMetadata?: ProviderMetadata;
};

/**
Content of a tool message. It is an array of tool result parts.
 */
export type ToolContent = Array<ToolResultPart>;

/**
A message that can be used in the `messages` field of a prompt.
It can be a user message, an assistant message, or a tool message.
 */
export type CoreMessage = CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage;
