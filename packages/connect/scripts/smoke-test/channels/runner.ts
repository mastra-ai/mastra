import { generateKeyPairSync, sign } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import type { ChannelProvider } from '@mastra/core/channels';
import { Mastra } from '@mastra/core/mastra';

import { channels } from '../../../src/channels.js';
import type { ConnectionCredential, ProjectConnection, ResolvedClient } from '../../../src/client.js';
import { getConnectionContext, getCredential, listProjectConnections, resolveClient } from '../../../src/client.js';
import { MastraConnectError } from '../../../src/errors.js';
import type { ScenarioStep } from '../scenario.js';
import { makeStep } from '../scenario.js';
import type { ProviderOutcome, RunResult } from '../runner.js';
import { mountChannelRoutes } from './server.js';

type ApiRoute = ReturnType<ChannelProvider['getRoutes']>[number];

/**
 * The four channel-capable integrations `channels()` registers today, keyed
 * by platform integrationId (the resolved-map keys). Slack rides the
 * `slack-channels` App Configuration integration (#25332) — the OAuth
 * `slack` integration backs tools only and is deliberately not
 * channel-capable.
 */
export const CHANNEL_IDS = ['discord', 'microsoft-teams', 'slack-channels', 'telegram'] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

/**
 * integrationId → the provider's platform id, which is also the first
 * segment of its mounted routes (`/{platform}/events/:webhookId`) and the
 * value of `provider.id`.
 */
const PLATFORM_IDS: Record<ChannelId, string> = {
  discord: 'discord',
  'microsoft-teams': 'teams',
  'slack-channels': 'slack',
  telegram: 'telegram',
};

