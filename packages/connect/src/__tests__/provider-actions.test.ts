import { readFileSync } from 'node:fs';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

import { PROVIDERS } from '../index.js';
import { listIncidentsInputSchema } from '../providers/incident-io/tools/list-incidents.js';
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
  ['resend', 80],
  ['incident-io', 66],
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

describe('generated Resend secret redaction', () => {
  it.each(['resend_create_webhook', 'resend_get_webhook'])(
    '%s never returns the webhook signing secret',
    async tool => {
      const upstream = {
        object: 'webhook',
        id: 'wh_1',
        endpoint: 'https://example.test/hooks',
        signing_secret: 'whsec_never_shown',
      };
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(upstream));
      const provider = PROVIDERS.find(entry => entry.integrationId === 'resend')!;
      const tools = provider.createTools({
        connectionId: 'connection',
        client: { baseUrl: 'https://platform.example.test', accessToken: 'test-platform-token', fetch: fetchMock },
      });
      const input =
        tool === 'resend_create_webhook'
          ? { body: { endpoint: 'https://example.test/hooks', events: ['email.sent'] } }
          : { webhook_id: 'wh_1' };
      const result = await tools[tool]!.execute!(input, { requestContext: new RequestContext() });
      expect(result).toEqual({ object: 'webhook', id: 'wh_1', endpoint: 'https://example.test/hooks' });
      expect(JSON.stringify(result)).not.toContain('whsec_never_shown');
      expect(Object.keys((tools[tool]!.outputSchema as z.ZodObject<z.ZodRawShape>).shape)).not.toContain(
        'signing_secret',
      );
    },
  );
});

describe('generated incident.io schema constraints', () => {
  it('uses the documented incident page-size limit', () => {
    expect(listIncidentsInputSchema.safeParse({ page_size: 250 }).success).toBe(true);
    expect(listIncidentsInputSchema.safeParse({ page_size: 251 }).success).toBe(false);
  });
});
