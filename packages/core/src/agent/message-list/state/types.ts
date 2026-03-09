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
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  type?: string;
};

// Extended part type that includes both AI SDK parts and Mastra custom parts
// add optional prov meta for AIV5 - v4 doesn't track this, and we're storing mmv2 in the db, so we need to extend
export type MastraMessagePart =
  | (UIMessageV4['parts'][number] & { providerMetadata?: AIV5Type.ProviderMetadata })
  | AIV5Type.DataUIPart<AIV5.UIDataTypes>;

// V4-compatible part type (excludes DataUIPart which V4 doesn't support)
export type UIMessageV4Part = UIMessageV4['parts'][number] & { providerMetadata?: AIV5Type.ProviderMetadata };

export type MastraMessageContentV2 = {
  format: 2; // format 2 === UIMessage in AI SDK v4
  parts: MastraMessagePart[];
  experimental_attachments?: UIMessageV4['experimental_attachments'];
  content?: UIMessageV4['content'];
  toolInvocations?: UIMessageV4['toolInvocations'];
  reasoning?: UIMessageV4['reasoning'];
  annotations?: UIMessageV4['annotations'];
  metadata?: Record<string, unknown>;
  providerMetadata?: AIV5Type.ProviderMetadata;
};

// maps to AI SDK V4 UIMessage
export type MastraDBMessage = MastraMessageShared & {
  content: MastraMessageContentV2;
};

// maps to AI SDK V5 UIMessage
export type MastraMessageV1 = {
  id: string;
  content: string | CoreMessageV4['content'];
  role: 'system' | 'user' | 'assistant' | 'tool';
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
