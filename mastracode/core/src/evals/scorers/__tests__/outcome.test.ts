import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';
import { createOutcomeScorer } from '../outcome';

/**
 * Build a minimal MastraDBMessage with tool-invocation parts.
 */
function makeMsg(
  role: 'user' | 'assistant',
  toolInvocations: Array<{
    toolName: string;
    args?: Record<string, unknown>;
    result?: unknown;
    state?: string;
  }> = [],
): MastraDBMessage {
  return {
    id: crypto.randomUUID(),
    role,
    createdAt: new Date(),
    content: {
      format: 2 as const,
      parts: toolInvocations.map(inv => ({
        type: 'tool-invocation' as const,
        toolInvocation: {
          toolCallId: crypto.randomUUID(),
          toolName: inv.toolName,
          args: inv.args ?? {},
          result: inv.result ?? null,
          state: (inv.state ?? 'result') as 'result',
        },
      })),
    },
  };
}

function cmd(command: string, exitCode: number) {
  return { toolName: 'execute_command', args: { command }, result: { exitCode } };
}

function tool(name: string, args: Record<string, unknown> = {}, result: unknown = null, state = 'result') {
  return { toolName: name, args, result, state };
}

function errorTool(name: string, args: Record<string, unknown> = {}, result: unknown = null) {
  return { toolName: name, args, result, state: 'error' };
}

/** Minimal agent-type scorer input */
const agentInput = {
  inputMessages: [] as MastraDBMessage[],
  rememberedMessages: [] as MastraDBMessage[],
  systemMessages: [],
  taggedSystemMessages: {},
};

