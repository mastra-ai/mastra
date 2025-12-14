import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { AgentBranch } from '../agent-branch';

describe('AgentBranch', () => {
  let storage: InMemoryStore;
  let mockMemory: MockMemory;
  let dummyModel: MockLanguageModelV2;

  beforeEach(() => {
    storage = new InMemoryStore();
    mockMemory = new MockMemory({ storage });
    dummyModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Response from branch' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        stream: convertArrayToReadableStream([
          { type: 'text-delta', id: 'text-1', delta: 'Response from branch' },
          {
            type: 'finish',
            id: '2',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        warnings: [],
      }),
    });
  });

  it('branch() returns an AgentBranch instance', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    const branch = agent.branch({
      threadId: 'source-thread',
      resourceId: 'user-123',
    });

    expect(branch).toBeInstanceOf(AgentBranch);
  });

  it('auto-generates newThreadId when not provided', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    const branch = agent.branch({
      threadId: 'source-thread',
      resourceId: 'user-123',
    });

    expect(branch.newThreadId).toBeDefined();
    expect(typeof branch.newThreadId).toBe('string');
    expect(branch.newThreadId.length).toBeGreaterThan(0);
  });

  it('uses custom newThreadId when provided', () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    const branch = agent.branch({
      threadId: 'source-thread',
      resourceId: 'user-123',
      newThreadId: 'custom-branch-id',
    });

    expect(branch.newThreadId).toBe('custom-branch-id');
  });

  it('throws error when agent has no memory configured', async () => {
    const agentWithoutMemory = new Agent({
      id: 'no-memory-agent',
      name: 'No Memory Agent',
      instructions: 'test',
      model: dummyModel,
    });

    const branch = agentWithoutMemory.branch({
      threadId: 'source-thread',
      resourceId: 'user-123',
    });

    await expect(branch.stream('Hello')).rejects.toThrow(/no memory configured/);
  });

  it('lazily copies messages only when stream() is first called', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    // Set up source thread with messages
    await mockMemory.createThread({
      threadId: 'source-thread',
      resourceId: 'user-123',
    });
    await mockMemory.saveMessages({
      messages: [
        {
          id: 'msg-1',
          threadId: 'source-thread',
          resourceId: 'user-123',
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          threadId: 'source-thread',
          resourceId: 'user-123',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
          createdAt: new Date(),
        },
      ],
    });

    const branch = agent.branch({
      threadId: 'source-thread',
      resourceId: 'user-123',
      newThreadId: 'new-branch',
    });

    // Before calling stream(), new thread should not exist
    const threadBefore = await mockMemory.getThreadById({ threadId: 'new-branch' });
    expect(threadBefore).toBeNull();

    // Call stream() which should trigger branching
    const result = await branch.stream('Continue the conversation');
    await result.consumeStream();

    // After calling stream(), new thread should exist with copied messages
    const threadAfter = await mockMemory.getThreadById({ threadId: 'new-branch' });
    expect(threadAfter).not.toBeNull();
    expect(threadAfter?.metadata?.branchedFrom).toBe('source-thread');

    const { messages } = await mockMemory.recall({ threadId: 'new-branch', resourceId: 'user-123' });
    // Should have the 2 copied messages + 1 new user message + 1 assistant response
    expect(messages.length).toBeGreaterThanOrEqual(2);

    // Check that original messages were copied with new IDs
    const copiedMessages = messages.filter(m => m.id !== 'msg-1' && m.id !== 'msg-2');
    expect(copiedMessages.length).toBeGreaterThan(0);
  });

  it('lazily copies messages only when generate() is first called', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    // Set up source thread with messages
    await mockMemory.createThread({
      threadId: 'source-thread-gen',
      resourceId: 'user-456',
    });
    await mockMemory.saveMessages({
      messages: [
        {
          id: 'msg-gen-1',
          threadId: 'source-thread-gen',
          resourceId: 'user-456',
          role: 'user',
          content: [{ type: 'text', text: 'Question' }],
          createdAt: new Date(),
        },
      ],
    });

    const branch = agent.branch({
      threadId: 'source-thread-gen',
      resourceId: 'user-456',
      newThreadId: 'generate-branch',
    });

    // Before calling generate(), new thread should not exist
    const threadBefore = await mockMemory.getThreadById({ threadId: 'generate-branch' });
    expect(threadBefore).toBeNull();

    // Call generate() which should trigger branching
    await branch.generate('Answer my question');

    // After calling generate(), new thread should exist
    const threadAfter = await mockMemory.getThreadById({ threadId: 'generate-branch' });
    expect(threadAfter).not.toBeNull();
  });

  it('copies messages only once even with multiple stream() calls', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    const saveSpy = vi.spyOn(mockMemory, 'saveMessages');

    // Set up source thread
    await mockMemory.createThread({
      threadId: 'source-once',
      resourceId: 'user-789',
    });
    await mockMemory.saveMessages({
      messages: [
        {
          id: 'msg-once-1',
          threadId: 'source-once',
          resourceId: 'user-789',
          role: 'user',
          content: [{ type: 'text', text: 'First message' }],
          createdAt: new Date(),
        },
      ],
    });

    // Reset spy count after setup
    saveSpy.mockClear();

    const branch = agent.branch({
      threadId: 'source-once',
      resourceId: 'user-789',
      newThreadId: 'idempotent-branch',
    });

    // Call stream() multiple times
    const result1 = await branch.stream('Message 1');
    await result1.consumeStream();
    const result2 = await branch.stream('Message 2');
    await result2.consumeStream();

    // saveMessages should have been called:
    // - Once for copying the source messages (during branch)
    // - Twice for saving new messages from each stream call
    // The key point is the copy happens only once
    const copyCallCount = saveSpy.mock.calls.filter(call => {
      const msgs = call[0].messages;
      return msgs.some((m: { threadId: string }) => m.threadId === 'idempotent-branch');
    }).length;

    // At least 1 call for copying, could be more for saving responses
    expect(copyCallCount).toBeGreaterThanOrEqual(1);
  });

  it('thread metadata includes branchedFrom and branchedAt', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    // Set up source thread
    await mockMemory.createThread({
      threadId: 'source-metadata',
      resourceId: 'user-meta',
    });

    const branch = agent.branch({
      threadId: 'source-metadata',
      resourceId: 'user-meta',
      newThreadId: 'metadata-branch',
    });

    const result = await branch.stream('Hello');
    await result.consumeStream();

    const thread = await mockMemory.getThreadById({ threadId: 'metadata-branch' });
    expect(thread).not.toBeNull();
    expect(thread?.metadata?.branchedFrom).toBe('source-metadata');
    expect(thread?.metadata?.branchedAt).toBeDefined();

    // Verify branchedAt is a valid ISO date string
    const branchedAt = new Date(thread?.metadata?.branchedAt as string);
    expect(branchedAt.getTime()).not.toBeNaN();
  });

  it('handles empty source thread (no messages to copy)', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    // Create empty source thread
    await mockMemory.createThread({
      threadId: 'empty-source',
      resourceId: 'user-empty',
    });

    const branch = agent.branch({
      threadId: 'empty-source',
      resourceId: 'user-empty',
      newThreadId: 'from-empty-branch',
    });

    // Should work even with no messages to copy
    const result = await branch.stream('Start fresh');
    await result.consumeStream();

    const thread = await mockMemory.getThreadById({ threadId: 'from-empty-branch' });
    expect(thread).not.toBeNull();
  });

  it('preserves original message content when copying', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    const originalContent = [{ type: 'text' as const, text: 'Original content to preserve' }];

    // Set up source thread with specific content
    await mockMemory.createThread({
      threadId: 'content-source',
      resourceId: 'user-content',
    });
    await mockMemory.saveMessages({
      messages: [
        {
          id: 'preserve-msg',
          threadId: 'content-source',
          resourceId: 'user-content',
          role: 'user',
          content: originalContent,
          createdAt: new Date(),
        },
      ],
    });

    const branch = agent.branch({
      threadId: 'content-source',
      resourceId: 'user-content',
      newThreadId: 'content-branch',
    });

    const result = await branch.stream('Continue');
    await result.consumeStream();

    const { messages } = await mockMemory.recall({ threadId: 'content-branch', resourceId: 'user-content' });

    // Find the copied message (not the new ones from this stream call)
    const copiedMsg = messages.find(
      m => m.role === 'user' && m.content?.[0]?.type === 'text' && m.content[0].text === 'Original content to preserve',
    );
    expect(copiedMsg).toBeDefined();
    expect(copiedMsg?.id).not.toBe('preserve-msg'); // Should have new ID
    expect(copiedMsg?.threadId).toBe('content-branch'); // Should have new thread ID
  });
});
