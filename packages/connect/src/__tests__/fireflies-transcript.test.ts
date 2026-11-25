import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { getTranscriptTool } from '../providers/fireflies/tools/get-transcript.js';
import { tools } from '../tools.js';

// Regression coverage for #29401: Fireflies returns `summary.keywords` as an
// array of strings and `speakers[].id` as a number, but the generated
// `fireflies_get_transcript` schema accepted only strings, so reading almost
// any real transcript threw a ZodError. The tool runs through the public
// `tools()` resolver against a real HTTP server standing in for the Mastra
// platform; only the Fireflies GraphQL payload is scripted, at the wire.

interface RecordedRequest {
  method: string | undefined;
  path: string;
  body: unknown;
}

const connection = {
  id: 'fir_test',
  integrationId: 'fireflies',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'test',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'fireflies',
  provider: 'fireflies',
  displayName: 'Fireflies',
  logoUrl: '',
  authType: 'API_KEY',
  authFields: [],
  capabilities: { proxy: true, webhooks: true, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

/** A `Transcript` query response in the shape the live Fireflies API returns it (#29401). */
function liveTranscriptResponse(overrides: { keywords: unknown; speakerIds: unknown[] }) {
  return {
    data: {
      transcript: {
        id: 'abc123',
        title: 'Weekly sync',
        sentences: [
          {
            index: 0,
            speaker_name: 'Ana',
            speaker_id: 0,
            raw_text: 'Hi',
            text: 'Hi',
            start_time: 0.5,
            end_time: 1.2,
          },
        ],
        summary: {
          overview: 'Overview',
          action_items: 'Do the thing',
          keywords: overrides.keywords,
          short_summary: 'Short',
          gist: 'Gist',
        },
        speakers: overrides.speakerIds.map((id, index) => ({ id, name: `Speaker ${index}` })),
        meeting_attendees: [
          { displayName: null, email: 'ana@example.com', phoneNumber: null, name: null, location: null },
        ],
        analytics: {
          speakers: [{ speaker_id: 0, name: 'Ana', duration: 12.5, word_count: 40 }],
        },
      },
    },
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

describe('fireflies_get_transcript with live Fireflies response shapes (#29401)', () => {
  let server: Server;
  let baseUrl: string;
  let graphqlResponse: unknown;
  let requests: RecordedRequest[];

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      requests.push({ method: request.method, path, body: await readJson(request) });
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      if (path.endsWith('/connections')) return send(200, { connections: [connection] });
      if (path.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (path === `/v2/connections/${connection.id}/proxy/graphql`) return send(200, graphqlResponse);
      return send(404, { error: `unexpected request ${request.method} ${path}` });
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

  async function getTranscript(id: string) {
    const resolve = tools({
      providers: ['fireflies'],
      allowTools: ['fireflies_get_transcript'],
      projectId: 'proj_test',
      client: { accessToken: 'test-platform-token', baseUrl },
    });
    // The resolver types its record loosely; narrow to the generated tool it registers.
    const tool = (await resolve()).fireflies_get_transcript as ReturnType<typeof getTranscriptTool> | undefined;
    if (!tool?.execute) throw new Error('fireflies_get_transcript was not resolved');
    const result = await tool.execute({ id }, { requestContext: new RequestContext() });
    // A result that fails the tool's own output schema comes back as a ValidationError, not a throw.
    if (isValidationError(result)) throw new Error(`output failed validation: ${result.message}`);
    if (!result) throw new Error('fireflies_get_transcript returned nothing');
    return result;
  }

  it('returns a transcript whose keywords are a list and whose speaker ids are numbers', async () => {
    graphqlResponse = liveTranscriptResponse({ keywords: ['pricing', 'roadmap', 'hiring'], speakerIds: [0, 1, 2] });

    const result = await getTranscript('abc123');

    expect(result).toMatchObject({
      id: 'abc123',
      title: 'Weekly sync',
      sentences: [{ index: 0, speaker_name: 'Ana', speaker_id: '0', text: 'Hi', start_time: 0.5, end_time: 1.2 }],
      summary: {
        overview: 'Overview',
        action_items: 'Do the thing',
        keywords: 'pricing, roadmap, hiring',
        short_summary: 'Short',
        gist: 'Gist',
      },
      speakers: [
        { id: '0', name: 'Speaker 0' },
        { id: '1', name: 'Speaker 1' },
        { id: '2', name: 'Speaker 2' },
      ],
      meeting_attendees: [{ email: 'ana@example.com' }],
      analytics: { speakers: [{ speaker_id: 0, name: 'Ana', duration: 12.5, word_count: 40 }] },
    });

    // The request that crossed the platform proxy is the documented Transcript query.
    const graphqlRequest = requests.find(request => request.path.endsWith('/proxy/graphql'));
    expect(graphqlRequest).toMatchObject({ method: 'POST', body: { variables: { id: 'abc123' } } });
    expect(JSON.stringify(graphqlRequest?.body)).toContain('keywords');
  });

  it('returns a transcript whose keywords are a list', async () => {
    graphqlResponse = liveTranscriptResponse({ keywords: ['pricing', 'roadmap'], speakerIds: ['0'] });

    const result = await getTranscript('abc123');

    expect(result.summary?.keywords).toBe('pricing, roadmap');
    expect(result.speakers).toEqual([{ id: '0', name: 'Speaker 0' }]);
  });

  it('returns a transcript whose speaker ids are numbers', async () => {
    graphqlResponse = liveTranscriptResponse({ keywords: 'pricing, roadmap', speakerIds: [0, 7] });

    const result = await getTranscript('abc123');

    expect(result.summary?.keywords).toBe('pricing, roadmap');
    expect(result.speakers).toEqual([
      { id: '0', name: 'Speaker 0' },
      { id: '7', name: 'Speaker 1' },
    ]);
  });

  it('still accepts keywords and speaker ids sent as strings', async () => {
    graphqlResponse = liveTranscriptResponse({ keywords: 'pricing, roadmap', speakerIds: ['0', '1'] });

    const result = await getTranscript('abc123');

    expect(result.summary?.keywords).toBe('pricing, roadmap');
    expect(result.speakers).toEqual([
      { id: '0', name: 'Speaker 0' },
      { id: '1', name: 'Speaker 1' },
    ]);
  });

  it('returns an empty keyword string when Fireflies sends an empty keyword list', async () => {
    // Same as action_items: the output stays a string, and an empty list joins to ''.
    graphqlResponse = liveTranscriptResponse({ keywords: [], speakerIds: [0] });

    const result = await getTranscript('abc123');

    expect(result.summary?.keywords).toBe('');
    expect(result.speakers).toEqual([{ id: '0', name: 'Speaker 0' }]);
  });

  it('keeps null keywords and speaker ids null instead of inventing values', async () => {
    graphqlResponse = liveTranscriptResponse({ keywords: null, speakerIds: [null] });

    const result = await getTranscript('abc123');

    expect(result.summary?.keywords).toBeNull();
    expect(result.speakers).toEqual([{ id: null, name: 'Speaker 0' }]);
  });

  it('leaves keywords and speaker ids absent when Fireflies omits them', async () => {
    const response = liveTranscriptResponse({ keywords: undefined, speakerIds: [] });
    const { keywords: _keywords, ...summaryWithoutKeywords } = response.data.transcript.summary;
    response.data.transcript.summary = summaryWithoutKeywords as typeof response.data.transcript.summary;
    response.data.transcript.speakers = [{ name: 'Ana' } as (typeof response.data.transcript.speakers)[number]];
    graphqlResponse = response;

    const result = await getTranscript('abc123');

    expect(result.summary?.overview).toBe('Overview');
    expect(result.summary?.keywords).toBeUndefined();
    expect(result.speakers).toEqual([{ name: 'Ana' }]);
    // What an agent receives is the JSON-serialized result: no placeholder keyword or id appears.
    const serialized = JSON.parse(JSON.stringify(result)) as typeof result;
    expect(serialized.summary).not.toHaveProperty('keywords');
    expect(serialized.speakers).toEqual([{ name: 'Ana' }]);
  });

  it('still rejects a speaker id that is neither a string nor a number', async () => {
    graphqlResponse = liveTranscriptResponse({ keywords: ['pricing'], speakerIds: [{ nested: true }] });

    await expect(getTranscript('abc123')).rejects.toThrow(/speakers/);
  });
});
