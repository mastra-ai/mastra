import type { ChannelProvider } from '@mastra/core/channels';

import { channels } from '../../../src/channels.js';
import type { ConnectionCredential, ProjectConnection, ResolvedClient } from '../../../src/client.js';
import { getCredential, listProjectConnections, resolveClient } from '../../../src/client.js';
import { MastraConnectError } from '../../../src/errors.js';
import type { ScenarioStep } from '../scenario.js';
import { makeStep } from '../scenario.js';
import type { ProviderOutcome, RunResult } from '../runner.js';

type ApiRoute = ReturnType<ChannelProvider['getRoutes']>[number];

/** The three channel-capable integrations `channels()` registers today. */
export const CHANNEL_IDS = ['discord', 'slack', 'telegram'] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

export interface ChannelRunnerOptions {
  /** Only run checks for these channel ids. Omit to run every channel. */
  channels?: string[];
  /** Project id to resolve. Defaults to MASTRA_PROJECT_ID. */
  projectId?: string;
  /** Platform access token. Defaults to MASTRA_PLATFORM_SECRET_KEY (or MASTRA_PLATFORM_ACCESS_TOKEN). */
  accessToken?: string;
}

/**
 * E2E smoke suite for the `channels()` resolver. Unlike the tools suite —
 * which exercises every generated tool through the platform proxy — this
 * suite exercises the *channel* path: the resolver contract (construction
 * guards, route mounting, TTL cache, overrides) plus, for every integration
 * with an active connection, the late-bound credential flow from platform
 * connection to live provider instance.
 *
 * All checks are read-only. Credential verification calls each vendor's
 * canonical whoami endpoint directly (not through the proxy) because that is
 * exactly how channel providers consume the credential: `channels()` hands
 * the resolved token to the provider, which talks to the vendor API itself.
 * No webhooks are registered, no agents installed, and no messages sent.
 */
