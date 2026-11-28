import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';
import { FactoryRequestError } from './factory';

function mockFetch(answer: { status?: number; body: unknown } = { body: {} }) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('FactoryWeb resource', () => {
  const client = new MastraClient({ baseUrl: 'http://localhost:4111', retries: 0 });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads under Factory's own /web by default and under a host's base path when given", async () => {
    const fetchMock = mockFetch({ body: { providers: [] } });
    await client.getFactoryWeb().providers();
    await client.getFactoryWeb({ webBasePath: '/agents/factory/projects/fp-1/web' }).providers();
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://localhost:4111/web/config/providers',
      'http://localhost:4111/agents/factory/projects/fp-1/web/config/providers',
    ]);
  });

  it('sends each call to its route with its method and body', async () => {
    const fetchMock = mockFetch();
    const web = client.getFactoryWeb();
    const session = { sessionId: 's1', resourceId: 'r1', threadId: 't1' };
    await web.models({ scope: 'org' });
    await web.models({ factoryProjectId: 'fp 1' });
    await web.sessionModels(session);
    await web.setSessionModel(session, { modelId: 'openai/gpt-5' } as never);
    await web.saveProviderKey('open ai', { key: 'k', scope: 'user' });
    await web.removeProviderKey('openai', 'org');
    await web.pollProviderOAuth('anthropic', 'o1');
    await web.voiceSettings('fp-1');
    await web.workspaceTree('/ws', 'src');
    await web.workspacePatches('/ws', 'branch');
    await web.directory(undefined);

    const sent = fetchMock.mock.calls.map(([url, init]) => [
      init?.method ?? 'GET',
      url.replace('http://localhost:4111', ''),
      init?.body,
    ]);
    expect(sent).toEqual([
      ['GET', '/web/config/models?scope=org', undefined],
      ['GET', '/web/config/models?factoryId=fp%201', undefined],
      ['GET', '/web/config/models?sessionId=s1&resourceId=r1&threadId=t1', undefined],
      ['PUT', '/web/config/session-model', JSON.stringify({ ...session, selection: { modelId: 'openai/gpt-5' } })],
      ['PUT', '/web/config/providers/open%20ai/key', JSON.stringify({ key: 'k', scope: 'user' })],
      ['DELETE', '/web/config/providers/openai/key?scope=org', undefined],
      ['POST', '/web/config/providers/anthropic/oauth/poll', JSON.stringify({ sessionId: 'o1' })],
      ['GET', '/web/voice/settings?factoryId=fp-1', undefined],
      ['GET', '/web/workspace/tree?workspacePath=%2Fws&path=src', undefined],
      ['GET', '/web/workspace/changes/patches?workspacePath=%2Fws&scope=branch', undefined],
      ['GET', '/web/fs/list', undefined],
    ]);
  });

  it('posts a voice clip as the raw body', async () => {
    const fetchMock = mockFetch({ body: { provider: 'openai', model: 'whisper', text: 'hi' } });
    const clip = new Blob(['audio'], { type: 'audio/webm' });
    await client.getFactoryWeb().transcribe(clip, 'fp-1');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:4111/web/voice/transcribe?factoryId=fp-1');
    expect(init?.body).toBe(clip);
    expect(new Headers(init?.headers).get('content-type')).toBeNull();
  });

  it("raises Factory's refusal text as a FactoryRequestError", async () => {
    mockFetch({ status: 403, body: { error: 'Only org admins can write org keys' } });
    const failure = client.getFactoryWeb().saveProviderKey('openai', { key: 'k', scope: 'org' });
    await expect(failure).rejects.toBeInstanceOf(FactoryRequestError);
    await expect(failure).rejects.toThrow('Only org admins can write org keys');
  });
});
