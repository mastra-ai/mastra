/**
 * Wire contracts for Factory session-command discovery and preparation.
 *
 * These types are the only thing the browser SPA imports from this package —
 * the file must stay dependency-free so `import type` never pulls server code
 * into the client bundle.
 */

export interface SessionCommandAddressPayload {
  /** Live agent-controller session id (or personal user id). */
  resourceId: string;
  /** Factory repository link for stored user sessions. */
  projectRepositoryId?: string;
  /** Session scope (worktree path) when the address requires one. */
  scope?: string;
}

export interface SessionCommandDiscoveryRequest extends SessionCommandAddressPayload {}

export type SessionCommandSource = 'custom' | 'skill';

export interface SessionCommandDescriptor {
  /** Exact composer token: `//name`, `/skill/name`, or `/goal/name`. */
  command: string;
  source: SessionCommandSource;
  /** Custom-command name or skill name behind the token. */
  name: string;
  description: string;
  /** Whether a `/goal/<name>` form exists for this source. */
  goal: boolean;
}

export interface SessionCommandDiscoveryResponse {
  capabilities: {
    customCommands: 'supported' | 'unsupported';
    skills: 'supported' | 'unsupported';
  };
  commands: SessionCommandDescriptor[];
}

export interface SessionCommandPrepareRequest extends SessionCommandAddressPayload {
  /** Exact composer token as advertised by discovery. */
  command: string;
  arguments?: string;
}

export type SessionCommandPrepareResponse =
  | { action: 'message'; content: string }
  | { action: 'goal'; objective: string }
  | { action: 'none'; notice: string };

/** Maximum serialized length of one command token. */
export const MAX_COMMAND_LENGTH = 512;

/** Custom command names: `deploy`, `presentation:review`, `git.commit`. */
export const CUSTOM_COMMAND_NAME_RE = /^[A-Za-z0-9._-]+(?::[A-Za-z0-9._-]+)*$/;

/** Skill directory names. */
export const SKILL_COMMAND_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Route prefix served by Factory AND called by the browser SPA. Both sides
 * derive their strings from this constant so they cannot diverge — the routes
 * live under `/web`, not under the core API's `/api` mount.
 *
 * `controllerId` is interpolated verbatim: the server passes the Hono
 * `:controllerId` placeholder, the browser passes an encoded id.
 */
export const SESSION_COMMANDS_ROUTE_PREFIX = '/web/agent-controller';

export function sessionCommandsRoute(controllerId: string, action: 'discover' | 'prepare'): string {
  return `${SESSION_COMMANDS_ROUTE_PREFIX}/${controllerId}/commands/${action}`;
}

const EXPLICIT_CUSTOM_TOKEN_PREFIX = '//';
const SKILL_TOKEN_PREFIX = '/skill/';
const GOAL_SOURCE_TOKEN_PREFIX = '/goal/';

/** `//name` — explicit custom-command invocation. */
export function isExplicitCustomToken(token: string): boolean {
  return token.startsWith(EXPLICIT_CUSTOM_TOKEN_PREFIX);
}

/** `/skill/name` — skill invocation. */
export function isSkillToken(token: string): boolean {
  return token.startsWith(SKILL_TOKEN_PREFIX);
}

/** `/goal/<name>` — goal-capable custom command or goal skill. */
export function isGoalSourceToken(token: string): boolean {
  return token.startsWith(GOAL_SOURCE_TOKEN_PREFIX);
}

/** The composer token forms this protocol accepts; everything else is invalid. */
export function isSessionCommandToken(token: string): boolean {
  return isExplicitCustomToken(token) || isSkillToken(token) || isGoalSourceToken(token);
}
