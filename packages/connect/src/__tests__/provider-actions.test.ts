import { readFileSync } from 'node:fs';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { PROVIDERS } from '../index.js';
import { listEmailsInputSchema } from '../providers/resend/tools/list-emails.js';
import { sendEmailInputSchema } from '../providers/resend/tools/send-email.js';

interface ActionFixture {
  provider: string;
  tool: string;
  method: string;
  path: string;
  input: Record<string, unknown>;
  response: Record<string, unknown>;
}

// Copied from the pinned template contribution; examples and synthetic fixtures, not live recordings.
for (const [providerId, count] of [
  ['neon', 12],
  ['resend', 8],
  ['incident-io', 11],
] as const) {
  describe(`${providerId} generated tools`, () => {
    const fixtures: ActionFixture[] = JSON.parse(
      readFileSync(new URL(`./fixtures/provider-actions/${providerId}.json`, import.meta.url), 'utf8'),
    );

    it('registers its complete toolset and supports allowTools', () => {
      const provider = PROVIDERS.find(entry => entry.integrationId === providerId)!;
      expect(Object.keys(provider.createTools({ connectionId: 'connection' }))).toHaveLength(count);
      expect(
        Object.keys(provider.createTools({ connectionId: 'connection', allowTools: [fixtures[0]!.tool] })),
      ).toEqual([fixtures[0]!.tool]);
    });

    for (const fixture of fixtures) {
      it(`${fixture.tool} executes through the authenticated platform connection proxy`, async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(fixture.response));
        const provider = PROVIDERS.find(entry => entry.integrationId === providerId)!;
        const tools = provider.createTools({
          connectionId: 'connection',
          client: { baseUrl: 'https://platform.example.test', accessToken: 'test-platform-token', fetch: fetchMock },
        });
        const tool = tools[fixture.tool]!;
        const result = await tool.execute!(fixture.input, { requestContext: new RequestContext() });
        expect(result).toMatchObject(fixture.response);
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, options] = fetchMock.mock.calls[0]!;
        const expectedPath = fixture.path.replace(/\{([^}]+)\}/g, (_, key: string) =>
          encodeURIComponent(String(fixture.input[key])),
        );
        expect(new URL(String(url)).pathname).toBe(`/v2/connections/connection/proxy${expectedPath}`);
        expect(options?.method).toBe(fixture.method);
        expect(new Headers(options?.headers).get('authorization')).toBe('Bearer test-platform-token');
        if ('body' in fixture.input) expect(JSON.parse(String(options?.body))).toEqual(fixture.input.body);
      });
    }
  });
}

describe('generated Resend schema constraints', () => {
  it('retains cross-field input validation from the upstream template', () => {
    expect(listEmailsInputSchema.safeParse({ after: 'a', before: 'b' }).success).toBe(false);
    expect(
      sendEmailInputSchema.safeParse({
        body: { from: 'sender@example.com', to: 'recipient@example.com', subject: 'Hello' },
      }).success,
    ).toBe(false);
  });
});
