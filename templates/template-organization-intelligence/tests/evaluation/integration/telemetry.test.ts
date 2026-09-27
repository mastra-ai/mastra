import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { askOrganizationAgent } from '../../../src/mastra/agents/organization-agent.js';
import {
  createOrganizationAnswerRoute,
  createOrganizationTelemetryRoute,
} from '../../../src/mastra/api/organization.js';
import { createEvaluationRuntime } from '../../../src/mastra/evaluation/fixtures/runtime.js';
import { TELEMETRY_RETENTION_MS } from '../../../src/mastra/telemetry.js';
import { createStatelessOrganizationAgent as createOrganizationAgent } from '../../fixtures/agent.js';
import { createOrganizationApplication } from '../../fixtures/application.js';
import { fixedLanguageModel } from '../../fixtures/model.js';

describe('Evaluation integration', () => {
  it('telemetry omits credentials', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-telemetry-'));
    let now = new Date('2026-01-01T00:00:00.000Z');
    const runtime = await createEvaluationRuntime(directory, {});
    await writeFile(
      join(directory, 'corpus', 'local', 'private.md'),
      'PRIVATE_EXCERPT_SENTINEL: retain this document.',
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
        const text = strings(call.prompt).join('\n');
        const payload = JSON.parse(text.split('\n').find(line => line.includes('"evidence"')) ?? '{}') as {
          evidence?: Array<{ recordId: string; locator: string }>;
        };
        return JSON.stringify({
          status: 'answered',
          answer: 'PRIVATE_ANSWER_SENTINEL: invoices are retained for seven years.',
          citations: (payload.evidence ?? [])
            .slice(0, 2)
            .map(hit => ({ recordId: hit.recordId, locator: hit.locator })),
        });
      },
    });
    const app = await createOrganizationApplication({
      projectRoot: directory,
      environment: {
        OPENAI_API_KEY: 'PRIVATE_OPENAI_KEY_SENTINEL',
        GOOGLE_DRIVE_CLIENT_EMAIL: 'PRIVATE_EMAIL_SENTINEL',
        GOOGLE_DRIVE_PRIVATE_KEY: 'PRIVATE_KEY_SENTINEL',
      },
      sources: runtime,
      embed: async text => [Number(/invoice|retain|retention|kept/.test(text.toLowerCase())), 0.01],
      answerModel: answerModel as never,
      now: () => now,
    });
    const nativeMastra = app.mastra;
    expect(nativeMastra.observability.getDefaultInstance()).toBeUndefined();
    expect(nativeMastra.observability.listInstances().size).toBe(0);
    await app.index.initialize();
    expect((await app.index.sync()).status).toBe('success');
    const question = 'How long are invoices retained? PRIVATE_QUESTION_SENTINEL';
    expect((await askOrganizationAgent(app.organizationAgent, question)).status).toBe('answered');
    await app.organizationAgent.generate(question, { maxSteps: 1, toolChoice: 'none' });
    const stream = await app.organizationAgent.stream(question, { maxSteps: 1, toolChoice: 'none' });
    for await (const _part of stream.fullStream) {
      // Drain the native stream so the finish processor records the query.
    }
    expect(
      await app.mcpServer.executeTool('answerOrganizationQuestion', {
        question,
      }),
    ).toMatchObject({ status: 'answered' });
    const answerRoute = createOrganizationAnswerRoute(app.organizationAgent) as unknown as {
      handler: (context: {
        req: { json: () => Promise<unknown> };
        json: (body: unknown, status?: number) => Response;
      }) => Promise<Response>;
    };
    expect(
      await (
        await answerRoute.handler({
          req: { json: async () => ({ question }) },
          json: (body, status) => Response.json(body, { status }),
        })
      ).json(),
    ).toMatchObject({ status: 'answered' });
    const unknown = createOrganizationAgent(
      app.index,
      fixedLanguageModel(JSON.stringify({ status: 'insufficient_evidence', answer: 'No evidence.', citations: [] }), {
        usage: {},
      }) as never,
      { maxRetries: 0 },
    );
    expect((await askOrganizationAgent(unknown, 'Unknown PRIVATE_QUESTION_SENTINEL')).status).toBe(
      'insufficient_evidence',
    );
    const failing = createOrganizationAgent(
      app.index,
      fixedLanguageModel('', { error: new Error('PRIVATE_PROVIDER_ERROR_SENTINEL') }) as never,
      { maxRetries: 0 },
    );
    expect((await askOrganizationAgent(failing, question)).status).toBe('operational_error');
    const telemetryRoute = createOrganizationTelemetryRoute(app.index) as unknown as {
      handler: (context: { json: (body: unknown, status?: number) => Response }) => Promise<Response>;
    };
    const summary = await (
      await telemetryRoute.handler({ json: (body, status) => Response.json(body, { status }) })
    ).json();
    expect(summary).toMatchObject({
      completedQuestions: 6,
      insufficientEvidence: 1,
      operationalErrors: 1,
      usage: 'partial',
      cost: 'unavailable',
      sourceUtilization: expect.objectContaining({ 'local-eval': expect.any(Number) }),
      syncRuns: [expect.objectContaining({ status: 'success', sources: expect.any(Array) })],
    });
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: 'file:' + join(directory, '.mastra', 'organization-intelligence.db') });
    const queryRows = await client.execute('SELECT data FROM oi_query_telemetry ORDER BY recorded_at');
    const runRows = await client.execute('SELECT data FROM oi_runs ORDER BY finished_at');
    const persisted = JSON.stringify({ queries: queryRows.rows, runs: runRows.rows });
    expect(queryRows.rows).toHaveLength(7);
    const events = queryRows.rows.map(row => JSON.parse(String(row.data)) as Record<string, unknown>);
    expect(new Set(events.map(event => event.correlationId))).toHaveLength(7);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'answered', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }),
        expect.objectContaining({ status: 'insufficient_evidence', usage: 'unavailable' }),
        expect.objectContaining({ status: 'operational_error', usage: 'unavailable' }),
      ]),
    );
    for (const sentinel of [
      'PRIVATE_OPENAI_KEY_SENTINEL',
      'PRIVATE_EMAIL_SENTINEL',
      'PRIVATE_KEY_SENTINEL',
      'PRIVATE_QUESTION_SENTINEL',
      'PRIVATE_ANSWER_SENTINEL',
      'PRIVATE_EXCERPT_SENTINEL',
      'PRIVATE_PROVIDER_ERROR_SENTINEL',
      'synthetic-access-token',
    ])
      expect(persisted).not.toContain(sentinel);
    expect(runRows.rows).toHaveLength(1);
    expect(JSON.parse(String(runRows.rows[0]!.data))).toMatchObject({
      sources: expect.arrayContaining([
        expect.objectContaining({ sourceId: 'local-eval', discovered: expect.any(Number) }),
        expect.objectContaining({ sourceId: 'drive-eval', discovered: expect.any(Number) }),
      ]),
    });
    client.close();
    const originalRecord = app.index.telemetry.recordQuery.bind(app.index.telemetry);
    app.index.telemetry.recordQuery = async () => {
      throw new Error('recorder unavailable');
    };
    expect((await askOrganizationAgent(app.organizationAgent, question)).status).toBe('answered');
    app.index.telemetry.recordQuery = originalRecord;
    const originalCleanup = app.index.telemetry.cleanup.bind(app.index.telemetry);
    app.index.telemetry.cleanup = async () => {
      throw new Error('cleanup unavailable');
    };
    expect((await app.index.sync()).status).toBe('success');
    app.index.telemetry.cleanup = originalCleanup;
    now = new Date(now.getTime() + TELEMETRY_RETENTION_MS + 1);
    expect(await app.index.telemetry.summary()).toMatchObject({ completedQuestions: 0, syncRuns: [] });
    expect((await app.index.sync()).status).toBe('success');
    expect((await app.index.telemetry.summary()).syncRuns).toHaveLength(1);
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
});
