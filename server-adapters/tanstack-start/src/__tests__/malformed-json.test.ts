import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

describe('Malformed JSON Body Handling', () => {
  let context: AdapterTestContext;
  let adapter: MastraServer;

  beforeEach(async () => {
    context = await createDefaultTestContext();
    adapter = new MastraServer({
      mastra: context.mastra,
      tools: context.tools,
      taskStore: context.taskStore,
    });
    await adapter.init();
  });

  it('returns 400 for malformed json payload', async () => {
    const response = await adapter.app.request(
      new Request('http://localhost/api/agents/test-agent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"messages": [{"role": "user", "content": "hel',
      }),
    );
    expect(response.status).toBe(400);
  });

  it('continues serving valid requests after malformed json', async () => {
    const malformed = await adapter.app.request(
      new Request('http://localhost/api/agents/test-agent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json here',
      }),
    );
    expect(malformed.status).toBe(400);

    const valid = await adapter.app.request(
      new Request('http://localhost/api/agents', {
        method: 'GET',
      }),
    );
    expect(valid.status).toBe(200);
  });
});
