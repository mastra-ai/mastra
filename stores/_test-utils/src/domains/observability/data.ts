import { randomUUID } from 'crypto';
import { AISpanType } from '@mastra/core/ai-tracing';
import type { AISpanRecord } from '@mastra/core/storage';

export const createSampleAiSpan = (
  name: string,
  spanType: AISpanType = AISpanType.AGENT_RUN,
  scope?: Record<string, any>,
  attributes?: Record<string, any>,
  metadata?: Record<string, any>,
  createdAt?: Date,
  startTime?: number,
): Omit<AISpanRecord, 'id'> => ({
  traceId: `trace-${randomUUID()}`,
  spanId: `span-${randomUUID()}`,
  parentSpanId: null,
  name,
  scope: scope || null,
  spanType,
  attributes: attributes || null,
  metadata: metadata || null,
  events: null,
  links: null,
  other: null,
  startTime: startTime || new Date().getTime(),
  endTime: 0,
  createdAt: createdAt || new Date(),
  input: null,
  output: null,
  error: null,
});

export const createSampleAgentRunSpan = (
  name: string,
  scope?: Record<string, any> | undefined,
  attributes?: Record<string, any>,
  metadata?: Record<string, any>,
  createdAt?: Date,
): Omit<AISpanRecord, 'id'> => createSampleAiSpan(name, AISpanType.AGENT_RUN, scope, attributes, metadata, createdAt);

export const createSampleLLMSpan = (
  name: string,
  scope?: Record<string, any>,
  attributes?: Record<string, any>,
  metadata?: Record<string, any>,
  createdAt?: Date,
): Omit<AISpanRecord, 'id'> =>
  createSampleAiSpan(name, AISpanType.LLM_GENERATION, scope, attributes, metadata, createdAt);

export const createSampleToolSpan = (
  name: string,
  scope?: Record<string, any>,
  attributes?: Record<string, any>,
  metadata?: Record<string, any>,
  createdAt?: Date,
): Omit<AISpanRecord, 'id'> => createSampleAiSpan(name, AISpanType.TOOL_CALL, scope, attributes, metadata, createdAt);

export const createSampleWorkflowSpan = (
  name: string,
  scope?: Record<string, any>,
  attributes?: Record<string, any>,
  metadata?: Record<string, any>,
  createdAt?: Date,
): Omit<AISpanRecord, 'id'> =>
  createSampleAiSpan(name, AISpanType.WORKFLOW_RUN, scope, attributes, metadata, createdAt);

// Utility to create a span hierarchy with proper parent-child relationships
export const createSpanHierarchy = (
  parentName: string,
  childNames: string[] = [],
  options: {
    parentSpanType?: AISpanType;
    childSpanType?: AISpanType;
    scope?: Record<string, any>;
    attributes?: Record<string, any>;
    metadata?: Record<string, any>;
    createdAt?: Date;
    startTime?: number;
    endTime?: number;
  } = {},
): {
  parent: Omit<AISpanRecord, 'id'>;
  children: Array<Omit<AISpanRecord, 'id'>>;
} => {
  const {
    parentSpanType = AISpanType.AGENT_RUN,
    childSpanType = AISpanType.AGENT_RUN,
    scope,
    attributes,
    metadata,
    createdAt,
    startTime,
  } = options;

  // Create parent span
  const parent = createSampleAiSpan(parentName, parentSpanType, scope, attributes, metadata, createdAt, startTime);

  // Create child spans with the same traceId as parent
  const children = childNames.map(childName => {
    const child = createSampleAiSpan(childName, childSpanType, scope, attributes, metadata, createdAt, startTime);

    // Override the traceId to match the parent
    (child as any).traceId = parent.traceId;

    return child;
  });

  return { parent, children };
};

// Utility to create multiple span hierarchies for testing pagination
export const createMultipleSpanHierarchies = (
  count: number,
  options: {
    parentNamePrefix?: string;
    childNames?: string[];
    parentSpanType?: AISpanType;
    childSpanType?: AISpanType;
    scope?: Record<string, any>;
    attributes?: Record<string, any>;
    metadata?: Record<string, any>;
    createdAt?: Date;
    startTime?: number;
    endTime?: number;
  } = {},
): Array<{
  parent: Omit<AISpanRecord, 'id'>;
  children: Array<Omit<AISpanRecord, 'id'>>;
}> => {
  const {
    parentNamePrefix = 'parent',
    childNames = ['child-1', 'child-2'],
    parentSpanType = AISpanType.AGENT_RUN,
    childSpanType = AISpanType.AGENT_RUN,
    scope,
    attributes,
    metadata,
    createdAt,
    startTime,
    endTime,
  } = options;

  return Array.from({ length: count }, (_, i) =>
    createSpanHierarchy(
      `${parentNamePrefix}-${i}`,
      childNames.map(name => `${name}-${i}`),
      {
        parentSpanType,
        childSpanType,
        scope,
        attributes,
        metadata,
        createdAt,
        startTime,
        endTime,
      },
    ),
  );
};
