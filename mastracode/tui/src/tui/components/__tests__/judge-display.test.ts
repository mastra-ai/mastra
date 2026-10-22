import process from 'node:process';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluationToJudgeResult, JudgeDisplayComponent } from '../judge-display.js';

const WIDTH = 80;

function renderPlain(component: JudgeDisplayComponent): string[] {
  return component.render(WIDTH).map(line => stripAnsi(line));
}

describe('JudgeDisplayComponent', () => {
  const originalColumns = process.stdout.columns;

  beforeEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: WIDTH,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  it('labels judge feedback as Goal and keeps the card rows aligned', () => {
    const component = new JudgeDisplayComponent(
      {
        decision: 'continue',
        reason:
          'This is a long reason that should wrap instead of stretching the card past the terminal width and making the terminal render jagged.',
      },
      2,
      20,
    );

    const lines = renderPlain(component).filter(line => line.trim().length > 0);
    const widths = lines.map(line => line.length);

    expect(lines.join('\n')).toContain('Goal');
    expect(lines.join('\n')).not.toContain('Judge');
    expect(lines.join('\n')).toContain('(2/20)');
    expect(new Set(widths).size).toBe(1);
  });

  it('renders judge failures as paused instead of continue', () => {
    const component = new JudgeDisplayComponent(
      {
        decision: 'paused',
        reason: 'Judge could not evaluate this turn.',
      },
      1,
      20,
    );

    const rendered = renderPlain(component).join('\n');

    expect(rendered).toContain('paused');
    expect(rendered).not.toContain('continue');
    expect(rendered).toContain('(1/20)');
  });

  it('strips terminal control sequences from a judge-failure reason', () => {
    const component = new JudgeDisplayComponent(
      { decision: 'paused', reason: 'Scorer failed\x1b[2J\x1b]0;pwned\x07\nboom' },
      1,
      20,
    );

    const raw = component.render(WIDTH).join('\n');
    const lines = renderPlain(component).filter(line => line.trim().length > 0);

    expect(raw).not.toContain('\x1b[2J');
    expect(raw).not.toContain('\x1b]0;');
    expect(lines.join('\n')).toContain('Scorer failed');
    expect(lines.join('\n')).toContain('boom');
    expect(new Set(lines.map(line => line.length)).size).toBe(1);
  });

  it('strips terminal control sequences from judge activity lines', () => {
    const component = new JudgeDisplayComponent(null, 1, 20);
    component.addActivity('grep "x\x1b[2J\x1b]0;pwned\x07\ny"');

    const raw = component.render(WIDTH).join('\n');
    const lines = renderPlain(component).filter(line => line.trim().length > 0);

    expect(raw).not.toContain('\x1b[2J');
    expect(raw).not.toContain('\x1b]0;');
    expect(new Set(lines.map(line => line.length)).size).toBe(1);
  });

  it('renders user-blocked goals as waiting instead of continue', () => {
    const component = new JudgeDisplayComponent(
      {
        decision: 'waiting',
        reason: 'The assistant is correctly waiting for feedback before continuing.',
      },
      1,
      20,
    );

    const rendered = renderPlain(component).join('\n');

    expect(rendered).toContain('waiting');
    expect(rendered).not.toContain('continue');
    expect(rendered).toContain('(1/20)');
  });

  it('separates judge activity from the final reason', () => {
    const component = new JudgeDisplayComponent(null, 1, 20);
    component.addActivity('read src/file.ts');
    component.setResult({ decision: 'continue', reason: 'Keep going.' }, 1, 20);

    const lines = renderPlain(component);
    const activityIndex = lines.findIndex(line => line.includes('• read src/file.ts'));
    const reasonIndex = lines.findIndex(line => line.includes('Keep going.'));
    const separator = lines[activityIndex + 1];

    expect(activityIndex).toBeGreaterThan(-1);
    expect(reasonIndex).toBe(activityIndex + 2);
    // The separator is a bare left-bar row.
    expect(separator?.trimEnd()).toBe('▎');
    expect(lines.every(line => line.startsWith('▎'))).toBe(true);
  });
});

describe('evaluationToJudgeResult', () => {
  const basePayload = {
    objective: 'Ship it',
    iteration: 4,
    maxRuns: 500,
    results: [],
    duration: 0,
    timedOut: false,
    maxRunsReached: false,
    suppressFeedback: false,
  };

  it('maps a judge-failure payload to paused and surfaces the cause (no infinite "continue")', () => {
    // Mirrors the reported bug: a judge that 400s used to render "continue" and
    // loop forever. Core now emits status:'paused' with the cause in `reason`.
    const result = evaluationToJudgeResult({
      ...basePayload,
      passed: false,
      status: 'paused',
      judgeFailed: true,
      pausedReason: 'Scorer threw an error: Scorer Run Failed: Bad Request',
      reason: 'Scorer threw an error: Scorer Run Failed: Bad Request',
    } as any);

    expect(result.decision).toBe('paused');
    expect(result.reason).toContain('Bad Request');
  });

  it('maps a waitingForUser evaluation to the waiting decision', () => {
    const result = evaluationToJudgeResult({
      ...basePayload,
      passed: false,
      status: 'active',
      waitingForUser: true,
      reason: 'Waiting for user to review the implementation.',
    } as any);

    expect(result.decision).toBe('waiting');
    expect(result.reason).toContain('review the implementation');
  });

  it('still maps an active/incomplete evaluation to continue', () => {
    const result = evaluationToJudgeResult({
      ...basePayload,
      passed: false,
      status: 'active',
      reason: 'Keep working.',
    } as any);

    expect(result.decision).toBe('continue');
  });
});
