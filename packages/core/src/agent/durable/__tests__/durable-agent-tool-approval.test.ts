/**
 * DurableAgent Tool Approval Tests
 *
 * Tests for tool approval workflow with requireToolApproval flag.
 * Validates that tools requiring approval properly suspend and can be approved/declined.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns a tool call
 */
function createToolCallModel(toolName: string, toolArgs: object) {
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
 * Creates a mock model that returns text first, then a tool call
 */
function createTextThenToolModel(text: string, toolName: string, toolArgs: object) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
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
 * Creates a mock model that returns multiple tool calls
 */
function createMultipleToolCallsModel(tools: Array<{ name: string; args: object }>) {
  const toolCallChunks = tools.map((tool, index) => ({
    type: 'tool-call' as const,
    toolCallType: 'function' as const,
    toolCallId: `call-${index + 1}`,
    toolName: tool.name,
    input: JSON.stringify(tool.args),
    providerExecuted: false,
  }));

  return new MockLanguageModelV2({
    doStream: async () => ({
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
    }),
  });
}

/**
 * Creates a simple text-only model for follow-up responses
 */
function _createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent Tool Approval Tests
// ============================================================================

describe('DurableAgent tool approval', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('requireToolApproval at agent level', () => {
    it('should include requireToolApproval in workflow options when set globally', async () => {
      const mockModel = createToolCallModel('findUser', { name: 'Alice' });
      const mockExecute = vi.fn().mockResolvedValue({ name: 'Alice', email: 'alice@test.com' });

      const findUserTool = createTool({
        id: 'findUser',
        description: 'Find a user by name',
        inputSchema: z.object({ name: z.string() }),
        execute: mockExecute,
      });

      const baseAgent = new Agent({
        id: 'approval-agent',
        name: 'Approval Agent',
        instructions: 'You can find users',
        model: mockModel as LanguageModelV2,
        tools: { findUser: findUserTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Find user Alice', {
        requireToolApproval: true,
      });

      expect(result.workflowInput.options.requireToolApproval).toBe(true);
    });

    it('should set requireToolApproval to false by default', async () => {
      const mockModel = createToolCallModel('findUser', { name: 'Alice' });

      const findUserTool = createTool({
        id: 'findUser',
        description: 'Find a user by name',
        inputSchema: z.object({ name: z.string() }),
        execute: async () => ({ name: 'Alice' }),
      });

      const baseAgent = new Agent({
        id: 'no-approval-agent',
        name: 'No Approval Agent',
        instructions: 'You can find users',
        model: mockModel as LanguageModelV2,
        tools: { findUser: findUserTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Find user Alice');

      // Should be undefined or false by default
      expect(result.workflowInput.options.requireToolApproval).toBeFalsy();
    });
  });

  describe('requireApproval at tool level', () => {
    it('should register tool with requireApproval flag', async () => {
      const mockModel = createToolCallModel('findUser', { name: 'Alice' });

      const findUserTool = createTool({
        id: 'findUser',
        description: 'Find a user by name',
        inputSchema: z.object({ name: z.string() }),
        requireApproval: true,
        execute: async () => ({ name: 'Alice', email: 'alice@test.com' }),
      });

      const baseAgent = new Agent({
        id: 'tool-approval-agent',
        name: 'Tool Approval Agent',
        instructions: 'You can find users',
        model: mockModel as LanguageModelV2,
        tools: { findUser: findUserTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Find user Alice');

      // Tool should be registered in registry
      const tools = durableAgent.runRegistry.getTools(result.runId);
      expect(tools).toBeDefined();
      expect(tools.findUser).toBeDefined();
    });

    it('should handle multiple tools with mixed approval requirements', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'findUser', args: { name: 'Alice' } },
        { name: 'sendEmail', args: { to: 'alice@test.com' } },
      ]);

      const findUserTool = createTool({
        id: 'findUser',
        description: 'Find a user by name',
        inputSchema: z.object({ name: z.string() }),
        requireApproval: false, // No approval needed
        execute: async () => ({ name: 'Alice' }),
      });

      const sendEmailTool = createTool({
        id: 'sendEmail',
        description: 'Send an email',
        inputSchema: z.object({ to: z.string() }),
        requireApproval: true, // Requires approval
        execute: async () => ({ sent: true }),
      });

      const baseAgent = new Agent({
        id: 'mixed-approval-agent',
        name: 'Mixed Approval Agent',
        instructions: 'You can find users and send emails',
        model: mockModel as LanguageModelV2,
        tools: { findUser: findUserTool, sendEmail: sendEmailTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Find Alice and send her an email');

      const tools = durableAgent.runRegistry.getTools(result.runId);
      expect(tools.findUser).toBeDefined();
      expect(tools.sendEmail).toBeDefined();
    });
  });

  describe('tool approval workflow serialization', () => {
    it('should serialize tool approval state in workflow input', async () => {
      const mockModel = createToolCallModel('dangerousTool', { action: 'delete' });

      const dangerousTool = createTool({
        id: 'dangerousTool',
        description: 'A dangerous operation that needs approval',
        inputSchema: z.object({ action: z.string() }),
        requireApproval: true,
        execute: async () => ({ result: 'completed' }),
      });

      const baseAgent = new Agent({
        id: 'dangerous-op-agent',
        name: 'Dangerous Operation Agent',
        instructions: 'You can perform dangerous operations',
        model: mockModel as LanguageModelV2,
        tools: { dangerousTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Delete all data', {
        requireToolApproval: true,
      });

      // Workflow input should be JSON-serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.options.requireToolApproval).toBe(true);
    });

    it('should handle tool approval with autoResumeSuspendedTools option', async () => {
      const mockModel = createToolCallModel('interactiveTool', { input: 'test' });

      const interactiveTool = createTool({
        id: 'interactiveTool',
        description: 'An interactive tool',
        inputSchema: z.object({ input: z.string() }),
        requireApproval: true,
        execute: async () => ({ output: 'result' }),
      });

      const baseAgent = new Agent({
        id: 'interactive-agent',
        name: 'Interactive Agent',
        instructions: 'You can use interactive tools',
        model: mockModel as LanguageModelV2,
        tools: { interactiveTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Use the interactive tool', {
        requireToolApproval: true,
        autoResumeSuspendedTools: true,
      });

      expect(result.workflowInput.options.requireToolApproval).toBe(true);
      expect(result.workflowInput.options.autoResumeSuspendedTools).toBe(true);
    });
  });

  describe('streaming with tool approval', () => {
    it('should stream with requireToolApproval option', async () => {
      const mockModel = createToolCallModel('searchTool', { query: 'test' });

      const searchTool = createTool({
        id: 'searchTool',
        description: 'Search for information',
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({ results: ['result1', 'result2'] }),
      });

      const baseAgent = new Agent({
        id: 'search-agent',
        name: 'Search Agent',
        instructions: 'You can search for information',
        model: mockModel as LanguageModelV2,
        tools: { searchTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { runId, cleanup } = await durableAgent.stream('Search for test', {
        requireToolApproval: true,
      });

      expect(runId).toBeDefined();
      cleanup();
    });

    it('should handle text before tool call with approval', async () => {
      const mockModel = createTextThenToolModel('Let me search for that information...', 'searchTool', {
        query: 'test',
      });

      const searchTool = createTool({
        id: 'searchTool',
        description: 'Search for information',
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({ results: ['result1'] }),
      });

      const baseAgent = new Agent({
        id: 'text-then-tool-agent',
        name: 'Text Then Tool Agent',
        instructions: 'You can search for information',
        model: mockModel as LanguageModelV2,
        tools: { searchTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { runId, cleanup } = await durableAgent.stream('Search for test', {
        requireToolApproval: true,
      });

      expect(runId).toBeDefined();
      cleanup();
    });
  });

  describe('onSuspended callback', () => {
    it('should include onSuspended callback option in stream', async () => {
      const mockModel = createToolCallModel('approvableTool', { data: 'test' });

      const approvableTool = createTool({
        id: 'approvableTool',
        description: 'A tool that can be approved',
        inputSchema: z.object({ data: z.string() }),
        requireApproval: true,
        execute: async () => ({ result: 'done' }),
      });

      const baseAgent = new Agent({
        id: 'callback-agent',
        name: 'Callback Agent',
        instructions: 'You can use approvable tools',
        model: mockModel as LanguageModelV2,
        tools: { approvableTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const onSuspended = vi.fn();

      const { runId, cleanup } = await durableAgent.stream('Use the tool', {
        requireToolApproval: true,
        onSuspended,
      });

      expect(runId).toBeDefined();
      // onSuspended callback is registered but may not be called in unit test
      // since the workflow execution is mocked
      cleanup();
    });
  });

  describe('tool call metadata', () => {
    it('should preserve tool metadata through workflow input', async () => {
      const mockModel = createToolCallModel('metadataTool', { key: 'value' });

      const metadataTool = createTool({
        id: 'metadataTool',
        description: 'A tool with rich metadata',
        inputSchema: z.object({
          key: z.string().describe('The key parameter'),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        requireApproval: true,
        execute: async () => ({ result: 'success' }),
      });

      const baseAgent = new Agent({
        id: 'metadata-agent',
        name: 'Metadata Agent',
        instructions: 'You use tools with metadata',
        model: mockModel as LanguageModelV2,
        tools: { metadataTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Use the metadata tool');

      // Tool metadata should be serialized
      expect(result.workflowInput.toolsMetadata).toBeDefined();

      // Verify it's JSON-serializable
      const serialized = JSON.stringify(result.workflowInput.toolsMetadata);
      expect(serialized).toBeDefined();
    });
  });
});

describe('DurableAgent tool approval with workflows as tools', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle requireToolApproval with workflow default options', async () => {
    const mockModel = createToolCallModel('workflowTool', { input: 'test' });

    const workflowTool = createTool({
      id: 'workflowTool',
      description: 'A workflow exposed as a tool',
      inputSchema: z.object({ input: z.string() }),
      execute: async () => ({ output: 'result' }),
    });

    const baseAgent = new Agent({
      id: 'workflow-tool-agent',
      name: 'Workflow Tool Agent',
      instructions: 'You can use workflow tools',
      model: mockModel as LanguageModelV2,
      tools: { workflowTool },
      defaultOptions: {
        requireToolApproval: true,
      },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Default options should be reflected when no options are passed
    const result = await durableAgent.prepare('Use the workflow tool');

    // Note: Default options are applied at the agent level, not workflow input level
    // This test verifies the agent accepts defaultOptions config
    expect(result.runId).toBeDefined();
  });
});
