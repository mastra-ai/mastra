import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { getRetrievalInstructions, OBSERVATION_CONTEXT_INSTRUCTIONS } from '../constants';
import { renderObservationGroupsForReflection } from '../observation-groups';
import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';
import type { MemoryContextProvider } from '../processor';

describe('who said it', () => {
  it('treats user statements as authoritative and assistant messages as suggestions', () => {
    expect(OBSERVATION_CONTEXT_INSTRUCTIONS).toContain('USER STATEMENTS VS ASSISTANT SUGGESTIONS');
    expect(OBSERVATION_CONTEXT_INSTRUCTIONS).toContain('unless data or their own later messages say otherwise');
    expect(OBSERVATION_CONTEXT_INSTRUCTIONS).toContain('unless the user adopted or confirmed them');
  });

  it("treats the assistant's actions as what happened", () => {
    expect(OBSERVATION_CONTEXT_INSTRUCTIONS).toContain(
      'What the assistant did, such as editing a file, running a command, or calling a tool, is a record of what happened.',
    );
  });

  it.each(['thread', 'resource'] as const)('does not rule out recall for preference questions in %s scope', scope => {
    for (const text of [getRetrievalInstructions(scope), getRetrievalInstructions(scope, undefined, false)]) {
      expect(text).toContain("general knowledge that doesn't depend on this user's history");
      expect(text).not.toContain('general preferences or facts');
    }
  });

  it.each(['thread', 'resource'] as const)(
    'sends unconfirmed assistant proposals to raw messages in %s scope',
    scope => {
      for (const text of [getRetrievalInstructions(scope), getRetrievalInstructions(scope, undefined, false)]) {
        expect(text).toContain('An observation records something the assistant proposed');
        expect(text).toContain("your observations don't show what the user decided");
        expect(text).toContain("Read the raw messages around it to find the user's decision");
      }
    },
  );
});

