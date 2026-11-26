import { AgentBrowser } from '@mastra/agent-browser';
import type { AgentBrowserConfig } from '@mastra/agent-browser';
import { resolveViewportSize } from '@mastra/core/browser';
import type { PlatformAccessToken } from '@mastra/platform-workspace';
import { PlatformBrowserSessions } from './sessions';
import type { PlatformBrowserSessionOptions } from './sessions';
import { PlatformBrowserThreadManager } from './thread-manager';

export type { PlatformBrowserSessionOptions } from './sessions';

export interface PlatformBrowserOptions extends Omit<
  AgentBrowserConfig,
  'cdpUrl' | 'cdpHeaders' | 'createThreadManager' | 'profile' | 'executablePath' | 'recording'
> {
  /** Platform access token. Falls back to `MASTRA_PLATFORM_ACCESS_TOKEN`, then `MASTRA_PLATFORM_SECRET_KEY`. */
  accessToken?: PlatformAccessToken;
  /** Mastra Platform project ID. Falls back to `MASTRA_PROJECT_ID`. */
  projectId?: string;
  /** Environment the browsers belong to. Falls back to `MASTRA_ENVIRONMENT_ID`. */
  environmentId?: string;
  /** Options for every hosted browser this instance starts. */
  session?: PlatformBrowserSessionOptions;
  fetch?: typeof fetch;
}

/**
 * Hosted browsers from Mastra Platform, driven with the same tools as {@link AgentBrowser}.
 *
 * Each thread gets its own browser by default (`scope: 'thread'`), ended when the thread's browser
 * closes. With `scope: 'shared'`, every thread drives one browser, ended when this instance closes.
 * The workspace proxy URL follows `MASTRA_WORKSPACE_PROXY_URL` or `MASTRA_PLATFORM_REGION`.
 */
export class PlatformBrowser extends AgentBrowser {
  override readonly name = 'PlatformBrowser';
  override readonly provider = 'mastra/platform';

  readonly #sessions: PlatformBrowserSessions;
  readonly #shared: { id?: string };

  constructor(options: PlatformBrowserOptions = {}) {
    const { accessToken, projectId, environmentId, session, fetch: fetchImpl, ...browserConfig } = options;
    const viewport = resolveViewportSize(browserConfig.viewport);
    const sessions = new PlatformBrowserSessions({
      accessToken,
      projectId,
      environmentId,
      session,
      fetch: fetchImpl,
      viewport,
    });
    const shared: { id?: string } = {};

    if (browserConfig.scope === 'shared') {
      super({
        ...browserConfig,
        scope: 'shared',
        cdpUrl: async () => {
          // A relaunch after the browser closed starts a fresh one; end the old one first.
          if (shared.id) await sessions.end(shared.id).catch(() => {});
          const opened = await sessions.open();
          shared.id = opened.id;
          return opened.cdpUrl;
        },
      });
    } else {
      super({
        ...browserConfig,
        scope: 'thread',
        createThreadManager: config => new PlatformBrowserThreadManager({ ...config, sessions }),
      });
    }
    this.#sessions = sessions;
    this.#shared = shared;
  }

  /** Platform browsers always run on a remote host, so their PID must never be captured (issue #23588). */
  protected override isRemoteThreadBrowser(): boolean {
    return true;
  }

  protected override async doClose(): Promise<void> {
    await super.doClose();
    const id = this.#shared.id;
    if (!id) return;
    this.#shared.id = undefined;
    await this.#sessions.end(id).catch(error => {
      this.logger?.warn?.(`PlatformBrowser: couldn't end browser ${id}: ${error}`);
    });
  }
}
