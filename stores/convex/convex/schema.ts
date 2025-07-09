import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Convex schema definition for Mastra storage
 */
export default defineSchema({
  // Thread table
  threads: defineTable({
    threadId: v.string(),
    resourceId: v.optional(v.string()),
    title: v.optional(v.string()),
    metadata: v.any(), // Flexible metadata storage
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index('by_threadId', ['threadId'])
    .index('by_resourceId', ['resourceId']),

  // Message table
  messages: defineTable({
    messageId: v.string(),
    threadId: v.string(),
    messageType: v.string(), // 'user', 'assistant', 'system'
    content: v.object({
      content: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
    createdAt: v.number(),
  })
    .index('by_messageId', ['messageId'])
    .index('by_threadId', ['threadId']),

  // Traces table
  traces: defineTable({
    traceId: v.string(),
    threadId: v.string(),
    transportId: v.string(),
    runId: v.string(),
    rootRunId: v.string(),
    timestamp: v.number(),
    properties: v.any(),
    spans: v.array(v.any()),
    spanDurations: v.any(),
  })
    .index('by_traceId', ['traceId'])
    .index('by_threadId', ['threadId'])
    .index('by_runId', ['runId']),

  // Evals table
  evals: defineTable({
    evalId: v.string(),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    type: v.optional(v.string()), // 'test' or 'live'
    metadata: v.any(),
    data: v.any(),
    createdAt: v.number(),
  })
    .index('by_evalId', ['evalId'])
    .index('by_threadId', ['threadId'])
    .index('by_agentName', ['agentName']),

  // WorkflowRuns table
  workflowRuns: defineTable({
    runId: v.string(),
    workflowName: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    stateType: v.string(),
    state: v.any(),
    error: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index('by_runId', ['runId'])
    .index('by_stateType', ['stateType'])
    .index('by_resourceId', ['resourceId']),
});
