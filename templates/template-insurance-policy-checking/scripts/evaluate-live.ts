import { evaluatedSourceIdentity } from './evaluation-identity.js';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { createClient } from '@libsql/client';
import { z } from 'zod';
import { canonicalJson, hashBytes } from '../src/mastra/domain/contracts.js';
import { processingBudgetSchema } from '../src/mastra/domain/reconciliation-contracts.js';
import { evaluationCases, datasetIdentity } from '../tests/evaluation-cases.js';
import { runEvaluationCase } from './evaluation-runtime.js';
import { aggregateEvaluation, evaluateCase, metricNames } from './evaluation.js';

const targetsSchema = z
  .object(
    Object.fromEntries(metricNames.map(name => [name, z.number().min(0).max(1)])) as Record<
      (typeof metricNames)[number],
      z.ZodNumber
    >,
  )
  .strict();
export const configurationSchema = z
  .object({
    runId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    outputDirectory: z.string().refine(isAbsolute, 'Use an approved absolute output directory.'),
    authorization: z
      .object({
        allowPaidCalls: z.literal(true),
        approvedBy: z.string().min(1),
        approvedAt: z.iso.datetime(),
        reference: z.string().min(1),
      })
      .strict(),
    dataset: z
      .object({ version: z.literal('insurance-use-cases-1'), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict(),
    source: z
      .object({
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        promptVersion: z.literal('insurance-2'),
        schemaVersion: z.literal('reconciliation-1'),
      })
      .strict(),
    model: z.literal('gpt-6.1-sol'),
    budget: processingBudgetSchema.refine(b => b.maxAttempts === 1, 'Live acceptance permits no automatic retries.'),
    aggregate: z
      .object({
        maxCases: z.number().int().positive(),
        maxRequests: z.number().int().positive(),
        maxTotalTokens: z.number().int().positive(),
        maxCostMicros: z.number().int().positive(),
      })
      .strict(),
    targets: targetsSchema,
    targetsSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((configuration, context) => {
    if (hashBytes(canonicalJson(configuration.targets)) !== configuration.targetsSha256)
      context.addIssue({
        code: 'custom',
        path: ['targetsSha256'],
        message: 'Approved targets do not match their frozen identity.',
      });
  });

export async function main() {
  const configIndex = process.argv.indexOf('--config');
  const outputIndex = process.argv.indexOf('--output');
  if (configIndex < 0 || outputIndex < 0 || !process.argv[configIndex + 1] || !process.argv[outputIndex + 1])
    throw Error(
      'live_model_quality_meets_approved_targets requires --config and --output with explicit external budget and quality-target authorization. No provider call was made.',
    );
  const config = validateLiveConfiguration(
    JSON.parse(await readFile(resolve(process.argv[configIndex + 1]!), 'utf8')),
    process.env.POLICY_TEST_PROVIDER_URL,
  );
  if ((await evaluatedSourceIdentity()).sha256 !== config.source.sha256)
    throw Error('The approved evaluated source identity does not match current bytes. No provider call was made.');
  if (!process.env.OPENAI_API_KEY) throw Error('OPENAI_API_KEY is required. No provider call was made.');

  if (config.aggregate.maxCases < evaluationCases.length)
    throw Error('Aggregate case allocation does not cover the frozen dataset.');
  const root = resolve(process.argv[outputIndex + 1]!);
  if (root !== resolve(config.outputDirectory))
    throw Error(
      'The output directory differs from the approved durable reservation location. No provider call was made.',
    );
  await mkdir(root, { recursive: true, mode: 0o700 });
  const runRoot = join(root, config.runId);
  await mkdir(runRoot, { recursive: true, mode: 0o700 });
  const allocation = await evaluationAllocation(join(root, 'reservations.db'), config);
  const identity = hashBytes(canonicalJson(config));
  await save(join(runRoot, 'configuration.json'), config);
  const results: ReturnType<typeof evaluateCase>[] = [];
  try {
    for (const test of evaluationCases) {
      // Charge a complete per-case ceiling before dispatch. Reservations survive failure/restart;
      // native transport additionally reserves every encoded request inside this allocation.
      await allocation.reserve(test.id);
      const observation = await runEvaluationCase(test, join(runRoot, test.id), undefined, config.budget);
      const scored = evaluateCase(test, observation);
      results.push(scored);
      await save(join(runRoot, `${test.id}.json`), {
        kind: 'live-provider',
        dataset: datasetIdentity,
        configIdentity: identity,
        evaluatedSource: config.source,
        result: scored,
      });
      await save(join(runRoot, 'results.json'), {
        kind: 'live-provider',
        dataset: datasetIdentity,
        configIdentity: identity,
        evaluatedSource: config.source,
        ...aggregateEvaluation(evaluationCases.map(c => results.find(r => r.caseId === c.id) ?? evaluateCase(c))),
        pending: evaluationCases.slice(results.length).map(c => c.id),
      });
      if (observation.state !== 'completed')
        throw Error(
          'A scheduled case did not complete. Further dispatch stopped because full case completion is required.',
        );
    }
    const aggregate = aggregateEvaluation(results);
    const failures = metricNames.filter(name => {
      const value = aggregate.metrics[name].value;
      return (
        value === null ||
        (name === 'false_assurance_rate' ? value > config.targets[name] : value < config.targets[name])
      );
    });
    const passed =
      !aggregate.failed &&
      !aggregate.unknown &&
      !failures.length &&
      aggregate.cases.every(c => c.counts.falseAuthorizations === 0 && c.counts.unauthorizedFinalizations === 0);
    await save(join(runRoot, 'results.json'), {
      proof: 'live_model_quality_meets_approved_targets',
      kind: 'live-provider',
      dataset: datasetIdentity,
      configIdentity: identity,
      evaluatedSource: config.source,
      targets: config.targets,
      failures,
      passed,
      ...aggregate,
    });
    if (!passed)
      throw Error(
        'Live quality did not meet every approved target. Inspect durable per-case results and denominators.',
      );
    process.stdout.write('live_model_quality_meets_approved_targets passed. Results saved locally.\n');
  } catch (error) {
    await save(join(runRoot, 'results.json'), {
      proof: 'live_model_quality_meets_approved_targets',
      kind: 'live-provider',
      dataset: datasetIdentity,
      configIdentity: identity,
      evaluatedSource: config.source,
      targets: config.targets,
      passed: false,
      failure: error instanceof Error ? error.message : 'Evaluation interrupted.',
      ...aggregateEvaluation(evaluationCases.map(c => results.find(r => r.caseId === c.id) ?? evaluateCase(c))),
      pending: evaluationCases.slice(results.length).map(c => c.id),
    });
    throw error;
  } finally {
    allocation.close();
  }
}
export function validateLiveConfiguration(value: unknown, controlledEndpoint?: string) {
  const config = configurationSchema.parse(value);
  if (config.dataset.sha256 !== datasetIdentity.sha256)
    throw Error('The approved dataset or targets do not match their frozen identity. No provider call was made.');
  if (controlledEndpoint) throw Error('A controlled endpoint cannot establish live model quality.');
  return config;
}
export async function evaluationAllocation(path: string, config: z.infer<typeof configurationSchema>) {
  const ledger = createClient({ url: `file:${path}` });
  await ledger.executeMultiple(
    'CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, identity TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reservations (run_id TEXT NOT NULL, case_id TEXT NOT NULL, requests INTEGER NOT NULL, tokens INTEGER NOT NULL, cost INTEGER NOT NULL, PRIMARY KEY(run_id,case_id));',
  );
  const identity = hashBytes(canonicalJson(config));
  await ledger.execute({ sql: 'INSERT OR IGNORE INTO runs VALUES (?,?)', args: [config.runId, identity] });
  const prior = await ledger.execute({ sql: 'SELECT identity FROM runs WHERE id=?', args: [config.runId] });
  if (prior.rows[0]?.identity !== identity) {
    ledger.close();
    throw Error('This run ID is already bound to another configuration.');
  }
  return {
    close: () => ledger.close(),
    async reserve(caseId: string) {
      const transaction = await ledger.transaction('write');
      try {
        const priorCase = await transaction.execute({
          sql: 'SELECT 1 FROM reservations WHERE run_id=? AND case_id=?',
          args: [config.runId, caseId],
        });
        if (priorCase.rows.length)
          throw Error(
            'A case allocation already exists. Review durable results; reruns require a new explicitly approved run.',
          );
        const totals = (
          await transaction.execute({
            sql: 'SELECT count(*) AS cases,coalesce(sum(requests),0) AS requests,coalesce(sum(tokens),0) AS tokens,coalesce(sum(cost),0) AS cost FROM reservations WHERE run_id=?',
            args: [config.runId],
          })
        ).rows[0]!;
        if (
          Number(totals.cases) + 1 > config.aggregate.maxCases ||
          Number(totals.requests) + config.budget.maxRequests > config.aggregate.maxRequests ||
          Number(totals.tokens) + config.budget.maxTotalTokens > config.aggregate.maxTotalTokens ||
          Number(totals.cost) + config.budget.maxCostMicros > config.aggregate.maxCostMicros
        )
          throw Error('The persistent aggregate run ceiling cannot reserve this case.');
        await transaction.execute({
          sql: 'INSERT INTO reservations VALUES (?,?,?,?,?)',
          args: [
            config.runId,
            caseId,
            config.budget.maxRequests,
            config.budget.maxTotalTokens,
            config.budget.maxCostMicros,
          ],
        });
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      } finally {
        transaction.close();
      }
    },
  };
}
async function save(path: string, value: unknown) {
  await writeFile(path + '.tmp', JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(path + '.tmp', path);
}
if (process.argv[1]?.endsWith('evaluate-live.ts'))
  main().catch(error => {
    // Configuration errors contain no credential contents. Runtime failures are already sanitized per case.
    process.stderr.write(`${error instanceof Error ? error.message : 'Live evaluation failed.'}\n`);
    process.exitCode = 1;
  });
