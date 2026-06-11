/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/17797
 *
 * User messages sent through the agent signal pipeline (`agent.sendMessage`,
 * used by the Studio playground) are stored as `role: 'signal'` rows and only
 * projected to `role: 'user'` at prompt time — after input processors run.
 * SemanticRecall must treat user-type signals as user messages when extracting
 * the recall query, otherwise recall is silently skipped for those turns while
 * working fine for plain `role: 'user'` messages (the /generate and /stream
 * HTTP routes).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageList } from '../../agent';
import type { MastraDBMessage } from '../../agent';
import { createSignal } from '../../agent/signals';
import { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';
import type { MastraEmbeddingModel, MastraVector } from '../../vector';

import { globalEmbeddingCache } from './embedding-cache';
import { SemanticRecall } from './semantic-recall';

const USER_TEXT = 'What was my secret code word?';
const CURRENT_THREAD = 'thread-B';
const OTHER_THREAD = 'thread-A';
const RESOURCE = 'resource-1';

describe('SemanticRecall with signal-delivered user messages', () => {
  let mockStorage: MemoryStorage;
  let mockVector: MastraVector;
  let mockEmbedder: MastraEmbeddingModel<string>;
  let requestContext: RequestContext;
  let processor: SemanticRecall;

  beforeEach(() => {
    globalEmbeddingCache.clear();

    // The planted message lives in a different thread (cross-thread recall
    // with scope: 'resource').
    const plantedMessage: MastraDBMessage = {
      id: 'msg-planted',
      role: 'user',
      threadId: OTHER_THREAD,
      resourceId: RESOURCE,
      content: {
        format: 2,
        content: 'Remember: my secret code word is Orchid-7.',
        parts: [{ type: 'text', text: 'Remember: my secret code word is Orchid-7.' }],
      },
      createdAt: new Date(Date.now() - 60_000),
    };

    mockStorage = {
      listMessages: vi.fn().mockResolvedValue({
        messages: [plantedMessage],
        total: 1,
        page: 1,
        perPage: false,
        hasMore: false,
      }),
    } as any;

    mockVector = {
      query: vi
        .fn()
        .mockResolvedValue([
          { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-planted', thread_id: OTHER_THREAD } },
        ]),
      listIndexes: vi.fn().mockResolvedValue(['mastra_memory_text_embedding_3_small']),
      createIndex: vi.fn(),
      upsert: vi.fn(),
    } as any;

    mockEmbedder = {
      doEmbed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
      modelId: 'text-embedding-3-small',
    } as any;

    requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: CURRENT_THREAD, resourceId: RESOURCE },
      resourceId: RESOURCE,
    });

    processor = new SemanticRecall({
      storage: mockStorage,
      vector: mockVector,
      embedder: mockEmbedder,
      topK: 3,
      scope: 'resource',
    });
  });

  async function runProcessor(messageList: MessageList) {
    // Mirrors ProcessorRunner.runInputProcessors: processors receive
    // messageList.get.input.db() as `messages`.
    return processor.processInput({
      messages: messageList.get.input.db(),
      messageList,
      abort: vi.fn() as any,
      requestContext,
    });
  }

  function recalledBlock(messageList: MessageList): string | undefined {
    const memorySystemMessages = messageList.getSystemMessages('memory');
    return memorySystemMessages
      .map(m => (typeof m.content === 'string' ? m.content : ''))
      .find(c => c.includes('<remembered_from_other_conversation>'));
  }

  it('injects recalled context for a plain user message', async () => {
    const messageList = new MessageList({ threadId: CURRENT_THREAD, resourceId: RESOURCE });
    messageList.add(
      {
        id: 'msg-new',
        role: 'user',
        threadId: CURRENT_THREAD,
        resourceId: RESOURCE,
        content: { format: 2, content: USER_TEXT, parts: [] },
        createdAt: new Date(),
      },
      'input',
    );

    await runProcessor(messageList);

    expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({ values: [USER_TEXT] });
    expect(mockVector.query).toHaveBeenCalledTimes(1);

    const block = recalledBlock(messageList);
    expect(block).toBeDefined();
    expect(block).toContain('Orchid-7');
  });

  it('injects recalled context for a user-message signal (Studio sendMessage path)', async () => {
    // This is how a playground turn reaches input processors: useChat →
    // agent.sendMessage → thread-stream-runtime wakes the idle thread with
    // agent.stream(signal, ...) → the signal is added to the MessageList as a
    // role: 'signal' DB row.
    const signal = createSignal({ type: 'user-message', contents: USER_TEXT });

    const messageList = new MessageList({ threadId: CURRENT_THREAD, resourceId: RESOURCE });
    messageList.addSignal(signal, { source: 'input' });

    const inputMessages = messageList.get.input.db();
    expect(inputMessages).toHaveLength(1);
    expect(inputMessages[0]!.role).toBe('signal');

    await runProcessor(messageList);

    expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({ values: [USER_TEXT] });
    expect(mockVector.query).toHaveBeenCalledTimes(1);

    const block = recalledBlock(messageList);
    expect(block).toBeDefined();
    expect(block).toContain('Orchid-7');
  });

  it('does not run recall for non-user signals', async () => {
    const signal = createSignal({ type: 'system-reminder', contents: 'The deploy finished.' });

    const messageList = new MessageList({ threadId: CURRENT_THREAD, resourceId: RESOURCE });
    messageList.addSignal(signal, { source: 'input' });

    await runProcessor(messageList);

    expect(mockEmbedder.doEmbed).not.toHaveBeenCalled();
    expect(mockVector.query).not.toHaveBeenCalled();
    expect(recalledBlock(messageList)).toBeUndefined();
  });
});
