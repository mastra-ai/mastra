/**
 * Platform-deployable Mastra entry for MastraCode.
 *
 * This module is the ONE place deployment env is read. It maps today's env
 * vars onto explicit `MastraFactory` config — instances for behaviors (pubsub,
 * storage, vector), plain values for config (publicUrl, origins) — so anyone
 * reading the entry sees exactly which env var feeds which slot.
 * Everything else (feature readiness, route/middleware assembly, controller
 * construction) lives in `MastraFactory` (`@mastra/factory`).
 *
 * `mastra build` requires the entry to export a `Mastra` instance named
 * `mastra` constructed by a literal `new Mastra(...)` in THIS file (validated
 * by the deployer's `checkConfigExport` Babel plugin) — which is why the
 * factory returns constructor args from `prepare()` instead of the instance.
 * The Mastra CLI consumes this entry everywhere: `mastra dev`, `mastra build`,
 * and `mastra deploy` all bundle this module and let the deployer generate
 * the server.
 */

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Knowledge } from '@mastra/core/knowledge';
import type { MaterializeKnowledgeScopeInput } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgVector, PgFactoryStorage } from '@mastra/pg';
import { LocalSandbox } from '@mastra/core/workspace';
import { PlatformSandbox, createRepoTemplate as createPlatformRepoTemplate } from '@mastra/platform-workspace';
import { E2BSandbox, createRepoTemplate as createE2BRepoTemplate } from '@mastra/e2b';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { getDatabasePath } from '@mastra/code-sdk/utils/project';
import { DEFAULT_RETENTION } from '@mastra/code-sdk/utils/storage-maintenance';
import { MastraAuthWorkos } from '@mastra/auth-workos';
import { createFactorySecretEncryption, MastraFactory } from '@mastra/factory';
import { GithubIntegration } from '@mastra/factory/integrations/github/integration';
import { parseAuthorizedBotsEnv } from '@mastra/factory/integrations/github/webhook';
import { LinearIntegration } from '@mastra/factory/integrations/linear/integration';
import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';
import type { IMastraAuthProvider } from '@mastra/core/server';

/**
 * Parse a positive-integer env knob; anything else means "use the default".
 * Fractional values are rejected rather than floored — flooring `0.5` to `0`
 * would silently disable a capacity knob or turn an idle window into
 * immediate expiry.
 */
function positiveInt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function decodeCredentialEncryptionKey(name: string, encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.byteLength !== 32) throw new Error(`${name} must contain base64-encoded 32-byte keys.`);
  return key;
}

function credentialEncryption() {
  const encodedKey = process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!encodedKey) {
    console.warn(
      '[factory] FACTORY_CREDENTIAL_ENCRYPTION_KEY is not set. Stored model-provider keys, custom-provider ' +
        'API keys, and integration secrets will be persisted as plaintext. Generate a key with ' +
        '`openssl rand -base64 32` and set FACTORY_CREDENTIAL_ENCRYPTION_KEY to encrypt them at rest.',
    );
    return undefined;
  }

  const previousKeys: Record<string, unknown> = process.env.FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS
    ? JSON.parse(process.env.FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS)
    : {};
  if (!previousKeys || Array.isArray(previousKeys) || typeof previousKeys !== 'object') {
    throw new Error('FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS must be a JSON object of key ids to base64 keys.');
  }

  return createFactorySecretEncryption({
    primary: {
      id: process.env.FACTORY_CREDENTIAL_ENCRYPTION_KEY_ID?.trim() || 'v1',
      key: decodeCredentialEncryptionKey('FACTORY_CREDENTIAL_ENCRYPTION_KEY', encodedKey),
    },
    previous: Object.entries(previousKeys).map(([id, value]) => {
      if (typeof value !== 'string') {
        throw new Error('FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS values must be base64 strings.');
      }
      return { id, key: decodeCredentialEncryptionKey('FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS', value) };
    }),
  });
}

