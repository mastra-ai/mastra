import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  complete,
  drain,
  fixedScorer,
  isAgentRequest,
  isCompletionRequest,
  isStructuredResultRequest,
  isRoutingRequest,
  requestText,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * agent.network() structured output: the typed object a network returns when
 * `structuredOutput.schema` is set, on both completion paths.
 */
describeForAllEngines(
  'AIMock network scenario: structured output',
  engine => {
    const getMock = useLoopScenarioAimock();

    const resultSchema = z.object({
      summary: z.string(),
      recommendations: z.array(z.string()),
      confidence: z.number(),
    });
    const structuredResult = {
      summary: 'Analysis complete',
      recommendations: ['Use caching', 'Add indexes'],
      confidence: 0.95,
    };

    function buildNetwork(id: string) {
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
        instructions: 'Orchestrate.',
        model: scenarioModel(llm),
        agents: { research },
        memory: new MockMemory(),
      });
      return { llm, network };
    }

    function answerDirectly(llm: ReturnType<typeof getMock>, object: unknown) {
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('none', 'none', ''));
      llm.on({ endpoint: 'chat', predicate: isStructuredResultRequest }, { content: JSON.stringify(object) });
    }

    const pass = () => ({ scorers: [fixedScorer('pass', 1)] });

    it('returns the typed object through .object, the object-result chunk and the finish payload', async () => {
      const { llm, network } = buildNetwork('typed-object');
      answerDirectly(llm, structuredResult);

      const stream = await forEngine(network, engine).network('Analyze this', {
        completion: pass(),
        structuredOutput: { schema: resultSchema },
        memory: { thread: 'to-t', resource: 'to-r' },
      });
      const chunks = await drain(stream);

      await expect(stream.object).resolves.toEqual(structuredResult);
      const objectResult = chunks.find(c => c.type === 'network-object-result');
      expect((objectResult?.payload as { object: unknown }).object).toEqual(structuredResult);
      const finish = chunks.find(c => c.type === 'network-execution-event-finish');
      expect((finish?.payload as { object: unknown }).object).toEqual(structuredResult);
      const structuredRequests = llm.getRequests().filter(r => isStructuredResultRequest(r.body));
      expect(structuredRequests).toHaveLength(1);
      // The schema travels in response_format, not in the prompt text.
      expect(requestText(structuredRequests[0]!.body)).toContain('Original task: Analyze this');
    });

    it('streams partial objects that build up to the final object', async () => {
      const { llm, network } = buildNetwork('partial-objects');
      answerDirectly(llm, structuredResult);

      const stream = await forEngine(network, engine).network('Stream test', {
        completion: pass(),
        structuredOutput: { schema: resultSchema },
        memory: { thread: 'po-t', resource: 'po-r' },
      });
      const partials: unknown[] = [];
      const reader = stream.objectStream.getReader();
      const chunksPromise = drain(stream);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        partials.push(value);
      }
      const chunks = await chunksPromise;

      expect(partials.length).toBeGreaterThan(1);
      expect(partials[0]).not.toEqual(structuredResult);
      expect(partials.at(-1)).toEqual(structuredResult);
      const objectChunks = chunks.filter(c => c.type === 'network-object');
      expect(objectChunks.length).toBeGreaterThan(1);
      expect((objectChunks[0]!.payload as { object: unknown }).object).not.toEqual(structuredResult);
      expect((objectChunks.at(-1)?.payload as { object: unknown }).object).toEqual(structuredResult);
    });

    it('resolves .object when awaited before the stream is consumed', async () => {
      const { llm, network } = buildNetwork('early-await');
      answerDirectly(llm, structuredResult);

      const stream = await forEngine(network, engine).network('Test', {
        completion: pass(),
        structuredOutput: { schema: resultSchema },
        memory: { thread: 'ea-t', resource: 'ea-r' },
      });

      await expect(stream.object).resolves.toEqual(structuredResult);
    });

    it('generates the object from the sub-agent result once the sub-agent finishes', async () => {
      const { llm, network } = buildNetwork('after-subagent');
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('research', 'agent', 'Research performance'));
      llm.on(
        { endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') },
        { content: 'SUBAGENT_FINDINGS: slow queries' },
      );
      llm.on({ endpoint: 'chat', predicate: isStructuredResultRequest }, { content: JSON.stringify(structuredResult) });

      const stream = await forEngine(network, engine).network('Research and summarize', {
        completion: pass(),
        structuredOutput: { schema: resultSchema },
        memory: { thread: 'as-t', resource: 'as-r' },
      });
      const chunks = await drain(stream);

      const agentEnd = chunks.findIndex(c => c.type === 'agent-execution-end');
      const objectResult = chunks.findIndex(c => c.type === 'network-object-result');
      expect(agentEnd).toBeGreaterThanOrEqual(0);
      expect(objectResult).toBeGreaterThan(agentEnd);
      const structuredRequest = llm.getRequests().find(r => isStructuredResultRequest(r.body));
      expect(requestText(structuredRequest!.body)).toContain('SUBAGENT_FINDINGS: slow queries');
      await expect(stream.object).resolves.toEqual(structuredResult);
    });

    it('generates the object after the default completion check passes', async () => {
      const { llm, network } = buildNetwork('default-structured');
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('none', 'none', ''));
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete(''));
      llm.on({ endpoint: 'chat', predicate: isStructuredResultRequest }, { content: JSON.stringify(structuredResult) });

      const stream = await forEngine(network, engine).network('Analyze', {
        structuredOutput: { schema: resultSchema },
        memory: { thread: 'ds-t', resource: 'ds-r' },
      });
      await drain(stream);

      const bodies = llm.getRequests().map(r => r.body);
      const structuredAt = bodies.findIndex(isStructuredResultRequest);
      expect(structuredAt).toBeGreaterThan(0);
      expect(bodies.slice(0, structuredAt).filter(isCompletionRequest)).toHaveLength(1);
      await expect(stream.object).resolves.toEqual(structuredResult);
    });

    it('parses nested schemas and applies optional fields and defaults', async () => {
      const schema = z.object({
        metadata: z.object({ version: z.string() }),
        results: z.array(z.object({ id: z.number(), data: z.object({ tags: z.array(z.string()) }) })),
        status: z.enum(['success', 'failure']),
        optional: z.string().optional(),
        withDefault: z.number().default(5),
      });
      const { llm, network } = buildNetwork('nested-schema');
      answerDirectly(llm, {
        metadata: { version: '1.0' },
        results: [
          { id: 1, data: { tags: ['important', 'urgent'] } },
          { id: 2, data: { tags: ['later'] } },
        ],
        status: 'success',
      });

      const stream = await forEngine(network, engine).network('Test nested schema', {
        completion: pass(),
        structuredOutput: { schema },
        memory: { thread: 'ns-t', resource: 'ns-r' },
      });
      await drain(stream);

      await expect(stream.object).resolves.toEqual({
        metadata: { version: '1.0' },
        results: [
          { id: 1, data: { tags: ['important', 'urgent'] } },
          { id: 2, data: { tags: ['later'] } },
        ],
        status: 'success',
        withDefault: 5,
      });
    });

    it('resolves .object to undefined and makes no structured call without structuredOutput', async () => {
      const { llm, network } = buildNetwork('no-structured');
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('none', 'none', ''));
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('plain answer'));

      const stream = await forEngine(network, engine).network('Test', {
        memory: { thread: 'nso-t', resource: 'nso-r' },
      });
      await drain(stream);

      await expect(stream.object).resolves.toBeUndefined();
      expect(llm.getRequests().filter(r => isStructuredResultRequest(r.body))).toHaveLength(0);
    });

    // #27613: generateStructuredFinalResult drops the structured call's usage, so the
    // total only covers the routing call (4/6/10).
    it.fails('adds the structured-output call usage to the network usage total', async () => {
      const { llm, network } = buildNetwork('usage');
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        { ...routeTo('none', 'none', ''), usage: { input_tokens: 4, output_tokens: 6 } },
      );
      llm.on(
        { endpoint: 'chat', predicate: isStructuredResultRequest },
        { content: JSON.stringify(structuredResult), usage: { input_tokens: 7, output_tokens: 3 } },
      );

      const stream = await forEngine(network, engine).network('Test usage', {
        completion: pass(),
        structuredOutput: { schema: resultSchema },
        memory: { thread: 'us-t', resource: 'us-r' },
      });
      await drain(stream);

      await expect(stream.usage).resolves.toMatchObject({ inputTokens: 11, outputTokens: 9, totalTokens: 20 });
    });
  },
  NETWORK_ENGINE_SKIP,
);
