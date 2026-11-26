import { isAbsolute, resolve } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
import { databaseUrlForPath, localDatabasePath } from './database-file.ts';

const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];
const libsqlProtocols = ['libsql:', 'https:', 'http:'];
const postgresProtocols = ['postgres:', 'postgresql:'];

export type StoreConfiguration =
  | { backend: 'libsql'; url: string; authToken?: string; lockFile?: string }
  | { backend: 'postgres'; connectionString: string };

function parseDatabaseUrl(value: string, protocols: string[]) {
  if (/[\r\n]/u.test(value)) return null;
  const parsed = URL.parse(value);
  return parsed?.hostname && protocols.includes(parsed.protocol) && !parsed.hash ? parsed : null;
}

function configurationError(missing: string[], invalid: string[]): never {
  const issues = [];
  if (missing.length) issues.push(`Missing database variables (${missing.join(', ')})`);
  if (invalid.length) issues.push(`Invalid database variables (${invalid.join(', ')})`);
  throw new Error(issues.join('. '));
}

function tursoUrlError(url: string) {
  const parsed = parseDatabaseUrl(url, libsqlProtocols);
  if (!parsed) return 'requires a valid HTTP, HTTPS or libSQL URL';
  if (parsed.protocol === 'http:' && !loopbackHosts.includes(parsed.hostname))
    return 'requires HTTPS or libSQL outside loopback';
  if (parsed.username || parsed.password) return 'must omit credentials, which belong in TURSO_AUTH_TOKEN';
  if (parsed.search) return 'must not include query options';
}

function writerLockFile(env: NodeJS.ProcessEnv, fallback?: string) {
  const path = env.SUPPORT_WRITER_LOCK_FILE ?? fallback;
  if (!path || !isAbsolute(path)) throw new Error('Hosted LibSQL requires an absolute SUPPORT_WRITER_LOCK_FILE');
  return path;
}

function postgresConfiguration(parsed: URL, url: string, databaseNameError: string): StoreConfiguration {
  if (!/^\/[^/]+$/u.test(parsed.pathname)) throw new Error(databaseNameError);
  const modes = parsed.searchParams.getAll('sslmode');
  const [mode] = modes;
  if (
    [...parsed.searchParams.keys()].some(key => key !== 'sslmode') ||
    modes.length > 1 ||
    (mode !== undefined && mode !== 'disable' && mode !== 'verify-full') ||
    (!loopbackHosts.includes(parsed.hostname) && mode !== 'verify-full')
  )
    throw new Error('PostgreSQL requires sslmode=verify-full outside loopback; no other URL options are supported');
  return { backend: 'postgres', connectionString: url };
}

function legacyHostedConfiguration(env: NodeJS.ProcessEnv, url: string): StoreConfiguration {
  const parsed = URL.parse(url);
  if (!parsed) throw new Error('Invalid hosted database URL');
  const loopback = loopbackHosts.includes(parsed.hostname);
  if (postgresProtocols.includes(parsed.protocol)) {
    if (!parseDatabaseUrl(url, postgresProtocols))
      throw new Error('PostgreSQL requires a host and explicit database name');
    return postgresConfiguration(parsed, url, 'PostgreSQL requires a host and explicit database name');
  }
  if (!libsqlProtocols.includes(parsed.protocol) || (parsed.protocol === 'http:' && !loopback))
    throw new Error('Hosted database requires HTTPS or libsql (HTTP is allowed only on loopback)');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.hostname)
    throw new Error('Invalid hosted database URL');
  const authToken = env.SUPPORT_DATABASE_AUTH_TOKEN;
  if (!authToken?.trim() || /[\r\n]/u.test(authToken))
    throw new Error('Hosted mode requires SUPPORT_DATABASE_AUTH_TOKEN');
  return { backend: 'libsql', url, authToken, lockFile: writerLockFile(env) };
}

/** Resolve the store used by the server, seed and coordinated writers. */
export function resolveStoreConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  url = env.SUPPORT_DATABASE_URL,
): StoreConfiguration {
  const mode = env.SUPPORT_MODE;
  if (mode !== undefined && mode !== 'local' && mode !== 'hosted')
    throw new Error('SUPPORT_MODE must be local or hosted');
  const explicit = env.DATABASE_PROVIDER?.trim();
  if (mode === 'hosted' && url && !explicit) return legacyHostedConfiguration(env, url);

  const tursoUrl = env.TURSO_DATABASE_URL ?? '';
  const tursoToken = env.TURSO_AUTH_TOKEN ?? '';
  const postgresUrl = env.DATABASE_URL ?? '';
  let provider = explicit || 'local';
  if (!explicit && mode !== 'local') {
    const hasTurso = Boolean(tursoUrl.trim() || tursoToken.trim());
    const hasPostgres = Boolean(postgresUrl.trim());
    if (hasTurso && hasPostgres) throw new Error('Set DATABASE_PROVIDER when both Turso and PostgreSQL are configured');
    if (hasTurso) provider = 'turso';
    if (hasPostgres) provider = 'postgres';
  }
  switch (provider) {
    case 'local':
      if (env.MASTRA_ENVIRONMENT_ID)
        throw new Error('Attach a managed database and set DATABASE_PROVIDER to a hosted provider on Mastra Platform');
      if (mode === 'hosted') throw new Error('Hosted mode requires a remote database');
      return { backend: 'libsql', url: databaseUrlForPath(localDatabasePath(url)) };
    case 'turso': {
      const missing: string[] = [];
      const invalid: string[] = [];
      if (tursoUrl.trim()) {
        const error = tursoUrlError(tursoUrl);
        if (error) invalid.push(`TURSO_DATABASE_URL ${error}`);
      } else {
        missing.push('TURSO_DATABASE_URL');
      }
      if (!tursoToken.trim()) missing.push('TURSO_AUTH_TOKEN');
      else if (/[\r\n]/u.test(tursoToken)) invalid.push('TURSO_AUTH_TOKEN');
      if (missing.length || invalid.length) configurationError(missing, invalid);
      return {
        backend: 'libsql',
        url: tursoUrl,
        authToken: tursoToken,
        lockFile: writerLockFile(env, resolve('.local/support.writer.sqlite')),
      };
    }
    case 'neon':
    case 'postgres': {
      if (!postgresUrl.trim()) configurationError(['DATABASE_URL'], []);
      const parsed = parseDatabaseUrl(postgresUrl, postgresProtocols);
      if (!parsed) configurationError([], ['DATABASE_URL']);
      return postgresConfiguration(parsed, postgresUrl, 'DATABASE_URL must include a PostgreSQL database name');
    }
    default:
      throw new Error('DATABASE_PROVIDER must be local, turso, neon, or postgres');
  }
}

export function hostedMode(configuration = resolveStoreConfiguration()) {
  return configuration.backend === 'postgres' || configuration.lockFile !== undefined;
}

/** Knowledge, Memory and workflow checkpoints always use the same native store. */
export function createStore(id: string, configuration: StoreConfiguration) {
  if (configuration.backend === 'postgres')
    return new PostgresStore({ id, connectionString: configuration.connectionString });
  return new LibSQLStore({ id, url: configuration.url, authToken: configuration.authToken });
}