// Distributed pub/sub: when `REDIS_URL` is set, events (streams, workflows,
// signals) ride Redis Streams so multiple web server processes can share one
// event bus. RedisStreamsPubSub also implements LeaseProvider, so the factory
// marks it cross-process and the controller drops its file-based thread locks
// in favor of pubsub-coordinated leases. Without `REDIS_URL` (bare local dev)
// the in-process default applies.
const redisUrl = process.env.REDIS_URL;
const pubsub = redisUrl ? new RedisStreamsPubSub({ url: redisUrl }) : undefined;
if (redisUrl) {
  // Redact credentials before logging (REDIS_URL may embed a password).
  let redisTarget = 'redis';
  try {
    const parsed = new URL(redisUrl);
    redisTarget = `${parsed.protocol}//${parsed.host}`;
  } catch {
    // Unparseable URL — RedisStreamsPubSub will surface the real error; keep the log generic.
  }
  console.log(`[PubSub] REDIS_URL set — event bus on Redis Streams (${redisTarget}), cross-process leases enabled.`);
}

// Auth selection, ordered by how explicit the operator's intent is:
//   1. MASTRACODE_AUTH_DISABLED=1 — explicit opt-out, auth off entirely.
//   2. MASTRA_SHARED_API_URL — explicit platform deferral; identity rides the
//      shared platform API (`.env.schema` names this the highest-precedence
//      auth config), so it wins even over a configured WORKOS_* pair — but
//      loudly, because silently ignoring sign-in config is how self-hosted
//      logins end up 302-ing somewhere that rejects their redirect_uri.
//   3. WORKOS_API_KEY + WORKOS_CLIENT_ID — self-managed WorkOS sign-in. The
//      constructor reads the rest of the WORKOS_* group from env, and
//      `init()` derives the /auth/callback redirect from the deployment's
//      publicUrl when WORKOS_REDIRECT_URI is unset. `fetchMemberships` lets
//      token auth resolve the user's organization so the bootstrapped
//      personal org works without re-auth. Note MASTRA_PLATFORM_ACCESS_TOKEN /
//      MASTRA_PLATFORM_SECRET_KEY do NOT defer to the platform here: they are
//      compute/integration credentials (sandboxes, GitHub/Linear slots), not
//      identity signals — platform compute plus self-managed sign-in is a
//      supported combination.
//   4. Nothing configured — leave undefined and MastraFactory installs its
//      platform-backed default provider.
const authDisabled = process.env.MASTRACODE_AUTH_DISABLED === '1';
const workosConfigured = Boolean(process.env.WORKOS_API_KEY?.trim() && process.env.WORKOS_CLIENT_ID?.trim());
let auth: IMastraAuthProvider | null | undefined;

if (authDisabled) {
  auth = null;
} else if (process.env.MASTRA_SHARED_API_URL?.trim()) {
  if (workosConfigured) {
    console.warn(
      '[Auth] WORKOS_API_KEY/WORKOS_CLIENT_ID are set but ignored: MASTRA_SHARED_API_URL takes precedence, so sign-in defers to the platform. Unset MASTRA_SHARED_API_URL to use self-managed WorkOS auth.',
    );
  }
} else if (workosConfigured) {
  auth = new MastraAuthWorkos({ fetchMemberships: true });
}
const secretEncryption = auth === null ? undefined : credentialEncryption();

// Direct GitHub App fallback: when the platform-backed integration isn't in
// play (self-hosted / local deploys), a complete GITHUB_APP_* env group wires
// a GithubIntegration so the app still gets a real GitHub connection — Connect
// GitHub in onboarding, the repo picker, and webhooks. A partial group stays
// disabled so the status route can report exactly what's missing.
const githubAppId = process.env.GITHUB_APP_ID?.trim();
const githubPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
const githubClientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
const githubClientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
const githubAppSlug = process.env.GITHUB_APP_SLUG?.trim();
const github =
  githubAppId && githubPrivateKey && githubClientId && githubClientSecret && githubAppSlug
    ? new GithubIntegration({
        appId: githubAppId,
        privateKey: githubPrivateKey,
        clientId: githubClientId,
        clientSecret: githubClientSecret,
        slug: githubAppSlug,
        webhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() || undefined,
        // Extra reviewer bot logins this deployment trusts to trigger
        // review/comment notifications, on top of the built-in defaults.
        authorizedBots: parseAuthorizedBotsEnv(process.env.MASTRACODE_GITHUB_AUTHORIZED_BOTS),
      })
    : undefined;

