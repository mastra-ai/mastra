import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, copyFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { evaluatedSourceIdentity } from '../scripts/evaluation-identity-utils.js';
import { metricNames } from '../scripts/evaluation-runner.js';
import {
  configurationSchema,
  evaluationAllocation,
  validateLiveConfiguration,
} from '../scripts/live-evaluation-runner.js';
import { canonicalJson, hashBytes } from '../src/mastra/domain/case-contracts.js';
import { datasetIdentity } from './evaluation-fixtures.js';
import { reportTestBudget } from './report-runtime.js';

it('paid_evaluation_requires_explicit_frozen_authority_and_durable_aggregate_reservations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'insurance-live-authorization-'));
  try {
    const targets = Object.fromEntries(metricNames.map(name => [name, name === 'false_assurance_rate' ? 0 : 1]));
    const config = configurationSchema.parse({
      runId: 'bounded-run',
      outputDirectory: root,
      authorization: {
        allowPaidCalls: true,
        approvedBy: 'Controlled test only',
        approvedAt: '2026-10-23T00:00:00.000Z',
        reference: 'No paid permission',
      },
      dataset: { version: datasetIdentity.version, sha256: datasetIdentity.sha256 },
      source: await evaluatedSourceIdentity(),
      model: 'gpt-6.1-sol',
      budget: { ...reportTestBudget, maxAttempts: 1 },
      aggregate: {
        maxCases: 1,
        maxRequests: reportTestBudget.maxRequests,
        maxTotalTokens: reportTestBudget.maxTotalTokens,
        maxCostMicros: reportTestBudget.maxCostMicros,
      },
      targets,
      targetsSha256: hashBytes(canonicalJson(targets)),
    });
    expect(
      configurationSchema.safeParse({ ...config, authorization: { ...config.authorization, allowPaidCalls: false } })
        .success,
    ).toBe(false);
    expect(() =>
      validateLiveConfiguration({ ...config, dataset: { ...config.dataset, sha256: '0'.repeat(64) } }),
    ).toThrow(/frozen identity/);
    expect(() => validateLiveConfiguration({ ...config, targetsSha256: '0'.repeat(64) })).toThrow(/frozen identity/);
    expect(() => validateLiveConfiguration(config, 'http://127.0.0.1:9999/v1')).toThrow(/controlled endpoint/);
    const path = join(root, 'ledger.db');
    const allocation = await evaluationAllocation(path, config);
    const claims = await Promise.allSettled([allocation.reserve('same-case'), allocation.reserve('same-case')]);
    expect(claims.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await expect(allocation.reserve('second-case')).rejects.toThrow(/ceiling/);
    allocation.close();
    const reopened = await evaluationAllocation(path, config);
    await expect(reopened.reserve('same-case')).rejects.toThrow(/already exists/);
    await expect(reopened.reserve('second-case')).rejects.toThrow(/ceiling/);
    reopened.close();
    await expect(
      evaluationAllocation(path, {
        ...config,
        model: config.model,
        targets: { ...config.targets, field_extraction: 0.95 },
      }),
    ).rejects.toThrow(/another configuration/);
    await expect(
      promisify(execFile)(
        process.execPath,
        ['--import', './tests/source-loader.mjs', 'scripts/live-evaluation-runner.ts'],
        {
          env: { ...process.env, OPENAI_API_KEY: '', POLICY_TEST_PROVIDER_URL: '' },
        },
      ),
    ).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('requires --config and --output') });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('binds evaluation identity without relying on hoisted transitive packages', async () => {
  const root = await mkdtemp(join(tmpdir(), 'insurance isolated install '));
  try {
    for (const directory of ['src', 'scripts', 'tests'])
      await cp(resolve(directory), join(root, directory), { recursive: true });
    await copyFile('package.json', join(root, 'package.json'));
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    for (const name of Object.keys(manifest.dependencies)) {
      const destination = join(root, 'node_modules', name, 'package.json');
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(resolve('node_modules', name, 'package.json'), destination);
    }
    // Execute the copied helper and loader using only their local runtime dependencies.
    for (const name of ['zod', 'typescript'])
      await cp(resolve('node_modules', name), join(root, 'node_modules', name), { recursive: true, dereference: true });
    const runIsolated = () =>
      promisify(execFile)(
        process.execPath,
        [
          '--import',
          join(root, 'tests/source-loader.mjs'),
          '--input-type=module',
          '-e',
          `import { evaluatedSourceIdentity } from ${JSON.stringify(pathToFileURL(join(root, 'scripts/evaluation-identity-utils.ts')).href)};
       console.log(JSON.stringify(await evaluatedSourceIdentity()));`,
        ],
        { cwd: root },
      );
    const { stdout } = await runIsolated();
    expect(JSON.parse(stdout)).toEqual(await evaluatedSourceIdentity());
    await rm(join(root, 'scripts/evaluation-identity-utils.ts'));
    await expect(runIsolated()).rejects.toMatchObject({
      stderr: expect.stringContaining('ERR_MODULE_NOT_FOUND'),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
