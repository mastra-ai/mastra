import { mkdir, readFile, rename, writeFile, unlink, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Stored Slack user-token credentials.
 *
 * Slack rotates the refresh token on every refresh, so the whole record is
 * re-persisted after each rotation — losing a rotated refresh token strands
 * the connection (the old one is single-use).
 */
export interface SlackUserCredentials {
  /** The user access token (`xoxp-…` / `xoxe.xoxp-…`). */
  accessToken: string;
  /** Rotated refresh token. Absent when the app has token rotation disabled. */
  refreshToken?: string;
  /** Epoch ms when `accessToken` expires. Absent for non-expiring tokens. */
  expiresAt?: number;
  /** The OAuth client_id the credentials were issued against. */
  clientId?: string;
  /** Slack workspace id (e.g. `T0123456`). */
  teamId?: string;
  /** Slack workspace name. */
  teamName?: string;
  /** The authed user's Slack id (e.g. `U0123456`). */
  userId?: string;
  /**
   * Set when a refresh failed terminally (dead refresh token). The user must
   * run the connect flow again; `getToken()` surfaces this as
   * `SlackAuthReconnectRequiredError` instead of a raw `invalid_token`.
   */
  needsReconnect?: boolean;
}

/**
 * Pluggable persistence for Slack user credentials.
 *
 * The default is {@link FileSlackCredentialStorage}. Hosts with their own
 * secret handling (servers, mastracode) can implement this interface to back
 * credentials with env vars, keychains, or databases.
 */
export interface SlackCredentialStorage {
  load(): Promise<SlackUserCredentials | undefined>;
  save(credentials: SlackUserCredentials): Promise<void>;
  clear(): Promise<void>;
}

/** Default credential file location: `~/.mastra/slack-auth.json`. */
export function defaultSlackCredentialPath(): string {
  return join(homedir(), '.mastra', 'slack-auth.json');
}

/**
 * File-backed credential storage. Writes are atomic (temp file + rename) and
 * the file is chmod'd to 0600 since it contains live tokens.
 */
export class FileSlackCredentialStorage implements SlackCredentialStorage {
  readonly #path: string;

  constructor(path: string = defaultSlackCredentialPath()) {
    this.#path = path;
  }

  get path(): string {
    return this.#path;
  }

  async load(): Promise<SlackUserCredentials | undefined> {
    let raw: string;
    try {
      raw = await readFile(this.#path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
    try {
      const parsed = JSON.parse(raw) as SlackUserCredentials;
      if (typeof parsed?.accessToken !== 'string' || parsed.accessToken.length === 0) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  async save(credentials: SlackUserCredentials): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true });
    const tempPath = `${this.#path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, this.#path);
    // rename preserves the temp file's mode, but be explicit in case the
    // destination already existed with looser permissions.
    await chmod(this.#path, 0o600).catch(() => {});
  }

  async clear(): Promise<void> {
    try {
      await unlink(this.#path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

/** In-memory credential storage, mainly for tests and ephemeral processes. */
export class InMemorySlackCredentialStorage implements SlackCredentialStorage {
  #credentials?: SlackUserCredentials;

  constructor(initial?: SlackUserCredentials) {
    this.#credentials = initial;
  }

  async load(): Promise<SlackUserCredentials | undefined> {
    return this.#credentials ? { ...this.#credentials } : undefined;
  }

  async save(credentials: SlackUserCredentials): Promise<void> {
    this.#credentials = { ...credentials };
  }

  async clear(): Promise<void> {
    this.#credentials = undefined;
  }
}