// Direct Linear OAuth fallback for self-hosted / local deploys. As with the
// GitHub fallback, only a complete credential group enables the integration;
// partial configuration remains available to the diagnostics routes.
const linearClientId = process.env.LINEAR_CLIENT_ID?.trim();
const linearClientSecret = process.env.LINEAR_CLIENT_SECRET?.trim();
const linear =
  linearClientId && linearClientSecret
    ? new LinearIntegration({
        clientId: linearClientId,
        clientSecret: linearClientSecret,
      })
    : undefined;

// Host env exposed to local sandboxes: an allow-list only, so app secrets
// (GITHUB_APP_PRIVATE_KEY, WORKOS_API_KEY, DATABASE_URL, …) never leak into
// commands run against untrusted repo checkouts. PATH is always added by the
// core LocalSandbox itself; the rest keeps git and TLS working normally.
const LOCAL_SANDBOX_ENV_KEYS = [
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'TERM',
  'TZ',
  'GIT_EXEC_PATH',
  'GIT_TEMPLATE_DIR',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
] as const;

function localSandboxEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of LOCAL_SANDBOX_ENV_KEYS) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

// One FactoryStorage backend powers agent storage, the factory app tables,
// the distributed project lock, and better-auth. `DATABASE_URL` set →
// Postgres (the paired PgVector rides the same database for recall search).
// Unset (bare local dev) → libSQL on the same local file the SDK's default
// storage resolution uses, running the FULL app surface (auth, intake,
// audit, work-items, integrations) — no features silently off.
//
// `APP_DATABASE_URL` is the deprecated legacy name — still honored as a
// fallback so existing checkouts keep working, but new setups should use
// `DATABASE_URL` (matches the platform's managed env-var sync for attached
// databases, so `mastra deploy` populates it automatically).
const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim() || undefined;
if (process.env.APP_DATABASE_URL?.trim() && !process.env.DATABASE_URL?.trim()) {
  console.warn(
    '[mastracode-web] APP_DATABASE_URL is deprecated — rename it to DATABASE_URL. ' +
      'The old name is honored as a fallback for now, but new deploys should use DATABASE_URL.',
  );
}
const localDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
if (!databaseUrl && !localDevelopmentMode) {
  throw new Error('DATABASE_URL is required outside local development and tests.');
}

const storage = databaseUrl
  ? new PgFactoryStorage({
      id: 'mastra-code-storage',
      connectionString: databaseUrl,
      retention: DEFAULT_RETENTION,
    })
  : new LibSQLFactoryStorage({
      id: 'mastra-code-storage',
      url: `file:${getDatabasePath()}`,
      retention: DEFAULT_RETENTION,
    });
const vector = databaseUrl ? new PgVector({ id: 'mastra-code-vectors', connectionString: databaseUrl }) : undefined;

const demoKnowledgeEnabled = process.env.NODE_ENV !== 'production';
const demoRepository = process.env.MASTRACODE_DEMO_GITHUB_REPOSITORY?.trim() || 'mastra-ai/mastra';
const demoRepositoryMatch = /^([^/]+)\/([^/]+)$/.exec(demoRepository);
if (demoKnowledgeEnabled && !demoRepositoryMatch) {
  throw new Error('MASTRACODE_DEMO_GITHUB_REPOSITORY must use the form owner/repository.');
}
const demoKnowledge = demoKnowledgeEnabled
  ? new Knowledge({
      id: 'mastra',
      description: 'Local Factory demo knowledge imported from the latest GitHub pull requests.',
      storage: storage.getMastraStorage(),
    })
  : undefined;
const demoImportRuns = new Map<string, Promise<void>>();

type DemoGitHubUser = {
  login: string;
  html_url?: string;
  avatar_url?: string;
};

type DemoGitHubItem = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  draft?: boolean;
  user: DemoGitHubUser;
  assignees?: DemoGitHubUser[];
  requested_reviewers?: DemoGitHubUser[];
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  base?: { ref: string };
  head?: { ref: string };
  pull_request?: object;
};

