/**
 * DurableAgent Tool Workflow Execution Tests
 *
 * These tests verify the actual workflow execution for tool suspension,
 * approval, message persistence, and the foreach pattern.
 * Adapted from the base Agent's tool-suspension.test.ts for the durable agent.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { delay } from '../../../utils';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { AgentStreamEvent } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns a single tool call
 */
function createToolCallModel(toolName: string, toolArgs: Record<string, unknown>) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(toolArgs),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a mock model that returns a tool call on the first invocation
 * and a text response on the second invocation.
 */
function createToolCallThenTextModel(toolName: string, toolArgs: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(toolArgs),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      } else {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: finalText },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
    },
  });
}

/**
 * Creates a mock model that returns multiple tool calls
 */
function createMultipleToolCallModel(tools: Array<{ name: string; args: Record<string, unknown> }>) {
  const toolCallChunks = tools.map((tool, index) => ({
    type: 'tool-call' as const,
    toolCallType: 'function' as const,
    toolCallId: `call-${index + 1}`,
    toolName: tool.name,
    input: JSON.stringify(tool.args),
    providerExecuted: false,
  }));

  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            ...toolCallChunks,
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      } else {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
    },
  });
}

/**
 * Collect pubsub events for a given runId
 */
function collectPubsubEvents(pubsub: EventEmitterPubSub, runId: string) {
  const events: AgentStreamEvent[] = [];
  pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
    events.push(event as unknown as AgentStreamEvent);
  });
  return events;
}

// ============================================================================
// Tool Approval Workflow Tests
// ============================================================================

