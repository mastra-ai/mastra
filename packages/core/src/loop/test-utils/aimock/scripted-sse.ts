import type { IncomingMessage, ServerResponse } from 'node:http';
import { createAnthropic } from '@ai-sdk/anthropic-v6';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v6';
import { createOpenAI } from '@ai-sdk/openai-v6';
import type { Mountable } from '@copilotkit/aimock';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * Serves one scripted SSE body per streaming request on a mounted path, and
 * one scripted JSON body per non-streaming request (`generated`), which is
 * what the plain agent sends for `generate()`. AIMock's own
 * fixtures cannot express provider-native content (Gemini grounding/inlineData,
 * OpenAI Responses reasoning items interleaved with text), which is what the
 * ported AI SDK v6 stream suites asserted. The real v6 provider still parses
 * the wire format, so the loop sees genuine V3 stream parts.
 */
export class ScriptedSSE implements Mountable {
  responses: unknown[][] = [];
  generated: unknown[] = [];
  requests: any[] = [];
  requestHeaders: IncomingMessage['headers'][] = [];

  /**
   * `generatePathSuffix` is for providers that use a separate path for
   * non-streaming calls (Gemini); the others send `stream: true` in the body.
   */
  constructor(
    private readonly pathSuffix: string,
    private readonly generatePathSuffix?: string,
  ) {}

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    const onGeneratePath = !!this.generatePathSuffix && pathname.endsWith(this.generatePathSuffix);
    if (req.method !== 'POST' || !(pathname.endsWith(this.pathSuffix) || onGeneratePath)) return false;
    let body = '';
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    this.requests.push(parsed);
    this.requestHeaders.push(req.headers);
    if (onGeneratePath || (!this.generatePathSuffix && parsed.stream !== true)) {
      const json = this.generated.shift();
      if (!json) throw new Error(`No scripted generate response left for request ${this.requests.length}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
      return true;
    }
    const events = this.responses.shift();
    if (!events) throw new Error(`No scripted response left for request ${this.requests.length}`);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''));
    return true;
  }
}

/**
 * Starts an LLMock with scripted Gemini (`/gemini`), OpenAI Responses
 * (`/openai`) and Anthropic Messages (`/anthropic`) endpoints for the
 * enclosing describe block.
 */
export function useScriptedProviders() {
  const gemini = new ScriptedSSE(':streamGenerateContent', ':generateContent');
  const openai = new ScriptedSSE('/responses');
  const anthropic = new ScriptedSSE('/messages');
  const llm = new LLMock({ port: 0 }).mount('/gemini', gemini).mount('/openai', openai).mount('/anthropic', anthropic);

  beforeAll(async () => {
    await llm.start();
  });
  afterEach(() => {
    for (const endpoint of [gemini, openai, anthropic]) {
      endpoint.responses = [];
      endpoint.generated = [];
      endpoint.requests = [];
      endpoint.requestHeaders = [];
    }
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
  });
  afterAll(async () => {
    await llm.stop();
  });

  return {
    llm,
    gemini,
    openai,
    anthropic,
    geminiModel: () =>
      createGoogleGenerativeAI({ apiKey: 'aimock', baseURL: `${llm.url}/gemini/v1beta` })('gemini-2.5-flash'),
    openaiModel: () => createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url}/openai` }).responses('gpt-5'),
    anthropicModel: () =>
      createAnthropic({ apiKey: 'aimock', baseURL: `${llm.url}/anthropic/v1` })('claude-sonnet-4-5'),
  };
}

export const geminiUsage = { promptTokenCount: 3, candidatesTokenCount: 10, totalTokenCount: 13 };

export function geminiChunk(parts: unknown[], extra: Record<string, unknown> = {}) {
  return { candidates: [{ content: { role: 'model', parts }, index: 0, ...extra }] };
}

export function geminiFinal(parts: unknown[], extra: Record<string, unknown> = {}) {
  return { ...geminiChunk(parts, { finishReason: 'STOP', ...extra }), usageMetadata: geminiUsage };
}
