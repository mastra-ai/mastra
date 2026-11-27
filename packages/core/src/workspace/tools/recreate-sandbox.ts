import { z } from 'zod/v4';
import { createTool } from '../../tools';
import type { ToolExecutionContext } from '../../tools/types';
import { requireSandbox } from './helpers';

export const RECREATE_SANDBOX_TOOL_ID = 'recreate_sandbox';

export interface RecreateSandboxToolOptions {
  /** Tool id. Defaults to `recreate_sandbox`. */
  id?: string;
  /**
   * Replaces the sandbox. Defaults to the workspace sandbox's `_reset()`.
   * Hosts that track the sandbox elsewhere (a stored id, a lock) pass their
   * own, which should end in `_reset()` on the instance the run holds.
   */
  reset?: (input: { reason: string; context: ToolExecutionContext }) => Promise<void>;
}

type Resettable = { _reset(options?: { timeoutMs?: number }): Promise<void> };

function canReset(sandbox: object): sandbox is Resettable {
  return typeof (sandbox as Partial<Resettable>)._reset === 'function';
}

/**
 * A tool the agent calls to replace a sandbox that stopped working. The run
 * keeps its sandbox instance; the next command starts a fresh environment
 * and runs setup again.
 */
export function createRecreateSandboxTool(options: RecreateSandboxToolOptions = {}) {
  return createTool({
    id: options.id ?? RECREATE_SANDBOX_TOOL_ID,
    description: [
      'Destroy your sandbox and replace it with a fresh one. Use it only to recover when the sandbox stops working: commands that time out even for `echo ok`, or errors like "onStart hook failed".',
      "Everything in the sandbox's environment that is not saved elsewhere may be lost for good: changed and new files, installed dependencies, build output and running processes.",
      "Save what you can first. If the sandbox can't run commands, call it anyway without waiting for anyone, and mention what was lost in your reply.",
      'Your next command starts the new sandbox, which runs setup again, so it may take a while. Check the state of your files before going on.',
    ].join(' '),
    inputSchema: z
      .object({
        reason: z.string().trim().min(1).max(500).describe('What went wrong with the sandbox.'),
      })
      .strict(),
    execute: async ({ reason }, context) => {
      if (options.reset) {
        await options.reset({ reason, context });
      } else {
        const { sandbox } = requireSandbox(context);
        if (!canReset(sandbox)) throw new Error("This sandbox can't be recreated.");
        await sandbox._reset();
      }
      return { recreated: true, next: 'Your next command starts a fresh sandbox.' };
    },
  });
}
