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
  /** The session's running sandbox, if this process has one. */
  findSandbox: (input: RecreateSessionSandboxInput) => Promise<object | undefined>;
}

interface PortUrlSandbox {
  getPortUrl(port: number): Promise<{ url: string; signInUrl: string }>;
}

function hasPortUrl(sandbox: object): sandbox is PortUrlSandbox {
  return typeof (sandbox as Partial<PortUrlSandbox>).getPortUrl === 'function';
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
      "Push what you can first. If the sandbox can't run commands, call it anyway without waiting for anyone, and mention what was lost in your reply.",
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

  const portUrl = createTool({
    id: 'factory_sandbox_port_url',
    description: [
      'Get links that open a port in your sandbox in a browser, so you or the person you are working with can see a server you started there (a dev server, a preview, an API).',
      'Start the server first and bind it to 0.0.0.0, not 127.0.0.1.',
      '`url` is the link to share: it only opens for people signed in with access to this sandbox, and it does not expire.',
      '`signInUrl` is only for your own browser tool, which cannot sign in. It works once and expires after a minute. Never share it or post it anywhere.',
      'A browser signed in to one port can reach every port of this sandbox, so a page can call an API on another port.',
    ].join(' '),
    inputSchema: z
      .object({
        port: z.number().int().min(1).max(65_535).describe('The port the server listens on inside the sandbox.'),
      })
      .strict(),
    execute: async ({ port }) => {
      const sourceControl = await deps.sessions.getSourceControlBySessionId(scope.sessionId);
      const sandbox =
        sourceControl && (await deps.findSandbox({ sourceControl, orgId: scope.orgId, sessionId: scope.sessionId }));
      if (!sandbox) throw new Error('This session has no sandbox running yet. Run a command to start one.');
      if (!hasPortUrl(sandbox)) throw new Error("This session's sandbox can't expose ports.");
      return sandbox.getPortUrl(port);
    },
  });

  return { factory_recreate_sandbox: recreate, factory_sandbox_port_url: portUrl };
}
