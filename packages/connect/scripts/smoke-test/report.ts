import type { RunResult } from './runner.js';

/**
 * Renders a run result as a short human-readable report. Prints one block per
 * provider with the overall status, elapsed time, and a step-by-step
 * breakdown. The final summary line counts outcomes by status so a CI job
 * can grep the output.
 */
export function printReport(result: RunResult, out: NodeJS.WriteStream = process.stdout): void {
  const line = (s: string) => out.write(`${s}\n`);
  line('');
  line(`@mastra/connect smoke run ${result.runId}`);
  line(`  started: ${result.startedAt}`);
  line(`  ended:   ${result.endedAt}`);
  line('');

  const counts = { pass: 0, fail: 0, skipped: 0, error: 0 };
  const widthProvider = Math.max(...result.outcomes.map(o => o.integrationId.length), 10);

  for (const outcome of result.outcomes) {
    counts[outcome.status]++;
    const badge = statusBadge(outcome.status);
    const header = `${badge} ${outcome.integrationId.padEnd(widthProvider)}  ${outcome.summary}`;
    const elapsed = outcome.elapsedMs ? `  (${outcome.elapsedMs}ms)` : '';
    line(`${header}${elapsed}`);
    if (outcome.reason) line(`    reason: ${outcome.reason}`);
    for (const step of outcome.steps) {
      const stepBadge = stepStatusBadge(step.status);
      const toolLabel = step.toolId ? ` [${step.toolId}]` : '';
      line(`    ${stepBadge} ${step.name}${toolLabel}${step.detail ? ` — ${step.detail}` : ''}`);
    }
  }

  line('');
  line(
    `summary: ${counts.pass} pass, ${counts.fail} fail, ${counts.skipped} skipped, ${counts.error} error (${result.outcomes.length} providers)`,
  );
}

function statusBadge(status: 'pass' | 'fail' | 'skipped' | 'error'): string {
  switch (status) {
    case 'pass':
      return 'PASS';
    case 'fail':
      return 'FAIL';
    case 'skipped':
      return 'SKIP';
    case 'error':
      return 'ERR ';
  }
}

function stepStatusBadge(status: 'pass' | 'fail' | 'skip'): string {
  switch (status) {
    case 'pass':
      return '✓';
    case 'fail':
      return '✗';
    case 'skip':
      return '-';
  }
}
