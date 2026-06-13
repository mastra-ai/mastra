import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { executeHook, runHooksForEvent } from './executor.js';
import type { HookDefinition, HookStdin } from './types.js';

const tempDirs: string[] = [];

function tempCwd() {
  const dir = mkdtempSync(join(tmpdir(), 'mastracode-hook-executor-'));
  tempDirs.push(dir);
  return dir;
}

function stdin(overrides: Partial<HookStdin> = {}): HookStdin {
  return {
    session_id: 'session-test',
    cwd: tempCwd(),
    hook_event_name: 'UserPromptSubmit',
    user_message: 'hello hooks',
    ...overrides,
  } as HookStdin;
}

function hook(command: string, overrides: Partial<HookDefinition> = {}): HookDefinition {
  return {
    type: 'command',
    command,
    description: 'test hook',
    timeout: 1000,
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('hook executor', () => {
  it('passes JSON stdin and event env to hook commands and parses JSON stdout', async () => {
    const result = await executeHook(
      hook(
        `node -e "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { const payload = JSON.parse(input); console.log(JSON.stringify({ additionalContext: payload.user_message + ':' + process.env.MASTRA_HOOK_EVENT })); });"`,
      ),
      stdin(),
    );

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toEqual({ additionalContext: 'hello hooks:UserPromptSubmit' });
  });

  it('times out hung hook commands and reports a warning', async () => {
    const result = await runHooksForEvent(
      [hook(`node -e "setTimeout(() => {}, 1000)"`, { timeout: 20, description: 'hung hook' })],
      stdin(),
    );

    expect(result.allowed).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.timedOut).toBe(true);
    expect(result.warnings).toEqual(['Hook timed out after 20ms: node -e "setTimeout(() => {}, 1000)"']);
  });

  it('blocks blocking events on exit code 2 with parsed reason and accumulated context', async () => {
    const result = await runHooksForEvent(
      [
        hook(`node -e "console.log(JSON.stringify({ additionalContext: 'first context' }))"`),
        hook(`node -e "console.log(JSON.stringify({ additionalContext: 'second context', reason: 'blocked from stdout' })); process.exit(2)"`),
      ],
      stdin(),
    );

    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe('blocked from stdout');
    expect(result.additionalContext).toBe('first context\nsecond context');
    expect(result.results).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it('treats exit code 2 as a warning for non-blocking events', async () => {
    const result = await runHooksForEvent(
      [hook(`node -e "console.error('post hook warning'); process.exit(2)"`, { description: 'post hook' })],
      stdin({ hook_event_name: 'PostToolUse', tool_name: 'view', tool_input: {}, tool_output: 'ok' }),
      { tool_name: 'view' },
    );

    expect(result.allowed).toBe(true);
    expect(result.blockReason).toBeUndefined();
    expect(result.warnings).toEqual(['post hook: post hook warning']);
  });
});
