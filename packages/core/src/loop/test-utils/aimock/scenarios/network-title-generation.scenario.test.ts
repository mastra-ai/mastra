import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { expect, it, vi } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  complete,
  drain,
  isAgentRequest,
  isCompletionRequest,
  isRoutingRequest,
  requestText,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * Thread title generation on the agent.network() path, which resolves
 * `generateTitle` and calls genTitle itself (loop/network/index.ts) instead of
 * going through the agent loop covered by title-generation.scenario.test.ts.
 *
 * Replaces the skipped title-generation cases from
 * packages/core/src/agent/agent-network.e2e.test.ts.
 */
describeForAllEngines(
  'AIMock network scenario: thread title generation',
  engine => {
    const getMock = useLoopScenarioAimock();
    const isTitleRequest = (req: ChatCompletionRequest | null) =>
      requestText(req).includes('you will generate a short title');

    function setup(memory: MockMemory, id: string) {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isTitleRequest }, { content: 'Dolphin Research' });
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('researcher', 'agent', 'Research dolphins'));
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('NTG_MARK') }, { content: '- dolphins swim' });
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Dolphins swim.'));
      const researcher = new Agent({
        id: 'researcher',
        name: 'researcher',
        description: 'Researches topics',
        instructions: 'NTG_MARK Research.',
        model: scenarioModel(llm),
      });
      const network = new Agent({
        id,
        name: id,
        instructions: 'Research things.',
        model: scenarioModel(llm),
        agents: { researcher },
        memory,
      });
      return { llm, network };
    }

    const titleRequests = (llm: ReturnType<typeof getMock>) => llm.getRequests().filter(r => isTitleRequest(r.body));

    // #28461: the network saves the user message before checking whether it is the
    // first one on the thread, so it never asks for a title.
    it.fails('titles the network thread when the memory enables generateTitle', async () => {
      const memory = new MockMemory({ options: { generateTitle: true } });
      const { llm, network } = setup(memory, 'ntg-memory-on');

      const chunks = await drain(
        await forEngine(network, engine).network('Research dolphins', {
          memory: { thread: 'ntg-memory-on', resource: 'ntg' },
        }),
      );

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      await vi.waitFor(async () => {
        expect((await memory.getThreadById({ threadId: 'ntg-memory-on' }))?.title).toBe('Dolphin Research');
      });
      expect(titleRequests(llm)).toHaveLength(1);
      expect(requestText(titleRequests(llm)[0]!.body)).toContain('Research dolphins');
    });

    // #28461: the network saves the user message before checking whether it is the
    // first one on the thread, so it never asks for a title.
    it.fails('titles the network thread when the network call enables generateTitle', async () => {
      const memory = new MockMemory();
      const { llm, network } = setup(memory, 'ntg-options-on');

      await drain(
        await forEngine(network, engine).network('Research dolphins', {
          memory: { thread: 'ntg-options-on', resource: 'ntg', options: { generateTitle: true } },
        }),
      );

      await vi.waitFor(async () => {
        expect((await memory.getThreadById({ threadId: 'ntg-options-on' }))?.title).toBe('Dolphin Research');
      });
      expect(titleRequests(llm)).toHaveLength(1);
    });

    it('does not title the network thread when the memory disables generateTitle', async () => {
      const memory = new MockMemory({ options: { generateTitle: false } });
      const { llm, network } = setup(memory, 'ntg-memory-off');

      const chunks = await drain(
        await forEngine(network, engine).network('Research dolphins', {
          memory: { thread: 'ntg-memory-off', resource: 'ntg' },
        }),
      );

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      expect(titleRequests(llm)).toEqual([]);
      expect((await memory.getThreadById({ threadId: 'ntg-memory-off' }))?.title ?? '').not.toBe('Dolphin Research');
    });

    it('does not title the network thread when the network call disables generateTitle', async () => {
      const memory = new MockMemory({ options: { generateTitle: true } });
      const { llm, network } = setup(memory, 'ntg-options-off');

      const chunks = await drain(
        await forEngine(network, engine).network('Research dolphins', {
          memory: { thread: 'ntg-options-off', resource: 'ntg', options: { generateTitle: false } },
        }),
      );

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      expect(titleRequests(llm)).toEqual([]);
      expect((await memory.getThreadById({ threadId: 'ntg-options-off' }))?.title ?? '').not.toBe('Dolphin Research');
    });
  },
  NETWORK_ENGINE_SKIP,
);
