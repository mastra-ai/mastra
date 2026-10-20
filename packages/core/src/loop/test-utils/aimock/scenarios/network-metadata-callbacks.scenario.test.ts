import { expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import type { MastraDBMessage } from '../../../../memory';
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

const isNetworkInternal = (msg: MastraDBMessage) =>
  msg.role === 'assistant' &&
  msg.content.parts.some(part => {
    if (part.type !== 'text') return false;
    try {
      const parsed = JSON.parse(part.text);
      return Boolean(parsed.isNetwork || (parsed.primitiveId && parsed.selectionReason));
    } catch {
      return false;
    }
  });

/**
 * agent.network() bookkeeping around a delegated sub-agent: internal network
 * messages are tagged metadata.mode = 'network' (#13106), and the run-level
 * onStepFinish / onError callbacks reach the sub-agent run.
 */
describeForAllEngines(
  'AIMock network scenario: metadata and callbacks',
  engine => {
    const getMock = useLoopScenarioAimock();

    const subAgentNetwork = (llm: ReturnType<typeof getMock>, memory: MockMemory, subAgentMemory?: MockMemory) =>
      new Agent({
        id: 'metadata-network',
        name: 'metadata-network',
        instructions: 'Delegate.',
        model: scenarioModel(llm),
        memory,
        agents: {
          subAgent: new Agent({
            id: 'subAgent',
            name: 'subAgent',
            description: 'Researches',
            instructions: 'SUB_MARK',
            model: scenarioModel(llm),
            ...(subAgentMemory ? { memory: subAgentMemory } : {}),
          }),
        },
      });

    const routeToSubAgent = (llm: ReturnType<typeof getMock>) => {
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('subAgent', 'agent', 'Research quantum computing'),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Research done'));
    };

    it.each([
      ['without its own memory', false],
      ['sharing the network memory', true],
    ])('tags internal network messages with metadata.mode = network, sub-agent %s (#13106)', async (_, shared) => {
      const llm = getMock();
      routeToSubAgent(llm);
      llm.on(
        { endpoint: 'chat', predicate: isAgentRequest('SUB_MARK') },
        { content: 'Sub-agent completed the research.' },
      );
      const memory = new MockMemory();
      const network = subAgentNetwork(llm, memory, shared ? memory : undefined);

      await drain(
        await forEngine(network, engine).network('Tell me about quantum computing', {
          memory: { thread: 'md-t', resource: 'md-r' },
        }),
      );

      const { messages } = await memory.recall({ threadId: 'md-t', resourceId: 'md-r' });
      const internal = messages.filter(isNetworkInternal);
      expect(internal.length).toBeGreaterThan(0);
      expect(internal.map(m => m.content.metadata?.mode)).toEqual(internal.map(() => 'network'));
      const userMessage = messages.find(
        m => m.role === 'user' && JSON.stringify(m.content).includes('Tell me about quantum computing'),
      );
      expect(userMessage).toMatchObject({ role: 'user' });
      expect(userMessage!.content.metadata?.mode).not.toBe('network');
    });

    it('calls onStepFinish for the sub-agent step', async () => {
      const llm = getMock();
      routeToSubAgent(llm);
      llm.on(
        { endpoint: 'chat', predicate: isAgentRequest('SUB_MARK') },
        { content: 'Step done.', usage: { input_tokens: 5, output_tokens: 10 } },
      );
      const steps: { text: string; finishReason: string | undefined; usage: unknown }[] = [];
      const network = subAgentNetwork(llm, new MockMemory());

      await drain(
        await forEngine(network, engine).network('Research', {
          memory: { thread: 'sf-t', resource: 'sf-r' },
          onStepFinish: step =>
            void steps.push({ text: step.text, finishReason: step.finishReason, usage: step.usage }),
        }),
      );

      expect(steps.at(-1)).toMatchObject({
        text: 'Step done.',
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      });
    });

    it('calls onError when the sub-agent model call fails', async () => {
      const llm = getMock();
      routeToSubAgent(llm);
      llm.on(
        { endpoint: 'chat', predicate: isAgentRequest('SUB_MARK') },
        { error: { message: 'Sub-agent provider failure', type: 'invalid_request_error' }, status: 400 },
      );
      const errors: unknown[] = [];
      const network = subAgentNetwork(llm, new MockMemory());

      try {
        await drain(
          await forEngine(network, engine).network('Research', {
            memory: { thread: 'oe-t', resource: 'oe-r' },
            onError: ({ error }) => void errors.push(error),
          }),
        );
      } catch {
        // The run may surface the sub-agent failure; onError is the behaviour under test.
      }

      expect(errors.length).toBeGreaterThan(0);
      expect(String((errors[0] as Error).message)).toContain('Sub-agent provider failure');
    });
  },
  NETWORK_ENGINE_SKIP,
);