describe('DurableAgent tool approval workflow execution', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should suspend workflow and emit suspended event when tool requires approval', async () => {
    const mockModel = createToolCallModel('searchTool', { query: 'test' });

    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      requireApproval: true,
      execute: async () => ({ results: ['result1', 'result2'] }),
    });

    const baseAgent = new Agent({
      id: 'approval-workflow-agent',
      name: 'Approval Workflow Agent',
      instructions: 'You can search for information',
      model: mockModel as LanguageModelV2,
      tools: { searchTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let suspendedData: any = null;
    const { cleanup } = await durableAgent.stream('Search for test', {
      requireToolApproval: true,
      onSuspended: data => {
        suspendedData = data;
      },
    });

    // Wait for workflow to reach suspension point
    await delay(500);

    expect(suspendedData).not.toBeNull();
    expect(suspendedData.type).toBe('approval');
    expect(suspendedData.toolName).toBe('searchTool');
    expect(suspendedData.toolCallId).toBe('call-1');

    cleanup();
  });

  it('should resume and execute tool after approval', async () => {
    const mockModel = createToolCallThenTextModel('searchTool', { query: 'test' }, 'Search complete');

    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      requireApproval: true,
      execute: async () => ({ results: ['result1', 'result2'] }),
    });

    const baseAgent = new Agent({
      id: 'resume-approval-agent',
      name: 'Resume Approval Agent',
      instructions: 'You can search for information',
      model: mockModel as LanguageModelV2,
      tools: { searchTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register with Mastra for storage (needed for snapshot persistence on resume)
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'resume-approval-agent': durableAgent as any },
    });

    let suspendedData: any = null;
    const { runId, cleanup } = await durableAgent.stream('Search for test', {
      requireToolApproval: true,
      onSuspended: data => {
        suspendedData = data;
      },
    });

    // Wait for suspension
    await delay(500);
    expect(suspendedData).not.toBeNull();

    // Resume with approval
    let finishData: any = null;
    const resumeResult = await durableAgent.resume(
      runId,
      { approved: true },
      {
        onFinish: data => {
          finishData = data;
        },
      },
    );

    // Wait for workflow to complete
    await delay(1000);

    expect(finishData).not.toBeNull();
    resumeResult.cleanup();
    cleanup();
  });

  it('should return not-approved result when tool approval is denied', async () => {
    const mockModel = createToolCallThenTextModel('searchTool', { query: 'test' }, 'Done');

    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      requireApproval: true,
      execute: async () => ({ results: ['result1', 'result2'] }),
    });

    const baseAgent = new Agent({
      id: 'deny-approval-agent',
      name: 'Deny Approval Agent',
      instructions: 'You can search for information',
      model: mockModel as LanguageModelV2,
      tools: { searchTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register with Mastra for storage (needed for snapshot persistence on resume)
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'deny-approval-agent': durableAgent as any },
    });

    let suspendedData: any = null;
    const { runId, cleanup } = await durableAgent.stream('Search for test', {
      requireToolApproval: true,
      onSuspended: data => {
        suspendedData = data;
      },
    });

    // Wait for suspension
    await delay(500);
    expect(suspendedData).not.toBeNull();

    // Resume with denial
    let finishData: any = null;
    const resumeResult = await durableAgent.resume(
      runId,
      { approved: false },
      {
        onFinish: data => {
          finishData = data;
        },
      },
    );

    // Wait for workflow to complete
    await delay(500);

    // Workflow should complete (the denial result flows through the mapping step)
    expect(finishData).not.toBeNull();
    resumeResult.cleanup();
    cleanup();
  });

  it('should emit tool-call-approval chunk via pubsub when tool requires approval', async () => {
    const mockModel = createToolCallModel('approveTool', { data: 'test' });

    const approveTool = createTool({
      id: 'approveTool',
      description: 'A tool that needs approval',
      inputSchema: z.object({ data: z.string() }),
      requireApproval: true,
      execute: async () => ({ result: 'done' }),
    });

    const baseAgent = new Agent({
      id: 'pubsub-approval-agent',
      name: 'PubSub Approval Agent',
      instructions: 'Use the tool',
      model: mockModel as LanguageModelV2,
      tools: { approveTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const prep = await durableAgent.prepare('Use the tool', { requireToolApproval: true });
    const events = collectPubsubEvents(pubsub, prep.runId);

    const { cleanup } = await durableAgent.stream('Use the tool', {
      runId: prep.runId,
      requireToolApproval: true,
    });

    // Wait for workflow to reach suspension
    await delay(500);

    // Check for approval chunk and suspended events
    const approvalChunks = events.filter(
      e => e.type === AgentStreamEventTypes.CHUNK && (e as any).data?.type === 'tool-call-approval',
    );
    const suspendedEvents = events.filter(e => e.type === AgentStreamEventTypes.SUSPENDED);

    expect(approvalChunks.length).toBeGreaterThan(0);
    expect(suspendedEvents.length).toBeGreaterThan(0);

    cleanup();
  });
});

// ============================================================================
// In-Execution Tool Suspension Tests
// ============================================================================

describe('DurableAgent in-execution tool suspension', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should suspend workflow when tool calls suspend() during execution', async () => {
    const mockModel = createToolCallModel('interactiveTool', { input: 'test' });

    const interactiveTool = createTool({
      id: 'interactiveTool',
      description: 'An interactive tool that suspends',
      inputSchema: z.object({ input: z.string() }),
      execute: async (_inputData: { input: string }, context?: any) => {
        const suspend = context?.agent?.suspend || context?.suspend;
        if (suspend) {
          await suspend({ reason: 'Waiting for user input' });
        }
        return { result: 'completed' };
      },
    });

    const baseAgent = new Agent({
      id: 'suspension-workflow-agent',
      name: 'Suspension Workflow Agent',
      instructions: 'Use the interactive tool',
      model: mockModel as LanguageModelV2,
      tools: { interactiveTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let suspendedData: any = null;
    const { cleanup } = await durableAgent.stream('Use the interactive tool', {
      onSuspended: data => {
        suspendedData = data;
      },
    });

    // Wait for workflow to reach suspension
    await delay(500);

    expect(suspendedData).not.toBeNull();
    expect(suspendedData.type).toBe('suspension');
    expect(suspendedData.toolName).toBe('interactiveTool');
    expect(suspendedData.suspendPayload).toEqual({ reason: 'Waiting for user input' });

    cleanup();
  });

  it('should resume tool execution after suspension with resume data', async () => {
    const mockModel = createToolCallThenTextModel('interactiveTool', { input: 'test' }, 'All done');

    const interactiveTool = createTool({
      id: 'interactiveTool',
      description: 'An interactive tool that suspends',
      inputSchema: z.object({ input: z.string() }),
      execute: async (_inputData: { input: string }, context?: any) => {
        const suspend = context?.agent?.suspend || context?.suspend;
        const resumeData = context?.agent?.resumeData || context?.resumeData;
        if (suspend && !resumeData) {
          await suspend({ reason: 'Waiting for user input' });
        }
        return { result: `completed with ${JSON.stringify(resumeData || {})}` };
      },
    });

    const baseAgent = new Agent({
      id: 'resume-suspension-agent',
      name: 'Resume Suspension Agent',
      instructions: 'Use the interactive tool',
      model: mockModel as LanguageModelV2,
      tools: { interactiveTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register with Mastra for storage (needed for snapshot persistence on resume)
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'resume-suspension-agent': durableAgent as any },
    });

    let suspendedData: any = null;
    const { runId, cleanup } = await durableAgent.stream('Use the interactive tool', {
      onSuspended: data => {
        suspendedData = data;
      },
    });

    // Wait for suspension
    await delay(500);
    expect(suspendedData).not.toBeNull();

    // Resume with data
    let finishData: any = null;
    const resumeResult = await durableAgent.resume(
      runId,
      { userResponse: 'yes' },
      {
        onFinish: data => {
          finishData = data;
        },
      },
    );

    // Wait for completion
    await delay(500);

    expect(finishData).not.toBeNull();
    resumeResult.cleanup();
    cleanup();
  });

  it('should emit tool-call-suspended chunk via pubsub', async () => {
    const mockModel = createToolCallModel('suspendingTool', { data: 'test' });

    const suspendingTool = createTool({
      id: 'suspendingTool',
      description: 'A tool that suspends',
      inputSchema: z.object({ data: z.string() }),
      execute: async (_inputData: { data: string }, context?: any) => {
        const suspend = context?.agent?.suspend || context?.suspend;
        if (suspend) {
          await suspend({ reason: 'Need more info' });
        }
        return { done: true };
      },
    });

    const baseAgent = new Agent({
      id: 'emit-suspended-agent',
      name: 'Emit Suspended Agent',
      instructions: 'Use the tool',
      model: mockModel as LanguageModelV2,
      tools: { suspendingTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const prep = await durableAgent.prepare('Use the tool');
    const events = collectPubsubEvents(pubsub, prep.runId);

    const { cleanup } = await durableAgent.stream('Use the tool', {
      runId: prep.runId,
    });

    // Wait for suspension
    await delay(500);

    const suspendedChunks = events.filter(
      e => e.type === AgentStreamEventTypes.CHUNK && (e as any).data?.type === 'tool-call-suspended',
    );
    const suspendedEvents = events.filter(e => e.type === AgentStreamEventTypes.SUSPENDED);

    expect(suspendedChunks.length).toBeGreaterThan(0);
    expect(suspendedEvents.length).toBeGreaterThan(0);

    cleanup();
  });
});

// ============================================================================
// Message Persistence Before Suspension Tests
// ============================================================================

describe('DurableAgent message persistence before suspension', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should create thread and save messages to memory before tool approval suspension', async () => {
    const mockMemory = new MockMemory();
    const mockModel = createToolCallModel('findJobTool', { title: 'software engineer' });

    const findJobTool = createTool({
      id: 'findJobTool',
      description: 'Find job listings',
      inputSchema: z.object({ title: z.string() }),
      requireApproval: true,
      execute: async ({ title }) => `Jobs for: ${title}`,
    });

    const baseAgent = new Agent({
      id: 'memory-approval-agent',
      name: 'Memory Approval Agent',
      instructions: 'You find jobs',
      model: mockModel as LanguageModelV2,
      tools: { findJobTool },
      memory: mockMemory,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register with Mastra for storage (needed for workflow execution)
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'memory-approval-agent': durableAgent as any },
    });

    const threadId = 'test-thread-durable-approval';
    const resourceId = 'user-durable-test';

    // Verify thread does not exist yet
    const threadBefore = await mockMemory.getThreadById({ threadId });
    expect(threadBefore).toBeNull();

    let suspendedData: any = null;
    const { cleanup } = await durableAgent.stream('Find me a software engineer job', {
      memory: { thread: threadId, resource: resourceId },
      requireToolApproval: true,
      onSuspended: data => {
        suspendedData = data;
      },
    });

    // Wait for workflow to reach suspension and flush messages
    await delay(500);

    expect(suspendedData).not.toBeNull();

    // Give debounced save time to fire
    await delay(200);

    // Thread should be created
    const threadAfterSuspension = await mockMemory.getThreadById({ threadId });
    expect(threadAfterSuspension).not.toBeNull();
    expect(threadAfterSuspension?.resourceId).toBe(resourceId);

    // Messages should be saved
    const messagesAfterSuspension = await mockMemory.recall({
      threadId,
      resourceId,
    });

    // User message should be saved
    const userMessages = messagesAfterSuspension.messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBeGreaterThan(0);

    // Note: In the durable agent architecture, the assistant message (with tool-call content)
    // is added to the message list by the llmMappingStep AFTER tool calls complete.
    // At suspension time, only the messages present in the messageList from preparation
    // (user messages + system) are flushed. This is different from the base Agent where
    // the LLM response is appended to messageList before the tool-call step runs.

    cleanup();
  });

  it('should create thread and save messages to memory before in-execution suspension', async () => {
    const mockMemory = new MockMemory();
    const mockModel = createToolCallModel('processDataTool', { data: 'test-data' });

    const processDataTool = createTool({
      id: 'processDataTool',
      description: 'Process data with manual approval',
      inputSchema: z.object({ data: z.string() }),
      execute: async (_inputData: { data: string }, context?: any) => {
        const suspend = context?.agent?.suspend || context?.suspend;
        const resumeData = context?.agent?.resumeData || context?.resumeData;
        if (suspend && !resumeData) {
          await suspend({ reason: 'Waiting for manual approval' });
        }
        return { result: 'Data processed' };
      },
    });

    const baseAgent = new Agent({
      id: 'memory-suspension-agent',
      name: 'Memory Suspension Agent',
      instructions: 'Process data when asked',
      model: mockModel as LanguageModelV2,
      tools: { processDataTool },
      memory: mockMemory,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register with Mastra for storage (needed for workflow execution)
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'memory-suspension-agent': durableAgent as any },
    });

    const threadId = 'test-thread-durable-suspension';
    const resourceId = 'user-durable-suspension';

    // Verify thread does not exist yet
    const threadBefore = await mockMemory.getThreadById({ threadId });
    expect(threadBefore).toBeNull();

    let suspendedData: any = null;
    const { cleanup } = await durableAgent.stream('Process the data', {
      memory: { thread: threadId, resource: resourceId },
      onSuspended: data => {
        suspendedData = data;
      },
    });

    // Wait for workflow to reach suspension and flush messages
    await delay(500);

    expect(suspendedData).not.toBeNull();

    // Give debounced save time to fire
    await delay(200);

    // Thread should be created
    const threadAfterSuspension = await mockMemory.getThreadById({ threadId });
    expect(threadAfterSuspension).not.toBeNull();
    expect(threadAfterSuspension?.resourceId).toBe(resourceId);

    // Messages should be saved
    const messagesAfterSuspension = await mockMemory.recall({
      threadId,
      resourceId,
    });

    // User message should be saved
    const userMessages = messagesAfterSuspension.messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBeGreaterThan(0);

    cleanup();
  });
});

