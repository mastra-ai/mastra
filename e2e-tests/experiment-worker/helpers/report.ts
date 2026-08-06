import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ScenarioReport {
  schemaVersion: 1;
  scenarioId: string;
  tier: 'pr' | 'full' | 'gated';
  status: 'passed' | 'failed' | 'skipped';
  fixture: string;
  isolationKey: string;
  packageManager: { name: string; version: string };
  registry: { tag: string; artifactDigest: string | null };
  assertions: Array<{ id: string; status: 'passed' | 'failed' | 'skipped'; evidence: unknown }>;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  diagnostics: Record<string, string>;
  [key: string]: unknown;
}

export async function writeScenarioReport(reportRoot: string, report: ScenarioReport) {
  await mkdir(reportRoot, { recursive: true });
  const jsonPath = join(reportRoot, `${report.scenarioId}.json`);
  const markdownPath = join(reportRoot, `${report.scenarioId}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(
    markdownPath,
    [
      `# ${report.scenarioId}`,
      '',
      `- Status: **${report.status}**`,
      `- Tier: ${report.tier}`,
      `- Duration: ${report.durationMs}ms`,
      `- Registry digest: ${report.registry.artifactDigest ?? 'local'}`,
      '',
      '## Assertions',
      '',
      ...report.assertions.map(assertion => `- ${assertion.status.toUpperCase()} \`${assertion.id}\``),
      '',
    ].join('\n'),
  );
  return { jsonPath, markdownPath };
}