function demoGithubReferences(item: DemoGitHubItem): number[] {
  const references = new Set<number>();
  for (const match of `${item.title}\n${item.body ?? ''}`.matchAll(/(?:^|[^\w])#(\d+)\b/g)) {
    const number = Number(match[1]);
    if (number !== item.number) references.add(number);
  }
  return [...references];
}

function demoGithubMentionedUsers(item: DemoGitHubItem): string[] {
  const logins = new Set<string>();
  for (const match of (item.body ?? '').matchAll(/(?:^|[^\w])@([a-z\d](?:[a-z\d-]{0,38}))/gi)) {
    if (match[1]) logins.add(match[1].toLowerCase());
  }
  return [...logins];
}

function demoGithubUserAddress(login: string): string {
  return `github:user:${encodeURIComponent(login.toLowerCase())}`;
}

// GitHub App logins end in `[bot]`, which would break `[[@login]]` wikilinks.
function demoGithubUserName(login: string): string {
  return `@${login.replace(/\[bot\]$/i, ' (bot)')}`;
}

async function configureDemoKnowledgeProject(input: {
  knowledge: Knowledge;
  projectId: string;
  orgScopeAddress: string;
  resourceScopeAddress: string;
  repositoryScope: MaterializeKnowledgeScopeInput;
}): Promise<void> {
  const [, owner, repository] = demoRepositoryMatch!;
  const repositoryScopeAddress = input.repositoryScope.address;
  const importerId = 'github-graph-demo-v3';
  const source = `github:${owner}/${repository}:graph-v3`;
  const pullRequestsAddress = `github:${owner}/${repository}:pull-requests`;
  const issuesAddress = `github:${owner}/${repository}:issues`;
  const contributorsAddress = `github:${owner}/${repository}:contributors`;

  if (!input.knowledge.getImporter(importerId)) {
    input.knowledge.registerImporter({
      id: importerId,
      access: {
        [input.orgScopeAddress]: 'owner',
        [input.resourceScopeAddress]: 'owner',
        [repositoryScopeAddress]: 'owner',
      },
      triggers: {
        cron: {
          schedule: '0 9 * * *',
          bindings: [{ source, scope: repositoryScopeAddress }],
        },
      },
      handler: async context => {
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'mastra-factory-knowledge-demo',
        };
        if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
        const githubFetch = async (path: string) => {
          const response = await fetch(`https://api.github.com/repos/${owner}/${repository}${path}`, {
            headers,
            signal: context.signal,
          });
          if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(
              `GitHub returned ${response.status} for ${owner}/${repository}${path}: ${detail.slice(0, 200)}`,
            );
          }
          return response.json();
        };

        const [pullPayload, issuePayload] = await Promise.all([
          githubFetch('/pulls?state=all&sort=created&direction=desc&per_page=10'),
          githubFetch('/issues?state=all&sort=created&direction=desc&per_page=30'),
        ]);
        const pulls = pullPayload as DemoGitHubItem[];
        const issues = (issuePayload as DemoGitHubItem[]).filter(item => !item.pull_request).slice(0, 10);
        const itemsByNumber = new Map([...pulls, ...issues].map(item => [item.number, item]));
        const referencedNumbers = [...new Set([...itemsByNumber.values()].flatMap(demoGithubReferences))]
          .filter(number => !itemsByNumber.has(number))
          .slice(0, 20);
        // Sequential on purpose: GitHub's secondary rate limit rejects bursts
        // of concurrent requests with 403 regardless of remaining quota.
        for (const number of referencedNumbers) {
          const item = (await githubFetch(`/issues/${number}`)) as DemoGitHubItem;
          itemsByNumber.set(item.number, item);
        }

        const items = [...itemsByNumber.values()];
        const itemKind = (item: DemoGitHubItem) => (item.pull_request || item.base ? 'pr' : 'issue');
        const itemAddress = (item: DemoGitHubItem) => `github:${owner}/${repository}:${itemKind(item)}:${item.number}`;
        const itemName = (item: DemoGitHubItem) => `${itemKind(item) === 'pr' ? 'PR' : 'Issue'} #${item.number}`;
        const users = new Map<string, DemoGitHubUser>();
        for (const item of items) {
          const actors = [item.user, ...(item.assignees ?? []), ...(item.requested_reviewers ?? [])];
          for (const actor of actors) users.set(actor.login.toLowerCase(), actor);
          for (const login of demoGithubMentionedUsers(item)) {
            if (!users.has(login)) users.set(login, { login });
          }
        }

        const importer = await context.importer();
        await importer.upsertNode(pullRequestsAddress, {
          name: 'Pull requests',
          kind: 'collection',
          metadata: { type: 'github-category', repository: `${owner}/${repository}` },
        });
        await importer.upsertNode(issuesAddress, {
          name: 'Issues',
          kind: 'collection',
          metadata: { type: 'github-category', repository: `${owner}/${repository}` },
        });
        await importer.upsertNode(contributorsAddress, {
          name: 'Contributors',
          kind: 'collection',
          metadata: { type: 'github-category', repository: `${owner}/${repository}` },
        });
        for (const user of users.values()) {
          await importer.upsertNode(demoGithubUserAddress(user.login), {
            name: demoGithubUserName(user.login),
            kind: 'person',
            metadata: { type: 'github-user', login: user.login, url: user.html_url, avatarUrl: user.avatar_url },
          });
        }
        for (const item of items) {
          const kind = itemKind(item);
          await importer.upsertNode(itemAddress(item), {
            name: itemName(item),
            kind: kind === 'pr' ? 'pull-request' : 'issue',
            metadata: {
              type: kind === 'pr' ? 'pull-request' : 'issue',
              title: item.title,
              repository: `${owner}/${repository}`,
              number: item.number,
              url: item.html_url,
              state: item.merged_at ? 'merged' : item.state,
              draft: item.draft,
              author: item.user.login,
              base: item.base?.ref,
              head: item.head?.ref,
              createdAt: item.created_at,
              updatedAt: item.updated_at,
            },
          });
        }

        // One record per relationship: each record is a labeled edge with its
        // own provenance, so the canvas renders "PR #N — reviewed by @x"
        // rather than a hub node with a blob of links.
        const entries: Array<{ address: string; text: string; metadata: Record<string, unknown> }> = [];
        const relate = (address: string, relationship: string, text: string, metadata: Record<string, unknown> = {}) =>
          entries.push({ address, text, metadata: { relationship, ...metadata } });
        const userLink = (login: string) => `[[${demoGithubUserName(users.get(login.toLowerCase())?.login ?? login)}]]`;
        const itemLabel = (item: DemoGitHubItem) => (itemKind(item) === 'pr' ? 'pull request' : 'issue');

        for (const item of items) {
          const kind = itemKind(item);
          const address = itemAddress(item);
          const provenance = { url: item.html_url, updatedAt: item.updated_at };
          const body = (item.body?.trim() || `No ${itemLabel(item)} description.`)
            .replaceAll('[[', '［［')
            .replaceAll(']]', '］］');

          relate(address, 'description', [`# ${itemName(item)}: ${item.title}`, body].join('\n\n'), {
            ...provenance,
            state: item.merged_at ? 'merged' : item.state,
            draft: item.draft,
            ...(item.head && item.base ? { head: item.head.ref, base: item.base.ref } : {}),
          });
          relate(
            kind === 'pr' ? pullRequestsAddress : issuesAddress,
            'contains',
            `${itemName(item)} (${item.title}) is a ${itemLabel(item)} in this collection: [[${itemName(item)}]]`,
            provenance,
          );
          relate(address, 'authored-by', `${itemName(item)} was opened by ${userLink(item.user.login)}`, provenance);
          for (const assignee of item.assignees ?? []) {
            relate(address, 'assigned-to', `${itemName(item)} is assigned to ${userLink(assignee.login)}`, provenance);
          }
          for (const reviewer of item.requested_reviewers ?? []) {
            relate(
              address,
              'reviewed-by',
              `${itemName(item)} requests review from ${userLink(reviewer.login)}`,
              provenance,
            );
          }
          const explicitActors = new Set(
            [item.user, ...(item.assignees ?? []), ...(item.requested_reviewers ?? [])].map(user =>
              user.login.toLowerCase(),
            ),
          );
          for (const login of demoGithubMentionedUsers(item)) {
            if (explicitActors.has(login)) continue;
            relate(address, 'mentions', `${itemName(item)} mentions ${userLink(login)}`, provenance);
          }
          for (const number of demoGithubReferences(item)) {
            const related = itemsByNumber.get(number);
            if (!related) continue;
            relate(address, 'references', `${itemName(item)} references [[${itemName(related)}]]`, provenance);
          }
        }
        for (const user of users.values()) {
          relate(
            contributorsAddress,
            'contains',
            `${userLink(user.login)} contributes to ${owner}/${repository}`,
            user.html_url ? { url: user.html_url } : {},
          );
        }

        const desiredByAddress = new Map<string, Map<string, (typeof entries)[number]>>();
        for (const entry of entries) {
          const recordId = createHash('sha256')
            .update(`${entry.address}:${entry.text}`)
            .digest('hex')
            .replace(/^(.{8})(.{4}).(.{3}).(.{3})(.{12}).*$/, '$1-$2-4$3-8$4-$5');
          let byId = desiredByAddress.get(entry.address);
          if (!byId) desiredByAddress.set(entry.address, (byId = new Map()));
          byId.set(recordId, entry);
        }
        const nodeAddresses = new Set([
          ...desiredByAddress.keys(),
          ...items.map(itemAddress),
          ...[...users.keys()].map(demoGithubUserAddress),
        ]);
        for (const address of nodeAddresses) {
          const node = await importer.getNode(address);
          if (!node) throw new Error(`GitHub node disappeared before record reconciliation: ${address}`);
          const desired = desiredByAddress.get(address) ?? new Map();
          const existing = await node.listRecords();
          for (const record of existing) {
            if (!desired.has(record.id)) await node.removeRecord(record.id);
          }
          const existingIds = new Set(existing.map(record => record.id));
          for (const [recordId, entry] of desired) {
            if (existingIds.has(recordId)) continue;
            await node.appendRecord({ id: recordId, text: entry.text, metadata: entry.metadata });
          }
        }
        await context.state.set('latestCreatedAt', pulls[0]?.created_at ?? new Date().toISOString());
      },
    });
  }

  if (!demoImportRuns.has(input.projectId)) {
    // The destination scope must exist before the importer binds to it.
    // Materialization is idempotent and coalesces with Factory's own pass
    // over the access profile, so this never races the profile hook.
    const run = input.knowledge
      .materializeScope(input.repositoryScope)
      .then(async () => {
        await input.knowledge.getImporter(importerId)!.run({ source, scope: repositoryScopeAddress }, undefined);
      })
      .catch((error: unknown) => {
        console.error(`[demo-knowledge] GitHub import for ${input.projectId} failed`, error);
      });
    demoImportRuns.set(input.projectId, run);
  }
}