/** Integration overrides disabling every channel except `keep`. */
function disableAllExcept(keep: ChannelId): Record<string, { disabled: true }> {
  return Object.fromEntries(CHANNEL_IDS.filter(id => id !== keep).map(id => [id, { disabled: true as const }]));
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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
 * Credential verification calls each vendor's canonical whoami endpoint
 * directly (not through the proxy) because that is exactly how channel
 * providers consume the credential: `channels()` hands the resolved token to
 * the provider, which talks to the vendor API itself. Where the full flow is
 * reachable without external listeners it runs for real — Discord's
 * connect → signed-webhook → disconnect loop, Slack's manifest mint + delete
 * lifecycle, and Teams' Entra app + Dev Portal bot provision + delete
 * lifecycle — and everything created is torn down in the same run. No
 * messages are sent and nothing survives the process.
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

  // Server-mount checks: hand the resolver to a real Mastra instance, mount
  // the merged apiRoutes the way the server adapter does, and drive the
  // webhook endpoints end-to-end with HTTP requests.
  outcomes.push(await serverMountOutcome(projectId, client));

  for (const id of CHANNEL_IDS) {
    if (requested && !requested.has(id)) continue;
    outcomes.push(await channelOutcome(id, projectId, client, activeByChannel.get(id), contract.resolved));
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
        integrations: Object.fromEntries(CHANNEL_IDS.map(id => [id, { disabled: true as const }])),
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

    // --- concurrent resolution shares one inflight build --------------------
    try {
      resolver.invalidate();
      const [a, b] = await Promise.all([resolver(), resolver()]);
      steps.push(
        a === b
          ? makeStep('concurrent resolves share one inflight build', undefined, 'pass')
          : makeStep(
              'concurrent resolves share one inflight build',
              undefined,
              'fail',
              'two concurrent resolutions produced different snapshots — the inflight gate did not dedupe',
            ),
      );
      resolved = a;
    } catch (error) {
      steps.push(makeStep('concurrent resolves share one inflight build', undefined, 'fail', errorMessage(error)));
    }

    // --- stale TTL: serve cached snapshot, revalidate in background ---------
    try {
      const shortTtl = await channels({ projectId, client: clientOptions, ttlMs: 50 });
      const first = await shortTtl();
      await sleep(120);
      // Past the TTL the resolver must answer immediately from the stale
      // snapshot while a background refresh runs — not block the caller.
      const staleServe = await shortTtl();
      let revalidated = false;
      for (let attempt = 0; attempt < 50 && !revalidated; attempt++) {
        await sleep(100);
        revalidated = (await shortTtl()) !== first;
      }
      steps.push(
        staleServe === first && revalidated
          ? makeStep('stale TTL serves cached snapshot + background revalidation lands', undefined, 'pass')
          : makeStep(
              'stale TTL serves cached snapshot + background revalidation lands',
              undefined,
              'fail',
              staleServe !== first
                ? 'stale resolution did not serve the cached snapshot (blocked on refetch instead)'
                : 'background revalidation never replaced the stale snapshot',
            ),
      );
    } catch (error) {
      steps.push(
        makeStep(
          'stale TTL serves cached snapshot + background revalidation lands',
          undefined,
          'fail',
          errorMessage(error),
        ),
      );
    }

    // --- disconnect() clears the cache without breaking the resolver --------
    try {
      await resolver.disconnect();
      const after = await resolver();
      steps.push(
        after !== resolved && sameKeys(after, resolved)
          ? makeStep('disconnect() clears cache; resolver stays usable', undefined, 'pass')
          : makeStep(
              'disconnect() clears cache; resolver stays usable',
              undefined,
              'fail',
              after === resolved ? 'resolution still served the disconnected snapshot' : 'map keys changed',
            ),
      );
      resolved = after;
    } catch (error) {
      steps.push(makeStep('disconnect() clears cache; resolver stays usable', undefined, 'fail', errorMessage(error)));
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

/**
 * Builds a real `Mastra` instance from a fresh resolver, mounts the merged
 * `server.apiRoutes` the way the production server adapter does, and drives
 * the webhook endpoints with real HTTP requests. Every platform's webhook
 * route must be live (mounted + handler reachable + storage lookup running)
 * even before any installation exists — unknown webhook ids answer 404.
 */
async function serverMountOutcome(projectId: string, client: ResolvedClient): Promise<ProviderOutcome> {
  const started = Date.now();
  const steps: ScenarioStep[] = [];
  const clientOptions = { accessToken: client.accessToken };

  try {
    const resolver = await channels({ projectId, client: clientOptions });
    const routeCount = resolver.getRoutes().length;
    const mastra = new Mastra({ channels: resolver, logger: false });
    const mounted = mastra.getServer()?.apiRoutes ?? [];
    steps.push(
      mounted.length === routeCount && routeCount > 0
        ? makeStep('channel routes merged into Mastra server config', undefined, 'pass', `${mounted.length} route(s)`)
        : makeStep(
            'channel routes merged into Mastra server config',
            undefined,
            'fail',
            `resolver exposes ${routeCount} route(s), Mastra server config has ${mounted.length}`,
          ),
    );

    // Webhook, slash-command, and OAuth routes must be publicly reachable
    // (vendors authenticate with their own signatures, not bearer tokens);
    // management routes must demand auth. The production server enforces the
    // flag — the contract to check here is its value.
    const misflagged = mounted.filter(route => {
      const isPublic = /\/events\/|\/commands\/|\/oauth\//.test(route.path);
      return (route.requiresAuth ?? true) === isPublic;
    });
    steps.push(
      misflagged.length === 0
        ? makeStep('requiresAuth flags match route roles', undefined, 'pass')
        : makeStep(
            'requiresAuth flags match route roles',
            undefined,
            'fail',
            `misflagged: ${misflagged.map(r => `${r.method} ${r.path}`).join(', ')}`,
          ),
    );

    const app = await mountChannelRoutes(mastra);
    for (const id of CHANNEL_IDS) {
      try {
        const response = await app.request(`/${PLATFORM_IDS[id]}/events/mastra-smoke-unknown-webhook`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ probe: true }),
        });
        steps.push(
          response.status === 404
            ? makeStep(`${id} webhook route live (unknown id → 404)`, undefined, 'pass')
            : makeStep(
                `${id} webhook route live (unknown id → 404)`,
                undefined,
                'fail',
                `expected 404, got ${response.status}`,
              ),
        );
      } catch (error) {
        steps.push(makeStep(`${id} webhook route live (unknown id → 404)`, undefined, 'fail', errorMessage(error)));
      }
    }
  } catch (error) {
    steps.push(makeStep('mount channel routes on Mastra server', undefined, 'fail', errorMessage(error)));
  }

  const status: ProviderOutcome['status'] = steps.some(s => s.status === 'fail') ? 'fail' : 'pass';
  return {
    integrationId: 'server-mount',
    summary: 'channel routes mounted on a real Mastra server + webhook endpoints live',
    status,
    steps,
    elapsedMs: Date.now() - started,
  };
}

