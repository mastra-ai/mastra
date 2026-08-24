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
