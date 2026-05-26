import { createInterface } from 'node:readline';

import type { LeaseRecoveryAction, LeaseRecoveryPromptHandler, LeaseRecoveryPromptInfo } from './config.js';

/**
 * Stdio-driven prompt invoked during `MastraCodeHarnessRuntime.init()` when a
 * stale Harness v1 session lease is held by another process. The handler
 * resolves to `wait` immediately when stdin is not a TTY so headless callers
 * stay non-interactive without an explicit `MASTRACODE_LEASE_RECOVERY` value.
 */
export function defaultStdioLeaseRecoveryPrompt(): LeaseRecoveryPromptHandler {
  return async (info: LeaseRecoveryPromptInfo): Promise<LeaseRecoveryAction> => {
    // Re-check TTY state at invocation time so tests / embedders that flip
    // `process.stdin.isTTY` after construction get the right behavior.
    if (!process.stdin.isTTY) return 'wait';
    const expires =
      Number.isFinite(info.expiresAt) && info.expiresAt > 0
        ? new Date(info.expiresAt).toLocaleTimeString()
        : 'an unknown time';
    const newThreadLine = info.allowNewThread
      ? `  (N)ew thread — abandon this thread and start a new one (loses continuity with thread history)\n`
      : '';
    const choiceHint = info.allowNewThread ? '[W/f/n/q]' : '[W/f/q]';
    process.stderr.write(
      `\nA previous MastraCode Harness session lease for thread "${info.threadId}" is still held by another process (owner "${info.currentOwnerId}", expires at ${expires}). Waited ${info.secondsWaited}s.\n` +
        `  (W)ait for the lease to expire (up to 60s total) — safe default\n` +
        `  (F)orce-claim the lease — only safe if the other process is known dead\n` +
        newThreadLine +
        `  (Q)uit\n` +
        `Tip: set MASTRACODE_LEASE_RECOVERY=force-claim|wait|new-thread|quit to skip this prompt next time.\n` +
        `Choice ${choiceHint}: `,
    );
    const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
    let closed = false;
    rl.once('close', () => {
      closed = true;
    });
    try {
      for (;;) {
        if (closed) return 'wait';
        // `rl.question` never resolves if stdin closes mid-prompt (Ctrl+D,
        // piped input ends); the `close` listener short-circuits to 'wait'
        // via the loop guard above.
        const answer = await new Promise<string>(resolve => {
          rl.question('', resolve);
          rl.once('close', () => resolve(''));
        });
        if (closed) return 'wait';
        const normalized = answer.trim().toLowerCase();
        if (normalized === '' || normalized === 'w' || normalized === 'wait') return 'wait';
        if (normalized === 'f' || normalized === 'force' || normalized === 'force-claim') return 'force-claim';
        if (info.allowNewThread && (normalized === 'n' || normalized === 'new' || normalized === 'new-thread')) {
          return 'new-thread';
        }
        if (normalized === 'q' || normalized === 'quit') return 'quit';
        process.stderr.write(`Please choose ${choiceHint.replace(/[\[\]]/g, '').toUpperCase()}: `);
      }
    } finally {
      rl.close();
    }
  };
}
