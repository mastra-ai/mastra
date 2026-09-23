import type { ThresholdConfig } from '@mastra/core/evals';
import type { Reporter, TestCase, TestModule } from 'vitest/node';

import type { MastraEvalMeta } from './meta';

type EvalEntry = {
  fullName: string;
  meta: MastraEvalMeta;
};

const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const BOLD = '\u001b[1m';
const DIM = '\u001b[2m';
const RESET = '\u001b[0m';

function supportsColor(): boolean {
  return process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
}

/**
 * Vitest reporter that prints a per-test score table for every eval run
 * using `expectEval`/`expectEvals` (or any test that populates `task.meta.mastraEval`).
 *
 * Usage in `vitest.config.ts`:
 *   test: { reporters: ['default', new MastraEvalsReporter()] }
 */
export class MastraEvalsReporter implements Reporter {
  private readonly color: boolean;

  constructor(options: { color?: boolean } = {}) {
    this.color = options.color ?? supportsColor();
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    const entries: EvalEntry[] = [];
    for (const module of testModules) {
      for (const test of module.children.allTests()) {
        const meta = ((test as TestCase).meta() as { mastraEval?: MastraEvalMeta }).mastraEval;
        if (meta) {
          entries.push({ fullName: test.fullName, meta });
        }
      }
    }

    if (entries.length === 0) return;

    this.print(this.render(entries));
  }

  /** Renders the score report as plain lines. Exposed for testing. */
  render(entries: EvalEntry[]): string {
    const lines: string[] = [];
    lines.push('');
    lines.push(this.style(BOLD, ' Mastra Evals '));

    for (const { fullName, meta } of entries) {
      lines.push('');
      lines.push(
        `${this.verdictBadge(meta.verdict)} ${this.style(BOLD, fullName)} ${this.style(DIM, `(${meta.totalItems} item${meta.totalItems === 1 ? '' : 's'})`)}`,
      );

      const rows: Array<[string, string, string]> = [];
      for (const gate of meta.gateResults ?? []) {
        rows.push([`${gate.id} ${this.style(DIM, '(gate)')}`, formatScore(gate.score), this.passMark(gate.passed)]);
      }
      for (const t of meta.thresholdResults ?? []) {
        rows.push([
          `${t.id} ${this.style(DIM, `(threshold: ${formatThreshold(t.threshold)})`)}`,
          formatScore(t.averageScore),
          this.passMark(t.passed),
        ]);
      }
      const covered = new Set([
        ...(meta.gateResults ?? []).map(g => g.id),
        ...(meta.thresholdResults ?? []).map(t => t.id),
      ]);
      for (const [id, score] of Object.entries(meta.scores)) {
        if (covered.has(id)) continue;
        rows.push([id, formatScore(score), '']);
      }

      lines.push(...this.table(rows));

      for (const turn of meta.turnResults ?? []) {
        const turnRows: Array<[string, string, string]> = [];
        for (const gate of turn.gateResults ?? []) {
          turnRows.push([
            `${gate.id} ${this.style(DIM, '(gate)')}`,
            formatScore(gate.score),
            this.passMark(gate.passed),
          ]);
        }
        for (const t of turn.thresholdResults ?? []) {
          turnRows.push([
            `${t.id} ${this.style(DIM, `(threshold: ${formatThreshold(t.threshold)})`)}`,
            formatScore(t.averageScore),
            this.passMark(t.passed),
          ]);
        }
        const turnCovered = new Set([
          ...(turn.gateResults ?? []).map(g => g.id),
          ...(turn.thresholdResults ?? []).map(t => t.id),
        ]);
        for (const [id, score] of Object.entries(turn.scores ?? {})) {
          if (turnCovered.has(id)) continue;
          turnRows.push([id, formatScore(score), '']);
        }
        if (turnRows.length === 0) continue;
        lines.push(`  ${this.style(DIM, `turn ${turn.index}`)}`);
        lines.push(...this.table(turnRows, '  '));
      }
    }

    const withVerdict = entries.filter(e => e.meta.verdict !== undefined);
    const passed = withVerdict.filter(e => e.meta.verdict === 'passed').length;
    const failed = withVerdict.filter(e => e.meta.verdict === 'failed').length;
    const scored = entries.length - passed - failed;
    lines.push('');
    const parts: string[] = [];
    if (passed > 0) parts.push(this.style(GREEN, `${passed} passed`));
    if (failed > 0) parts.push(this.style(RED, `${failed} failed`));
    if (scored > 0) parts.push(this.style(YELLOW, `${scored} scored`));
    lines.push(` Eval runs: ${entries.length} ${this.style(DIM, `(${parts.join(', ')})`)}`);
    lines.push('');

    return lines.join('\n');
  }

  private table(rows: Array<[string, string, string]>, indent = ''): string[] {
    if (rows.length === 0) return [];
    const nameWidth = Math.max(...rows.map(([name]) => stripAnsi(name).length));
    const scoreWidth = Math.max(5, ...rows.map(([, score]) => score.length));
    return rows.map(([name, score, mark]) => {
      const namePad = ' '.repeat(nameWidth - stripAnsi(name).length);
      return `${indent}   ${name}${namePad}  ${score.padStart(scoreWidth)}  ${mark}`.trimEnd();
    });
  }

  private verdictBadge(verdict: MastraEvalMeta['verdict']): string {
    if (verdict === 'passed') return this.style(GREEN, '✓');
    if (verdict === 'failed') return this.style(RED, '✗');
    return this.style(YELLOW, '•');
  }

  private passMark(passed: boolean): string {
    return passed ? this.style(GREEN, '✓') : this.style(RED, '✗');
  }

  private style(code: string, text: string): string {
    return this.color ? `${code}${text}${RESET}` : text;
  }

  private print(output: string): void {
    process.stdout.write(`${output}\n`);
  }
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? score.toFixed(1) : score.toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0');
}

function formatThreshold(threshold: ThresholdConfig): string {
  if (typeof threshold === 'number') return `min ${threshold}`;
  return Object.entries(threshold)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}