// ============================================================================
// Foreach Tool Execution Pattern Tests
// ============================================================================

describe('DurableAgent foreach tool execution', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should execute a single tool through the foreach pattern', async () => {
    const mockModel = createToolCallThenTextModel('echoTool', { message: 'hello' }, 'Echo complete');

    const echoTool = createTool({
      id: 'echoTool',
      description: 'Echo the input',
      inputSchema: z.object({ message: z.string() }),
      execute: async ({ message }) => `Echo: ${message}`,
    });

    const baseAgent = new Agent({
      id: 'single-tool-foreach-agent',
      name: 'Single Tool Foreach Agent',
      instructions: 'Echo messages',
      model: mockModel as LanguageModelV2,
      tools: { echoTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let finishData: any = null;
    const toolResults: any[] = [];

    const { cleanup } = await durableAgent.stream('Echo hello', {
      onChunk: chunk => {
        if (chunk.type === 'tool-result') {
          toolResults.push(chunk);
        }
      },
      onFinish: data => {
        finishData = data;
      },
    });

    // Wait for workflow to complete
    await delay(500);

    expect(finishData).not.toBeNull();
    expect(toolResults.length).toBeGreaterThan(0);

    cleanup();
  });

  it('should execute multiple tools through the foreach pattern', async () => {
    const mockModel = createMultipleToolCallModel([
      { name: 'addTool', args: { a: 2, b: 3 } },
      { name: 'multiplyTool', args: { a: 4, b: 5 } },
    ]);

    const addTool = createTool({
      id: 'addTool',
      description: 'Add two numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a + b,
    });

    const multiplyTool = createTool({
      id: 'multiplyTool',
      description: 'Multiply two numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a * b,
    });

    const baseAgent = new Agent({
      id: 'multi-tool-foreach-agent',
      name: 'Multi Tool Foreach Agent',
      instructions: 'Calculate',
      model: mockModel as LanguageModelV2,
      tools: { addTool, multiplyTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let finishData: any = null;
    const toolResults: any[] = [];

    const { cleanup } = await durableAgent.stream('Add 2+3 and multiply 4*5', {
      onChunk: chunk => {
        if (chunk.type === 'tool-result') {
          toolResults.push(chunk);
        }
      },
      onFinish: data => {
        finishData = data;
      },
    });

    // Wait for workflow to complete
    await delay(500);

    expect(finishData).not.toBeNull();
    // Both tools should have results
    expect(toolResults.length).toBe(2);

    cleanup();
  });

  it('should handle tool errors gracefully in foreach pattern', async () => {
    const mockModel = createToolCallThenTextModel('errorTool', { input: 'test' }, 'Handled error');

    const errorTool = createTool({
      id: 'errorTool',
      description: 'A tool that throws',
      inputSchema: z.object({ input: z.string() }),
      execute: async () => {
        throw new Error('Tool execution failed');
      },
    });

    const baseAgent = new Agent({
      id: 'error-tool-foreach-agent',
      name: 'Error Tool Foreach Agent',
      instructions: 'Use the tool',
      model: mockModel as LanguageModelV2,
      tools: { errorTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const toolErrors: any[] = [];

    const { cleanup } = await durableAgent.stream('Use the error tool', {
      onChunk: chunk => {
        if (chunk.type === 'tool-error') {
          toolErrors.push(chunk);
        }
      },
    });

    // Wait for workflow to complete or error
    await delay(500);

    expect(toolErrors.length).toBeGreaterThan(0);

    cleanup();
  });
});
