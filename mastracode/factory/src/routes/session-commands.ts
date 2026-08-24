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
  MAX_ARGUMENTS_LENGTH,
  parseSessionAddress,
  type SessionAuthorizationResult,
  type SessionCommandAddress,
} from './session-address.js';
import {
  isSessionCommandToken,
  MAX_COMMAND_LENGTH,
  sessionCommandsRoute,
  type SessionCommandDiscoveryRequest,
  type SessionCommandPrepareRequest,
} from './session-command-contract.js';

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
  command_discovery_failed: 422,
} as const;

function loose(context: unknown): Context {
  return context as Context;
}

function parseDiscoverBody(value: unknown): SessionCommandDiscoveryRequest | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return parseSessionAddress(value as Record<string, unknown>);
}

function parsePrepareBody(value: unknown): SessionCommandPrepareRequest | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const address = parseSessionAddress(input);
  if (!address) return undefined;
  if (typeof input.command !== 'string' || input.command.length === 0 || input.command.length > MAX_COMMAND_LENGTH) {
    return undefined;
  }
  // Tokens are exact: printable, no control characters, no interior whitespace.
  if (/\s/.test(input.command.trim()) || /[\x00-\x1f\x7f]/.test(input.command)) return undefined;
  if (!isSessionCommandToken(input.command)) return undefined;
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
    const authorizeWithOptions = customAuthorize
      ? async (
          context: Context,
          address: SessionCommandAddress,
          options: { storedSessionAccess?: 'owner' | 'viewer' },
        ) => {
          // Custom authorizers predate the ownership knob; they already gate
          // their own callers, so the option degrades to the plain check.
          void options;
          return customAuthorize(context, address);
        }
      : (context: Context, address: SessionCommandAddress, options: Parameters<typeof authorizeSessionAddress>[3]) =>
          authorizeSessionAddress({ auth, sourceControlStorage, ensureSourceControlReady }, context, address, options);

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

      const authorization = await authorizeWithOptions(c, body, { storedSessionAccess: 'owner' });
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
      registerApiRoute(sessionCommandsRoute(':controllerId', 'discover'), {
        method: 'POST',
        requiresAuth: false,
        handler: context => handleDiscover(context),
      }),
      registerApiRoute(sessionCommandsRoute(':controllerId', 'prepare'), {
        method: 'POST',
        requiresAuth: false,
        handler: context => handlePrepare(context),
      }),
    ];
  }
}
