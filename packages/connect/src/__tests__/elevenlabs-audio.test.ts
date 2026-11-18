import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import type { speechToTextInputSchema, speechToTextTool } from '../providers/elevenlabs/tools/speech-to-text.js';
import { tools } from '../tools.js';

// The ElevenLabs text-to-speech and speech-to-text tools are hand-written (the
// upstream templates have no audio actions). Both move binary audio through
// the platform proxy: text-to-speech downloads it, speech-to-text uploads it in
// a multipart form. These tests run the tools through the public `tools()`
// resolver against a real HTTP server standing in for the Mastra platform, and
// check what crossed the wire in each direction.

interface RecordedRequest {
  method: string | undefined;
  path: string;
  query: URLSearchParams;
  contentType: string | undefined;
  body: Buffer;
}

const connection = {
  id: 'el_test',
  integrationId: 'elevenlabs',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'test',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'elevenlabs',
  provider: 'elevenlabs',
  displayName: 'ElevenLabs',
  logoUrl: '',
  authType: 'API_KEY',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

// An MP3 frame header followed by bytes that would break a text-based
// encoder: CRLF, a line starting with "--", NUL, and invalid UTF-8.
const audioBytes = Buffer.from([
  0xff, 0xfb, 0x90, 0x64, 0x0d, 0x0a, 0x2d, 0x2d, 0x00, 0xc3, 0x28, 0xfe, 0x0d, 0x0a, 0x0d, 0x0a, 0x7f, 0x80,
]);

const transcript = {
  language_code: 'eng',
  language_probability: 0.98,
  text: 'Hello there.',
  transcription_id: 'tr_1',
  words: [
    { text: 'Hello', start: 0, end: 0.4, type: 'word', speaker_id: 'speaker_0', logprob: -0.1 },
    { text: ' ', start: 0.4, end: 0.45, type: 'spacing', speaker_id: 'speaker_0', logprob: 0 },
    { text: 'there.', start: 0.45, end: 0.9, type: 'word', speaker_id: 'speaker_0', logprob: -0.2 },
  ],
};

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Parses a recorded multipart body with the platform's own (undici) form parser. */
async function parseForm(request: RecordedRequest): Promise<FormData> {
  return new Response(new Uint8Array(request.body), {
    headers: { 'content-type': request.contentType ?? '' },
  }).formData();
}

type Chunk = Record<string, unknown>;
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

describe('ElevenLabs audio tools through the platform proxy', () => {
  let server: Server;
  let baseUrl: string;
  let requests: RecordedRequest[];

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const body = await readBody(request);
      requests.push({
        method: request.method,
        path: url.pathname,
        query: url.searchParams,
        contentType: request.headers['content-type'],
        body,
      });
      const sendJson = (status: number, payload: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(payload));
      };
      if (url.pathname.endsWith('/connections')) return sendJson(200, { connections: [connection] });
      if (url.pathname.endsWith('/integrations')) return sendJson(200, { integrations: [integration] });
      const proxyPrefix = `/v2/connections/${connection.id}/proxy`;
      if (url.pathname === `${proxyPrefix}/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb`) {
        response.writeHead(200, { 'content-type': 'audio/mpeg', 'history-item-id': 'hist_1' });
        return response.end(audioBytes);
      }
      if (url.pathname === `${proxyPrefix}/v1/speech-to-text`) return sendJson(200, transcript);
      return sendJson(404, { error: `unexpected request ${request.method} ${url.pathname}` });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  beforeEach(() => {
    requests = [];
  });

  const proxied = () => requests.filter(request => request.path.includes('/proxy/'));

  async function resolveTools() {
    return tools({
      providers: ['elevenlabs'],
      allowTools: ['elevenlabs_text_to_speech', 'elevenlabs_speech_to_text'],
      projectId: 'proj_test',
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
  }

  async function transcribe(input: z.input<typeof speechToTextInputSchema>) {
    // The resolver types its record loosely; narrow to the tool it registers.
    const tool = (await resolveTools()).elevenlabs_speech_to_text as ReturnType<typeof speechToTextTool> | undefined;
    if (!tool?.execute) throw new Error('elevenlabs_speech_to_text was not resolved');
    return tool.execute(input, { requestContext: new RequestContext() });
  }

  it('gives the caller the generated audio but shows the model only a summary of it', async () => {
    const calls: Array<{ prompt: unknown[] }> = [];
    const steps: Chunk[][] = [
      [
        {
          type: 'tool-call',
          toolCallId: 'call-speak',
          toolName: 'elevenlabs_text_to_speech',
          input: JSON.stringify({
            voice_id: 'JBFqnCBsd6RMkjVDRZzb',
            text: 'Your order has shipped.',
            voice_settings: { stability: 0.4 },
          }),
          providerExecuted: false,
        },
        { type: 'finish', finishReason: 'tool-calls', usage },
      ],
      [
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'Done.' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage },
      ],
    ];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        calls.push({ prompt });
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            ...(steps[calls.length - 1] ?? []),
          ]) as never,
        };
      },
    });
    const agent = new Agent({
      id: 'voice-agent',
      name: 'Voice Agent',
      instructions: 'You read messages aloud.',
      model,
      tools: await resolveTools(),
    });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const stream = await agent.stream('Read "Your order has shipped." aloud.');
    const chunks: Array<{ type: string; payload?: any }> = [];
    for await (const chunk of stream.fullStream) chunks.push(chunk as { type: string; payload?: any });

    // The caller gets the exact bytes ElevenLabs returned.
    const toolResult = chunks.find(chunk => chunk.type === 'tool-result')?.payload?.result;
    expect(toolResult).toEqual({
      audio: audioBytes.toString('base64'),
      media_type: 'audio/mpeg',
      output_format: 'mp3_44100_128',
      size_bytes: audioBytes.length,
      history_item_id: 'hist_1',
    });

    // The model's next turn sees a summary, never the base64 audio.
    expect(calls).toHaveLength(2);
    const followUp = JSON.stringify(calls[1]!.prompt);
    expect(followUp).toContain('Generated 1 KB of audio/mpeg audio (mp3_44100_128). History item: hist_1.');
    expect(followUp).not.toContain(audioBytes.toString('base64'));

    // The request that crossed the proxy is the documented convert call.
    const [request] = proxied();
    expect(request?.method).toBe('POST');
    expect(request?.query.get('output_format')).toBe('mp3_44100_128');
    expect(JSON.parse(request!.body.toString('utf8'))).toEqual({
      text: 'Your order has shipped.',
      voice_settings: { stability: 0.4 },
    });
  });

  it('uploads base64 audio as an intact multipart file', async () => {
    const result = await transcribe({
      audio: audioBytes.toString('base64'),
      audio_format: 'wav',
      language_code: 'en',
      diarize: true,
      num_speakers: 2,
      include_words: true,
    });

    expect(result).toEqual({
      text: 'Hello there.',
      language_code: 'eng',
      language_probability: 0.98,
      transcription_id: 'tr_1',
      words: [
        { text: 'Hello', start: 0, end: 0.4, type: 'word', speaker_id: 'speaker_0' },
        { text: ' ', start: 0.4, end: 0.45, type: 'spacing', speaker_id: 'speaker_0' },
        { text: 'there.', start: 0.45, end: 0.9, type: 'word', speaker_id: 'speaker_0' },
      ],
    });

    const [request] = proxied();
    const form = await parseForm(request!);
    expect(Object.fromEntries([...form.entries()].filter(([name]) => name !== 'file'))).toEqual({
      model_id: 'scribe_v2',
      language_code: 'en',
      diarize: 'true',
      num_speakers: '2',
    });
    const file = form.get('file') as File;
    expect(file.name).toBe('audio.wav');
    expect(Buffer.from(await file.arrayBuffer())).toEqual(audioBytes);
  });

  it('asks ElevenLabs to fetch a URL instead of uploading, and omits word timings unless asked', async () => {
    const result = await transcribe({ source_url: 'https://example.com/call.mp3' });

    expect(result).toEqual({
      text: 'Hello there.',
      language_code: 'eng',
      language_probability: 0.98,
      transcription_id: 'tr_1',
    });

    const form = await parseForm(proxied()[0]!);
    expect(Object.fromEntries(form.entries())).toEqual({
      model_id: 'scribe_v2',
      source_url: 'https://example.com/call.mp3',
    });
  });

  it.each([
    ['neither', {}],
    ['both', { audio: audioBytes.toString('base64'), source_url: 'https://example.com/call.mp3' }],
  ])('rejects %s of audio and source_url without calling ElevenLabs', async (_label, input) => {
    const result = await transcribe(input);

    expect(isValidationError(result)).toBe(true);
    expect(proxied()).toHaveLength(0);
  });
});
