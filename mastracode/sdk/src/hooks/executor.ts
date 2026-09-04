/**
 * Hook process execution.
 * Spawns shell commands, handles stdin/stdout/exit-code protocol.
 */

import { spawn } from 'node:child_process';
import type { HookDefinition, HookStdin, HookResult, HookStdout, HookEventResult } from './types.js';
import { isBlockingEvent } from './types.js';

const DEFAULT_TIMEOUT = 10_000;

export async function executeHook(hook: HookDefinition, stdinPayload: HookStdin): Promise<HookResult> {
  const timeout = hook.timeout ?? DEFAULT_TIMEOUT;
  const startTime = Date.now();

  return new Promise<HookResult>(resolve => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : '/bin/sh';
    const shellArgs = isWindows ? ['/c', hook.command] : ['-c', hook.command];

    const child = spawn(shell, shellArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: stdinPayload.cwd,
      // Without this, Node's default Windows argument escaping re-quotes
      // hook.command before cmd.exe ever sees it, so a quoted path (or any
      // path containing spaces) reaches the child process with literal "
      // characters embedded in it. mastracode/tui's shell-runner.ts already
      // sets this for its own cmd invocations; this call site just missed it.
      ...(isWindows ? { windowsVerbatimArguments: true } : {}),
      env: {
        ...process.env,
        MASTRA_HOOK_EVENT: stdinPayload.hook_event_name,
      },
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let resolved = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', exitCode => {
      clearTimeout(timer);
      if (resolved) return;
      resolved = true;

      let parsedStdout: HookStdout | undefined;
      if (stdout.trim()) {
        try {
          parsedStdout = JSON.parse(stdout.trim()) as HookStdout;
        } catch {
          // Not valid JSON — ignore
        }
      }

      resolve({
        hook,
        exitCode: exitCode ?? 1,
        stdout: parsedStdout,
        stderr: stderr.trim() || undefined,
        timedOut,
        durationMs: Date.now() - startTime,
      });
    });

    child.on('error', error => {
      clearTimeout(timer);
      if (resolved) return;
      resolved = true;

      resolve({
        hook,
        exitCode: 1,
        stderr: error.message,
        timedOut: false,
        durationMs: Date.now() - startTime,
      });
    });

    // A hook that never reads stdin (or exits before we finish writing) closes
    // the pipe under us. That surfaces asynchronously as an EPIPE 'error' event
    // on the socket, which Node escalates to an unhandled error — taking the
    // whole host process down — unless something is listening. The hook's real
    // outcome still arrives via 'close', so absorb it.
    child.stdin?.on('error', () => {});

    try {
      child.stdin?.write(JSON.stringify(stdinPayload));
      child.stdin?.end();
    } catch {
      // Synchronous stdin write failure — process continues
    }
  });
}

export function matchesHook(hook: HookDefinition, context: { tool_name?: string }): boolean {
  if (!hook.matcher) return true;

  if (hook.matcher.tool_name) {
    if (!context.tool_name) return false;
    try {
      return new RegExp(hook.matcher.tool_name).test(context.tool_name);
    } catch {
      return false;
    }
  }

  return true;
}

export async function runHooksForEvent(
  hooks: HookDefinition[],
  stdinPayload: HookStdin,
  matchContext: { tool_name?: string } = {},
): Promise<HookEventResult> {
  const results: HookResult[] = [];
  const warnings: string[] = [];
  let additionalContext: string | undefined;

  const applicable = hooks.filter(h => matchesHook(h, matchContext));
  if (applicable.length === 0) {
    return { allowed: true, results: [], warnings: [] };
  }

  const blocking = isBlockingEvent(stdinPayload.hook_event_name);

  for (const hook of applicable) {
    const result = await executeHook(hook, stdinPayload);
    results.push(result);

    if (result.stdout?.additionalContext) {
      additionalContext = additionalContext
        ? `${additionalContext}\n${result.stdout.additionalContext}`
        : result.stdout.additionalContext;
    }

    if (result.timedOut) {
      warnings.push(`Hook timed out after ${hook.timeout ?? DEFAULT_TIMEOUT}ms: ${hook.command}`);
      continue;
    }

    if (result.exitCode === 2 && blocking) {
      const reason = result.stdout?.reason || result.stderr || `Blocked by hook: ${hook.description || hook.command}`;

      return {
        allowed: false,
        blockReason: reason,
        additionalContext,
        results,
        warnings,
      };
    }

    if (result.exitCode === 0) continue;

    const warnMsg = result.stderr || `Hook exited with code ${result.exitCode}`;
    warnings.push(`${hook.description || hook.command}: ${warnMsg}`);
  }

  return { allowed: true, additionalContext, results, warnings };
}
