import type { SandboxStartHook } from '@mastra/core/workspace';

import type { ConnectClientOptions, ConnectionCredential } from './client.js';
import { getCredential, listProjectConnections, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';
import { groupByIntegrationId, resolveConnection, validateIntegrationOverrides } from './resolution.js';

export interface EnvironmentIntegrationOptions {
  /** Pin a specific connection id (bypasses env-var fallback and single-active-connection resolution). */
  connectionId?: string;
  /** Exclude this provider entirely, even if a connection exists. */
  disabled?: boolean;
}

export interface EnvironmentOptions {
  /** Platform project whose connections to discover. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /** Optional per-provider overrides keyed by integrationId. */
  integrations?: Record<string, EnvironmentIntegrationOptions>;
  client?: ConnectClientOptions;
}

/**
 * Sandbox credentials materialized from the project's Platform connections.
 * Pass `env` into the sandbox's environment and `onStart` as (or inside) its
 * start hook so CLI tooling in the sandbox is authenticated out of the box.
 */
export interface ConnectEnvironment {
  /** Environment variables to inject into the sandbox (e.g. GH_TOKEN). Never log these. */
  env: Record<string, string | undefined>;
  /** Runs provider setup inside the sandbox (e.g. git credential wiring). Safe no-op when nothing to do. */
  onStart: SandboxStartHook;
}

/**
 * One provider's contribution to a sandbox environment: env vars derived from
 * the connection credential plus optional in-sandbox setup.
 */
interface EnvironmentContributor {
  integrationId: string;
  /** Fallback connection-id environment variable when more than one active connection exists. */
  envVar: string;
  build(credential: ConnectionCredential): {
    env: Record<string, string | undefined>;
    onStart?: SandboxStartHook;
  };
}

function credentialToken(credential: ConnectionCredential): string {
  return credential.type === 'oauth2' ? credential.accessToken : credential.apiKey;
}

/**
 * Wires git's credential helper to read the token from the environment at use
 * time, so the secret lives in the process env rather than in git config or
 * remote URLs. `gh` needs no setup: it honors GH_TOKEN directly.
 */
const GITHUB_GIT_CREDENTIAL_HELPER = '!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f';

const githubEnvironment: EnvironmentContributor = {
  integrationId: 'github',
  envVar: 'MASTRA_GITHUB_CONNECTION_ID',
  build(credential) {
    const token = credentialToken(credential);
    return {
      env: { GH_TOKEN: token, GITHUB_TOKEN: token },
      onStart: async ({ sandbox }) => {
        if (!sandbox.executeCommand) {
          console.warn(
            '[@mastra/connect] github environment: sandbox does not support executeCommand; skipping git credential setup (gh still works via GH_TOKEN).',
          );
          return;
        }
        await sandbox.executeCommand('git', [
          'config',
          '--global',
          'credential.https://github.com.helper',
          GITHUB_GIT_CREDENTIAL_HELPER,
        ]);
      },
    };
  },
};

/** Providers that know how to materialize sandbox credentials. */
const ENVIRONMENT_CONTRIBUTORS: readonly EnvironmentContributor[] = [githubEnvironment];

/**
 * Resolves the project's Platform connections into sandbox credentials:
 * environment variables plus a start hook that finishes in-sandbox setup.
 * Currently GitHub-aware (`GH_TOKEN`/`GITHUB_TOKEN` + git credential helper);
 * more providers plug in over time.
 *
 * Connection resolution matches `connect()`: a per-integration `connectionId`
 * or the provider's `MASTRA_*_CONNECTION_ID` env var wins, else a single
 * active connection; ambiguity, needs_reauth, and credential-fetch failures
 * warn and skip that provider. Configuration errors (missing project id,
 * malformed integration id) throw here so they surface at startup.
 *
 * The returned `env` is a snapshot: call `environment()` again for a fresh
 * token when starting new sandboxes.
 *
 * @example
 * const { env, onStart } = await environment({ projectId });
 * const sandbox = new E2BSandbox({ env, onStart });
 * // in the sandbox: `gh pr list`, `git clone https://github.com/org/repo` just work
 */
export async function environment(options: EnvironmentOptions = {}): Promise<ConnectEnvironment> {
  const projectId = options.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (!projectId) {
    throw new MastraConnectError('missing_project_id', 'Missing project id: set MASTRA_PROJECT_ID or pass projectId.');
  }
  validateIntegrationOverrides(options.integrations);
  const client = resolveClient(options.client);

  const connections = await listProjectConnections(client, projectId);
  const byIntegrationId = groupByIntegrationId(connections);

  const env: Record<string, string | undefined> = {};
  const hooks: { integrationId: string; hook: SandboxStartHook }[] = [];

  for (const contributor of ENVIRONMENT_CONTRIBUTORS) {
    const integrationId = contributor.integrationId;
    const overrides = options.integrations?.[integrationId] ?? {};
    if (overrides.disabled) continue;
    const candidates = byIntegrationId.get(integrationId) ?? [];
    if (candidates.length === 0) continue;
    const connectionId = resolveConnection(
      { integrationId, envVar: contributor.envVar, connectionId: overrides.connectionId },
      candidates,
    );
    if (!connectionId) continue; // warned + skipped

    let credential: ConnectionCredential;
    try {
      credential = await getCredential(client, connectionId);
    } catch (error) {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId} environment: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    const contribution = contributor.build(credential);
    for (const [key, value] of Object.entries(contribution.env)) {
      if (key in env) {
        console.warn(
          `[@mastra/connect] ${integrationId} environment overwrites env var '${key}' set by an earlier provider.`,
        );
      }
      env[key] = value;
    }
    if (contribution.onStart) hooks.push({ integrationId, hook: contribution.onStart });
  }

  const onStart: SandboxStartHook = async args => {
    for (const { hook } of hooks) {
      await hook(args);
    }
  };

  return { env, onStart };
}
