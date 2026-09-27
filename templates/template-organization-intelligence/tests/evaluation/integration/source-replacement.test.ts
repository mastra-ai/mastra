import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { askOrganizationAgent } from '../../../src/mastra/agents/organization-agent.js';
import { createOrganizationAnswerRoute } from '../../../src/mastra/api/organization.js';
import { createOrganizationApplication } from '../../fixtures/application.js';
import { fixedLanguageModel } from '../../fixtures/model.js';

describe('Evaluation integration', () => {
  it('tutorial source replacement preserves query contract', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-tutorial-'));
    const retained = join(directory, 'retained');
    const retired = join(directory, 'retired');
    const replacement = join(directory, 'replacement');
    await Promise.all([mkdir(retained), mkdir(retired), mkdir(replacement)]);
    await Promise.all([
      writeFile(join(retained, 'retained.md'), 'Retained policy: manager review takes seven days.'),
      writeFile(join(retired, 'retired.md'), 'Retired policy: archive approval is obsolete.'),
      writeFile(join(replacement, 'replacement.md'), 'Replacement policy: procurement review takes two days.'),
    ]);
    const environment = { OPENAI_API_KEY: 'controlled-tutorial-key' };
    const catalogPath = join(directory, 'source-catalog.json');
    const writeCatalog = async (sources: Array<{ id: string; mountPath: string; root: string }>) =>
      writeFile(
        catalogPath,
        JSON.stringify({
          version: 1,
          sources: sources.map(source => ({ ...source, provider: 'local', enabled: true })),
        }),
      );
    const strings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : Array.isArray(value)
          ? value.flatMap(strings)
          : typeof value === 'object' && value
            ? Object.values(value).flatMap(strings)
            : [];
    const answerModel = fixedLanguageModel('', {
      textForCall: call => {
        const prompt = strings(call.prompt).join('\n');
        const payload = JSON.parse(prompt.split('\n').find(line => line.includes('"evidence"')) ?? '{}') as {
          evidence?: Array<{ recordId: string; locator: string; excerpt: string }>;
        };
        const evidence = payload.evidence ?? [];
        return JSON.stringify({
          status: evidence.length ? 'answered' : 'insufficient_evidence',
          answer: evidence[0]?.excerpt ?? 'No evidence.',
          citations: evidence.slice(0, 1).map(hit => ({ recordId: hit.recordId, locator: hit.locator })),
        });
      },
    });
    const embed = async (text: string) => [
      Number(/retained|manager|seven|eight/.test(text.toLowerCase())),
      Number(/retired|archive|obsolete/.test(text.toLowerCase())),
      Number(/replacement|procurement|two/.test(text.toLowerCase())),
      0.01,
    ];
    await writeCatalog([
      { id: 'retained', mountPath: '/retained', root: retained },
      { id: 'retired', mountPath: '/retired', root: retired },
    ]);
    const app1 = await createOrganizationApplication({
      projectRoot: directory,
      environment,
      embed,
      answerModel: answerModel as never,
    });
    const mastra1 = app1.mastra;
    await mastra1.startWorkers();
    expect(await mastra1.schedules.list()).toHaveLength(1);
    expect((await askOrganizationAgent(app1.organizationAgent, 'archive obsolete')).citations[0]).toMatchObject({
      sourceId: 'retired',
    });
    const retainedBefore = (await askOrganizationAgent(app1.organizationAgent, 'manager seven')).citations[0]!;
    await mastra1.stopWorkers();
    await app1.close();
    await writeCatalog([
      { id: 'retained', mountPath: '/retained', root: retained },
      { id: 'replacement', mountPath: '/replacement', root: replacement },
    ]);
    const app2 = await createOrganizationApplication({
      projectRoot: directory,
      environment,
      embed,
      answerModel: answerModel as never,
    });
    const mastra2 = app2.mastra;
    await mastra2.startWorkers();
    expect(await mastra2.schedules.list()).toHaveLength(1);
    expect((await app2.index.search('archive obsolete')).some(hit => hit.metadata.sourceId === 'retired')).toBe(false);
    const retainedAfter = (await askOrganizationAgent(app2.organizationAgent, 'manager seven')).citations[0]!;
    expect(retainedAfter).toMatchObject({ sourceId: 'retained' });
    expect(retainedAfter).toMatchObject({ recordId: retainedBefore.recordId, locator: retainedBefore.locator });
    expect((await askOrganizationAgent(app2.organizationAgent, 'procurement two')).citations[0]).toMatchObject({
      sourceId: 'replacement',
    });
    const mcp = await app2.mcpServer.executeTool('answerOrganizationQuestion', { question: 'procurement two' });
    expect(mcp).toMatchObject({ citations: [expect.objectContaining({ sourceId: 'replacement' })] });
    const route = createOrganizationAnswerRoute(app2.organizationAgent) as unknown as {
      handler: (context: {
        req: { json: () => Promise<unknown> };
        json: (body: unknown, status?: number) => Response;
      }) => Promise<Response>;
    };
    expect(
      await (
        await route.handler({
          req: { json: async () => ({ question: 'procurement two' }) },
          json: (body, status) => Response.json(body, { status }),
        })
      ).json(),
    ).toMatchObject({ citations: [expect.objectContaining({ sourceId: 'replacement' })] });
    const runId = app2.index.lastRun()?.runId;
    const schedule = (await mastra2.schedules.list())[0]!;
    await writeFile(join(retained, 'retained.md'), 'Retained policy: manager review takes eight days.');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(schedule.nextFireAt + 1);
    await mastra2.scheduler!.tick();
    await vi.waitFor(() => expect(app2.index.lastRun()?.runId).not.toBe(runId));
    vi.useRealTimers();
    expect((await app2.index.search('manager eight')).some(hit => hit.content.includes('eight days'))).toBe(true);
    await mastra2.stopWorkers();
    await app2.close();
    await rm(directory, { recursive: true, force: true });
  });
});
