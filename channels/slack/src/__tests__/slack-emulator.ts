import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  Hono,
  Store,
  WebhookDispatcher,
  authMiddleware,
  createApiErrorHandler,
  createErrorHandler,
  serve,
} from '@emulators/core';
import type { AppEnv, AuthUser, Context, TokenMap } from '@emulators/core';
import { getSlackStore, seedFromConfig, slackPlugin } from '@emulators/slack';
import type { SlackSeedConfig, SlackStore } from '@emulators/slack';

export interface SlackEmulator {
  /** Base URL of the running emulator (e.g. http://127.0.0.1:54321). Use as SlackProvider/adapter `apiUrl`. */
  url: string;
  /** Raw emulator store. */
  store: Store;
  /** Typed Slack store collections for assertions (messages, tokens, installations, ...). */
  slackStore: SlackStore;
  /** Webhook dispatcher for delivering inbound events. */
  webhooks: WebhookDispatcher;
  /** Auth token map. */
  tokenMap: TokenMap;
  /**
   * Drive the emulator's OAuth authorize callback to mint a real one-time code for the
   * seeded app + user. Returns the `code` the provider's `/slack/oauth/callback` expects.
   */
  mintOAuthCode: (params: {
    clientId: string;
    redirectUri: string;
    userId: string;
    scope?: string;
    state?: string;
  }) => Promise<string>;
  /**
   * Records of manifest API calls made against the emulator, in order. Only populated when
   * `registerManifestRoutes` is enabled. Useful for asserting create/update/delete drift.
   */
  manifestCalls: () => ManifestCall[];
  /**
   * Authorize any bot tokens currently in the store (e.g. minted by the OAuth flow) with the auth
   * token map so adapter Web API calls succeed. Call after an OAuth install before driving events.
   */
  syncBotTokens: () => void;
  /** Reset emulator state to the seeded baseline. */
  reset: () => Promise<void>;
  /** Shut down the emulator HTTP server. */
  close: () => Promise<void>;
}

export interface ManifestCall {
  action: 'create' | 'update' | 'delete';
  appId?: string;
  manifest?: unknown;
}

const MANIFEST_CALLS_KEY = 'slack.test.manifestCalls';

export interface StartSlackEmulatorOptions {
  /**
   * Register stateful `tooling.tokens.rotate` + `apps.manifest.create/update/delete` routes.
   * The upstream Slack emulator does not implement the App Manifest API, so these are added
   * here so `SlackProvider.connect()` (which creates an app + rotates config tokens) can run
   * fully against the emulator. `apps.manifest.create` inserts a real `oauth_app` so the
   * subsequent `oauth.v2.access` exchange validates the client credentials.
   */
  registerManifestRoutes?: boolean;
  /**
   * Register stateful `chat.startStream` / `chat.appendStream` / `chat.stopStream` routes.
   * The upstream Slack emulator does not implement Slack's native streaming API, but the
   * `@chat-adapter/slack` adapter uses it when streaming a reply (the path exercised by
   * `AgentChannels` ownerStream). These handlers accumulate the streamed markdown and persist
   * a real message into the `messages` store on `stopStream`, so streamed replies are
   * assertable exactly like `chat.postMessage` replies. Defaults to `true`.
   */
  registerStreamingRoutes?: boolean;
}

/**
 * Boot an in-process Slack emulator on an ephemeral 127.0.0.1 port (no network, no Docker).
 * Mirrors the emulator's own `startSlackTestEmulator` boot pattern but seeds from an explicit
 * `SlackSeedConfig` so each suite controls its apps/users/channels/tokens.
 */