describe('actor recall guidance', () => {
  it.each(['thread', 'resource'] as const)('teaches search-to-observation paging in %s scope', scope => {
    const text = getRetrievalInstructions(scope);
    expect(text).toContain('mode: "observations"');
    expect(text).toContain('5 groups');
    expect(text).toContain('two views of the same conversation history');
    expect(text).toContain('observations for breadth, and messages for depth');
    expect(text).toContain('page both before and after the anchor');
    expect(text).toContain('The range connects the summary view to the raw-message view');
    expect(text).toContain('limit: 2');
    expect(text).toContain('currently provided tool schema');
    expect(text).toContain('what was discussed or decided and why, start with recall');
    expect(text).toContain('Distinguish recorded reasons from your own inference');
    expect(text).toContain('hasMore: false');
    expect(text).toContain('not whether older raw messages exist');
    expect(text).toContain('first or last group ID');
    expect(text).toContain('direction: "before"');
    expect(text).toContain('direction: "after"');
    expect(text).toContain('not a complete timeline');
    expect(text).toContain('both event dates');
    expect(text).toContain('missing search hit is not evidence');
    expect(text).toContain('kind="reflection"');
    expect(text).toContain('lossy summaries');
    expect(text).toContain('that does not mean it did not happen');
    expect(text).toContain("user's message verbatim as the search query");
    expect(text).not.toContain('There is no relevant range in your observations for the topic');
    expect(text).not.toContain('go straight to `mode: "messages"`');
  });

  it.each(['thread', 'resource'] as const)(
    'lays out search, paging, and source reads as one lookup in %s scope',
    scope => {
      const text = getRetrievalInstructions(scope);
      const search = text.indexOf('1. **Search to locate.**');
      const paging = text.indexOf('2. **Page observations for context.**');
      const messages = text.indexOf('3. **Read source messages to confirm.**');
      expect(search).toBeGreaterThan(-1);
      expect(paging).toBeGreaterThan(search);
      expect(messages).toBeGreaterThan(paging);
      expect(text).toContain('differently worded queries');
      expect(text).toContain('`after`/`before` date windows');
      expect(text).toContain('stop rephrasing: page from those groups or read their source messages instead');
      expect(text).toContain('Group already in current context" marks a group that is already in your observations');
      expect(text).not.toContain('first or last source message');

      const withoutPaging = getRetrievalInstructions(scope, undefined, true, false);
      expect(withoutPaging).toContain('1. **Search to locate.**');
      expect(withoutPaging).toContain('2. **Read source messages to confirm.**');
      expect(withoutPaging).toContain('stop rephrasing: read their source messages instead');
      expect(withoutPaging).not.toContain('mode: "observations"');
      expect(withoutPaging).not.toContain('page a referenced group');
    },
  );

  it.each(['thread', 'resource'] as const)('does not advertise unavailable paging in %s scope', async scope => {
    const browsing = getRetrievalInstructions(scope, undefined, false);
    expect(browsing).not.toContain('mode: "observations"');
    expect(browsing).not.toContain('mode: "search"');
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    Object.defineProperty(storage, 'supportsObservationalMemoryHistorySearch', { value: false });
    const om = new ObservationalMemory({ storage, model: 'test-model', retrieval: { scope, vector: true } });
    const text = (await om.buildContextSystemMessages({ threadId: 'thread', resourceId: 'resource' }))!.join('\n');
    expect(text).toContain('mode: "search"');
    expect(text).not.toContain('mode: "observations"');
  });

  it('labels lossy reflection groups in actor context without changing reflector input', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const record = await storage.initializeObservationalMemory({
      threadId: 'thread',
      resourceId: 'resource',
      scope: 'thread',
      config: {},
    });
    const observations =
      '<observation-group id="summary" range="m1:m2" kind="reflection">Broad summary</observation-group>\n<observation-group id="original" range="m3:m4">Original note</observation-group>';
    await storage.updateActiveObservations({ id: record.id, observations, tokenCount: 10, lastObservedAt: new Date() });
    const om = new ObservationalMemory({ storage, model: 'test-model', retrieval: { vector: true } });
    const text = await om.buildContextSystemMessage({ threadId: 'thread', resourceId: 'resource' });
    expect(text).toContain('## Group `summary`\n_kind: reflection_\n_range: `m1:m2`_');
    expect(text).toContain('## Group `original`\n_range: `m3:m4`_');
    expect(renderObservationGroupsForReflection(observations)).not.toContain('_kind: reflection_');
  });

  it.each([false, true])('omits recall guidance when disabled, with observations=%s', async populated => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const record = await storage.initializeObservationalMemory({
      threadId: 'thread',
      resourceId: 'resource',
      scope: 'thread',
      config: {},
    });
    if (populated)
      await storage.updateActiveObservations({
        id: record.id,
        observations: 'A fact.',
        tokenCount: 3,
        lastObservedAt: new Date(),
      });
    const om = new ObservationalMemory({ storage, model: 'test-model' });
    const text = await om.buildContextSystemMessage({ threadId: 'thread', resourceId: 'resource' });
    expect(text ?? '').not.toContain('## Recall');
  });

  for (const scope of ['thread', 'resource'] as const) {
    for (const readOnly of [false, true]) {
      it.each(['missing', 'empty', 'populated'] as const)(
        `injects stable system guidance on every step: ${scope}, readOnly=${readOnly}, record=%s`,
        async recordState => {
          const threadId = 'thread';
          const resourceId = 'resource';
          const storage = new InMemoryMemory({ db: new InMemoryDB() });
          await storage.saveThread({
            thread: { id: threadId, resourceId, createdAt: new Date(), updatedAt: new Date() },
          });
          if (recordState !== 'missing') {
            const record = await storage.initializeObservationalMemory({
              threadId,
              resourceId,
              scope: 'thread',
              config: {},
            });
            if (recordState === 'populated') {
              await storage.updateActiveObservations({
                id: record.id,
                observations: 'Existing user preferences.',
                tokenCount: 5,
                lastObservedAt: new Date(),
              });
            }
          }
          const initialize = vi.spyOn(storage, 'initializeObservationalMemory');
          const om = new ObservationalMemory({
            storage,
            model: 'test-model',
            retrieval: { scope, vector: true, instructions: 'Custom application guidance.' },
            observation: { messageTokens: 100_000, bufferTokens: false },
            reflection: { observationTokens: 100_000, bufferActivation: 1 },
          });
          const memory: MemoryContextProvider = {
            getContext: async () => {
              const omRecord = await om.getRecord(threadId, resourceId);
              return {
                omRecord,
                hasObservations: !!omRecord?.activeObservations,
                messages: [],
                systemMessage: undefined,
                continuationMessage: undefined,
                otherThreadsContext: undefined,
              };
            },
            persistMessages: vi.fn(),
          };
          const processor = new ObservationalMemoryProcessor(om, memory);
          const messageList = new MessageList({ threadId, resourceId });
          const requestContext = new RequestContext();
          requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId, memoryConfig: { readOnly } });
          const state = {};
          let firstPrefix: string | undefined;
          for (const stepNumber of [0, 1]) {
            await processor.processInputStep({
              messageList,
              messages: [],
              requestContext,
              stepNumber,
              state,
              steps: [],
              systemMessages: [],
              model: new MockLanguageModelV2() as any,
              retryCount: 0,
              abort: () => {
                throw new Error('Unexpected abort');
              },
            });
            const messages = messageList.getSystemMessages('observational-memory');
            expect(messages.every(message => message.role === 'system')).toBe(true);
            const text = messages.map(message => message.content).join('\n');
            expect(text.match(/## Recall — looking up source messages/g)).toHaveLength(1);
            expect(text).toContain('mode: "observations"');
            expect(text).toContain('both event dates');
            expect(text).toContain('Custom application guidance.');
            const prefix = String(messages[0]!.content);
            if (stepNumber === 0) firstPrefix = prefix;
            else expect(prefix).toBe(firstPrefix);
          }
          if (readOnly) {
            expect(initialize).not.toHaveBeenCalled();
            expect(memory.persistMessages).not.toHaveBeenCalled();
          }
        },
      );
    }
  }
  it.each(['thread', 'resource'] as const)('does not ask the agent to handle record IDs in %s scope', scope => {
    expect(getRetrievalInstructions(scope, undefined, true, true)).not.toContain('recordId');
  });
});
