import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  complete,
  drain,
  isAgentRequest,
  isCompletionRequest,
  isRoutingRequest,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * agent.network() delegating to a sub-agent that shares the network's memory
 * with working memory enabled: the sub-agent runs on the network's thread and
 * resource, so its `updateWorkingMemory` call succeeds and lands on the
 * caller's resource (issue #9873: sub-agents used to run without them).
 *
 * Replaces the live "updateWorkingMemory" case from
 * packages/core/src/agent/agent-network.e2e.test.ts.
 */
describeForAllEngines(
  'AIMock network scenario: sub-agent working memory',
  engine => {
    const getMock = useLoopScenarioAimock();
    const lastIsToolResult = (req: ChatCompletionRequest | null) => req?.messages.at(-1)?.role === 'tool';
    const THREAD_ID = 'nwm-thread';
    const RESOURCE_ID = 'nwm-resource';
    const PROFILE = '# Information Profile\n- Title: Dolphins\n';

    it("forwards the network's thread and resource to a sub-agent's updateWorkingMemory call", async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('researcher', 'agent', 'Research dolphins'));
      llm.on(
        { endpoint: 'chat', predicate: req => isAgentRequest('NWM_MARK')(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-wm', name: 'updateWorkingMemory', arguments: { memory: PROFILE } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => isAgentRequest('NWM_MARK')(req) && lastIsToolResult(req) },
        { content: 'Dolphins are marine mammals.' },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Dolphins are marine mammals.'));

      const memory = new MockMemory({
        enableWorkingMemory: true,
        workingMemoryTemplate: '# Information Profile\n- Title:\n',
      });
      const researcher = new Agent({
        id: 'researcher',
        name: 'researcher',
        description: 'Researches topics',
        instructions: 'NWM_MARK Remember what you learn using your memory tools.',
        model: scenarioModel(llm),
        memory,
      });
      const network = new Agent({
        id: 'wm-network',
        name: 'wm-network',
        instructions: 'Delegate research.',
        model: scenarioModel(llm),
        agents: { researcher },
        memory,
      });

      const stream = await forEngine(network, engine).network('Research dolphins', {
        memory: { thread: THREAD_ID, resource: RESOURCE_ID },
      });
      const chunks = await drain(stream);

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      const wmResult = chunks.find(
        c =>
          c.type === 'agent-execution-event-tool-result' &&
          (c.payload as { payload?: { toolName?: string } }).payload?.toolName === 'updateWorkingMemory',
      );
      expect((wmResult?.payload as { payload?: { result?: unknown } }).payload?.result).toEqual({ success: true });

      expect(await memory.getWorkingMemory({ threadId: THREAD_ID, resourceId: RESOURCE_ID })).toBe(PROFILE);
      const thread = await memory.getThreadById({ threadId: THREAD_ID });
      expect(thread?.resourceId).toBe(RESOURCE_ID);
      await expect(stream.usage).resolves.toBeDefined();
    });
  },
  NETWORK_ENGINE_SKIP,
);
