import type { IncomingMessage, ServerResponse } from 'node:http';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import type { Mountable } from '@copilotkit/aimock';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';

/**
 * Regression for #27231: Gemini 3 signs only the first function call of a
 * parallel step. When that call is `updateWorkingMemory`, persistence strips
 * it, and the stored step must mark the next surviving call with Google's
 * documented `skip_thought_signature_validator` signature. Otherwise providers
 * that do not add it themselves (`@ai-sdk/google` before 3.0.80, or other
 * Gemini clients) replay the step unsigned, and a same-turn replay is rejected
 * with "Function call is missing a thought_signature". The real signature is
 * bound to the removed call, so it must not be moved onto another call.
 *
 * AIMock's built-in Gemini fixtures cannot put a `thoughtSignature` on a
 * `functionCall` part, so the Gemini endpoint is served by a scripted handler
 * mounted on the AIMock server.
 */

type GeminiPart = Record<string, unknown>;
type GeminiRequest = { contents: { role: string; parts: GeminiPart[] }[] };

class ScriptedGemini implements Mountable {
  responses: GeminiPart[][] = [];
  requests: GeminiRequest[] = [];

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    if (req.method !== 'POST' || !pathname.endsWith(':streamGenerateContent')) return false;
    let body = '';
    for await (const chunk of req) body += chunk;
    this.requests.push(JSON.parse(body));
    const parts = this.responses.shift();
    if (!parts) throw new Error(`No scripted Gemini response left for request ${this.requests.length}`);
    const chunk = {
      candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP', index: 0 }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(`data: ${JSON.stringify(chunk)}\n\n`);
    return true;
  }
}

const storedMemory = '# User Profile\n- **City**: Paris\n';
const wmCall = { functionCall: { name: 'updateWorkingMemory', args: { memory: storedMemory } } };
const SKIP_SIGNATURE = 'skip_thought_signature_validator';
const weatherCall = { functionCall: { name: 'lookupWeather', args: { city: 'Paris' } } };

describe('AIMock scenario: Gemini thought signature on parallel updateWorkingMemory calls (#27231)', () => {
  const gemini = new ScriptedGemini();
  const llm = new LLMock({ port: 0 }).mount('/gemini', gemini);

  beforeAll(async () => {
    await llm.start();
  });

  afterEach(() => {
    gemini.responses = [];
    gemini.requests = [];
  });

  afterAll(async () => {
    await llm.stop();
  });

  /**
   * Turn 1 replies with `firstStep`, then text. Turn 2 is a new prompt on the
   * same thread, so its request replays turn 1 from storage. Returns the
   * stored function-call metadata and the function-call parts Gemini receives
   * in that replay.
   */
  async function replayedFunctionCalls(firstStep: GeminiPart[]) {
    const memory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: '# User Profile\n- **City**:\n',
    });
    const threadId = 'gemini-wm-thread';
    const resourceId = 'gemini-wm-resource';
    const google = createGoogleGenerativeAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/gemini/v1beta` });
    const lookupWeather = createTool({
      id: 'lookupWeather',
      description: 'Look up the weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ forecast: 'sunny' }),
    });
    const agent = new Agent({
      id: 'gemini-wm-agent',
      name: 'Gemini WM Agent',
      instructions: 'Remember facts about the user and answer weather questions.',
      model: google('gemini-3-pro-preview'),
      tools: { lookupWeather },
      memory,
    });

    gemini.responses = [firstStep, [{ text: 'It is sunny in Paris.' }], [{ text: 'You live in Paris.' }]];

    const turn1 = await agent.stream('I live in Paris. What is the weather?', {
      memory: { thread: threadId, resource: resourceId },
    });
    await turn1.consumeStream();
    const turn2 = await agent.stream('Where do I live?', { memory: { thread: threadId, resource: resourceId } });
    await turn2.consumeStream();

    expect(gemini.requests).toHaveLength(3);
    expect(await memory.getWorkingMemory({ threadId, resourceId })).toContain('Paris');

    const { messages } = await memory.recall({ threadId, resourceId });
    const stored = messages
      .flatMap(message => message.content.parts)
      .filter(part => part.type === 'tool-invocation')
      .map(part => ({ toolName: part.toolInvocation.toolName, google: part.providerMetadata?.google }));
    const replayed = gemini.requests[2]!.contents.filter(content => content.role === 'model')
      .flatMap(content => content.parts)
      .filter(part => 'functionCall' in part || 'thoughtSignature' in part);
    return { stored, replayed };
  }

  it('stores and replays the surviving parallel call with the skip-validator signature', async () => {
    const { stored, replayed } = await replayedFunctionCalls([
      { ...wmCall, thoughtSignature: 'SIG_PARALLEL_STEP' },
      weatherCall,
    ]);

    expect(stored).toEqual([
      { toolName: 'lookupWeather', google: expect.objectContaining({ thoughtSignature: SKIP_SIGNATURE }) },
    ]);
    expect(replayed).toEqual([
      {
        functionCall: expect.objectContaining({ name: 'lookupWeather', args: { city: 'Paris' } }),
        thoughtSignature: SKIP_SIGNATURE,
      },
    ]);
    expect(JSON.stringify(gemini.requests[2])).not.toContain('SIG_PARALLEL_STEP');
  });

  it('keeps the signature a surviving call already has', async () => {
    const { stored, replayed } = await replayedFunctionCalls([
      { ...wmCall, thoughtSignature: 'SIG_WM' },
      { ...weatherCall, thoughtSignature: 'SIG_WEATHER' },
    ]);

    expect(stored).toEqual([
      { toolName: 'lookupWeather', google: expect.objectContaining({ thoughtSignature: 'SIG_WEATHER' }) },
    ]);
    expect(replayed).toEqual([
      { functionCall: expect.objectContaining({ name: 'lookupWeather' }), thoughtSignature: 'SIG_WEATHER' },
    ]);
  });

  it('replays nothing from a step whose only call was updateWorkingMemory', async () => {
    const { stored, replayed } = await replayedFunctionCalls([{ ...wmCall, thoughtSignature: 'SIG_WM_ONLY' }]);

    expect(stored).toEqual([]);
    expect(replayed).toEqual([]);
    expect(JSON.stringify(gemini.requests[2])).not.toContain('SIG_WM_ONLY');
  });
});
