import type { IncomingMessage, ServerResponse } from 'node:http';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v6';
import { createOpenAI } from '@ai-sdk/openai-v6';
import type { Mountable } from '@copilotkit/aimock';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * Serves one scripted SSE body per request on a mounted path. AIMock's own
 * fixtures cannot express provider-native content (Gemini grounding/inlineData,
 * OpenAI Responses reasoning items interleaved with text), which is what the
 * ported AI SDK v6 stream suites asserted. The real v6 provider still parses
 * the wire format, so the loop sees genuine V3 stream parts.
 */
export class ScriptedSSE implements Mountable {
  responses: unknown[][] = [];
  requests: any[] = [];

  constructor(private readonly pathSuffix: string) {}

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    if (req.method !== 'POST' || !pathname.endsWith(this.pathSuffix)) return false;
    let body = '';
    for await (const chunk of req) body += chunk;
    this.requests.push(JSON.parse(body));
    const events = this.responses.shift();
    if (!events) throw new Error(`No scripted response left for request ${this.requests.length}`);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''));
    return true;
  }
}

/**
 * Starts an LLMock with scripted Gemini (`/gemini`) and OpenAI Responses
 * (`/openai`) endpoints for the enclosing describe block.
 */
export function useScriptedProviders() {
  const gemini = new ScriptedSSE(':streamGenerateContent');
  const openai = new ScriptedSSE('/responses');
  const llm = new LLMock({ port: 0 }).mount('/gemini', gemini).mount('/openai', openai);

  beforeAll(async () => {
    await llm.start();
  });
  afterEach(() => {
    gemini.responses = [];
    gemini.requests = [];
    openai.responses = [];
    openai.requests = [];
  });
  afterAll(async () => {
    await llm.stop();
  });

  return {
    llm,
    gemini,
    openai,
    geminiModel: () =>
      createGoogleGenerativeAI({ apiKey: 'aimock', baseURL: `${llm.url}/gemini/v1beta` })('gemini-2.5-flash'),
    openaiModel: () => createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url}/openai` }).responses('gpt-5'),
  };
}

export const geminiUsage = { promptTokenCount: 3, candidatesTokenCount: 10, totalTokenCount: 13 };

export function geminiChunk(parts: unknown[], extra: Record<string, unknown> = {}) {
  return { candidates: [{ content: { role: 'model', parts }, index: 0, ...extra }] };
}

export function geminiFinal(parts: unknown[], extra: Record<string, unknown> = {}) {
  return { ...geminiChunk(parts, { finishReason: 'STOP', ...extra }), usageMetadata: geminiUsage };
}