describe('Outcome Scorer', () => {
  const scorer = createOutcomeScorer();

  describe('empty / minimal sessions', () => {
    it('scores 0 for empty messages', async () => {
      const { score } = await scorer.run({ input: agentInput, output: [], groundTruth: {} });
      expect(score).toBe(0);
    });

    it('scores 0 for text-only session (no tool calls)', async () => {
      const msgs: MastraDBMessage[] = [
        {
          id: '1',
          role: 'user',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text' as const, text: 'hello' }] },
        },
        {
          id: '2',
          role: 'assistant',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text' as const, text: 'hi there' }] },
        },
      ];
      const { score } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(score).toBe(0);
    });
  });

  describe('build detection', () => {
    it('detects build pass from exit code 0', async () => {
      const msgs = [makeMsg('assistant', [cmd('tsc --noEmit', 0)])];
      const { score, reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(score).toBeGreaterThan(0);
      expect(reason).toContain('Build/typecheck passed');
    });

    it('detects build failure from non-zero exit code', async () => {
      const msgs = [makeMsg('assistant', [cmd('tsc --noEmit', 1)])];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('Build failed');
    });

    it('handles compound command with build segment', async () => {
      const msgs = [makeMsg('assistant', [cmd('pnpm build && pnpm test', 0)])];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      // Should recognize both build and test dimensions
      expect(reason).toContain('Build/typecheck passed');
      expect(reason).toContain('Tests passed');
    });

    it('does not classify pure test commands as builds', async () => {
      const msgs = [makeMsg('assistant', [cmd('pnpm test', 0)])];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('No build/typecheck ran');
    });

    it('uses the last build command result', async () => {
      const msgs = [makeMsg('assistant', [cmd('tsc --noEmit', 1)]), makeMsg('assistant', [cmd('tsc --noEmit', 0)])];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('Build/typecheck passed');
    });
  });

  describe('test detection', () => {
    it('detects test pass from exit code 0', async () => {
      const msgs = [makeMsg('assistant', [cmd('vitest run', 0)])];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('Tests passed');
    });

    it('detects test failure', async () => {
      const msgs = [makeMsg('assistant', [cmd('vitest run', 1)])];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('Tests failed');
    });

    it('infers test pass from output text when no exit code', async () => {
      const msgs = [
        makeMsg('assistant', [
          { toolName: 'execute_command', args: { command: 'vitest run' }, result: '5 tests passed ✓' },
        ]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('Tests passed (inferred)');
    });
  });

  describe('tool errors', () => {
    it('scores 1.0 when no tool errors', async () => {
      const msgs = [
        makeMsg('assistant', [tool('view', { path: 'a.ts' }), tool('string_replace_lsp', { path: 'a.ts' })]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('No tool errors');
    });

    it('excludes benign error tools from penalty', async () => {
      // Only benign error tools (search_content, find_files) — no non-benign tools present
      const msgs = [
        makeMsg('assistant', [errorTool('search_content', { pattern: 'foo' }), errorTool('find_files', { path: '.' })]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('All tool calls are benign-error tools');
    });

    it('penalizes non-benign tool errors', async () => {
      const msgs = [
        makeMsg('assistant', [
          errorTool('string_replace_lsp', { path: 'a.ts' }),
          tool('string_replace_lsp', { path: 'a.ts' }),
        ]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('tools errored');
    });
  });

  describe('stuck loops', () => {
    it('detects consecutive identical calls', async () => {
      const msgs = [
        makeMsg('assistant', [
          errorTool('string_replace_lsp', { path: 'a.ts', old_string: 'x' }),
          errorTool('string_replace_lsp', { path: 'a.ts', old_string: 'x' }),
          errorTool('string_replace_lsp', { path: 'a.ts', old_string: 'x' }),
        ]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('consecutive identical calls');
    });

    it('no loop detection when calls are varied', async () => {
      const msgs = [
        makeMsg('assistant', [
          tool('view', { path: 'a.ts' }),
          tool('string_replace_lsp', { path: 'a.ts' }),
          tool('view', { path: 'b.ts' }),
        ]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('No stuck loops');
    });
  });

  describe('regression', () => {
    it('detects persistent regression (build passed then failed)', async () => {
      const msgs = [
        makeMsg('assistant', [cmd('tsc --noEmit', 0)]),
        makeMsg('assistant', [tool('string_replace_lsp', { path: 'a.ts' })]),
        makeMsg('assistant', [cmd('tsc --noEmit', 1)]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('regressed (persisted)');
    });

    it('gives partial credit for recovered regression', async () => {
      const msgs = [
        makeMsg('assistant', [cmd('tsc --noEmit', 0)]),
        makeMsg('assistant', [cmd('tsc --noEmit', 1)]),
        makeMsg('assistant', [cmd('tsc --noEmit', 0)]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('regressed then recovered');
    });

    it('scores 1.0 when no regression', async () => {
      const msgs = [makeMsg('assistant', [cmd('tsc --noEmit', 0)]), makeMsg('assistant', [cmd('tsc --noEmit', 0)])];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('No regressions');
    });
  });

  describe('autonomy', () => {
    it('scores 1.0 when no ask_user calls', async () => {
      const msgs = [makeMsg('assistant', [tool('view', { path: 'a.ts' })])];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('No ask_user calls');
    });

    it('penalizes ask_user calls', async () => {
      const msgs = [
        makeMsg('assistant', [
          tool('ask_user', { question: 'what color?' }),
          tool('ask_user', { question: 'which file?' }),
          tool('view', { path: 'a.ts' }),
        ]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('2 ask_user calls');
    });
  });

  describe('N/A dimensions', () => {
    it('excludes non-applicable dimensions from weighted average', async () => {
      // Session with only edit calls — no build, no tests
      const msgs = [
        makeMsg('assistant', [tool('view', { path: 'a.ts' }), tool('string_replace_lsp', { path: 'a.ts' })]),
      ];
      const { score, reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      // Build and Tests should be N/A, excluded from average
      expect(reason).toContain('N/A — excluded from average');
      // Score should still be meaningful (tool errors + loops + regression + autonomy)
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('getExitCode parsing', () => {
    it('parses exit code from object with exitCode field', async () => {
      const msgs = [
        makeMsg('assistant', [
          { toolName: 'execute_command', args: { command: 'tsc --noEmit' }, result: { exitCode: 2 } },
        ]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('Build failed (exit 2)');
    });

    it('parses exit code from string with "exit code N" pattern', async () => {
      const msgs = [
        makeMsg('assistant', [
          { toolName: 'execute_command', args: { command: 'tsc --noEmit' }, result: 'Process exited with code 1' },
        ]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('Build failed (exit 1)');
    });

    it('returns ambiguous score when exit code unknown', async () => {
      const msgs = [
        makeMsg('assistant', [
          { toolName: 'execute_command', args: { command: 'tsc --noEmit' }, result: 'some output...' },
        ]),
      ];
      const { reason } = await scorer.run({ input: agentInput, output: msgs, groundTruth: {} });
      expect(reason).toContain('outcome unclear');
    });
  });
});
