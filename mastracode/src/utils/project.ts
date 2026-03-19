/**
 * Project detection utilities
 *
 * Detects project identity from git repo or filesystem path.
 * Handles git worktrees by finding the main repository.
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export interface ProjectInfo {
  /** Unique resource ID for this project (used for thread grouping) */
  resourceId: string;
  /** Human-readable project name */
  name: string;
  /** Absolute path to the project root */
  rootPath: string;
  /** Git remote URL if available */
  gitUrl?: string;
  /** Current git branch */
  gitBranch?: string;
  /** Whether this is a git worktree */
  isWorktree: boolean;
  /** Path to main git repo (different from rootPath if worktree) */
  mainRepoPath?: string;
  /** Whether the resourceId was explicitly overridden (env var or config) */
  resourceIdOverride?: boolean;
}

/**
 * Run a git command and return stdout, or undefined if it fails
 */
function git(args: string, cwd: string): string | undefined {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Slugify a string for use in IDs
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Create a short hash of a string
 */
function shortHash(str: string): string {
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

/**
 * Normalize a git URL to a canonical form for comparison
 * - Removes .git suffix
 * - Converts SSH to HTTPS format for consistency
 * - Lowercases
 */
function normalizeGitUrl(url: string): string {
  return url
    .replace(/\.git$/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^ssh:\/\/git@/, 'https://')
    .toLowerCase();
}

/**
 * Detect project info from a directory path
 */
export function detectProject(projectPath: string): ProjectInfo {
  const absolutePath = path.resolve(projectPath);

  // Check if this is a git repo
  const gitDir = git('rev-parse --git-dir', absolutePath);
  const isGitRepo = gitDir !== undefined;

  let rootPath = absolutePath;
  let gitUrl: string | undefined;
  let gitBranch: string | undefined;
  let isWorktree = false;
  let mainRepoPath: string | undefined;

  if (isGitRepo) {
    // Get the repo root (handles being in a subdirectory)
    rootPath = git('rev-parse --show-toplevel', absolutePath) || absolutePath;

    // Check for worktree - git-common-dir differs from git-dir in worktrees
    const commonDir = git('rev-parse --git-common-dir', absolutePath);
    if (commonDir && commonDir !== '.git' && commonDir !== gitDir) {
      isWorktree = true;
      // The common dir is inside the main repo's .git folder
      mainRepoPath = path.dirname(path.resolve(rootPath, commonDir));
    }

    // Get remote URL (prefer origin, fall back to first remote)
    gitUrl = git('remote get-url origin', absolutePath);
    if (!gitUrl) {
      const remotes = git('remote', absolutePath);
      if (remotes) {
        const firstRemote = remotes.split('\n')[0];
        if (firstRemote) {
          gitUrl = git(`remote get-url ${firstRemote}`, absolutePath);
        }
      }
    }

    // Get current branch
    gitBranch = git('rev-parse --abbrev-ref HEAD', absolutePath);
  }

  // Generate resource ID
  // Priority: normalized git URL > main repo path (for worktrees) > absolute path
  let resourceIdSource: string;
  if (gitUrl) {
    resourceIdSource = normalizeGitUrl(gitUrl);
  } else if (mainRepoPath) {
    resourceIdSource = mainRepoPath;
  } else {
    resourceIdSource = rootPath;
  }

  // Create a readable but unique resource ID
  // Format: slugified-name-shorthash
  const baseName = gitUrl
    ? gitUrl
        .split('/')
        .pop()
        ?.replace(/\.git$/, '') || 'project'
    : path.basename(rootPath);

  const resourceId = `${slugify(baseName)}-${shortHash(resourceIdSource)}`;

  return {
    resourceId,
    name: baseName,
    rootPath,
    gitUrl,
    gitBranch,
    isWorktree,
    mainRepoPath,
  };
}

/**
 * Get the current git branch for a given directory.
 * Lightweight alternative to detectProject() for refreshing just the branch.
 */
export function getCurrentGitBranch(cwd: string): string | undefined {
  return git('rev-parse --abbrev-ref HEAD', cwd);
}

/**
 * Get the application data directory for mastracode
 * - macOS: ~/Library/Application Support/mastracode
 * - Linux: ~/.local/share/mastracode
 * - Windows: %APPDATA%/mastracode
 */
export function getAppDataDir(): string {
  const platform = os.platform();
  let baseDir: string;

  if (platform === 'darwin') {
    baseDir = path.join(os.homedir(), 'Library', 'Application Support');
  } else if (platform === 'win32') {
    baseDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else {
    // Linux and others - follow XDG spec
    baseDir = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  }

  const appDir = path.join(baseDir, 'mastracode');

  // Ensure directory exists
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }

  return appDir;
}
/**
 * Get the database path for mastracode
 * Can be overridden with the MASTRA_DB_PATH environment variable for debugging.
 */
export function getDatabasePath(): string {
  if (process.env.MASTRA_DB_PATH) {
    return process.env.MASTRA_DB_PATH;
  }
  return path.join(getAppDataDir(), 'mastra.db');
}

import type { StorageBackend, StorageSettings } from '../onboarding/settings.js';

/**
 * LibSQL storage configuration.
 */
export interface LibSQLStorageConfig {
  backend: 'libsql';
  url: string;
  authToken?: string;
  isRemote: boolean;
}

/**
 * PostgreSQL storage configuration.
 */
export interface PgStorageConfig {
  backend: 'pg';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  schemaName?: string;
  disableInit?: boolean;
  skipDefaultIndexes?: boolean;
}

/**
 * Resolved storage configuration for either backend.
 */
export type StorageConfig = LibSQLStorageConfig | PgStorageConfig;

/**
 * Get the resolved storage configuration.
 *
 * Priority (highest to lowest):
 *   1. Environment variables: MASTRA_STORAGE_BACKEND + backend-specific vars
 *   2. Global settings (from /settings): settings.storage
 *   3. Legacy config files: .mastracode/database.json (LibSQL only)
 *   4. Local file database (LibSQL default)
 *
 * For PG, the env vars are:
 *   MASTRA_STORAGE_BACKEND=pg
 *   MASTRA_PG_CONNECTION_STRING or MASTRA_PG_HOST/PORT/DATABASE/USER/PASSWORD
 *   MASTRA_PG_SCHEMA_NAME (optional)
 *
 * For LibSQL, the legacy env vars still work:
 *   MASTRA_DB_URL + MASTRA_DB_AUTH_TOKEN
 */
export function getStorageConfig(projectDir?: string, storageSettings?: StorageSettings): StorageConfig {
  // 1. Environment variable — explicit backend selection
  const envBackend = process.env.MASTRA_STORAGE_BACKEND as StorageBackend | undefined;

  if (envBackend === 'pg') {
    return resolvePgFromEnv();
  }

  // Legacy LibSQL env vars (MASTRA_DB_URL) — treat as explicit libsql
  if (envBackend === 'libsql' || process.env.MASTRA_DB_URL) {
    return resolveLibSQLFromEnv();
  }

  // 2. Global settings (from /settings)
  if (storageSettings && storageSettings.backend === 'pg') {
    return resolvePgFromSettings(storageSettings);
  }

  if (storageSettings && storageSettings.backend === 'libsql' && storageSettings.libsql.url) {
    return {
      backend: 'libsql',
      url: storageSettings.libsql.url,
      authToken: storageSettings.libsql.authToken,
      isRemote: !storageSettings.libsql.url.startsWith('file:'),
    };
  }

  // 3. Legacy project/global config files (.mastracode/database.json)
  if (projectDir) {
    const projectConfig = loadDatabaseConfig(path.join(projectDir, '.mastracode', 'database.json'));
    if (projectConfig) return projectConfig;
  }
  const globalConfig = loadDatabaseConfig(path.join(os.homedir(), '.mastracode', 'database.json'));
  if (globalConfig) return globalConfig;

  // 4. Default: local LibSQL file database
  return {
    backend: 'libsql',
    url: `file:${getDatabasePath()}`,
    isRemote: false,
  };
}

function resolveLibSQLFromEnv(): LibSQLStorageConfig {
  const url = process.env.MASTRA_DB_URL!;
  return {
    backend: 'libsql',
    url,
    authToken: process.env.MASTRA_DB_AUTH_TOKEN,
    isRemote: !url.startsWith('file:'),
  };
}

function resolvePgFromEnv(): PgStorageConfig {
  const connectionString = process.env.MASTRA_PG_CONNECTION_STRING;
  if (connectionString) {
    return {
      backend: 'pg',
      connectionString,
      schemaName: process.env.MASTRA_PG_SCHEMA_NAME,
    };
  }

  // Host/port style
  return {
    backend: 'pg',
    host: process.env.MASTRA_PG_HOST,
    port: process.env.MASTRA_PG_PORT ? parseInt(process.env.MASTRA_PG_PORT, 10) : undefined,
    database: process.env.MASTRA_PG_DATABASE,
    user: process.env.MASTRA_PG_USER,
    password: process.env.MASTRA_PG_PASSWORD,
    schemaName: process.env.MASTRA_PG_SCHEMA_NAME,
  };
}

function resolvePgFromSettings(settings: StorageSettings): PgStorageConfig {
  const pg = settings.pg;
  return {
    backend: 'pg',
    connectionString: pg.connectionString,
    host: pg.host,
    port: pg.port,
    database: pg.database,
    user: pg.user,
    password: pg.password,
    schemaName: pg.schemaName,
    disableInit: pg.disableInit,
    skipDefaultIndexes: pg.skipDefaultIndexes,
  };
}

/**
 * Load database config from a legacy JSON file.
 * Expected format: { "url": "libsql://...", "authToken": "..." }
 */
function loadDatabaseConfig(filePath: string): LibSQLStorageConfig | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.url === 'string' && parsed.url) {
      return {
        backend: 'libsql',
        url: parsed.url,
        authToken: typeof parsed.authToken === 'string' ? parsed.authToken : undefined,
        isRemote: !parsed.url.startsWith('file:'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the current user identity.
 *
 * Priority:
 *   1. MASTRA_USER_ID environment variable
 *   2. git config user.email (from project dir or global)
 *   3. OS username as fallback
 */
export function getUserId(projectDir?: string): string {
  // 1. Environment variable override
  if (process.env.MASTRA_USER_ID) {
    return process.env.MASTRA_USER_ID;
  }

  // 2. git user.email
  const cwd = projectDir || process.cwd();
  const email = git('config user.email', cwd);
  if (email) {
    return email;
  }

  // 3. OS username fallback
  return os.userInfo().username || 'unknown';
}

/**
 * Observational memory scope: "thread" (per-conversation) or "resource" (shared across threads).
 */
export type OmScope = 'thread' | 'resource';

/**
 * Get the configured observational memory scope.
 *
 * Priority:
 *   1. MASTRA_OM_SCOPE environment variable ("thread" or "resource")
 *   2. Project config: .mastracode/database.json → omScope
 *   3. Global config: ~/.mastracode/database.json → omScope
 *   4. Default: "thread"
 */
export function getOmScope(projectDir?: string): OmScope {
  // 1. Environment variable
  const envScope = process.env.MASTRA_OM_SCOPE;
  if (envScope === 'thread' || envScope === 'resource') {
    return envScope;
  }

  // 2. Project-level config
  if (projectDir) {
    const scope = loadOmScopeFromConfig(path.join(projectDir, '.mastracode', 'database.json'));
    if (scope) return scope;
  }

  // 3. Global config
  const scope = loadOmScopeFromConfig(path.join(os.homedir(), '.mastracode', 'database.json'));
  if (scope) return scope;

  // 4. Default
  return 'thread';
}

function loadOmScopeFromConfig(filePath: string): OmScope | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed?.omScope === 'thread' || parsed?.omScope === 'resource') {
      return parsed.omScope;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get an explicit resource ID override, if configured.
 *
 * Resource IDs act as shared tags — two users who set the same resourceId
 * will share threads and observations for that resource.
 *
 * Priority:
 *   1. MASTRA_RESOURCE_ID environment variable
 *   2. Project config: .mastracode/database.json → resourceId
 *   3. Global config: ~/.mastracode/database.json → resourceId
 *   4. null (use auto-detected value)
 */
export function getResourceIdOverride(projectDir?: string): string | null {
  // 1. Environment variable
  if (process.env.MASTRA_RESOURCE_ID) {
    return process.env.MASTRA_RESOURCE_ID;
  }

  // 2. Project-level config
  if (projectDir) {
    const rid = loadStringField(path.join(projectDir, '.mastracode', 'database.json'), 'resourceId');
    if (rid) return rid;
  }

  // 3. Global config
  const rid = loadStringField(path.join(os.homedir(), '.mastracode', 'database.json'), 'resourceId');
  if (rid) return rid;

  return null;
}

function loadStringField(filePath: string, field: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const value = parsed?.[field];
    if (typeof value === 'string' && value) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}
