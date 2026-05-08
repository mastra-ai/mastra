/**
 * Base fields shared by all entities
 */
export interface BaseEntityData {
  entity: string;
  createdAt: string;
  updatedAt: string;
  metadata?: string;
  ttl?: number;
  expiresAt?: number;
}

export interface ThreadEntityData extends BaseEntityData {
  entity: 'thread';
  id: string;
  resourceId: string;
  title: string;
}

export interface MessageEntityData extends BaseEntityData {
  entity: 'message';
  id: string;
  threadId?: string;
  role: string;
  type?: string;
  content: string;
  resourceId?: string;
  toolCallIds?: string;
  toolCallArgs?: string;
  toolNames?: string;
}

export interface ResourceEntityData extends BaseEntityData {
  entity: 'resource';
  id: string;
  workingMemory?: string;
}

export interface WorkflowSnapshotEntityData extends BaseEntityData {
  entity: 'workflow_snapshot';
  workflow_name: string;
  run_id: string;
  snapshot: string;
  resourceId?: string;
}

export interface ScoreEntityData extends BaseEntityData {
  entity: 'score';
  id: string;
  scorerId: string;
  runId: string;
  scorer: string;
  score: number;
  input: string;
  output: string;
  source: string;
  traceId?: string;
  spanId?: string;
  reason?: string;
  extractPrompt?: string;
  analyzePrompt?: string;
  reasonPrompt?: string;
  generateScorePrompt?: string;
  generateReasonPrompt?: string;
  preprocessPrompt?: string;
  extractStepResult?: string;
  preprocessStepResult?: string;
  analyzeStepResult?: string;
  additionalContext?: string;
  requestContext?: string;
  entityType?: string;
  entityData?: string;
  entityId?: string;
  resourceId?: string;
  threadId?: string;
}

export const baseAttributes = {
  createdAt: {
    type: 'string',
    required: true,
    readOnly: true,
    // Convert Date to ISO string on set
    set: (value?: Date | string) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value || new Date().toISOString();
    },
    // Initialize with current timestamp if not provided
    default: () => new Date().toISOString(),
  },
  updatedAt: {
    type: 'string',
    required: true,
    // Convert Date to ISO string on set
    set: (value?: Date | string) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value || new Date().toISOString();
    },
    // Always use current timestamp when creating/updating
    default: () => new Date().toISOString(),
  },
  metadata: {
    type: 'string', // JSON stringified
    // Stringify objects on set
    set: (value?: Record<string, unknown> | string) => {
      if (value && typeof value !== 'string') {
        return JSON.stringify(value);
      }
      return value;
    },
    // Parse JSON string to object on get
    get: (value?: string) => {
      if (value) {
        try {
          return JSON.parse(value);
        } catch {
          // If parsing fails, return the original string
          return value;
        }
      }
      return value;
    },
  },
  /**
   * TTL attribute for DynamoDB automatic item expiration.
   * This is a Unix timestamp (epoch seconds) that indicates when the item should be deleted.
   *
   * Note: For TTL to work, you must enable TTL on your DynamoDB table
   * specifying this attribute name (default: 'ttl').
   */
  ttl: {
    type: 'number',
    required: false,
  },
  /**
   * Alternative TTL attribute with configurable name.
   * Use this if you've configured TTL on your DynamoDB table with 'expiresAt' as the attribute name.
   */
  expiresAt: {
    type: 'number',
    required: false,
  },
} as const;
