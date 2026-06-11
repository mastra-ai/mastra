import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';
import type {
  ListHarnessesResponse,
  GetHarnessResponse,
  ListHarnessModesResponse,
  ListHarnessSessionsResponse,
  GetHarnessSessionResponse,
  SendHarnessMessageResponse,
} from '../types';

global.fetch = vi.fn();

const mockJson = (data: unknown) =>
  (global.fetch as any).mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    }),
  );

const mockStream = () =>
  (global.fetch as any).mockResolvedValueOnce(
    new Response(new ReadableStream(), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    }),
  );

const BASE_URL = 'http://localhost:4111';
const HARNESS_ID = 'harness-1';
const SESSION_ID = 'session-abc';

const MOCK_MODE = { id: 'code', defaultModelId: 'claude-sonnet-4-6' };
const MOCK_HARNESS_SUMMARY = { id: HARNESS_ID, ownerId: 'owner-1', modes: [MOCK_MODE] };
const MOCK_SESSION_RECORD = {
  id: SESSION_ID,
  ownerId: 'owner-1',
  resourceId: 'res-1',
  threadId: 'thread-1',
  origin: 'top-level' as const,
  modeId: 'code',
  modelId: 'claude-sonnet-4-6',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastActivityAt: '2026-01-01T00:00:00.000Z',
};
const MOCK_SESSION_INFO = { ...MOCK_SESSION_RECORD, isBusy: false, queueDepth: 0, currentRunId: null, currentTraceId: null };

describe('Harness client', () => {
  let client: MastraClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient({ baseUrl: BASE_URL, retries: 0 });
  });

  it('listHarnesses calls GET /api/harnesses', async () => {
    const response: ListHarnessesResponse = { harnesses: [MOCK_HARNESS_SUMMARY] };
    mockJson(response);

    const result = await client.listHarnesses();

    expect(result).toEqual(response);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/harnesses`,
      expect.anything(),
    );
  });

  it('harness.details calls GET /api/harnesses/:id', async () => {
    const response: GetHarnessResponse = { harness: MOCK_HARNESS_SUMMARY };
    mockJson(response);

    const result = await client.getHarness(HARNESS_ID).details();

    expect(result).toEqual(response);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/harnesses/${HARNESS_ID}`,
      expect.anything(),
    );
  });

  it('harness.listModes calls GET /api/harnesses/:id/modes', async () => {
    const response: ListHarnessModesResponse = { modes: [MOCK_MODE] };
    mockJson(response);

    const result = await client.getHarness(HARNESS_ID).listModes();

    expect(result).toEqual(response);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/harnesses/${HARNESS_ID}/modes`,
      expect.anything(),
    );
  });

  it('harness.listSessions appends query params', async () => {
    const response: ListHarnessSessionsResponse = { sessions: [MOCK_SESSION_RECORD] };
    mockJson(response);

    await client.getHarness(HARNESS_ID).listSessions({ resourceId: 'res-1', threadId: 'thread-1' });

    const url = (global.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('resourceId=res-1');
    expect(url).toContain('threadId=thread-1');
  });

  it('harness.createSession POSTs body to /api/harnesses/:id/sessions', async () => {
    const response: GetHarnessSessionResponse = { session: MOCK_SESSION_INFO };
    mockJson(response);

    const result = await client.getHarness(HARNESS_ID).createSession({ resourceId: 'res-1', threadId: 'thread-1' });

    expect(result).toEqual(response);
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe(`${BASE_URL}/api/harnesses/${HARNESS_ID}/sessions`);
    expect(JSON.parse(call[1].body)).toEqual({ resourceId: 'res-1', threadId: 'thread-1' });
  });

  it('session.details calls GET /api/harnesses/:hid/sessions/:sid', async () => {
    const response: GetHarnessSessionResponse = { session: MOCK_SESSION_INFO };
    mockJson(response);

    await client.getHarness(HARNESS_ID).getSession(SESSION_ID).details();

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/harnesses/${HARNESS_ID}/sessions/${SESSION_ID}`,
      expect.anything(),
    );
  });

  it('session.switchMode POSTs modeId', async () => {
    const response: GetHarnessSessionResponse = { session: MOCK_SESSION_INFO };
    mockJson(response);

    await client.getHarness(HARNESS_ID).getSession(SESSION_ID).switchMode({ modeId: 'review' });

    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe(`${BASE_URL}/api/harnesses/${HARNESS_ID}/sessions/${SESSION_ID}/mode`);
    expect(JSON.parse(call[1].body)).toEqual({ modeId: 'review' });
  });

  it('session.switchModel POSTs modelId', async () => {
    const response: GetHarnessSessionResponse = { session: MOCK_SESSION_INFO };
    mockJson(response);

    await client.getHarness(HARNESS_ID).getSession(SESSION_ID).switchModel({ modelId: 'claude-opus-4-8' });

    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe(`${BASE_URL}/api/harnesses/${HARNESS_ID}/sessions/${SESSION_ID}/model`);
    expect(JSON.parse(call[1].body)).toEqual({ modelId: 'claude-opus-4-8' });
  });

  it('session.sendMessage POSTs messages', async () => {
    const response: SendHarnessMessageResponse = { result: { accepted: true } };
    mockJson(response);

    await client.getHarness(HARNESS_ID).getSession(SESSION_ID).sendMessage({ messages: 'hello' });

    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe(`${BASE_URL}/api/harnesses/${HARNESS_ID}/sessions/${SESSION_ID}/messages`);
    expect(JSON.parse(call[1].body)).toEqual({ messages: 'hello' });
  });

  it('session.queueMessage POSTs to /messages/queue', async () => {
    const response: SendHarnessMessageResponse = { result: { accepted: true, queued: true } };
    mockJson(response);

    await client.getHarness(HARNESS_ID).getSession(SESSION_ID).queueMessage({ messages: 'queued' });

    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe(`${BASE_URL}/api/harnesses/${HARNESS_ID}/sessions/${SESSION_ID}/messages/queue`);
  });

  it('session.stream returns a Response', async () => {
    mockStream();

    const result = await client.getHarness(HARNESS_ID).getSession(SESSION_ID).stream({ messages: 'stream me' });

    expect(result).toBeInstanceOf(Response);
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe(`${BASE_URL}/api/harnesses/${HARNESS_ID}/sessions/${SESSION_ID}/stream`);
    expect(JSON.parse(call[1].body)).toEqual({ messages: 'stream me' });
  });
});
