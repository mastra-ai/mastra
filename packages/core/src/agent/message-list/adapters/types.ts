import type { UIMessage as UIMessageV4, CoreMessage as CoreMessageV4, IdGenerator } from '@internal/ai-sdk-v4';

import type { MastraDBMessage } from '../state/types';
import type { AIV5Type } from '../types';

export type {
  MastraDBMessage,
  MastraMessageV1,
  MessageSource,
  MemoryInfo,
  MastraMessageContentV2,
  UIMessageWithMetadata,
} from '../state/types';

// Re-export for convenience
export type { AIV5Type };
export type { UIMessageV4, CoreMessageV4 };

// Common adapter context passed to all adapters
export interface AdapterContext {
  memoryInfo: { threadId?: string; resourceId?: string } | null;
  generateMessageId?: IdGenerator;
  newMessageId(): string;
  generateCreatedAt(messageSource: string, start?: unknown): Date;
  /** Messages array for looking up tool call args */
  dbMessages?: MastraDBMessage[];
}
