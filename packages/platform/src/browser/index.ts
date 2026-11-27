import { PlatformApiError, PlatformClient } from '@mastra/platform-workspace';
import { StagehandBrowser } from '@mastra/stagehand';
import type { StagehandBrowserConfig } from '@mastra/stagehand';
import { PlatformBrowserSessions } from './sessions';
import type { CreatePlatformBrowserSessionInput } from './sessions';

export * from './sessions';

export interface PlatformBrowserOptions extends Omit<
  StagehandBrowserConfig,
  'cdpUrl' | 'scope' | 'env' | 'apiKey' | 'projectId'
> {
  /** CDP URL of a browser that is already running. Skips the Platform: no access token or project needed. */
  cdpUrl?: string;
  /** A running Platform browser session to connect to, instead of starting one. */
  sessionId?: string;
  /** Environment to start the session in. Falls back to `MASTRA_ENVIRONMENT_ID`. */
  environmentId?: string;
  /** Settings for the session this browser starts. */
  session?: Omit<CreatePlatformBrowserSessionInput, 'environmentId'>;
  /** Platform access token. Falls back to `MASTRA_PLATFORM_ACCESS_TOKEN`, then `MASTRA_PLATFORM_SECRET_KEY`. */
  accessToken?: string;
  /** Mastra Platform project ID. Falls back to `MASTRA_PROJECT_ID`. */
  projectId?: string;
  fetch?: typeof fetch;
}

/**
 * A Stagehand browser running on Mastra Platform. It starts a hosted browser session the first time
 * it is used, or connects to `sessionId`. Each connection gets a fresh CDP URL, so the browser can
 * reconnect after the URL expires.
 */
export class PlatformBrowser extends StagehandBrowser {
  readonly #state: { sessionId?: string };

  constructor(options: PlatformBrowserOptions = {}) {
    const {
      cdpUrl,
      sessionId,
      environmentId = process.env.MASTRA_ENVIRONMENT_ID,
      session,
      accessToken,
      projectId,
      fetch,
      ...stagehandOptions
    } = options;
    const state: { sessionId?: string } = { sessionId };

    let connect: () => Promise<string>;
    if (!cdpUrl) {
      if (!sessionId && !environmentId) throw new Error('PlatformBrowser: environmentId is required');
      const sessions = new PlatformBrowserSessions(new PlatformClient({ accessToken, projectId, fetch }));
      const start = async () => (await sessions.create({ ...session, environmentId: environmentId! })).id;
      connect = async () => {
        state.sessionId ??= await start();
        try {
          return (await sessions.cdpUrl(state.sessionId)).url;
        } catch (error) {
          // A session this browser started has ended (idle timeout, max duration): start another.
          if (sessionId || !(error instanceof PlatformApiError && error.status === 409)) throw error;
          state.sessionId = await start();
          return (await sessions.cdpUrl(state.sessionId)).url;
        }
      };
    }

    super({ ...stagehandOptions, scope: 'shared', cdpUrl: cdpUrl || connect! });
    this.#state = state;
  }

  /** The Platform browser session, once one is started or when `sessionId` was given. */
  get sessionId(): string | undefined {
    return this.#state.sessionId;
  }
}
