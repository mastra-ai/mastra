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

type MastraMessageShared = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'signal';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  type?: string;
};

type LegacyToolInvocationPart = Extract<UIMessageV4['parts'][number], { type: 'tool-invocation' }>;
type LegacySourcePart = Extract<UIMessageV4['parts'][number], { type: 'source' }>;
type LegacyToolInvocation = NonNullable<UIMessageV4['toolInvocations']>[number];
export type MastraProviderMetadata = AIV5Type.ProviderMetadata;
type MastraPartExtensions = { providerMetadata?: MastraProviderMetadata; createdAt?: number };
type PartWithProviderMetadata<T> = T & MastraPartExtensions;
export type MastraStepStartPart = {
  type: 'step-start';
  model?: string;
} & MastraPartExtensions;

// Approval payload stored alongside tool invocations so v6 approval flows can
// round-trip through MessageList.
export type MastraToolApproval = {
  id: string;
  approved?: boolean;
  reason?: string;
};

export type MastraToolInvocation = Omit<LegacyToolInvocation, 'state'> & {
  state: LegacyToolInvocation['state'] | 'approval-requested' | 'approval-responded' | 'output-error' | 'output-denied';
  result?: unknown;
  errorText?: string;
  rawInput?: unknown;
  approval?: MastraToolApproval;
};

export type MastraToolInvocationPart = Omit<LegacyToolInvocationPart, 'toolInvocation'> & {
  toolInvocation: MastraToolInvocation;
  providerMetadata?: MastraProviderMetadata;
  providerExecuted?: boolean;
  title?: string;
  preliminary?: boolean;
  createdAt?: number;
};

export type MastraSourceDocumentPart = {
  type: 'source-document';
  sourceId: string;
  mediaType: string;
  title: string;
  filename?: string;
  providerMetadata?: MastraProviderMetadata;
  createdAt?: number;
};

export type MastraSourceUrlPart = Omit<LegacySourcePart, 'providerMetadata'> & {
  providerMetadata?: MastraProviderMetadata;
  createdAt?: number;
};

// Named intermediate types to avoid TS2589 (type instantiation excessively deep)
// when MastraMessagePart is used in contexts with deep type inference (e.g. @hono/zod-openapi).
type MastraStandardUIV4Part = Exclude<UIMessageV4['parts'][number], { type: 'tool-invocation' | 'source' | 'step-start' }>;
type MastraStandardUIV4PartWithMetadata = PartWithProviderMetadata<MastraStandardUIV4Part>;
type MastraDataUIPart = PartWithProviderMetadata<AIV5Type.DataUIPart<AIV5.UIDataTypes>>;

// Canonical stored part type. It starts from the v4 UI part model and extends
// it with provider metadata, AI SDK v5 data parts, and v6-only persisted parts
// such as approval-aware tool invocations and source documents.
export type MastraMessagePart =
  | MastraStandardUIV4PartWithMetadata
  | MastraStepStartPart
  | MastraToolInvocationPart
  | MastraSourceUrlPart
  | MastraSourceDocumentPart
  | MastraDataUIPart;

// V4-compatible part type (excludes DataUIPart which V4 doesn't support)
export type UIMessageV4Part = UIMessageV4['parts'][number] & MastraPartExtensions;

export type MastraMessageContentV2 = {
  format: 2; // format 2 === UIMessage in AI SDK v4
  parts: MastraMessagePart[];
  experimental_attachments?: UIMessageV4['experimental_attachments'];
  content?: UIMessageV4['content'];
  toolInvocations?: UIMessageV4['toolInvocations'];
  reasoning?: UIMessageV4['reasoning'];
  annotations?: UIMessageV4['annotations'];
  metadata?: Record<string, unknown>;
  providerMetadata?: MastraProviderMetadata;
};

// maps to AI SDK V4 UIMessage
export type MastraDBMessage = MastraMessageShared & {
  content: MastraMessageContentV2;
};

// maps to AI SDK V5 UIMessage
export type MastraMessageV1 = {
  id: string;
  content: string | CoreMessageV4['content'];
  role: 'system' | 'user' | 'assistant' | 'tool' | 'signal';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

// Extend UIMessage to include optional metadata field
export type UIMessageWithMetadata = UIMessageV4 & {
  metadata?: Record<string, unknown>;
};
