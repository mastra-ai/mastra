import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { attioDemoErrorMessage, createDemoEntry } from '../../scripts/attio-demo';
import { AttioClient } from '../../src/mastra/providers/attio/client';
import { OutputError } from '../../src/mastra/providers/output';
import { attioFixture } from '../support/attio';
import { exampleProfile } from '../support/example-profile';

it.each([
  { matches: 0, code: 'attio_demo_company_not_found' },
  { matches: 2, code: 'attio_demo_company_ambiguous' },
])('reports $code without creating a list entry', async ({ matches, code }) => {
  const fixture = attioFixture(true);
  const transport = vi.fn<typeof fetch>(async () =>
    Response.json({
      data: Array.from({ length: matches }, () => ({
        id: {
          workspace_id: fixture.config.workspaceId,
          object_id: fixture.config.companyObjectId,
          record_id: randomUUID(),
        },
      })),
    }),
  );
  const client = new AttioClient(fixture.config, transport);
  const profile = exampleProfile({ domain: 'resend.com', seed: 42, scenario: 'no-inquiry' });
  await expect(createDemoEntry(client, profile)).rejects.toMatchObject({ code, retryable: false });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0]![0]).toBe(
    `https://api.attio.com/v2/objects/${fixture.config.companyObjectId}/records/query`,
  );
  expect(attioDemoErrorMessage(new OutputError(code, false))).toContain(
    matches ? 'multiple companies match' : 'Create the company under Companies',
  );
});

it('keeps unexpected failures private', () => {
  const message = attioDemoErrorMessage(new Error('private-response-with-example-token'));
  expect(message).toContain('Check the dedicated list mapping');
  expect(message).not.toContain('private-response');
});
