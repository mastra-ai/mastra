import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { MastraError } from '../../../../error';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  complete,
  drain,
  fixedScorer,
  isAgentRequest,
  isCompletionRequest,
  isFinalResultRequest,
  isRoutingRequest,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * agent.network() routing basics: which primitive runs, what the stream
 * reports, and what the router's own direct answers look like.
 */
describeForAllEngines(
  'AIMock network scenario: routing',
  engine => {
    const getMock = useLoopScenarioAimock();

    describe('observational memory', () => {
      it('rejects observational memory configured on the agent memory', async () => {
        const network = new Agent({
          id: 'om-config',
          name: 'om-config',
          instructions: 'Route.',
          model: scenarioModel(getMock()),
          memory: new MockMemory({ options: { observationalMemory: true } }),
        });

        await expect(
          forEngine(network, engine).network('Do something', { memory: { thread: 'om-t1', resource: 'om-r1' } }),
        ).rejects.toThrow('Observational Memory is not supported with agent network');
        expect(getMock().getRequests()).toHaveLength(0);
      });

      it('rejects observational memory enabled at call time with a user error', async () => {
        const network = new Agent({
          id: 'om-runtime',
          name: 'om-runtime',
          instructions: 'Route.',
          model: scenarioModel(getMock()),
          memory: new MockMemory(),
        });

        await expect(
          forEngine(network, engine).network('Do something', {
            memory: {
              thread: 'om-t2',
              resource: 'om-r2',
              options: { observationalMemory: { model: 'google/gemini-2.5-flash' } },
            },
          }),
        ).rejects.toMatchObject({
          id: 'AGENT_NETWORK_OBSERVATIONAL_MEMORY_UNSUPPORTED',
          domain: 'AGENT_NETWORK',
          category: 'USER',
        } satisfies Partial<MastraError>);
      });

      it('runs when the call disables observational memory configured on the agent', async () => {
        const llm = getMock();
        const network = new Agent({
          id: 'om-disabled',
          name: 'om-disabled',
          instructions: 'Route.',
          model: scenarioModel(llm),
          memory: new MockMemory({ options: { observationalMemory: true } }),
        });
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('none', 'none', ''));
        llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Done'));

        const stream = await forEngine(network, engine).network('Do something', {
          memory: { thread: 'om-t3', resource: 'om-r3', options: { observationalMemory: false } },
        });
        const chunks = await drain(stream);

        const finish = chunks.find(c => c.type === 'network-execution-event-finish');
        expect(finish?.payload).toMatchObject({ isComplete: true, result: 'Done' });
      });
    });

    describe('router answers directly', () => {
      it('streams the completion answer as routing-agent text when no primitive is picked', async () => {
        const llm = getMock();
        const network = new Agent({
          id: 'self-handle',
          name: 'self-handle',
          instructions: 'Answer questions directly.',
          model: scenarioModel(llm),
          memory: new MockMemory(),
        });
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('none', 'none', ''));
        llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('I am a helpful assistant.'));

        const chunks = await drain(
          await forEngine(network, engine).network('Who are you?', {
            memory: { thread: 'self-t1', resource: 'self-r1' },
          }),
        );

        const end = chunks.find(c => c.type === 'routing-agent-end');
        expect(end?.payload).toMatchObject({ primitiveId: 'none', primitiveType: 'none' });
        const text = chunks
          .filter(c => c.type === 'routing-agent-text-delta')
          .map(c => (c.payload as { text?: string }).text ?? '')
          .join('');
        expect(text).toBe('I am a helpful assistant.');
      });

      it('keeps the selection reason out of the streamed text', async () => {
        const llm = getMock();
        const reason = 'Simple question, no sub-agent needed.';
        const network = new Agent({
          id: 'no-reason-text',
          name: 'no-reason-text',
          instructions: 'Answer questions directly.',
          model: scenarioModel(llm),
          memory: new MockMemory(),
        });
        llm.on(
          { endpoint: 'chat', predicate: isRoutingRequest },
          {
            content: JSON.stringify({
              primitiveId: 'none',
              primitiveType: 'none',
              prompt: '',
              selectionReason: reason,
            }),
          },
        );
        llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('The answer is 42.'));

        const chunks = await drain(
          await forEngine(network, engine).network('What is the answer?', {
            memory: { thread: 'self-t2', resource: 'self-r2' },
          }),
        );

        const end = chunks.find(c => c.type === 'routing-agent-end');
        expect(end?.payload).toMatchObject({ primitiveId: 'none', selectionReason: reason });
        const text = chunks
          .filter(c => c.type === 'routing-agent-text-delta')
          .map(c => (c.payload as { text?: string }).text ?? '')
          .join('');
        expect(text).toBe('The answer is 42.');
      });
    });

    it('fails the run with a descriptive error when the router output does not parse', async () => {
      const llm = getMock();
      const network = new Agent({
        id: 'bad-router',
        name: 'bad-router',
        instructions: 'Route.',
        model: scenarioModel(llm),
        memory: new MockMemory(),
      });
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        { content: 'Some invalid response that did not parse' },
      );

      const stream = await forEngine(network, engine).network('Do something', {
        memory: { thread: 'bad-t', resource: 'bad-r' },
      });
      const chunks = await drain(stream).catch(() => []);
      const result: any = await stream.result;

      expect(chunks.map(c => c.type)).toEqual(['routing-agent-start']);
      expect(result.status).toBe('failed');
      expect(result.error.code).toBe('STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED');
      expect(result.error.details.value).toBe('Some invalid response that did not parse');
      // One native structured-output attempt, then the json-prompt-injection retry from tryGenerateWithJsonFallback.
      const routingRequests = llm.getRequests().filter(r => isRoutingRequest(r.body));
      expect(routingRequests).toHaveLength(2);
      expect(routingRequests[0]?.body?.messages[0]?.content).not.toContain('JSON schema:');
      expect(routingRequests[1]?.body?.messages[0]?.content).toContain('JSON schema:');
    });

    it('gives a network tool its toolCallId, threadId and resourceId', async () => {
      const llm = getMock();
      const seen: Array<{ input: unknown; agent: unknown }> = [];
      const tool = createTool({
        id: 'context-check-tool',
        description: 'Checks context',
        inputSchema: z.object({ message: z.string() }),
        execute: async (input, context) => {
          seen.push({ input, agent: context?.agent });
          return { result: 'context captured' };
        },
      });
      const network = new Agent({
        id: 'tool-context',
        name: 'tool-context',
        instructions: 'Use the tool.',
        model: scenarioModel(llm),
        tools: { tool },
        memory: new MockMemory(),
      });
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('tool', 'tool', JSON.stringify({ message: 'validate context' })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('ok'));

      await drain(
        await forEngine(network, engine).network('Validate context', {
          memory: { thread: 'ctx-thread', resource: 'ctx-res' },
        }),
      );

      expect(seen).toEqual([
        {
          input: { message: 'validate context' },
          agent: expect.objectContaining({
            toolCallId: expect.any(String),
            threadId: 'ctx-thread',
            resourceId: 'ctx-res',
          }),
        },
      ]);
    });

    it('keeps tool calls in the saved agent result messages without a redundant toolCalls copy', async () => {
      const llm = getMock();
      const memory = new MockMemory();
      const testTool = createTool({
        id: 'test-tool',
        description: 'Processes a query',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => ({ result: `Processed: ${query}` }),
      });
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Processes things',
        instructions: 'SUBAGENT_MARK',
        model: scenarioModel(llm),
        tools: { 'test-tool': testTool },
      });
      const network = new Agent({
        id: 'token-efficiency',
        name: 'token-efficiency',
        instructions: 'Delegate.',
        model: scenarioModel(llm),
        agents: { subAgent },
        memory,
      });
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('subAgent', 'agent', 'process hello world'));
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => isAgentRequest('SUBAGENT_MARK')(req) && req.messages.at(-1)?.role !== 'tool',
        },
        { toolCalls: [{ id: 'call-1', name: 'test-tool', arguments: { query: 'hello world' } }] },
      );
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => isAgentRequest('SUBAGENT_MARK')(req) && req.messages.at(-1)?.role === 'tool',
        },
        { content: 'Processed it.' },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete(''));

      await drain(
        await forEngine(network, engine).network('Process hello world', {
          memory: { thread: 'eff-t', resource: 'eff-r' },
        }),
      );

      const { messages } = await memory.recall({ threadId: 'eff-t', resourceId: 'eff-r' });
      const agentResult = messages
        .map(m => {
          const part = m.content.parts?.[0];
          return part?.type === 'text' ? part.text : '';
        })
        .filter(text => text.includes('"isNetwork":true') && text.includes('"primitiveType":"agent"'))
        .map(text => JSON.parse(text));
      expect(agentResult).toHaveLength(1);
      expect(agentResult[0].finalResult).not.toHaveProperty('toolCalls');
      const types = (agentResult[0].finalResult.messages as Array<{ type: string }>).map(m => m.type);
      expect(types).toEqual(expect.arrayContaining(['tool-call', 'tool-result']));
    });

    it('replaces the raw sub-agent answer with the synthesized final result when scorers pass', async () => {
      const llm = getMock();
      const subAgent = new Agent({
        id: 'research',
        name: 'research',
        description: 'Researches topics',
        instructions: 'RESEARCH_MARK',
        model: scenarioModel(llm),
      });
      const network = new Agent({
        id: 'reformat',
        name: 'reformat',
        instructions: 'Orchestrate research.',
        model: scenarioModel(llm),
        agents: { research: subAgent },
        memory: new MockMemory(),
      });
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research dolphins'));
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: 'RAW: dolphin notes' });
      llm.on(
        { endpoint: 'chat', predicate: isFinalResultRequest },
        { content: JSON.stringify({ finalResult: 'REFORMATTED: dolphins are marine mammals.' }) },
      );

      const chunks = await drain(
        await forEngine(network, engine).network('Tell me about dolphins', {
          completion: { scorers: [fixedScorer('always-pass', 1)] },
          memory: { thread: 'ref-t', resource: 'ref-r' },
        }),
      );

      const finish = chunks.find(c => c.type === 'network-execution-event-finish');
      expect((finish?.payload as { result: string }).result).toBe('REFORMATTED: dolphins are marine mammals.');
    });
  },
  NETWORK_ENGINE_SKIP,
);
