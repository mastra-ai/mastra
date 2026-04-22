import { describe, it, expect } from 'vitest';
import { createOutcomeMatchScorer } from '../outcome-match';
import type { MastraCodeExperimentOutput } from '../../../experiments/lifecycle';
import type { MastraCodeGroundTruth } from '../../../experiments/types';

function makeOutput(overrides: Partial<MastraCodeExperimentOutput> = {}): MastraCodeExperimentOutput {
  return { messages: [], toolCalls: [], errors: [], startedAt: 0, completedAt: 1000, ...overrides };
}

function tc(toolName: string, args: Record<string, unknown> = {}, result?: unknown) {
  return { toolName, args, result: result ?? null };
}

describe('Outcome Match Scorer', () => {
  const scorer = createOutcomeMatchScorer();

  it('detects build pass/fail from execute_command exit codes', async () => {
    const passing = makeOutput({
      toolCalls: [tc('execute_command', { command: 'tsc --noEmit' }, { exitCode: 0 })],
    });
    const failing = makeOutput({
      toolCalls: [tc('execute_command', { command: 'tsc --noEmit' }, { exitCode: 1 })],
    });
    const gt: MastraCodeGroundTruth = { buildPasses: true };

    const pass = await scorer.run({ input: {}, output: passing, groundTruth: gt });
    const fail = await scorer.run({ input: {}, output: failing, groundTruth: gt });

    expect(pass.score).toBe(1);
    expect(fail.score).toBe(0);
  });

  it('uses last build command when multiple exist (retries)', async () => {
    // First build fails, agent fixes, second build succeeds
    const output = makeOutput({
      toolCalls: [
        tc('execute_command', { command: 'tsc --noEmit' }, { exitCode: 1 }),
        tc('string_replace_lsp', { path: 'a.ts' }),
        tc('execute_command', { command: 'tsc --noEmit' }, { exitCode: 0 }),
      ],
    });

    const { score } = await scorer.run({
      input: {},
      output,
      groundTruth: { buildPasses: true },
    });
    expect(score).toBe(1);
  });

  it('scores partial credit across mixed assertion types', async () => {
    const output = makeOutput({
      toolCalls: [
        tc('string_replace_lsp', { path: 'src/a.ts' }),
        tc('write_file', { path: 'src/new.ts', content: '...' }),
        tc('execute_command', { command: 'vitest run' }, { exitCode: 0 }),
      ],
    });
    const gt: MastraCodeGroundTruth = {
      testsPasses: true,       // pass
      filesModified: ['src/a.ts', 'src/b.ts'], // 1 of 2
      filesCreated: ['src/new.ts'],             // pass
      toolsNotUsed: ['delete_file'],            // pass
    };

    const { score } = await scorer.run({ input: {}, output, groundTruth: gt });
    // 4 pass, 1 fail (src/b.ts not modified) out of 5 checks
    expect(score).toBeCloseTo(4 / 5, 2);
  });

  it('enforces toolsNotUsed as blacklist', async () => {
    const output = makeOutput({
      toolCalls: [tc('execute_command', { command: 'rm -rf /' }), tc('delete_file', { path: 'x' })],
    });

    const { score } = await scorer.run({
      input: {},
      output,
      groundTruth: { toolsNotUsed: ['delete_file', 'execute_command'] },
    });
    // Both forbidden tools used → 0/2
    expect(score).toBe(0);
  });
});
