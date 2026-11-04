import type { BrowserCookie, MastraBrowser } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import { supportsNetworking } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
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
  /** The browser session agents drive, when Factory has one. */
  browser?: MastraBrowser;
}

/** A sandbox that can sign a browser in to a private port, like `PlatformSandbox`. */
interface PortAuthCookieSandbox {
  getPortAuthCookie(port: number): Promise<BrowserCookie | null>;
}

function hasPortAuthCookie(sandbox: object): sandbox is PortAuthCookieSandbox {
  return typeof (sandbox as Partial<PortAuthCookieSandbox>).getPortAuthCookie === 'function';
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
      'Get the link that opens a port in your sandbox in a browser, so you or the person you are working with can see a server you started there (a dev server, a preview, an API).',
      'Start the server first, in the background and without a timeout, or it may stop.',
      "Dev servers that check the Host header (like Vite) see a different host than the link, so allow all hosts up front, such as Vite's `server.allowedHosts: true`.",
      'The link does not expire, so you can share it. Depending on the sandbox, it may only open for people signed in to your organization.',
      'It also lets your own browser tool open that port for the next hour. If your browser later lands on a sign-in page, call this again.',
    ].join(' '),
    inputSchema: z
      .object({
        port: z.number().int().min(1).max(65_535).describe('The port the server listens on inside the sandbox.'),
      })
      .strict(),
    execute: async ({ port }, context) => {
      const sourceControl = await deps.sessions.getSourceControlBySessionId(scope.sessionId);
      const sandbox =
        sourceControl && (await deps.findSandbox({ sourceControl, orgId: scope.orgId, sessionId: scope.sessionId }));
      if (!sandbox) throw new Error('This session has no sandbox running yet. Run a command to start one.');
      if (!supportsNetworking(sandbox as WorkspaceSandbox)) {
        throw new Error("This session's sandbox can't expose ports.");
      }
      const url = await (sandbox as WorkspaceSandbox).networking!.getPortUrl(port);
      if (!url) throw new Error(`Port ${port} can't be opened from this sandbox.`);
      // The browser tool can't sign in, so it gets the port auth cookie directly.
      // The cookie never goes back to the model.
      const threadId = context?.agent?.threadId;
      if (threadId && deps.browser && hasPortAuthCookie(sandbox)) {
        // The link works either way; without the cookie the browser just has to sign in.
        await sandbox
          .getPortAuthCookie(port)
          .then(cookie => cookie && deps.browser!.setCookies([cookie], threadId))
          .catch(error => {
            console.warn("[Mastra Factory] Couldn't sign the session's browser in to a sandbox port", {
              sessionId: scope.sessionId,
              port,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }
      return { url };
    },
  });

  return { factory_recreate_sandbox: recreate, factory_sandbox_port_url: portUrl };
}
