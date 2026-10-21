import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { RecreateSessionSandboxInput } from '../sandbox/session-retirement.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { FactoryToolScope } from './scope.js';

export interface FactorySandboxToolDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getSourceControlBySessionId'>;
  /** `SessionRetirementCoordinator.resetSessionSandbox`. */
  resetSandbox: (input: RecreateSessionSandboxInput) => Promise<'reset' | 'not-found' | 'not-here'>;
}

/** Tools a session uses on its own sandbox. Every session with a sandbox gets them. */
export function createFactorySandboxTools(
  scope: FactoryToolScope,
  deps: FactorySandboxToolDependencies,
): IntegrationTools {
  const recreate = createTool({
    id: 'factory_recreate_sandbox',
    description: [
      'Destroy this session\'s sandbox and replace it with a fresh one. Use it only to recover when the sandbox stops working: commands that time out even for `echo ok`, or errors like "onStart hook failed".',
      'This deletes the VM. Everything in it that is not committed and pushed is lost for good: uncommitted and unpushed changes, untracked files, installed dependencies, build output and running processes.',
      'Before calling it, try to push what you can.',
      'Your next command starts the new sandbox, which clones the repositories and runs setup again, so it takes a while. Check the branch and working tree before going on.',
    ].join(' '),
    inputSchema: z
      .object({
        reason: z.string().trim().min(1).max(500).describe('What went wrong with the sandbox.'),
      })
      .strict(),
    execute: async ({ reason }) => {
      const sourceControl = await deps.sessions.getSourceControlBySessionId(scope.sessionId);
      if (!sourceControl) throw new Error('This session has no sandbox to recreate.');
      console.warn('[Mastra Factory] Session agent is recreating its sandbox', {
        orgId: scope.orgId,
        sessionId: scope.sessionId,
        reason,
      });
      const outcome = await deps.resetSandbox({ sourceControl, orgId: scope.orgId, sessionId: scope.sessionId });
      if (outcome === 'not-found') throw new Error('This session has no sandbox to recreate.');
      if (outcome === 'not-here') {
        throw new Error('This session has no sandbox running yet. Run a command to start one.');
      }
      return { recreated: true, next: 'Your next command starts a fresh sandbox.' };
    },
  });
  return { factory_recreate_sandbox: recreate };
}