// Deployment-stable secret for OAuth/link `state` signing. Shared by the
// factory's integration signer and the channel-account-link deep link so both
// sign/verify with the same key: webhook secret first, then the WorkOS cookie
// password, then the Slack signing secret so a Slack-only deployment still has
// a stable signer. Unset → per-process random secret (single-process local dev
// only).
const stateSecret =
  process.env.GITHUB_APP_WEBHOOK_SECRET ||
  process.env.WORKOS_COOKIE_PASSWORD ||
  process.env.SLACK_APP_SIGNING_SECRET ||
  undefined;

// Slack channels + account linking. Optional: the Slack adapter validates the
// signing secret at construction, so the integration is only built when the
// Slack app env is configured. Repo-backed Slack threads come from the
// factory's source-control owner (GitHub) — the integration wires itself.
const slackSigningSecret = process.env.SLACK_APP_SIGNING_SECRET?.trim();
const slack = slackSigningSecret
  ? new SlackIntegration({
      signingSecret: slackSigningSecret,
      botToken: process.env.SLACK_APP_BOT_TOKEN,
      clientId: process.env.SLACK_APP_CLIENT_ID?.trim(),
      clientSecret: process.env.SLACK_APP_CLIENT_SECRET?.trim(),
      // Slack requires an HTTPS redirect_uri, which locally is the tunnel
      // origin rather than the app's own public URL.
      oidcRedirectBaseUrl: process.env.MASTRACODE_CHANNELS_PUBLIC_URL ?? process.env.MASTRACODE_PUBLIC_URL,
      uiOrigin: process.env.MASTRACODE_PUBLIC_URL,
    })
  : undefined;

