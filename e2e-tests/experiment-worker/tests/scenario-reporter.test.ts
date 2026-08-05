import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import ScenarioReporter from '../reporters/scenario-reporter.js';
import { scenarios } from '../scenarios/index.js';

const roots: string[] = [];
const originalEnvironment = { ...process.env };

afterEach(async () => {
  process.env = { ...originalEnvironment };
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

function passedTestCase(scenarioId: string) {
  return {
    fullName: `experiment worker > ${scenarioId} completes`,
    result: () => ({ state: 'passed' }),
    diagnostic: () => ({ duration: 5 }),
  };
}

describe('scenario reporter', () => {
  test('fails strict tiers when a required scenario is missing', async () => {
    const reportRoot = await mkdtemp(join(tmpdir(), 'experiment-reports-'));
    roots.push(reportRoot);
    process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR = reportRoot;
    process.env.MASTRA_EXPERIMENT_E2E_TIER = 'pr';

    const reporter = new ScenarioReporter();
    await expect(reporter.onTestRunEnd()).rejects.toThrow('Missing required scenario report');
  });

  test('rejects a scenario-level pass with missing assertion evidence', async () => {
    const reportRoot = await mkdtemp(join(tmpdir(), 'experiment-reports-'));
    roots.push(reportRoot);
    process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR = reportRoot;
    process.env.MASTRA_EXPERIMENT_E2E_TIER = 'pr';

    const reporter = new ScenarioReporter();
    const required = scenarios.filter(scenario => scenario.tier === 'pr');
    for (const scenario of required) {
      reporter.onTestCaseResult(passedTestCase(scenario.id) as never);
      await writeFile(
        join(reportRoot, `${scenario.id}.assertions.json`),
        JSON.stringify({
          scenarioId: scenario.id,
          evidence: Object.fromEntries(scenario.assertions.slice(0, -1).map(id => [id, { observed: true }])),
        }),
      );
    }

    await expect(reporter.onTestRunEnd()).rejects.toThrow('Missing required assertion evidence');
  });

  test('validates only the explicitly selected scenario', async () => {
    const reportRoot = await mkdtemp(join(tmpdir(), 'experiment-reports-'));
    roots.push(reportRoot);
    const scenario = scenarios.find(candidate => candidate.id === 'workspace-browser')!;
    process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR = reportRoot;
    process.env.MASTRA_EXPERIMENT_E2E_TIER = 'full';
    process.env.MASTRA_EXPERIMENT_E2E_SCENARIO = scenario.id;

    const reporter = new ScenarioReporter();
    reporter.onTestCaseResult(passedTestCase(scenario.id) as never);
    await writeFile(
      join(reportRoot, `${scenario.id}.assertions.json`),
      JSON.stringify({
        scenarioId: scenario.id,
        evidence: Object.fromEntries(scenario.assertions.map(id => [id, { observed: true }])),
      }),
    );
    await reporter.onTestRunEnd();

    const summary = JSON.parse(await readFile(join(reportRoot, 'summary.json'), 'utf8')) as {
      reports: Array<{ scenarioId: string }>;
    };
    expect(summary.reports).toEqual([expect.objectContaining({ scenarioId: scenario.id })]);
  });

  test('writes every required assertion and a suite summary', async () => {
    const reportRoot = await mkdtemp(join(tmpdir(), 'experiment-reports-'));
    roots.push(reportRoot);
    process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR = reportRoot;
    process.env.MASTRA_EXPERIMENT_E2E_TIER = 'pr';
    process.env.MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST = 'a'.repeat(64);

    const reporter = new ScenarioReporter();
    for (const scenario of scenarios.filter(scenario => scenario.tier === 'pr')) {
      reporter.onTestCaseResult(passedTestCase(scenario.id) as never);
      await writeFile(
        join(reportRoot, `${scenario.id}.assertions.json`),
        JSON.stringify({
          scenarioId: scenario.id,
          evidence: Object.fromEntries(scenario.assertions.map(id => [id, { observed: true }])),
        }),
      );
    }
    await reporter.onTestRunEnd();

    const summary = JSON.parse(await readFile(join(reportRoot, 'summary.json'), 'utf8')) as {
      reports: Array<{ scenarioId: string; assertions: Array<{ id: string; status: string }> }>;
    };
    expect(summary.reports.map(report => report.scenarioId)).toEqual(
      scenarios.filter(scenario => scenario.tier === 'pr').map(scenario => scenario.id),
    );
    for (const report of summary.reports) {
      const scenario = scenarios.find(candidate => candidate.id === report.scenarioId);
      expect(report.assertions.map(assertion => ({ id: assertion.id, status: assertion.status }))).toEqual(
        scenario?.assertions.map(id => ({ id, status: 'passed' })),
      );
    }
  });
});