export async function startSlackEmulator(
  seed: SlackSeedConfig = {},
  options: StartSlackEmulatorOptions = {},
): Promise<SlackEmulator> {
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  const tokenMap: TokenMap = new Map();

  const app = new Hono<AppEnv>();
  app.onError(createApiErrorHandler());
  app.use('*', createErrorHandler());
  app.use('*', (authMiddleware as (tokens: TokenMap) => ReturnType<typeof authMiddleware>)(tokenMap));

  if (options.registerManifestRoutes) {
    registerManifestRoutes(app, store);
  }

  if (options.registerStreamingRoutes !== false) {
    registerStreamingRoutes(app, store);
    registerAssistantThreadStubs(app);
  }

  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }) as unknown as Server;
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', reject);
  });

  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  slackPlugin.register!(app, store, webhooks, url, tokenMap);

  // Register every bot token currently in the store with the auth token map so adapter calls
  // (e.g. chat.postMessage) authorize. Tokens minted at runtime by the OAuth flow are NOT in the
  // map until this runs, so tests that install via OAuth call `syncBotTokens()` before asserting.
  const syncBotTokens = () => {
    const ss = getSlackStore(store);
    for (const token of ss.tokens.all()) {
      if (token.token_type === 'bot' && !tokenMap.has(token.token)) {
        tokenMap.set(token.token, {
          login: token.bot_user_id ?? token.user_id ?? 'U000000001',
          id: 1,
          scopes: token.scopes ?? ['chat:write', 'channels:read'],
        });
      }
    }
  };

  const applySeed = () => {
    seedFromConfig(store, url, seed);
    syncBotTokens();
  };
  applySeed();

  const slackStore = getSlackStore(store);

  const mintOAuthCode: SlackEmulator['mintOAuthCode'] = async ({
    clientId,
    redirectUri,
    userId,
    scope = 'chat:write,channels:read',
    state = '',
  }) => {
    const res = await fetch(`${url}/oauth/v2/authorize/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({
        user_id: userId,
        redirect_uri: redirectUri,
        scope,
        user_scope: '',
        state,
        client_id: clientId,
      }),
    });
    const location = res.headers.get('location');
    if (!location) {
      throw new Error(`Emulator authorize callback did not redirect (status ${res.status})`);
    }
    const code = new URL(location).searchParams.get('code');
    if (!code) {
      throw new Error(`Emulator authorize callback returned no code: ${location}`);
    }
    return code;
  };

  return {
    url,
    store,
    slackStore,
    webhooks,
    tokenMap,
    mintOAuthCode,
    syncBotTokens,
    manifestCalls: () => store.getData<ManifestCall[]>(MANIFEST_CALLS_KEY) ?? [],
    reset: async () => {
      store.reset();
      tokenMap.clear();
      applySeed();
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      }),
  };
}

/**
 * Register a minimal, stateful App Manifest API on the emulator app. The upstream Slack
 * emulator does not implement these endpoints, so they are added here so SlackProvider can
 * create/update/delete apps and rotate config tokens fully against the emulator.
 */
function registerManifestRoutes(app: Hono<AppEnv>, store: Store): void {
  const recordCall = (call: ManifestCall) => {
    const calls = store.getData<ManifestCall[]>(MANIFEST_CALLS_KEY) ?? [];
    calls.push(call);
    store.setData(MANIFEST_CALLS_KEY, calls);
  };

  app.post('/api/tooling.tokens.rotate', c =>
    c.json({
      ok: true,
      token: 'xoxe.xoxp-rotated-' + Math.random().toString(36).slice(2, 10),
      refresh_token: 'xoxe-1-rotated-' + Math.random().toString(36).slice(2, 10),
    }),
  );

  app.post('/api/apps.manifest.create', async c => {
    const body = (await c.req.json().catch(() => ({}))) as { manifest?: { display_information?: { name?: string } } };
    const ss = getSlackStore(store);
    const appId = 'A' + Math.random().toString(36).slice(2, 12).toUpperCase();
    const clientId = `${Math.floor(Math.random() * 1e12)}.${Math.floor(Math.random() * 1e12)}`;
    const clientSecret = 'cs-' + Math.random().toString(36).slice(2, 18);
    const signingSecret = 'ss-' + Math.random().toString(36).slice(2, 18);

    ss.oauthApps.insert({
      app_id: appId,
      client_id: clientId,
      client_secret: clientSecret,
      name: body.manifest?.display_information?.name ?? 'Mastra App',
      redirect_uris: [],
      scopes: ['chat:write', 'channels:read'],
    });

    recordCall({ action: 'create', appId, manifest: body.manifest });

    const scopes = (body.manifest as { oauth_config?: { scopes?: { bot?: string[] } } } | undefined)?.oauth_config
      ?.scopes?.bot;
    const origin = new URL(c.req.url).origin;
    const authorizeUrl = new URL(`${origin}/oauth/v2/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    if (scopes?.length) authorizeUrl.searchParams.set('scope', scopes.join(','));

    return c.json({
      ok: true,
      app_id: appId,
      credentials: {
        client_id: clientId,
        client_secret: clientSecret,
        signing_secret: signingSecret,
      },
      oauth_authorize_url: authorizeUrl.toString(),
    });
  });

  app.post('/api/apps.manifest.update', async c => {
    const body = (await c.req.json().catch(() => ({}))) as { app_id?: string; manifest?: unknown };
    const ss = getSlackStore(store);
    const existing = body.app_id ? ss.oauthApps.findOneBy('app_id', body.app_id) : undefined;
    if (!existing) {
      return c.json({ ok: false, error: 'app_not_found' });
    }
    recordCall({ action: 'update', appId: body.app_id, manifest: body.manifest });
    return c.json({ ok: true });
  });

  app.post('/api/apps.manifest.delete', async c => {
    const body = (await c.req.json().catch(() => ({}))) as { app_id?: string };
    const ss = getSlackStore(store);
    const existing = body.app_id ? ss.oauthApps.findOneBy('app_id', body.app_id) : undefined;
    if (existing) {
      ss.oauthApps.delete(existing.id);
    }
    recordCall({ action: 'delete', appId: body.app_id });
    return c.json({ ok: true });
  });
}

/**
 * Stub the `assistant.threads.*` typing/title/prompt endpoints. The `@chat-adapter/slack` adapter
 * calls `assistant.threads.setStatus` (and friends) to render a typing indicator while streaming.
 * The upstream emulator does not implement them; the adapter treats failures as non-fatal, but
 * stubbing them keeps test output free of spurious 404 warnings.
 */
