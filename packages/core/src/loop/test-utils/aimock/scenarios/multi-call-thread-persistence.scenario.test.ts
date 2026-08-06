import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Scenario: Multi-call thread persistence with shared storage
 *
 * Tests that thread state persists correctly across multiple agent calls
 * when using shared storage. This validates:
 *
 * - Messages accumulate across calls within the same thread
 * - Different threads maintain isolated state
 * - Memory recall includes messages from previous calls
 * - Tool results persist across thread boundaries
 *
 * Regression classes:
 * - Thread isolation: messages from thread A don't leak into thread B
 * - Message accumulation: second call sees first call's messages
 * - Resource isolation: different resources maintain separate threads
 */
describeForAllEngines(
  'AIMock loop scenario: multi-call thread persistence',
  engine => {
    const getMock = useLoopScenarioAimock();

    // Helper to extract text content from message
    const getContent = (msg: any): string => {
      if (typeof msg.content === 'string') {
        return msg.content;
      }
      if (Array.isArray(msg.content)) {
        return msg.content.map((part: any) => part.text || '').join('');
      }
      return '';
    };

    it('accumulates messages across multiple calls in same thread', async () => {
      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        memory: sharedMemory,
      });

      const threadId = 'persistence-thread';
      const resourceId = 'test-resource';

      // First call: user asks about weather
      await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'What is the weather in San Francisco?',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/weather|san francisco/i, {
            content: 'The weather in San Francisco is sunny and 72°F.',
          });
        },
        collectChunks: false,
      });

      // Clear fixtures for second call
      getMock().clearFixtures();
      getMock().clearRequests();
      getMock().resetMatchCounts();

      // Second call: user asks follow-up question
      const { requests: secondRequests } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'What about tomorrow?',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/tomorrow/i, {
            content: 'Tomorrow in San Francisco will be partly cloudy with a high of 68°F.',
          });
        },
        collectChunks: false,
      });

      // The second call should include messages from the first call
      expect(secondRequests.length).toBeGreaterThan(0);
      const lastRequest = secondRequests[secondRequests.length - 1];
      const messages = lastRequest.body?.messages || [];

      // Should have more than just the current message (includes history)
      const userMessages = messages.filter((m: any) => m.role === 'user');
      expect(userMessages.length).toBeGreaterThanOrEqual(2);

      // First user message should be about weather
      const firstUserMsg = userMessages.find((m: any) => {
        const content = getContent(m);
        return content.toLowerCase().includes('weather');
      });
      expect(firstUserMsg).toBeDefined();

      // Second user message should be about tomorrow
      const secondUserMsg = userMessages.find((m: any) => {
        const content = getContent(m);
        return content.toLowerCase().includes('tomorrow');
      });
      expect(secondUserMsg).toBeDefined();
    });

    it('maintains thread isolation across different thread IDs', async () => {
      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        memory: sharedMemory,
      });

      const resourceId = 'test-resource';

      // Thread A: ask about cats
      await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Tell me about cats',
        memory: sharedMemory,
        threadId: 'thread-a',
        resourceId,
        fixtures: llm => {
          llm.onMessage(/cats/i, {
            content: 'Cats are independent and affectionate pets.',
          });
        },
        collectChunks: false,
      });

      // Clear fixtures
      getMock().clearFixtures();
      getMock().clearRequests();
      getMock().resetMatchCounts();

      // Thread B: ask about dogs
      const { requests: threadBRequests } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Tell me about dogs',
        memory: sharedMemory,
        threadId: 'thread-b',
        resourceId,
        fixtures: llm => {
          llm.onMessage(/dogs/i, {
            content: 'Dogs are loyal and energetic companions.',
          });
        },
        collectChunks: false,
      });

      // Thread B should NOT see Thread A's messages
      expect(threadBRequests.length).toBeGreaterThan(0);
      const lastRequest = threadBRequests[threadBRequests.length - 1];
      const messages = lastRequest.body?.messages || [];

      const userMessages = messages.filter((m: any) => m.role === 'user');

      // Should only have the current message (no history from thread-a)
      expect(userMessages.length).toBe(1);
      const firstUserContent = getContent(userMessages[0]).toLowerCase();
      expect(firstUserContent).toContain('dogs');

      // Should NOT contain cats message
      const catsMsg = userMessages.find((m: any) => {
        const content = getContent(m);
        return content.toLowerCase().includes('cats');
      });
      expect(catsMsg).toBeUndefined();
    });

    it('maintains resource isolation across different resource IDs', async () => {
      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        memory: sharedMemory,
      });

      const threadId = 'same-thread';

      // Resource A: ask about Python
      await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Explain Python programming',
        memory: sharedMemory,
        threadId,
        resourceId: 'resource-a',
        fixtures: llm => {
          llm.onMessage(/python/i, {
            content: 'Python is a high-level programming language known for its simplicity.',
          });
        },
        collectChunks: false,
      });

      // Clear fixtures
      getMock().clearFixtures();
      getMock().clearRequests();
      getMock().resetMatchCounts();

      // Resource B: ask about JavaScript (same thread ID, different resource)
      const { requests: resourceBRequests } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Explain JavaScript programming',
        memory: sharedMemory,
        threadId,
        resourceId: 'resource-b',
        fixtures: llm => {
          llm.onMessage(/javascript/i, {
            content: 'JavaScript is the language of the web.',
          });
        },
        collectChunks: false,
      });

      // Resource B should NOT see Resource A's messages
      expect(resourceBRequests.length).toBeGreaterThan(0);
      const lastRequest = resourceBRequests[resourceBRequests.length - 1];
      const messages = lastRequest.body?.messages || [];

      const userMessages = messages.filter((m: any) => m.role === 'user');

      // Should only have the current message (no history from resource-a)
      expect(userMessages.length).toBe(1);
      const firstUserContent = getContent(userMessages[0]).toLowerCase();
      expect(firstUserContent).toContain('javascript');

      // Should NOT contain python message
      const pythonMsg = userMessages.find((m: any) => {
        const content = getContent(m);
        return content.toLowerCase().includes('python');
      });
      expect(pythonMsg).toBeUndefined();
    });
  },
  { skip: ['fs'] },
); // uses sharedAgent across calls; the fs path assembles its own agent
