import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
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
  requestText,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * agent.network() finalResult handling: when a synthesized final result is
 * saved, streamed, and reported in the finish event, and when the primitive's
 * own result is kept instead.
 */
describeForAllEngines(
  'AIMock network scenario: final result',
  engine => {
    const getMock = useLoopScenarioAimock();

    function buildNetwork(id: string, memory = new MockMemory()) {
      const llm = getMock();
      const research = new Agent({
        id: 'research',
        name: 'research',
        description: 'Researches topics',
        instructions: 'RESEARCH_MARK',
        model: scenarioModel(llm),
      });
      const network = new Agent({
        id,
        name: id,
        instructions: 'Orchestrate research.',
        model: scenarioModel(llm),
        agents: { research },
        memory,
      });
      return { llm, network, memory };
    }

    /** Plain-text assistant messages: the standalone finalResult, not network bookkeeping JSON. */
    async function standaloneTexts(memory: MockMemory, threadId: string, resourceId: string) {
      const { messages } = await memory.recall({ threadId, resourceId });
      return messages
        .filter(m => m.role === 'assistant')
        .map(m => {
          const part = m.content.parts?.[0];
          return part?.type === 'text' ? part.text : '';
        })
        .filter(text => text && !text.includes('"isNetwork"') && !text.includes('Completion Check Results'));
    }

    const finishResult = (chunks: Array<{ type: string; payload?: unknown }>) =>
      (chunks.find(c => c.type === 'network-execution-event-finish')?.payload as { result: string } | undefined)
        ?.result;

    const streamedText = (chunks: Array<{ type: string; payload?: unknown }>) =>
      chunks
        .filter(c => c.type === 'routing-agent-text-delta')
        .map(c => (c.payload as { text?: string }).text ?? '')
        .join('');

    describe('scorer-driven completion', () => {
      it('condenses a verbose primitive result: saves, streams and reports the generated final result', async () => {
        const verbose = `OLD_PRIMITIVE_RESULT ${'Detailed technical finding. '.repeat(40)}END_OF_FINDINGS`;
        const { llm, network, memory } = buildNetwork('scorer-final');
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research dolphins'));
        llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: verbose });
        llm.on(
          { endpoint: 'chat', predicate: isFinalResultRequest },
          { content: JSON.stringify({ finalResult: 'GENERATED_FINAL_RESULT synthesized response' }) },
        );

        const chunks = await drain(
          await forEngine(network, engine).network('Tell me about dolphins', {
            completion: { scorers: [fixedScorer('pass', 1)] },
            memory: { thread: 'sf-t', resource: 'sf-r' },
          }),
        );

        expect(finishResult(chunks)).toBe('GENERATED_FINAL_RESULT synthesized response');
        expect(streamedText(chunks)).toContain('GENERATED_FINAL_RESULT synthesized response');
        expect(await standaloneTexts(memory, 'sf-t', 'sf-r')).toEqual(['GENERATED_FINAL_RESULT synthesized response']);
        expect(streamedText(chunks)).not.toContain('Detailed technical finding');
        const finalResultRequests = llm.getRequests().filter(r => isFinalResultRequest(r.body));
        expect(finalResultRequests).toHaveLength(1);
        expect(requestText(finalResultRequests[0]!.body)).toContain(verbose);
      });

      async function runWithFinalResult(id: string, finalResult: string) {
        const { llm, network, memory } = buildNetwork(id);
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research'));
        llm.on(
          { endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') },
          { content: 'ORIGINAL_PRIMITIVE_RESULT' },
        );
        llm.on({ endpoint: 'chat', predicate: isFinalResultRequest }, { content: JSON.stringify({ finalResult }) });
        const chunks = await drain(
          await forEngine(network, engine).network('Research', {
            completion: { scorers: [fixedScorer('pass', 1)] },
            memory: { thread: `${id}-t`, resource: `${id}-r` },
          }),
        );
        return { chunks, saved: await standaloneTexts(memory, `${id}-t`, `${id}-r`) };
      }

      it('keeps the primitive result when the final-result call returns an empty finalResult', async () => {
        const { chunks, saved } = await runWithFinalResult('empty-final', '');
        expect(finishResult(chunks)).toBe('ORIGINAL_PRIMITIVE_RESULT');
        expect(saved).toEqual([]);
      });

      // #27611: whitespace-only finalResult is truthy, so it replaces the primitive result and is saved.
      it.fails('treats a whitespace-only finalResult as omitted', async () => {
        const { chunks, saved } = await runWithFinalResult('ws-final', '   \n  ');
        expect(saved).toEqual([]);
        expect(finishResult(chunks)).toBe('ORIGINAL_PRIMITIVE_RESULT');
      });

      it('saves the final result only after a failed iteration is retried and passes', async () => {
        let calls = 0;
        const scorer = fixedScorer('flaky', () => (++calls === 1 ? 0 : 1));
        const { llm, network, memory } = buildNetwork('retry-final');
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research'));
        llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: 'partial notes' });
        llm.on(
          { endpoint: 'chat', predicate: isFinalResultRequest },
          { content: JSON.stringify({ finalResult: 'RETRY_FINAL_RESULT' }) },
        );

        const chunks = await drain(
          await forEngine(network, engine).network('Research', {
            completion: { scorers: [scorer] },
            maxSteps: 5,
            memory: { thread: 'rf-t', resource: 'rf-r' },
          }),
        );

        expect(scorer.runs).toHaveLength(2);
        expect(llm.getRequests().filter(r => isFinalResultRequest(r.body))).toHaveLength(1);
        expect(finishResult(chunks)).toBe('RETRY_FINAL_RESULT');
        expect(await standaloneTexts(memory, 'rf-t', 'rf-r')).toEqual(['RETRY_FINAL_RESULT']);
      });

      // #27612: generateFinalResult runs without thread memory, so only the latest primitive result reaches it.
      it.fails('sends the history from every iteration to the final-result call', async () => {
        let calls = 0;
        const scorer = fixedScorer('second-pass', () => (++calls === 1 ? 0 : 1));
        const { llm, network } = buildNetwork('history-final');
        let routed = 0;
        llm.on(
          { endpoint: 'chat', predicate: req => isRoutingRequest(req) && routed++ === 0 },
          routeTo('research', 'agent', 'Find step one'),
        );
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Find step two'));
        llm.on(
          {
            endpoint: 'chat',
            predicate: req =>
              isAgentRequest('RESEARCH_MARK')(req) &&
              requestText(req).includes('Find step one') &&
              !requestText(req).includes('Find step two'),
          },
          { content: 'ITERATION_ONE_FACT' },
        );
        llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: 'ITERATION_TWO_FACT' });
        llm.on(
          { endpoint: 'chat', predicate: isFinalResultRequest },
          { content: JSON.stringify({ finalResult: 'MULTI_ITERATION_SYNTHESIS of 2 iterations' }) },
        );

        const chunks = await drain(
          await forEngine(network, engine).network('Two step research', {
            completion: { scorers: [scorer] },
            maxSteps: 5,
            memory: { thread: 'hf-t', resource: 'hf-r' },
          }),
        );

        const finalRequests = llm.getRequests().filter(r => isFinalResultRequest(r.body));
        expect(finalRequests).toHaveLength(1);
        const finalPrompt = requestText(finalRequests[0]!.body);
        expect(finalPrompt).toContain('ITERATION_TWO_FACT');
        expect(finishResult(chunks)).toBe('MULTI_ITERATION_SYNTHESIS of 2 iterations');
        expect(finalPrompt).toContain('ITERATION_ONE_FACT');
      });

      it('turns structured tool output into the readable final result', async () => {
        const llm = getMock();
        const dataTool = createTool({
          id: 'data-tool',
          description: 'Returns items',
          inputSchema: z.object({}),
          execute: async () => ({ items: [{ id: 1 }, { id: 2 }, { id: 3 }], status: 'ok' }),
        });
        const network = new Agent({
          id: 'structured-tool-final',
          name: 'structured-tool-final',
          instructions: 'Use tools.',
          model: scenarioModel(llm),
          tools: { dataTool },
          memory: new MockMemory(),
        });
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('dataTool', 'tool', '{}'));
        llm.on(
          { endpoint: 'chat', predicate: isFinalResultRequest },
          { content: JSON.stringify({ finalResult: 'HUMAN_READABLE: found 3 items' }) },
        );

        const chunks = await drain(
          await forEngine(network, engine).network('List the items', {
            completion: { scorers: [fixedScorer('pass', 1)] },
            memory: { thread: 'st-t', resource: 'st-r' },
          }),
        );

        const finalRequests = llm.getRequests().filter(r => isFinalResultRequest(r.body));
        expect(requestText(finalRequests[0]!.body)).toContain('"items"');
        expect(finishResult(chunks)).toBe('HUMAN_READABLE: found 3 items');
      });
    });

    describe('default completion check', () => {
      it('saves, streams and reports the finalResult returned by the completion check', async () => {
        const { llm, network, memory } = buildNetwork('default-final');
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research'));
        llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: 'OLD_PRIMITIVE_RESULT' });
        llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('DEFAULT_CHECK_FINAL_RESULT'));

        const chunks = await drain(
          await forEngine(network, engine).network('Research', { memory: { thread: 'df-t', resource: 'df-r' } }),
        );

        expect(finishResult(chunks)).toBe('DEFAULT_CHECK_FINAL_RESULT');
        expect(streamedText(chunks)).toContain('DEFAULT_CHECK_FINAL_RESULT');
        expect(await standaloneTexts(memory, 'df-t', 'df-r')).toEqual(['DEFAULT_CHECK_FINAL_RESULT']);
      });

      it('keeps the primitive result and saves nothing extra when the check omits finalResult', async () => {
        const { llm, network, memory } = buildNetwork('default-omit');
        llm.on(
          { endpoint: 'chat', predicate: isRoutingRequest },
          routeTo('research', 'agent', 'What is the capital of France?'),
        );
        llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: 'DIRECT_ANSWER: Paris' });
        llm.on(
          { endpoint: 'chat', predicate: isCompletionRequest },
          { content: JSON.stringify({ isComplete: true, completionReason: 'answered' }) },
        );

        const chunks = await drain(
          await forEngine(network, engine).network('What is the capital of France?', {
            memory: { thread: 'do-t', resource: 'do-r' },
          }),
        );

        expect(finishResult(chunks)).toBe('DIRECT_ANSWER: Paris');
        expect(await standaloneTexts(memory, 'do-t', 'do-r')).toEqual([]);
      });

      it('ignores finalResult from a check that says the task is not complete', async () => {
        const { llm, network, memory } = buildNetwork('default-incomplete');
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research'));
        llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: 'notes' });
        llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('SHOULD_BE_IGNORED', false));

        const chunks = await drain(
          await forEngine(network, engine).network('Research', {
            maxSteps: 1,
            memory: { thread: 'di-t', resource: 'di-r' },
          }),
        );

        expect(String(finishResult(chunks))).not.toContain('SHOULD_BE_IGNORED');
        expect(streamedText(chunks)).not.toContain('SHOULD_BE_IGNORED');
        expect(await standaloneTexts(memory, 'di-t', 'di-r')).toEqual([]);
      });

      it('treats a completion check the provider rejects as not complete', async () => {
        const { llm, network, memory } = buildNetwork('default-error');
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research'));
        llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: 'notes' });
        llm.on(
          { endpoint: 'chat', predicate: isCompletionRequest },
          { error: { message: 'Completion provider failure', type: 'invalid_request_error' }, status: 400 },
        );

        const chunks = await drain(
          await forEngine(network, engine).network('Research', {
            maxSteps: 1,
            memory: { thread: 'de-t', resource: 'de-r' },
          }),
        );

        const validationEnds = chunks.filter(c => c.type === 'network-validation-end');
        expect(validationEnds.map(c => c.payload.passed)).toEqual([false, false]);
        expect(validationEnds[0]!.payload.results[0]).toMatchObject({
          scorerId: 'default-completion',
          passed: false,
          reason: expect.stringContaining('LLM completion check failed: Completion provider failure'),
        });
        expect(await standaloneTexts(memory, 'de-t', 'de-r')).toEqual([]);
      });
    });

    describe('failures while producing the final result', () => {
      it('fails the run with the memory error when saving the final result fails, after streaming it', async () => {
        const memory = new MockMemory();
        const original = memory.saveMessages.bind(memory);
        memory.saveMessages = async params => {
          const isFinal = params.messages.some(m => {
            const part = m.content.parts?.[0];
            return part?.type === 'text' && part.text === 'FINAL_SAVE_FAILS';
          });
          if (isFinal) throw new Error('Simulated memory save failure');
          return original(params);
        };
        const { llm, network } = buildNetwork('save-fail', memory);
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('none', 'none', ''));
        llm.on(
          { endpoint: 'chat', predicate: isFinalResultRequest },
          { content: JSON.stringify({ finalResult: 'FINAL_SAVE_FAILS' }) },
        );

        const stream = await forEngine(network, engine).network('Do it', {
          completion: { scorers: [fixedScorer('pass', 1)] },
          memory: { thread: 'sv-t', resource: 'sv-r' },
        });
        const chunks = await drain(stream);
        const result = (await stream.result) as { status: string; error?: { message: string } };

        expect(streamedText(chunks)).toBe('FINAL_SAVE_FAILS');
        expect(chunks.some(c => c.type === 'network-execution-event-finish')).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.error?.message).toBe('Simulated memory save failure');
      });

      it('fails the run with a validation error when the final-result output is not JSON', async () => {
        const { llm, network } = buildNetwork('bad-final-json');
        llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research'));
        llm.on({ endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') }, { content: 'PRIMITIVE_NOTES' });
        llm.on({ endpoint: 'chat', predicate: isFinalResultRequest }, { content: 'not json {{{' });

        const stream = await forEngine(network, engine).network('Research', {
          completion: { scorers: [fixedScorer('pass', 1)] },
          memory: { thread: 'bj-t', resource: 'bj-r' },
        });
        const chunks = await drain(stream);
        const result = (await stream.result) as { status: string; error?: { code?: string } };

        expect(chunks.some(c => c.type === 'network-execution-event-finish')).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.error?.code).toBe('STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED');
        expect(llm.getRequests().filter(r => isFinalResultRequest(r.body))).toHaveLength(1);
      });
    });
  },
  NETWORK_ENGINE_SKIP,
);