const integrations = [...(github ? [github] : []), ...(linear ? [linear] : []), ...(slack ? [slack] : [])];

export const factoryConfigVersion = 'mastracode-web-v1';

const hasPlatformSandboxEnv =
  ['MASTRA_PLATFORM_ACCESS_TOKEN', 'MASTRA_PLATFORM_SECRET_KEY'].some(key => Boolean(process.env[key]?.trim())) &&
  ['MASTRA_ENVIRONMENT_ID', 'MASTRA_PROJECT_ID'].every(key => Boolean(process.env[key]?.trim()));
export const factory = new MastraFactory({
  auth,
  secretEncryption,
  integrations,
  configVersion: factoryConfigVersion,
  sandbox: ctx => {
    const useLocalSandbox = process.env.FACTORY_SANDBOX_PROVIDER?.trim() === 'local';
    if (!useLocalSandbox && hasPlatformSandboxEnv) {
      return new PlatformSandbox({
        id: ctx.sessionId,
        template: createPlatformRepoTemplate(ctx),
      });
    }

    if (!useLocalSandbox && process.env.E2B_API_KEY?.trim()) {
      return new E2BSandbox({
        id: ctx.sessionId,
        template: createE2BRepoTemplate(ctx),
      });
    }

    return new LocalSandbox({
      workingDirectory: join(
        process.env.MASTRACODE_LOCAL_SANDBOX_ROOT?.trim() || join(homedir(), '.mastracode', 'web', 'sandboxes'),
        ctx.sessionId,
      ),
      env: localSandboxEnv(),
    });
  },
  // Per-replica cap on concurrent Factory background dispatches. Unset means
  // the dispatcher default; invalid and non-positive values are ignored.
  dispatcher: {
    maxInFlight: positiveInt(process.env.MASTRACODE_DISPATCH_MAX_IN_FLIGHT),
  },
  // Agent state (threads, messages, memory, OM, recall vectors) lives in the
  // single app Postgres alongside the github/app tables — one shared DB (and
  // pg pool) for all users, separated by `resourceId` scoping. Unset (bare
  // local dev) → default storage resolution applies (local libSQL file).
  storage,
  vector,
  ...(demoKnowledge
    ? {
        knowledge: demoKnowledge,
        knowledgeAccessProfile: async ({ knowledge, projectId, builtInScopes }) => {
          const repositoryScope = {
            address: `resource:${projectId}:github:${demoRepository}`,
            name: demoRepository,
            parentAddresses: [builtInScopes.resource.address],
            contextualScopeAddress: builtInScopes.resource.address,
            parameters: { repository: demoRepository },
          };
          await configureDemoKnowledgeProject({
            knowledge,
            projectId,
            orgScopeAddress: builtInScopes.org.address,
            resourceScopeAddress: builtInScopes.resource.address,
            repositoryScope,
          });
          return {
            id: `local-demo:${projectId}`,
            rootScopeAddress: builtInScopes.org.address,
            baselineScopes: [builtInScopes.org, builtInScopes.resource, repositoryScope],
            vouchedScopeAddresses: [builtInScopes.org.address, builtInScopes.resource.address, repositoryScope.address],
          };
        },
      }
    : {}),
  pubsub,
  platform: {
    // The deployment's own self-hosted App slug, when one is configured. It is
    // NOT Platform's identity: Platform posts as its own App, which names
    // itself. Reusing this value for that purpose left self-recognition
    // comparing against `undefined[bot]` on every Platform deployment, where
    // this is legitimately unset.
    githubAppSlug,
  },
  // Browser-facing origin. On the platform the SPA is hosted separately, so
  // this MUST be set to the public API origin.
  publicUrl: process.env.MASTRACODE_PUBLIC_URL,
  // Allowed cross-origin SPA origins (comma-separated). The SPA is served from
  // a separate static host, so credentialed requests must be explicitly allowed.
  allowedOrigins: (process.env.MASTRACODE_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  // Deployment-stable secret for OAuth `state` signing (GitHub/Linear connect
  // flows). See `stateSecret` above.
  stateSecret,
});

const preparedArgs = await factory.prepare();

// Construct the server-owned Mastra HERE so the `new Mastra(...)` literal lives
// in the entry file (see module docs). `prepare()` returns the constructor args
// carrying the controller (via `agentControllers`), storage, and the assembled
// `server` config (middleware + apiRoutes + cors). Keep the worker-relevant
// properties explicit so deploy builds can statically detect the worker topology.
export const mastra = new Mastra({
  ...preparedArgs,
  storage: preparedArgs.storage,
  pubsub: preparedArgs.pubsub,
  workers: preparedArgs.workers,
});

// Post-construct boot: initialize the controller (which now inherits this
// instance's storage) and start its workers. Runs at module load via top-level
// await, so the deployer imports a fully-booted instance.
await factory.finalize();
