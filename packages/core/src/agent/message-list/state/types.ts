import type { UIMessage as UIMessageV4, CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type * as AIV5 from '@internal/ai-sdk-v5';
import type { AIV5Type } from '../types';

export type MessageSource =
  | 'memory'
  | 'response'
  | 'input'
  | 'system'
  | 'context'
  /* @deprecated use input instead. "user" was a confusing source type because the user can send messages that don't have role: "user" */
  | 'user';

export type MemoryInfo = { threadId: string; resourceId?: string };

/** Identity, role and memory ownership shared by stored messages. */
type MastraMessageShared = {
  /** Unique message identifier. */
  id: string;
  /** Role of the message in the conversation, including internal agent signals. */
  role: 'user' | 'assistant' | 'system' | 'signal';
  /** Creation time of the message. */
  createdAt: Date;
  /** Thread containing the message, when associated with memory. */
  threadId?: string;
  /** Resource associated with the message, when provided. */
  resourceId?: string;
  /** Optional message category retained alongside its content. */
  type?: string;
};

/** AI SDK v4 tool-invocation part used as the base of the stored tool part. */
type LegacyToolInvocationPart = Extract<
  UIMessageV4['parts'][number],
  {
    /** Selects tool-invocation parts from the legacy UI message union. */
    type: 'tool-invocation';
  }
>;
/** AI SDK v4 source part used as the base of the stored URL source part. */
type LegacySourcePart = Extract<
  UIMessageV4['parts'][number],
  {
    /** Selects source parts from the legacy UI message union. */
    type: 'source';
  }
>;
/** AI SDK v4 tool invocation extended with persisted approval and error states. */
type LegacyToolInvocation = NonNullable<UIMessageV4['toolInvocations']>[number];
/** Provider-namespaced metadata preserved on messages and their parts. */
export type MastraProviderMetadata = AIV5Type.ProviderMetadata;
/** Provider metadata and timing fields shared by stored message parts. */
type MastraPartExtensions = {
  /** Provider-namespaced metadata associated with this part. */
  providerMetadata?: MastraProviderMetadata;
  /** Part timestamp in milliseconds since the Unix epoch. */
  createdAt?: number;
};
/** A message part extended with provider metadata and a part timestamp. */
type PartWithProviderMetadata<T> = T & MastraPartExtensions;
/** Marker for the beginning of a model step in stored message content. */
export type MastraStepStartPart = {
  /** Identifies a step-start marker. */
  type: 'step-start';
  /** Model identifier recorded for this step, when available. */
  model?: string;
} & MastraPartExtensions;

/** Approval request and optional decision persisted alongside a tool invocation. */
export type MastraToolApproval = {
  /** Identifier of the approval request. */
  id: string;
  /** Approval decision, absent while no decision has been recorded. */
  approved?: boolean;
  /** Optional explanation accompanying the approval decision. */
  reason?: string;
};

/** Stored tool invocation with approval, denial and output-error states. */
export type MastraToolInvocation = Omit<LegacyToolInvocation, 'state'> & {
  /** Current invocation state, including argument streaming, results and approval handling. */
  state: LegacyToolInvocation['state'] | 'approval-requested' | 'approval-responded' | 'output-error' | 'output-denied';
  /** Tool result retained when available. */
  result?: unknown;
  /** Set alongside `state: 'result'` when the tool executor reported a failure. */
  isError?: boolean;
  /** Error text retained for an output-error invocation. */
  errorText?: string;
  /** Unparsed tool input retained with an input or execution error, when provided. */
  rawInput?: unknown;
  /** Approval request and decision associated with this invocation. */
  approval?: MastraToolApproval;
};

/** Stored tool part combining invocation state with provider and display metadata. */
export type MastraToolInvocationPart = Omit<LegacyToolInvocationPart, 'toolInvocation'> & {
  /** Tool arguments, execution state, result and approval information. */
  toolInvocation: MastraToolInvocation;
  /** Provider-namespaced metadata retained for the tool call and result. */
  providerMetadata?: MastraProviderMetadata;
  /** Whether the model provider executed the tool rather than Mastra. */
  providerExecuted?: boolean;
  /** Optional display title supplied for the tool part. */
  title?: string;
  /** Whether the imported tool output is marked preliminary rather than final. */
  preliminary?: boolean;
  /** Part timestamp in milliseconds since the Unix epoch. */
  createdAt?: number;
};

/** Document cited as a source in a message. */
export type MastraSourceDocumentPart = {
  /** Identifies a document source rather than a URL source. */
  type: 'source-document';
  /** Identifier assigned to the source. */
  sourceId: string;
  /** Media type of the cited document. */
  mediaType: string;
  /** Display title of the cited document. */
  title: string;
  /** Filename associated with the document, when provided. */
  filename?: string;
  /** Provider-namespaced metadata associated with the source. */
  providerMetadata?: MastraProviderMetadata;
  /** Part timestamp in milliseconds since the Unix epoch. */
  createdAt?: number;
};

/** URL source part with provider metadata and a stored part timestamp. */
export type MastraSourceUrlPart = Omit<LegacySourcePart, 'providerMetadata'> & {
  /** Provider-namespaced metadata associated with the source. */
  providerMetadata?: MastraProviderMetadata;
  /** Part timestamp in milliseconds since the Unix epoch. */
  createdAt?: number;
};

// Named alias so TypeScript caches the Exclude expansion and avoids TS2589 when
// MastraMessagePart is used alongside deeply-generic libraries like @hono/zod-openapi.
/** AI SDK v4 parts other than the tool, source and step-start parts specialized by Mastra. */
type UIV4NonMastraPart = Exclude<
  UIMessageV4['parts'][number],
  {
    /** Part categories replaced by Mastra's specialized stored representations. */
    type: 'tool-invocation' | 'source' | 'step-start';
  }
>;

/**
 * Canonical stored message part. Extends the AI SDK v4 UI part model with
 * provider metadata, data parts and persisted approval-aware tool and document parts.
 */
export type MastraMessagePart =
  | PartWithProviderMetadata<UIV4NonMastraPart>
  | MastraStepStartPart
  | MastraToolInvocationPart
  | MastraSourceUrlPart
  | MastraSourceDocumentPart
  | PartWithProviderMetadata<AIV5Type.DataUIPart<AIV5.UIDataTypes>>;

// V4-compatible part type (excludes DataUIPart which V4 doesn't support)
export type UIMessageV4Part = UIMessageV4['parts'][number] & MastraPartExtensions;

/** Version 2 stored message content with ordered parts and optional compatibility fields. */
export type MastraMessageContentV2 = {
  /** Identifies the version 2 stored content format, based on AI SDK v4 UI messages. */
  format: 2;
  /** Ordered text, tool, source, data and other content parts. */
  parts: MastraMessagePart[];
  /** Attachments retained in the AI SDK v4 compatibility representation. */
  experimental_attachments?: UIMessageV4['experimental_attachments'];
  /** Text content retained for compatibility with AI SDK v4 UI messages. */
  content?: UIMessageV4['content'];
  /** Tool invocations retained in the legacy top-level representation. */
  toolInvocations?: UIMessageV4['toolInvocations'];
  /** Reasoning text retained in the legacy top-level representation. */
  reasoning?: UIMessageV4['reasoning'];
  /** Annotations attached to the message. */
  annotations?: UIMessageV4['annotations'];
  /** Application-defined metadata associated with the message. */
  metadata?: Record<string, unknown>;
  /** Provider-namespaced metadata associated with the message. */
  providerMetadata?: MastraProviderMetadata;
};

/** Stored message combining message identity and memory ownership with version 2 content. */
export type MastraDBMessage = MastraMessageShared & {
  /** Structured message content in the version 2 storage format. */
  content: MastraMessageContentV2;
};

/** Legacy Mastra message representation with text or AI SDK core-message content. */
export type MastraMessageV1 = {
  /** Unique message identifier. */
  id: string;
  /** Text or core-message content in the legacy representation. */
  content: string | CoreMessageV4['content'];
  /** Conversation role, including separate tool messages and internal agent signals. */
  role: 'system' | 'user' | 'assistant' | 'tool' | 'signal';
  /** Creation time of the message. */
  createdAt: Date;
  /** Thread containing the message, when associated with memory. */
  threadId?: string;
  /** Resource associated with the message, when provided. */
  resourceId?: string;
  /** Optional tool-call identifiers associated with the legacy message. */
  toolCallIds?: string[];
  /** Optional tool argument records associated with the legacy message. */
  toolCallArgs?: Record<string, unknown>[];
  /** Optional tool names associated with the legacy message. */
  toolNames?: string[];
  /** Whether the legacy message represents text, tool calls or tool results. */
  type: 'text' | 'tool-call' | 'tool-result';
};

/** AI SDK v4 UI message extended with application-defined metadata. */
export type UIMessageWithMetadata = UIMessageV4 & {
  /** Application-defined metadata associated with the UI message. */
  metadata?: Record<string, unknown>;
};
