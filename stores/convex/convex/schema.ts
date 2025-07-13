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
    content: v.any(),
    createdAt: v.number(),
  })
    .index('by_messageId', ['messageId'])
    .index('by_threadId', ['threadId']),

  // Traces table
  traces: defineTable({
    id: v.string(),
    parentSpanId: v.string(),
    name: v.string(),
    traceId: v.string(),
    scope: v.string(),
    attributes: v.any(),
    status: v.any(),
    kind: v.number(),
    events: v.array(v.any()),
    links: v.array(v.any()),
    other: v.any(),
    startTime: v.number(),
    endTime: v.number(),
    createdAt: v.number(),
  })
    .index('by_traceId', ['traceId'])
    .index('by_parentSpanId', ['parentSpanId']),

  // Evals table
  evals: defineTable({
    input: v.string(),
    output: v.string(),
    result: v.any(),
    agentName: v.string(),
    createdAt: v.number(),
    metricName: v.string(),
    instructions: v.string(),
    runId: v.string(),
    globalRunId: v.string(),
    testInfo: v.optional(v.any()),
  })
    .index('by_runId', ['runId'])
    .index('by_globalRunId', ['globalRunId'])
    .index('by_agentName', ['agentName']),

  // WorkflowRuns table
  workflowRuns: defineTable({
    runId: v.string(),
    workflowName: v.string(),
    resourceId: v.optional(v.string()),
    snapshot: v.any(), // Holds WorkflowRunState or string
    status: v.union(
      v.literal('running'),
      v.literal('success'),
      v.literal('failed'),
      v.literal('suspended'),
      v.literal('waiting'),
      v.literal('pending'),
    ),
    createdAt: v.number(), // Store as number but convert to/from Date in code
    updatedAt: v.number(), // Store as number but convert to/from Date in code
  })
    .index('by_runId', ['runId'])
    .index('by_status', ['status'])
    .index('by_resourceId', ['resourceId'])
    .index('by_workflowName', ['workflowName']),
});
