import type * as AIV5 from '@internal/ai-sdk-v5';
import type { AIV5Type } from '../types';
import type { LegacyCoreMessage, LegacyUIMessage, LegacyUIPart } from './legacy-shapes';

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

type LegacyToolInvocationPart = Extract<LegacyUIPart, { type: 'tool-invocation' }>;
type LegacySourcePart = Extract<LegacyUIPart, { type: 'source' }>;
type LegacyToolInvocation = NonNullable<LegacyUIMessage['toolInvocations']>[number];
export type MastraProviderMetadata = AIV5Type.ProviderMetadata;
type MastraPartExtensions = { providerMetadata?: MastraProviderMetadata; createdAt?: number };
type PartWithProviderMetadata<T> = T & MastraPartExtensions;
export type MastraStepStartPart = {
  type: 'step-start';
  model?: string;
} & MastraPartExtensions;

// Persisted record of a terminal agent failure (retries, error processors and
// fallback models all exhausted). Deliberately stores only JSON-safe identity
// fields: stack traces, causes and custom enumerable properties stay on the
// runtime error surfaces (stream chunk, onError, result.error) and are never
// written to thread history.
export type MastraErrorPart = {
  type: 'error';
  error: {
    name: string;
    message: string;
  };
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
  /** Set alongside `state: 'result'` when the tool executor reported a failure. */
  isError?: boolean;
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
  /** Epoch ms of the latest state change (approval response, result, error). */
  updatedAt?: number;
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

// Named alias so TypeScript caches the Exclude expansion and avoids TS2589 when
// MastraMessagePart is used alongside deeply-generic libraries like @hono/zod-openapi.
type UIV4NonMastraPart = Exclude<LegacyUIPart, { type: 'tool-invocation' | 'source' | 'step-start' }>;

// Canonical stored part type. It starts from the v4 UI part model and extends
// it with provider metadata, AI SDK v5 data parts, and v6-only persisted parts
// such as approval-aware tool invocations and source documents.
export type MastraMessagePart =
  | PartWithProviderMetadata<UIV4NonMastraPart>
  | MastraStepStartPart
  | MastraErrorPart
  | MastraToolInvocationPart
  | MastraSourceUrlPart
  | MastraSourceDocumentPart
  | PartWithProviderMetadata<AIV5Type.DataUIPart<AIV5.UIDataTypes>>;

// Stored part type without AI SDK v5 data parts
export type MastraBasePart = LegacyUIPart & MastraPartExtensions;

export type MastraMessageContentV2 = {
  format: 2; // format 2: parts modelled on the AI SDK v4 UI message
  parts: MastraMessagePart[];
  experimental_attachments?: LegacyUIMessage['experimental_attachments'];
  content?: LegacyUIMessage['content'];
  toolInvocations?: LegacyUIMessage['toolInvocations'];
  reasoning?: LegacyUIMessage['reasoning'];
  annotations?: LegacyUIMessage['annotations'];
  metadata?: Record<string, unknown>;
  providerMetadata?: MastraProviderMetadata;
};

export type MastraDBMessage = MastraMessageShared & {
  content: MastraMessageContentV2;
};

export type MastraMessageV1 = {
  id: string;
  content: string | LegacyCoreMessage['content'];
  role: 'system' | 'user' | 'assistant' | 'tool' | 'signal';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};