function registerAssistantThreadStubs(app: Hono<AppEnv>): void {
  for (const method of ['setStatus', 'setTitle', 'setSuggestedPrompts']) {
    app.post(`/api/assistant.threads.${method}`, c => c.json({ ok: true }));
  }
}

interface StreamChunk {
  type?: string;
  text?: string;
  markdown_text?: string;
}

/**
 * Register a minimal, stateful implementation of Slack's native streaming API
 * (`chat.startStream` / `chat.appendStream` / `chat.stopStream`). The upstream Slack emulator
 * does not implement these, but `@chat-adapter/slack` uses them when streaming a reply (the
 * ownerStream path in `AgentChannels`). Streamed `markdown_text` chunks are accumulated per
 * stream `ts`; on `stopStream` a real message is inserted into the `messages` store so streamed
 * replies are assertable exactly like `chat.postMessage` replies.
 */
function registerStreamingRoutes(app: Hono<AppEnv>, store: Store): void {
  let tsCounter = 0;
  const generateTs = () => {
    tsCounter++;
    return `${Math.floor(Date.now() / 1000)}.${String(tsCounter).padStart(6, '0')}`;
  };

  // Accumulated markdown text per in-flight stream, keyed by stream ts.
  const buffers = new Map<string, { channel: string; thread_ts?: string; text: string }>();

  // The Slack WebClient sends API calls as application/x-www-form-urlencoded, JSON-stringifying
  // complex fields (e.g. `chunks`). Parse both JSON and form bodies; JSON-parse stringified values.
  const parseBody = async (c: Context): Promise<Record<string, unknown>> => {
    const contentType = c.req.header('Content-Type') ?? '';
    const rawText = await c.req.text();
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(rawText) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of new URLSearchParams(rawText)) {
      if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
        try {
          result[key] = JSON.parse(value);
          continue;
        } catch {
          /* fall through to raw string */
        }
      }
      result[key] = value;
    }
    return result;
  };

  const resolveAuthorUser = (c: Context): string => {
    const authUser = c.get('authUser') as AuthUser | undefined;
    const login = authUser?.login;
    if (!login) return 'U000000001';
    const ss = getSlackStore(store);
    const user = ss.users.findOneBy('user_id', login) ?? ss.users.findOneBy('name', login);
    return user?.user_id ?? login;
  };

  const appendChunks = (entry: { text: string }, chunks: unknown): void => {
    if (!Array.isArray(chunks)) return;
    for (const raw of chunks as StreamChunk[]) {
      if (raw && (raw.type === 'markdown_text' || raw.markdown_text !== undefined || raw.text !== undefined)) {
        entry.text += raw.markdown_text ?? raw.text ?? '';
      }
    }
  };

  app.post('/api/chat.startStream', async c => {
    const body = (await parseBody(c)) as { channel?: string; thread_ts?: string; chunks?: unknown };
    const channel = typeof body.channel === 'string' ? body.channel : '';
    if (!channel) return c.json({ ok: false, error: 'channel_not_found' });
    const ts = generateTs();
    const entry = { channel, thread_ts: typeof body.thread_ts === 'string' ? body.thread_ts : undefined, text: '' };
    appendChunks(entry, body.chunks);
    buffers.set(ts, entry);
    return c.json({ ok: true, ts, channel });
  });

  app.post('/api/chat.appendStream', async c => {
    const body = (await parseBody(c)) as { ts?: string; chunks?: unknown };
    const entry = body.ts ? buffers.get(body.ts) : undefined;
    if (!entry) return c.json({ ok: false, error: 'message_not_found' });
    appendChunks(entry, body.chunks);
    return c.json({ ok: true, ts: body.ts });
  });

  app.post('/api/chat.stopStream', async c => {
    const body = (await parseBody(c)) as { ts?: string; channel?: string; chunks?: unknown };
    const entry = body.ts ? buffers.get(body.ts) : undefined;
    if (!entry) return c.json({ ok: false, error: 'message_not_found' });
    appendChunks(entry, body.chunks);
    buffers.delete(body.ts!);

    const ss = getSlackStore(store);
    const channelEntity =
      ss.channels.findOneBy('channel_id', entry.channel) ??
      ss.channels.all().find(ch => !ch.is_im && !ch.is_mpim && ch.name === entry.channel);
    const channelId = channelEntity?.channel_id ?? entry.channel;

    const ts = generateTs();
    const msg = ss.messages.insert({
      ts,
      channel_id: channelId,
      user: resolveAuthorUser(c),
      text: entry.text,
      type: 'message' as const,
      thread_ts: entry.thread_ts,
      reply_count: 0,
      reply_users: [],
      reactions: [],
    });

    if (entry.thread_ts) {
      const parent = ss.messages.all().find(m => m.ts === entry.thread_ts && m.channel_id === channelId);
      if (parent) {
        ss.messages.update(parent.id, {
          reply_count: parent.reply_count + 1,
          reply_users: parent.reply_users.includes(msg.user) ? parent.reply_users : [...parent.reply_users, msg.user],
        });
      }
    }

    return c.json({
      ok: true,
      ts,
      channel: channelId,
      message: { type: 'message', user: msg.user, text: msg.text, ts },
    });
  });
}
