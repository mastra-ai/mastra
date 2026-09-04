import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Reporter } from 'vitest/reporters';
import { scenarios, type ScenarioDefinition } from '../scenarios/index.js';

type TestCase = Parameters<NonNullable<Reporter['onTestCaseResult']>>[0];
import { writeScenarioReport, type ScenarioReport } from '../helpers/report.js';

interface ScenarioResult {
  definition: ScenarioDefinition;
  tests: Array<{ name: string; status: 'passed' | 'failed' | 'skipped'; durationMs: number }>;
}

export default class ScenarioReporter implements Reporter {
  private readonly results = new Map<string, ScenarioResult>();
  private readonly startedAt = new Date();

  onTestCaseResult(testCase: TestCase) {
    const scenarioTags = new Set(testCase.fullName.split(/\s+/));
    for (const scenario of scenarios) {
      if (!scenarioTags.has(scenario.id)) continue;
      const result = testCase.result();
      const entry = this.results.get(scenario.id) ?? { definition: scenario, tests: [] };
      entry.tests.push({
        name: testCase.fullName,
        status: result.state === 'passed' ? 'passed' : result.state === 'skipped' ? 'skipped' : 'failed',
        durationMs: testCase.diagnostic()?.duration ?? 0,
      });
      this.results.set(scenario.id, entry);
    }
  }

  async onTestRunEnd() {
    const reportDirectory = process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR;
    const tier = process.env.MASTRA_EXPERIMENT_E2E_TIER as 'pr' | 'full' | undefined;
    if (!reportDirectory || !tier || this.results.size === 0) return;

    const reportRoot = resolve(reportDirectory);
    await mkdir(reportRoot, { recursive: true });
    const selectedScenario = process.env.MASTRA_EXPERIMENT_E2E_SCENARIO;
    const requiredScenarios = selectedScenario
      ? scenarios.filter(scenario => scenario.id === selectedScenario)
      : scenarios.filter(scenario => scenario.tier === 'pr' || tier === 'full');
    if (selectedScenario && requiredScenarios.length !== 1) {
      throw new Error(`Unknown selected scenario: ${selectedScenario}`);
    }
    const reports: ScenarioReport[] = [];

    for (const scenario of requiredScenarios) {
      const result = this.results.get(scenario.id);
      if (!result) throw new Error(`Missing required scenario report: ${scenario.id}`);
      const status = result.tests.some(test => test.status === 'failed')
        ? 'failed'
        : result.tests.some(test => test.status === 'skipped')
          ? 'skipped'
          : 'passed';
      let assertionEvidence: { scenarioId: string; evidence: Record<string, unknown> };
      try {
        assertionEvidence = JSON.parse(await readFile(join(reportRoot, `${scenario.id}.assertions.json`), 'utf8')) as {
          scenarioId: string;
          evidence: Record<string, unknown>;
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || status === 'passed') throw error;
        assertionEvidence = {
          scenarioId: scenario.id,
          evidence: Object.fromEntries(
            scenario.assertions.map(id => [id, { error: `Scenario ${status} before assertion evidence was recorded` }]),
          ),
        };
      }
      if (assertionEvidence.scenarioId !== scenario.id) {
        throw new Error(`Assertion evidence scenario mismatch for ${scenario.id}`);
      }
      const evidenceIds = Object.keys(assertionEvidence.evidence).sort();
      const requiredIds = [...scenario.assertions].sort();
      if (JSON.stringify(evidenceIds) !== JSON.stringify(requiredIds)) {
        throw new Error(`Missing required assertion evidence for ${scenario.id}`);
      }
      const report: ScenarioReport = {
        schemaVersion: 1,
        scenarioId: scenario.id,
        tier: scenario.tier,
        status,
        fixture: scenario.fixture,
        isolationKey: scenario.isolationKey,
        packageManager: { name: 'scenario-defined', version: process.version },
        registry: {
          tag: process.env.MASTRA_E2E_REGISTRY_TAG ?? 'local',
          artifactDigest: process.env.MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST ?? null,
        },
        assertions: scenario.assertions.map(id => ({
          id,
          status,
          evidence: assertionEvidence.evidence[id],
        })),
        startedAt: this.startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: result.tests.reduce((total, test) => total + test.durationMs, 0),
        diagnostics: {},
      };
      await writeScenarioReport(reportRoot, report);
      reports.push(report);
    }

    const missingAssertions = reports.flatMap(report =>
      report.assertions
        .filter(assertion => assertion.status !== 'passed')
        .map(assertion => `${report.scenarioId}:${assertion.id}`),
    );
    await writeFile(
      join(reportRoot, 'summary.json'),
      `${JSON.stringify({ schemaVersion: 1, tier, reports }, null, 2)}\n`,
    );
    if (missingAssertions.length > 0) {
      throw new Error(`Required scenario assertions did not pass: ${missingAssertions.join(', ')}`);
    }
  }
}