export async function runChannelSmokeTests(options: ChannelRunnerOptions = {}): Promise<RunResult> {
  const startedAt = new Date().toISOString();

  const projectId = options.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error('Missing project id: set MASTRA_PROJECT_ID or pass --project-id.');
  }
  const client = resolveClient({ accessToken: options.accessToken });

  // One platform connection listing shared by every check, so per-channel
  // outcomes can distinguish "not connected" (skip) from "connected but the
  // resolver dropped it" (fail).
  const connections = await listProjectConnections(client, projectId);
  const activeByChannel = new Map<ChannelId, ProjectConnection>();
  for (const id of CHANNEL_IDS) {
    const active = connections.filter(c => c.integrationId === id && c.status === 'active');
    if (active.length > 0) activeByChannel.set(id, active[0]!);
  }

  const requested = options.channels?.length ? new Set(options.channels) : null;
  const outcomes: ProviderOutcome[] = [];

  // Resolver-contract checks run once, up front: they are channel-agnostic
  // and produce the shared resolution map the per-channel checks assert on.
  const contract = await resolverContractOutcome(projectId, client, activeByChannel);
  outcomes.push(contract.outcome);

  for (const id of CHANNEL_IDS) {
    if (requested && !requested.has(id)) continue;
    outcomes.push(await channelOutcome(id, client, activeByChannel.get(id), contract.resolved));
  }

  return {
    runId: `mastra-smoke-channels`,
    outcomes,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

interface ContractResult {
  outcome: ProviderOutcome;
  /** The resolution map produced by the contract checks, reused by per-channel checks. */
  resolved: Record<string, ChannelProvider>;
}

async function resolverContractOutcome(
  projectId: string,
  client: ResolvedClient,
  activeByChannel: Map<ChannelId, ProjectConnection>,
): Promise<ContractResult> {
  const started = Date.now();
  const steps: ScenarioStep[] = [];
  let resolved: Record<string, ChannelProvider> = {};

  const clientOptions = { accessToken: client.accessToken };

  // --- construction guards -------------------------------------------------
  // channels() falls back to MASTRA_PROJECT_ID, so the env var has to be
  // stashed for the missing-project-id rejection to be observable.
  const savedProjectId = process.env.MASTRA_PROJECT_ID;
  delete process.env.MASTRA_PROJECT_ID;
  try {
    await channels({ client: clientOptions });
    steps.push(makeStep('reject missing project id', undefined, 'fail', 'resolved without a project id'));
  } catch (error) {
    steps.push(
      error instanceof MastraConnectError && error.code === 'missing_project_id'
        ? makeStep('reject missing project id', undefined, 'pass')
        : makeStep('reject missing project id', undefined, 'fail', errorMessage(error)),
    );
  } finally {
    if (savedProjectId !== undefined) process.env.MASTRA_PROJECT_ID = savedProjectId;
  }

  try {
    await channels({ projectId, client: clientOptions, ttlMs: -5 });
    steps.push(makeStep('reject invalid ttlMs', undefined, 'fail', 'resolved with ttlMs: -5'));
  } catch (error) {
    steps.push(
      error instanceof MastraConnectError && error.code === 'invalid_options'
        ? makeStep('reject invalid ttlMs', undefined, 'pass')
        : makeStep('reject invalid ttlMs', undefined, 'fail', errorMessage(error)),
    );
  }

  // --- route mounting ------------------------------------------------------
  let resolver: Awaited<ReturnType<typeof channels>> | undefined;
  try {
    resolver = await channels({ projectId, client: clientOptions });
    steps.push(makeStep('construct resolver', undefined, 'pass'));
  } catch (error) {
    steps.push(makeStep('construct resolver', undefined, 'fail', errorMessage(error)));
  }

  if (resolver) {
    const routes = resolver.getRoutes();
    const malformed = routes.filter(r => typeof (r as ApiRoute).path !== 'string' || (r as ApiRoute).path.length === 0);
    steps.push(
      routes.length > 0 && malformed.length === 0
        ? makeStep('routes mounted before any connection', undefined, 'pass', `${routes.length} route(s)`)
        : makeStep(
            'routes mounted before any connection',
            undefined,
            'fail',
            routes.length === 0 ? 'getRoutes() returned no routes' : `${malformed.length} route(s) missing a path`,
          ),
    );

    // Disabling every integration must remove both routes and providers —
    // this is deterministic regardless of which connections the project has.
    try {
      const allDisabled = await channels({
        projectId,
        client: clientOptions,
        integrations: { slack: { disabled: true }, telegram: { disabled: true }, discord: { disabled: true } },
      });
      const disabledRoutes = allDisabled.getRoutes();
      const disabledMap = await allDisabled();
      steps.push(
        disabledRoutes.length === 0 && Object.keys(disabledMap).length === 0
          ? makeStep('disabled overrides remove routes + providers', undefined, 'pass')
          : makeStep(
              'disabled overrides remove routes + providers',
              undefined,
              'fail',
              `${disabledRoutes.length} route(s), ${Object.keys(disabledMap).length} provider(s) despite all-disabled`,
            ),
      );
    } catch (error) {
      steps.push(makeStep('disabled overrides remove routes + providers', undefined, 'fail', errorMessage(error)));
    }

    // --- resolution + cache behavior ---------------------------------------
    try {
      resolved = await resolver();
      const keys = Object.keys(resolved).sort();
      const unknown = keys.filter(k => !(CHANNEL_IDS as readonly string[]).includes(k));
      const expected = [...activeByChannel.keys()].sort();
      const missing = expected.filter(k => !keys.includes(k));
      if (unknown.length > 0) {
        steps.push(
          makeStep('resolve connected channels', undefined, 'fail', `unknown channel id(s): ${unknown.join(', ')}`),
        );
      } else if (missing.length > 0) {
        // An active connection that doesn't resolve means credential
        // late-binding (sync) failed — exactly what this suite exists to catch.
        steps.push(
          makeStep(
            'resolve connected channels',
            undefined,
            'fail',
            `active connection(s) missing from resolved map: ${missing.join(', ')}`,
          ),
        );
      } else {
        steps.push(
          makeStep(
            'resolve connected channels',
            undefined,
            'pass',
            keys.length > 0 ? `connected: ${keys.join(', ')}` : 'no channel connections in project',
          ),
        );
      }
    } catch (error) {
      steps.push(makeStep('resolve connected channels', undefined, 'fail', errorMessage(error)));
    }

    try {
      const second = await resolver();
      steps.push(
        second === resolved
          ? makeStep('TTL cache serves repeat resolution', undefined, 'pass')
          : makeStep(
              'TTL cache serves repeat resolution',
              undefined,
              'fail',
              'second resolution was not the cached snapshot',
            ),
      );

      resolver.invalidate();
      const afterInvalidate = await resolver();
      steps.push(
        afterInvalidate !== resolved && sameKeys(afterInvalidate, resolved)
          ? makeStep('invalidate() forces refetch', undefined, 'pass')
          : makeStep(
              'invalidate() forces refetch',
              undefined,
              'fail',
              afterInvalidate === resolved
                ? 'resolution still served the invalidated snapshot'
                : 'refetched map keys changed',
            ),
      );

      const refreshed = await resolver.refresh();
      steps.push(
        refreshed !== afterInvalidate && sameKeys(refreshed, afterInvalidate)
          ? makeStep('refresh() fetches a new snapshot', undefined, 'pass')
          : makeStep(
              'refresh() fetches a new snapshot',
              undefined,
              'fail',
              refreshed === afterInvalidate ? 'refresh() returned the cached snapshot' : 'refreshed map keys changed',
            ),
      );
      resolved = refreshed;
    } catch (error) {
      steps.push(makeStep('resolver cache behavior', undefined, 'fail', errorMessage(error)));
    }

    // --- bogus connection pin ----------------------------------------------
    const pinnableId = [...activeByChannel.keys()][0];
    if (pinnableId) {
      try {
        const pinned = await channels({
          projectId,
          client: clientOptions,
          integrations: { [pinnableId]: { connectionId: 'conn-mastra-smoke-nonexistent' } },
        });
        const pinnedMap = await pinned();
        steps.push(
          pinnedMap[pinnableId] === undefined
            ? makeStep('bogus connectionId pin excluded (warn-and-skip)', undefined, 'pass', pinnableId)
            : makeStep(
                'bogus connectionId pin excluded (warn-and-skip)',
                undefined,
                'fail',
                `${pinnableId} resolved despite a nonexistent pinned connection id`,
              ),
        );
      } catch (error) {
        steps.push(makeStep('bogus connectionId pin excluded (warn-and-skip)', undefined, 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        makeStep('bogus connectionId pin excluded (warn-and-skip)', undefined, 'skip', 'no connected channel to pin'),
      );
    }
  }

  const status: ProviderOutcome['status'] = steps.some(s => s.status === 'fail') ? 'fail' : 'pass';
  return {
    outcome: {
      integrationId: 'channels-resolver',
      summary: 'channels() resolver contract: guards, routes, cache, overrides',
      status,
      steps,
      elapsedMs: Date.now() - started,
    },
    resolved,
  };
}

async function channelOutcome(
  id: ChannelId,
  client: ResolvedClient,
  connection: ProjectConnection | undefined,
  resolved: Record<string, ChannelProvider>,
): Promise<ProviderOutcome> {
  const started = Date.now();
  const summary = CHANNEL_SUMMARIES[id];

  if (!connection) {
    return {
      integrationId: id,
      summary,
      status: 'skipped',
      reason: 'No active connection in the project — connect one on the platform to exercise this channel.',
      steps: [],
      elapsedMs: Date.now() - started,
    };
  }

  const steps: ScenarioStep[] = [];
  const provider = resolved[id];

  // Presence in the resolved map is itself the strongest late-binding signal:
  // for Discord it means `sync()` fetched the bot token and pushed it through
  // `configure()` without error.
  steps.push(
    provider
      ? makeStep('present in resolved provider map', undefined, 'pass', `connection ${connection.id}`)
      : makeStep('present in resolved provider map', undefined, 'fail', 'active connection did not resolve'),
  );

  if (provider) {
    steps.push(
      provider.id === id
        ? makeStep('provider id matches integration id', undefined, 'pass')
        : makeStep('provider id matches integration id', undefined, 'fail', `provider.id is '${provider.id}'`),
    );

    try {
      const routes = provider.getRoutes();
      steps.push(
        routes.length > 0
          ? makeStep('provider routes', undefined, 'pass', `${routes.length} route(s)`)
          : makeStep('provider routes', undefined, 'fail', 'getRoutes() returned no routes'),
      );
    } catch (error) {
      steps.push(makeStep('provider routes', undefined, 'fail', errorMessage(error)));
    }

    if (typeof provider.getInfo === 'function') {
      try {
        const info = provider.getInfo();
        steps.push(makeStep('getInfo() discovery metadata', undefined, 'pass', info?.name ?? undefined));
      } catch (error) {
        steps.push(makeStep('getInfo() discovery metadata', undefined, 'fail', errorMessage(error)));
      }
    } else {
      steps.push(makeStep('getInfo() discovery metadata', undefined, 'skip', 'provider does not implement getInfo'));
    }
  }

  // Fetch the credential through the same platform path the provider runtime
  // uses, then prove it works against the vendor's read-only whoami endpoint.
  let credential: ConnectionCredential | undefined;
  try {
    credential = await getCredential(client, connection.id);
    steps.push(makeStep('platform credential fetch', undefined, 'pass', `type: ${credential.type}`));
  } catch (error) {
    steps.push(makeStep('platform credential fetch', undefined, 'fail', errorMessage(error)));
  }

  if (credential) {
    steps.push(...(await verifyCredentialLive(id, credential)));
  }

  const status: ProviderOutcome['status'] = steps.some(s => s.status === 'fail') ? 'fail' : 'pass';
  return { integrationId: id, summary, status, steps, elapsedMs: Date.now() - started };
}

const CHANNEL_SUMMARIES: Record<ChannelId, string> = {
  discord: 'Discord channel: bot-token late-binding + live credential check',
  slack: 'Slack channel: token resolver path + live credential check',
  telegram: 'Telegram channel: bot-token resolver path + live credential check',
};

/**
 * Read-only whoami calls against each vendor API, using the credential the
 * platform holds for the connection. Deliberately not proxied: channel
 * providers call vendor APIs directly with this token, so this is the
 * end-to-end path being smoked.
 */
async function verifyCredentialLive(id: ChannelId, credential: ConnectionCredential): Promise<ScenarioStep[]> {
  const token = credential.type === 'oauth2' ? credential.accessToken : credential.apiKey;
  const steps: ScenarioStep[] = [];

  try {
    switch (id) {
      case 'discord': {
        const me = await fetchJson('https://discord.com/api/v10/users/@me', { Authorization: `Bot ${token}` });
        steps.push(
          me.ok
            ? makeStep('live credential: GET /users/@me', undefined, 'pass', `bot: ${asString(me.body, 'username')}`)
            : makeStep('live credential: GET /users/@me', undefined, 'fail', `status ${me.status}`),
        );
        // DiscordProvider backfills applicationId + publicKey from this
        // endpoint when connection metadata doesn't carry them.
        const app = await fetchJson('https://discord.com/api/v10/applications/@me', { Authorization: `Bot ${token}` });
        steps.push(
          app.ok && typeof asString(app.body, 'verify_key') === 'string'
            ? makeStep(
                'live credential: GET /applications/@me',
                undefined,
                'pass',
                `app: ${asString(app.body, 'name')}`,
              )
            : makeStep(
                'live credential: GET /applications/@me',
                undefined,
                'fail',
                app.ok ? 'application object missing verify_key' : `status ${app.status}`,
              ),
        );
        break;
      }
      case 'telegram': {
        const me = await fetchJson(`https://api.telegram.org/bot${token}/getMe`, {});
        const result = (me.body as { ok?: boolean; result?: { username?: string } } | undefined) ?? {};
        steps.push(
          me.ok && result.ok === true
            ? makeStep('live credential: getMe', undefined, 'pass', `bot: @${result.result?.username ?? '?'}`)
            : makeStep('live credential: getMe', undefined, 'fail', `status ${me.status}`),
        );
        break;
      }
      case 'slack': {
        const auth = await fetchJson('https://slack.com/api/auth.test', { Authorization: `Bearer ${token}` }, 'POST');
        const body = (auth.body as { ok?: boolean; error?: string; team?: string } | undefined) ?? {};
        steps.push(
          body.ok === true
            ? makeStep('live credential: auth.test', undefined, 'pass', `team: ${body.team ?? '?'}`)
            : makeStep('live credential: auth.test', undefined, 'fail', `slack error: ${body.error ?? auth.status}`),
        );
        break;
      }
    }
  } catch (error) {
    steps.push(makeStep('live credential check', undefined, 'fail', errorMessage(error)));
  }

  return steps;
}

async function fetchJson(
  url: string,
  headers: Record<string, string>,
  method: 'GET' | 'POST' = 'GET',
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(url, { method, headers });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return { ok: response.ok, status: response.status, body };
}

function asString(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function sameKeys(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
