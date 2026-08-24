import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { TrustedPluginPaths } from '../commands/service.js';
import { discoverSessionCommands, prepareSessionCommand, SessionCommandError } from '../commands/service.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';
import {
  authorizeSessionAddress,
  MAX_RESOURCE_ID_LENGTH,
  MAX_SCOPE_LENGTH,
  type SessionAuthorizationResult,
  type SessionCommandAddress,
} from './session-address.js';
import {
  MAX_COMMAND_LENGTH,
  type SessionCommandDiscoveryRequest,
  type SessionCommandPrepareRequest,
} from './session-command-contract.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ARGUMENTS_LENGTH = 16_384;

export interface SessionCommandRoutesDeps extends RouteDependencies {
  controllerId: string;
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>;
  /** Server-owned plugin asset snapshot; client state is never trusted. */
  pluginPaths: TrustedPluginPaths;
  /** Expose host user-global command/skill directories (local deploys only). */
  includeRuntimeGlobals: boolean;
  sourceControlStorage?: SourceControlStorageHandle;
  ensureSourceControlReady?: () => Promise<void>;
  authorizeSessionAddress?: (context: Context, address: SessionCommandAddress) => Promise<SessionAuthorizationResult>;
}

const ERROR_STATUS = {
  session_not_found: 404,
  command_not_found: 404,
  command_unavailable: 409,
  command_expansion_failed: 422,
} as const;

function loose(context: unknown): Context {
  return context as Context;
}

function parseAddress(value: Record<string, unknown>): SessionCommandAddress | undefined {
  if (typeof value.resourceId !== 'string' || value.resourceId.length === 0) return undefined;
  if (value.resourceId.length > MAX_RESOURCE_ID_LENGTH) return undefined;
  if (
    value.projectRepositoryId !== undefined &&
    (typeof value.projectRepositoryId !== 'string' || !UUID_RE.test(value.projectRepositoryId))
  ) {
    return undefined;
  }
  if (value.scope !== undefined && (typeof value.scope !== 'string' || value.scope.length > MAX_SCOPE_LENGTH)) {
    return undefined;
  }
  return {
    resourceId: value.resourceId,
    ...(value.projectRepositoryId ? { projectRepositoryId: value.projectRepositoryId } : {}),
    ...(value.scope ? { scope: value.scope } : {}),
  };
}

function parseDiscoverBody(value: unknown): SessionCommandDiscoveryRequest | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return parseAddress(value as Record<string, unknown>);
}

function parsePrepareBody(value: unknown): SessionCommandPrepareRequest | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const address = parseAddress(input);
  if (!address) return undefined;
  if (typeof input.command !== 'string' || input.command.length === 0 || input.command.length > MAX_COMMAND_LENGTH) {
    return undefined;
  }
  // Tokens are exact: no control characters, no interior whitespace.
  if (/[\x00-\x1f\x7f]/.test(input.command) || /\s/.test(input.command.trim())) return undefined;
  if (!input.command.startsWith('//') && !input.command.startsWith('/skill/') && !input.command.startsWith('/goal/')) {
    return undefined;
  }
  let args: string | undefined;
  if (input.arguments !== undefined) {
    if (typeof input.arguments !== 'string' || input.arguments.length > MAX_ARGUMENTS_LENGTH) return undefined;
    args = input.arguments;
  }
  return { ...address, command: input.command, ...(args !== undefined ? { arguments: args } : {}) };
}

export class SessionCommandRoutes extends Route<SessionCommandRoutesDeps> {
  #commandError(c: Context, error: SessionCommandError) {
    const status = ERROR_STATUS[error.code];
    // Expansion failures can carry arbitrary template/sandbox detail — always
    // answer with the fixed redacted message.
    const message = error.code === 'command_expansion_failed' ? 'The command could not be expanded.' : error.message;
    return c.json({ error: error.code, message }, status);
  }

  routes(): ApiRoute[] {
    const {
      controllerId,
      controller,
      auth,
      sourceControlStorage,
      ensureSourceControlReady,
      pluginPaths,
      includeRuntimeGlobals,
      authorizeSessionAddress: customAuthorize,
    } = this.deps;

    const authorize =
      customAuthorize ??
      ((context: Context, address: SessionCommandAddress) =>
        authorizeSessionAddress({ auth, sourceControlStorage, ensureSourceControlReady }, context, address));

    const serviceDeps = (body: SessionCommandAddress) => ({
      controller,
      resourceId: body.resourceId,
      scope: body.scope,
      pluginPaths,
      includeRuntimeGlobals,
    });

    const handleDiscover = async (rawContext: unknown) => {
      const c = loose(rawContext);
      if (c.req.param('controllerId') !== controllerId) {
        return c.json({ error: 'controller_not_found', message: 'Agent controller not found.' }, 404);
      }
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        rawBody = undefined;
      }
      const body = parseDiscoverBody(rawBody);
      if (!body) {
        return c.json({ error: 'invalid_request', message: 'Invalid discovery request.' }, 400);
      }

      // Authorization precedes any live-session lookup.
      const authorization = await authorize(c, body);
      if (!authorization.allowed) {
        return c.json({ error: authorization.code, message: authorization.message }, authorization.status ?? 403);
      }

      try {
        return c.json(await discoverSessionCommands(serviceDeps(body)), 200);
      } catch (error) {
        if (error instanceof SessionCommandError) return this.#commandError(c, error);
        throw error;
      }
    };

    const handlePrepare = async (rawContext: unknown) => {
      const c = loose(rawContext);
      if (c.req.param('controllerId') !== controllerId) {
        return c.json({ error: 'controller_not_found', message: 'Agent controller not found.' }, 404);
      }
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        rawBody = undefined;
      }
      const body = parsePrepareBody(rawBody);
      if (!body) {
        return c.json({ error: 'invalid_request', message: 'Invalid preparation request.' }, 400);
      }

      const authorization = await authorize(c, body);
      if (!authorization.allowed) {
        return c.json({ error: authorization.code, message: authorization.message }, authorization.status ?? 403);
      }

      try {
        const { command, arguments: args } = body;
        return c.json(await prepareSessionCommand(serviceDeps(body), { command, arguments: args }), 200);
      } catch (error) {
        if (error instanceof SessionCommandError) return this.#commandError(c, error);
        throw error;
      }
    };

    return [
      registerApiRoute('/web/agent-controller/:controllerId/commands/discover', {
        method: 'POST',
        requiresAuth: false,
        handler: context => handleDiscover(context),
      }),
      registerApiRoute('/web/agent-controller/:controllerId/commands/prepare', {
        method: 'POST',
        requiresAuth: false,
        handler: context => handlePrepare(context),
      }),
    ];
  }
}
