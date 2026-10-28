import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it, vi } from 'vitest';

import { askOrganizationAgent } from '../../../src/mastra/agents/organization-agent.js';
import { createOrganizationApplication } from '../../fixtures/application.js';
import { fixedLanguageModel } from '../../fixtures/model.js';

const command = promisify(execFile);
describe('Evaluation integration', () => {
  it('example catalog starts locally with only an OpenAI key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-shipped-defaults-'));
    const repository = fileURLToPath(new URL('../../../', import.meta.url));
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected remote request'));
    let app: Awaited<ReturnType<typeof createOrganizationApplication>> | undefined;
    try {
      // The operational catalog is user-configurable; exercise the bundled example instead.
      await cp(join(repository, 'source-catalog.example.json'), join(directory, 'source-catalog.json'));
      await cp(join(repository, 'sample-documents'), join(directory, 'sample-documents'), { recursive: true });
      const environment = { OPENAI_API_KEY: 'synthetic-default-key', PATH: process.env.PATH };
      await command(process.execPath, [join(repository, 'scripts/check-env.mjs')], {
        cwd: directory,
        env: environment,
      });
      app = await createOrganizationApplication({
        projectRoot: directory,
        environment,
        embed: async () => [1, 0.01],
        answerModel: fixedLanguageModel('', {
          textForCall: call => {
            const serialized = JSON.stringify(call.prompt);
            expect(serialized).toContain('seven years');
            const strings = (value: unknown): string[] =>
              typeof value === 'string'
                ? [value]
                : Array.isArray(value)
                  ? value.flatMap(strings)
                  : value && typeof value === 'object'
                    ? Object.values(value).flatMap(strings)
                    : [];
            const evidenceLine = strings(call.prompt)
              .join('\n')
              .split('\n')
              .find(line => line.includes('"evidence"'));
            const evidence = JSON.parse(evidenceLine!).evidence as Array<{
              recordId: string;
              locator: string;
              path: string;
              excerpt: string;
            }>;
            const retention = evidence.find(
              hit => hit.path === '/sample/records-retention.md' && hit.excerpt.includes('seven years'),
            );
            expect(retention).toBeDefined();
            return JSON.stringify({
              status: 'answered',
              answer: 'Retain approved invoices for seven years after the end of the fiscal year.',
              citations: [{ recordId: retention!.recordId, locator: retention!.locator }],
            });
          },
        }) as never,
      });
      await app.index.initialize();
      expect((await app.index.sync()).status).toBe('success');
      const answer = await askOrganizationAgent(app.organizationAgent, 'How long are invoices retained?');
      expect(answer).toMatchObject({
        status: 'answered',
        answer: expect.stringContaining('seven years'),
        citations: [expect.objectContaining({ sourceId: 'sample', path: '/sample/records-retention.md' })],
        sourceStatus: [expect.objectContaining({ sourceId: 'sample', ready: true, stale: false })],
      });
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
      await app?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