async function channelOutcome(
  id: ChannelId,
  projectId: string,
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
      : makeStep(
          'present in resolved provider map',
          undefined,
          'fail',
          id === 'microsoft-teams' && !process.env.MASTRA_ENCRYPTION_KEY
            ? 'active connection did not resolve — the Teams channel requires MASTRA_ENCRYPTION_KEY ' +
                '(its install store persists per-agent bot secrets); without it channels() warn-and-skips the provider'
            : 'active connection did not resolve',
        ),
  );

  if (provider) {
    steps.push(
      provider.id === PLATFORM_IDS[id]
        ? makeStep('provider id matches platform id', undefined, 'pass', PLATFORM_IDS[id])
        : makeStep(
            'provider id matches platform id',
            undefined,
            'fail',
            `provider.id is '${provider.id}', expected '${PLATFORM_IDS[id]}'`,
          ),
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

  // Connection context backs ChannelRuntime.getConnectionContext() — the
  // metadata channel providers read (e.g. Discord's botToken). Prove the
  // platform endpoint answers for this connection.
  try {
    const context = await getConnectionContext(client, connection.id);
    const metadataKeys = Object.keys(context?.metadata ?? {});
    steps.push(
      context && typeof context === 'object'
        ? makeStep(
            'connection context fetch',
            undefined,
            'pass',
            metadataKeys.length > 0 ? `metadata keys: ${metadataKeys.join(', ')}` : 'no metadata (empty context)',
          )
        : makeStep('connection context fetch', undefined, 'fail', 'context endpoint returned a non-object'),
    );
  } catch (error) {
    steps.push(makeStep('connection context fetch', undefined, 'fail', errorMessage(error)));
  }

  // Discord supports the complete flow without external listeners: register
  // the webhook (connect), deliver a signed interaction to the mounted route,
  // reject a forged one, and tear the installation down again.
  if (id === 'discord' && credential?.type === 'api_key') {
    steps.push(...(await discordWebhookFlow(projectId, client, credential.apiKey)));
  }

  // Slack supports the manifest half of the flow without external listeners:
  // connect() mints a real Slack app via the manifest API (pending OAuth
  // install), disconnect() deletes the minted app again.
  if (id === 'slack-channels' && credential) {
    steps.push(...(await slackManifestFlow(projectId, client)));
  }

  // Teams supports the provisioning half of the flow without external
  // listeners: connect() provisions a real Entra application + Dev Portal bot
  // registration, disconnect() deletes both again.
  if (id === 'microsoft-teams' && credential?.type === 'oauth2' && provider) {
    steps.push(...(await teamsProvisionFlow(projectId, client, credential.accessToken)));
  }

  const status: ProviderOutcome['status'] = steps.some(s => s.status === 'fail') ? 'fail' : 'pass';
  return { integrationId: id, summary, status, steps, elapsedMs: Date.now() - started };
}

/** The agent id the Discord full-flow installation is registered under. */
const SMOKE_AGENT_ID = 'mastra-smoke-channels-agent';

/**
 * Full Discord webhook flow against a real Mastra server:
 *
 * 1. Build a dedicated resolver whose Discord provider is configured with a
 *    locally generated Ed25519 public key (`providerOptions.publicKey` is an
 *    allowed override), so this suite holds the matching private key and can
 *    produce genuinely valid signatures — something Discord itself never
 *    exposes. `gateway: false` keeps the Gateway loop out of a smoke run.
 * 2. `connect()` an agent to a guild the bot is already in (immediate bind).
 *    `commands: []` makes command registration a no-op, so the guild is not
 *    mutated; connect() itself only performs read-only Discord calls
 *    (`/applications/@me`, guild health check).
 * 3. POST a signed PING interaction to the mounted route → 200 PONG.
 * 4. POST the same payload with a tampered signature → 401.
 * 5. `disconnect()` and verify the installation is gone.
 *
 * Everything the flow creates lives in the provider's channel storage (in
 * memory for this process) — nothing persists after the run.
 */
async function discordWebhookFlow(
  projectId: string,
  client: ResolvedClient,
  botToken: string,
): Promise<ScenarioStep[]> {
  const steps: ScenarioStep[] = [];
  const clientOptions = { accessToken: client.accessToken };

  // Our own Ed25519 pair: raw 32-byte public key hex, the format Discord uses.
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');

  type InstallableProvider = ChannelProvider & {
    getInstallation?: (agentId: string) => Promise<{ webhookId: string } | null>;
  };

  let provider: InstallableProvider | undefined;
  let connected = false;
  // Hoisted so the teardown block can replay the signed PING against the
  // removed installation after disconnect.
  let app: Awaited<ReturnType<typeof mountChannelRoutes>> | undefined;
  let webhookId: string | undefined;
  let pingHeaders: Record<string, string> | undefined;
  let pingBody: string | undefined;
  try {
    const resolver = await channels({
      projectId,
      client: clientOptions,
      integrations: {
        ...disableAllExcept('discord'),
        discord: { providerOptions: { publicKey: publicKeyHex, gateway: false } },
      },
    });
    const mastra = new Mastra({ channels: resolver, logger: false });
    app = await mountChannelRoutes(mastra);
    const resolved = await resolver();
    provider = resolved.discord as InstallableProvider | undefined;
    if (!provider) {
      steps.push(makeStep('webhook flow: resolve dedicated provider', undefined, 'fail', 'discord did not resolve'));
      return steps;
    }

    // A guild the bot is already in → connect() binds immediately.
    const guilds = await fetchJson('https://discord.com/api/v10/users/@me/guilds', {
      Authorization: `Bot ${botToken}`,
    });
    const guildId = guilds.ok && Array.isArray(guilds.body) ? asString(guilds.body[0], 'id') : undefined;
    if (!guildId) {
      steps.push(
        makeStep('webhook flow: discover guild', undefined, 'skip', 'bot is not a member of any guild — cannot bind'),
      );
      return steps;
    }

    if (typeof provider.connect !== 'function' || typeof provider.disconnect !== 'function') {
      steps.push(makeStep('webhook flow: connect agent', undefined, 'fail', 'provider lacks connect/disconnect'));
      return steps;
    }

    const result = await provider.connect(SMOKE_AGENT_ID, { guildId, commands: [] });
    connected = true;
    steps.push(
      result.type === 'immediate'
        ? makeStep('webhook flow: connect agent (immediate bind)', undefined, 'pass', `guild ${guildId}`)
        : makeStep(
            'webhook flow: connect agent (immediate bind)',
            undefined,
            'fail',
            `expected immediate bind, got '${result.type}'`,
          ),
    );

    const installation = await provider.getInstallation?.(SMOKE_AGENT_ID);
    webhookId = installation?.webhookId;
    if (!webhookId) {
      steps.push(makeStep('webhook flow: installation webhookId', undefined, 'fail', 'no webhookId on installation'));
      return steps;
    }

    // Signed PING → PONG. The adapter verifies Ed25519 over timestamp+body
    // against the stored public key (ours), then answers { type: 1 }.
    const body = JSON.stringify({ type: 1, id: '0', application_id: '0', version: 1, token: 'mastra-smoke' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
    const headers = {
      'content-type': 'application/json',
      'x-signature-ed25519': signature,
      'x-signature-timestamp': timestamp,
    };
    pingHeaders = headers;
    pingBody = body;

    const pong = await app.request(`/discord/events/${webhookId}`, { method: 'POST', headers, body });
    const pongBody = (await pong.json().catch(() => undefined)) as { type?: number } | undefined;
    steps.push(
      pong.status === 200 && pongBody?.type === 1
        ? makeStep('webhook flow: signed PING → PONG', undefined, 'pass')
        : makeStep(
            'webhook flow: signed PING → PONG',
            undefined,
            'fail',
            `status ${pong.status}, body ${JSON.stringify(pongBody)}`,
          ),
    );

    // Forged signature → rejected before any work happens.
    const tampered = `${signature.slice(0, -2)}${signature.endsWith('00') ? '11' : '00'}`;
    const forged = await app.request(`/discord/events/${webhookId}`, {
      method: 'POST',
      headers: { ...headers, 'x-signature-ed25519': tampered },
      body,
    });
    steps.push(
      forged.status === 401
        ? makeStep('webhook flow: forged signature → 401', undefined, 'pass')
        : makeStep('webhook flow: forged signature → 401', undefined, 'fail', `status ${forged.status}`),
    );

    // No signature headers at all → rejected on the same gate.
    const unsigned = await app.request(`/discord/events/${webhookId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    steps.push(
      unsigned.status === 401
        ? makeStep('webhook flow: missing signature headers → 401', undefined, 'pass')
        : makeStep('webhook flow: missing signature headers → 401', undefined, 'fail', `status ${unsigned.status}`),
    );
  } catch (error) {
    steps.push(makeStep('webhook flow', undefined, 'fail', errorMessage(error)));
  } finally {
    if (provider && connected) {
      try {
        await provider.disconnect?.(SMOKE_AGENT_ID);
        const after = await provider.getInstallation?.(SMOKE_AGENT_ID);
        steps.push(
          after == null
            ? makeStep('webhook flow: disconnect removes installation', undefined, 'pass')
            : makeStep(
                'webhook flow: disconnect removes installation',
                undefined,
                'fail',
                'installation still present',
              ),
        );

        // The old webhookId must be dead: a replay of the previously valid
        // signed PING has to 404 now that the installation is gone.
        if (app && webhookId && pingHeaders && pingBody) {
          const replay = await app.request(`/discord/events/${webhookId}`, {
            method: 'POST',
            headers: pingHeaders,
            body: pingBody,
          });
          steps.push(
            replay.status === 404
              ? makeStep('webhook flow: webhook dead after disconnect (replay → 404)', undefined, 'pass')
              : makeStep(
                  'webhook flow: webhook dead after disconnect (replay → 404)',
                  undefined,
                  'fail',
                  `status ${replay.status}`,
                ),
          );
        }

        // The provider contract for disconnecting an already-disconnected
        // agent is a clear "no installation" rejection — pin that so an
        // accidental crash or silent partial delete would show up here.
        try {
          await provider.disconnect?.(SMOKE_AGENT_ID);
          steps.push(
            makeStep(
              'webhook flow: second disconnect rejects cleanly',
              undefined,
              'fail',
              'second disconnect resolved — expected a "no installation" rejection per the provider contract',
            ),
          );
        } catch (error) {
          const message = errorMessage(error);
          steps.push(
            /no .*installation/i.test(message)
              ? makeStep('webhook flow: second disconnect rejects cleanly', undefined, 'pass')
              : makeStep('webhook flow: second disconnect rejects cleanly', undefined, 'fail', message),
          );
        }
      } catch (error) {
        steps.push(makeStep('webhook flow: disconnect removes installation', undefined, 'fail', errorMessage(error)));
      }
    }
  }
  return steps;
}

/**
 * Full Slack manifest lifecycle against the platform credential:
 *
 * 1. Build a dedicated resolver (Slack only) and a Mastra instance with a
 *    placeholder agent (its model is never invoked — `connect()` only reads
 *    the agent's name/description for the app manifest).
 * 2. `connect()` mints a real Slack app via `apps.manifest.create` using the
 *    token the platform serves, and returns a pending OAuth install with an
 *    authorization URL (completing the install needs a human browser step,
 *    so activation stays out of scope).
 * 3. `disconnect()` deletes the minted app via `apps.manifest.delete` and
 *    removes the record — nothing is left in the Slack workspace.
 *
 * The channel rides the platform's `slack-channels` integration (#25332),
 * whose TWO_STEP credential carries a Slack App Configuration token — the
 * token type `apps.manifest.*` requires. A token-type rejection here is a
 * real failure: it means the connection's credential is not an App
 * Configuration token.
 */
async function slackManifestFlow(projectId: string, client: ResolvedClient): Promise<ScenarioStep[]> {
  const steps: ScenarioStep[] = [];
  const clientOptions = { accessToken: client.accessToken };

  type ManifestProvider = ChannelProvider & {
    setBaseUrl?: (url: string) => void;
    __attach?: (mastra: Mastra) => void;
    listInstallations?: () => Promise<Array<{ agentId: string; status: string }>>;
  };

  let provider: ManifestProvider | undefined;
  let connected = false;
  try {
    const resolver = await channels({
      projectId,
      client: clientOptions,
      integrations: disableAllExcept('slack-channels'),
    });
    // The agent exists only so connect() can derive the app's display name;
    // its model is never invoked.
    const agent = new Agent({
      id: SMOKE_AGENT_ID,
      name: 'Mastra Smoke Channels',
      instructions: 'Smoke-test placeholder. Never invoked.',
      model: 'openai/gpt-4o-mini',
    });
    const mastra = new Mastra({ channels: resolver, agents: { [SMOKE_AGENT_ID]: agent }, logger: false });

    const resolved = await resolver();
    provider = resolved['slack-channels'] as ManifestProvider | undefined;
    if (!provider) {
      steps.push(
        makeStep('manifest flow: resolve dedicated provider', undefined, 'fail', 'slack-channels did not resolve'),
      );
      return steps;
    }
    // Programmatic connect() (not via a mounted route) needs the Mastra
    // reference for agent resolution; __attach is idempotent if the channel
    // registration already did this.
    provider.__attach?.(mastra);
    provider.setBaseUrl?.('http://127.0.0.1:4111');

    // Garbage on the public routes must degrade gracefully (controlled 4xx,
    // never a 2xx or an unhandled 500). These are the endpoints Slack itself
    // calls, so they are reachable by anyone who knows the server's address.
    const app = await mountChannelRoutes(mastra);
    const bareCallback = await app.request('/slack/oauth/callback');
    steps.push(
      bareCallback.status === 400
        ? makeStep('oauth callback without state → 400', undefined, 'pass')
        : makeStep('oauth callback without state → 400', undefined, 'fail', `status ${bareCallback.status}`),
    );
    const bogusCommand = await app.request('/slack/commands/mastra-smoke-unknown-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'command=%2Fmastra&text=smoke',
    });
    steps.push(
      bogusCommand.status >= 400 && bogusCommand.status < 500
        ? makeStep('commands route rejects unknown webhook', undefined, 'pass', `status ${bogusCommand.status}`)
        : makeStep(
            'commands route rejects unknown webhook',
            undefined,
            'fail',
            `expected a controlled 4xx, got ${bogusCommand.status}`,
          ),
    );

    if (typeof provider.connect !== 'function' || typeof provider.disconnect !== 'function') {
      steps.push(
        makeStep('manifest flow: mint app via connect()', undefined, 'fail', 'provider lacks connect/disconnect'),
      );
      return steps;
    }

    let result: Awaited<ReturnType<NonNullable<ChannelProvider['connect']>>>;
    try {
      result = await provider.connect(SMOKE_AGENT_ID, {
        name: `mastra-smoke-${Date.now()}`,
        description: 'Mastra connect smoke test — safe to delete',
      });
    } catch (error) {
      const message = errorMessage(error);
      steps.push(
        makeStep(
          'manifest flow: mint app via connect()',
          undefined,
          'fail',
          /not_allowed_token_type/i.test(message)
            ? `Slack rejected the mint at the token gate (${message}) — the slack-channels connection's credential ` +
                `is not an App Configuration token. Reconnect the integration on the platform.`
            : message,
        ),
      );
      return steps;
    }
    connected = true;

    const authorizationUrl =
      result.type === 'oauth' ? (result as { authorizationUrl?: string }).authorizationUrl : undefined;
    steps.push(
      result.type === 'oauth' && typeof authorizationUrl === 'string' && authorizationUrl.length > 0
        ? makeStep('manifest flow: mint app via connect()', undefined, 'pass', 'real app minted; pending OAuth install')
        : makeStep(
            'manifest flow: mint app via connect()',
            undefined,
            'fail',
            `expected an oauth result with an authorization URL, got '${result.type}'`,
          ),
    );

    const pending = (await provider.listInstallations?.())?.find(i => i.agentId === SMOKE_AGENT_ID);
    steps.push(
      pending?.status === 'pending'
        ? makeStep('manifest flow: pending installation recorded', undefined, 'pass')
        : makeStep(
            'manifest flow: pending installation recorded',
            undefined,
            'fail',
            `installation status: ${pending?.status ?? 'missing'}`,
          ),
    );
  } catch (error) {
    steps.push(makeStep('manifest flow', undefined, 'fail', errorMessage(error)));
  } finally {
    if (provider && connected) {
      try {
        await provider.disconnect?.(SMOKE_AGENT_ID);
        const remaining = (await provider.listInstallations?.())?.find(i => i.agentId === SMOKE_AGENT_ID);
        steps.push(
          remaining == null
            ? makeStep(
                'manifest flow: disconnect deletes minted app',
                undefined,
                'pass',
                'app deleted via apps.manifest.delete; record removed',
              )
            : makeStep('manifest flow: disconnect deletes minted app', undefined, 'fail', 'installation still present'),
        );

        // Same contract as Discord: a second disconnect rejects with a clear
        // "no installation" error rather than crashing or re-deleting.
        try {
          await provider.disconnect?.(SMOKE_AGENT_ID);
          steps.push(
            makeStep(
              'manifest flow: second disconnect rejects cleanly',
              undefined,
              'fail',
              'second disconnect resolved — expected a "no installation" rejection per the provider contract',
            ),
          );
        } catch (error) {
          const message = errorMessage(error);
          steps.push(
            /no .*installation/i.test(message)
              ? makeStep('manifest flow: second disconnect rejects cleanly', undefined, 'pass')
              : makeStep('manifest flow: second disconnect rejects cleanly', undefined, 'fail', message),
          );
        }
      } catch (error) {
        steps.push(
          makeStep(
            'manifest flow: disconnect deletes minted app',
            undefined,
            'fail',
            `LEAKED Slack app for "${SMOKE_AGENT_ID}": ${errorMessage(error)}`,
          ),
        );
      }
    }
  }
  return steps;
}

/**
 * Full Teams provisioning lifecycle against the platform credential:
 *
 * 1. Build a dedicated resolver (Teams only) and point the provider at a
 *    local baseUrl via `configure()` so the provisioned bot's messaging
 *    endpoint is well-formed. The endpoint is never called — no external
 *    listener exists in a smoke run, and Teams only delivers activities once
 *    a human packages + installs the bot as a Teams app.
 * 2. `connect()` provisions a real Entra application + client secret
 *    (Microsoft Graph) and a Teams Dev Portal bot registration, persists the
 *    installation as **active**, and returns a `deep_link` to the Dev Portal
 *    (the remaining human step is packaging — out of scope here).
 * 3. `disconnect()` deletes the Dev Portal registration and the Entra
 *    application and removes the installation. Remote deletes are
 *    best-effort inside the provider, so the flow then proves the Entra
 *    application is really gone via Graph (`GET /applications/{id}` → 404).
 *
 * Requires MASTRA_ENCRYPTION_KEY (the install store persists the minted bot
 * secret at rest) and a credential carrying the Dev Portal secondary token.
 */
async function teamsProvisionFlow(
  projectId: string,
  client: ResolvedClient,
  graphToken: string,
): Promise<ScenarioStep[]> {
  const steps: ScenarioStep[] = [];
  const clientOptions = { accessToken: client.accessToken };

  type ProvisionProvider = ChannelProvider & {
    configure?: (settings: { baseUrl?: string }) => Promise<void>;
    getInstallation?: (agentId: string) => Promise<{ status: string; appId?: string; entraObjectId?: string } | null>;
  };

  let provider: ProvisionProvider | undefined;
  let connected = false;
  let entraObjectId: string | undefined;
  let appId: string | undefined;
  try {
    const resolver = await channels({
      projectId,
      client: clientOptions,
      integrations: disableAllExcept('microsoft-teams'),
    });
    const resolved = await resolver();
    provider = resolved['microsoft-teams'] as ProvisionProvider | undefined;
    if (!provider) {
      steps.push(
        makeStep('provision flow: resolve dedicated provider', undefined, 'fail', 'microsoft-teams did not resolve'),
      );
      return steps;
    }
    // Delegated connect() refuses to register a bot without a messaging
    // endpoint; a local placeholder is fine because nothing ever calls it.
    await provider.configure?.({ baseUrl: 'http://127.0.0.1:4111' });

    if (typeof provider.connect !== 'function' || typeof provider.disconnect !== 'function') {
      steps.push(
        makeStep('provision flow: provision bot via connect()', undefined, 'fail', 'provider lacks connect/disconnect'),
      );
      return steps;
    }

    const result = await provider.connect(SMOKE_AGENT_ID, {
      name: `mastra-smoke-${Date.now()}`,
    });
    connected = true;
    steps.push(
      result.type === 'deep_link'
        ? makeStep(
            'provision flow: provision bot via connect()',
            undefined,
            'pass',
            'Entra app + Dev Portal bot provisioned',
          )
        : makeStep(
            'provision flow: provision bot via connect()',
            undefined,
            'fail',
            `expected a deep_link result, got '${result.type}'`,
          ),
    );

    const installation = await provider.getInstallation?.(SMOKE_AGENT_ID);
    entraObjectId = installation?.entraObjectId;
    appId = installation?.appId;
    steps.push(
      installation?.status === 'active'
        ? makeStep('provision flow: active installation recorded', undefined, 'pass', `app ${appId ?? '?'}`)
        : makeStep(
            'provision flow: active installation recorded',
            undefined,
            'fail',
            `installation status: ${installation?.status ?? 'missing'}`,
          ),
    );
  } catch (error) {
    steps.push(makeStep('provision flow', undefined, 'fail', errorMessage(error)));
  } finally {
    if (provider && connected) {
      try {
        await provider.disconnect?.(SMOKE_AGENT_ID);
        const remaining = await provider.getInstallation?.(SMOKE_AGENT_ID);
        steps.push(
          remaining == null
            ? makeStep('provision flow: disconnect removes installation', undefined, 'pass')
            : makeStep(
                'provision flow: disconnect removes installation',
                undefined,
                'fail',
                'installation still present',
              ),
        );
      } catch (error) {
        steps.push(
          makeStep(
            'provision flow: disconnect removes installation',
            undefined,
            'fail',
            `LEAKED Teams bot for "${SMOKE_AGENT_ID}" (appId ${appId ?? '?'}, Entra object ${entraObjectId ?? '?'}): ${errorMessage(error)}`,
          ),
        );
      }
      // The provider deletes the remote resources best-effort (a
      // control-plane failure never blocks local removal), so prove the
      // Entra application is actually gone rather than trusting disconnect.
      if (entraObjectId) {
        try {
          const gone = await fetchJson(`https://graph.microsoft.com/v1.0/applications/${entraObjectId}`, {
            Authorization: `Bearer ${graphToken}`,
          });
          steps.push(
            gone.status === 404
              ? makeStep('provision flow: Entra application deleted (graph 404)', undefined, 'pass')
              : makeStep(
                  'provision flow: Entra application deleted (graph 404)',
                  undefined,
                  'fail',
                  `LEAKED Entra application ${entraObjectId} (appId ${appId ?? '?'}): graph returned ${gone.status}`,
                ),
          );
        } catch (error) {
          steps.push(
            makeStep('provision flow: Entra application deleted (graph 404)', undefined, 'fail', errorMessage(error)),
          );
        }
      }
    }
  }
  return steps;
}

const CHANNEL_SUMMARIES: Record<ChannelId, string> = {
  discord: 'Discord channel: bot-token late-binding + live credential check',
  'microsoft-teams':
    'Teams channel: scope-aware token resolver + live credential check + bot provision/delete lifecycle',
  'slack-channels': 'Slack channel: config-token resolver path, live credential check + manifest mint/delete lifecycle',
  telegram: 'Telegram channel: bot-token resolver path + live credential check',
};

/** Extract the token a channel provider would consume from a platform credential. */
function credentialToken(credential: ConnectionCredential): string {
  if (credential.type === 'oauth2') return credential.accessToken;
  if (credential.type === 'two_step') return credential.token;
  return credential.apiKey;
}

/**
 * Read-only whoami calls against each vendor API, using the credential the
 * platform holds for the connection. Deliberately not proxied: channel
 * providers call vendor APIs directly with this token, so this is the
 * end-to-end path being smoked.
 */
async function verifyCredentialLive(id: ChannelId, credential: ConnectionCredential): Promise<ScenarioStep[]> {
  const token = credentialToken(credential);
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
      case 'slack-channels': {
        const auth = await fetchJson('https://slack.com/api/auth.test', { Authorization: `Bearer ${token}` }, 'POST');
        const body = (auth.body as { ok?: boolean; error?: string; team?: string; url?: string } | undefined) ?? {};
        steps.push(
          body.ok === true
            ? makeStep('live credential: auth.test', undefined, 'pass', `workspace: ${body.team ?? body.url ?? '?'}`)
            : makeStep('live credential: auth.test', undefined, 'fail', `slack error: ${body.error ?? auth.status}`),
        );
        break;
      }
      case 'microsoft-teams': {
        // The primary oauth2 token is a delegated Microsoft Graph token —
        // /me is the canonical read-only whoami for it.
        const me = await fetchJson('https://graph.microsoft.com/v1.0/me', { Authorization: `Bearer ${token}` });
        steps.push(
          me.ok
            ? makeStep(
                'live credential: GET graph /me',
                undefined,
                'pass',
                `user: ${asString(me.body, 'userPrincipalName') ?? asString(me.body, 'displayName') ?? '?'}`,
              )
            : makeStep('live credential: GET graph /me', undefined, 'fail', `status ${me.status}`),
        );
        // Delegated provisioning needs the secondary Dev Portal token the
        // platform serves alongside the Graph token on the same credential.
        const devPortalToken =
          credential.type === 'oauth2'
            ? credential.secondaryAccessTokens?.devPortalAccessToken?.accessToken
            : undefined;
        steps.push(
          devPortalToken
            ? makeStep('credential carries Dev Portal secondary token', undefined, 'pass')
            : makeStep(
                'credential carries Dev Portal secondary token',
                undefined,
                'fail',
                'no secondaryAccessTokens.devPortalAccessToken — the integration must request the ' +
                  'dev.teams.microsoft.com/AppDefinitions.ReadWrite scope',
              ),
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
