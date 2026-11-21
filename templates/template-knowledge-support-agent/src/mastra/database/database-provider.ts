type DatabaseConnection =
  | { provider: 'local' }
  | { provider: 'turso'; url: string; authToken: string }
  | { provider: 'neon' | 'postgres'; connectionString: string };

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name];
  if (!value?.trim() || /[\r\n]/u.test(value)) throw new Error(`Set ${name} for the selected database provider`);
  return value;
}

function connectionUrl(env: NodeJS.ProcessEnv, name: string, protocols: string[]) {
  const value = required(env, name);
  const parsed = URL.parse(value);
  if (!parsed?.hostname || !protocols.includes(parsed.protocol) || parsed.hash)
    throw new Error(`Invalid connection URL in ${name}`);
  return { value, parsed };
}

function postgresUrl(env: NodeJS.ProcessEnv) {
  const { value, parsed } = connectionUrl(env, 'DATABASE_URL', ['postgres:', 'postgresql:']);
  if (!/^\/[^/]+$/u.test(parsed.pathname)) throw new Error('DATABASE_URL must include a PostgreSQL database name');
  return value;
}

function inferredProvider(env: NodeJS.ProcessEnv) {
  const turso = env.TURSO_DATABASE_URL || env.TURSO_AUTH_TOKEN;
  if (turso && env.DATABASE_URL) throw new Error('Set DATABASE_PROVIDER when both Turso and PostgreSQL are configured');
  if (turso) return 'turso';
  if (env.DATABASE_URL) return 'postgres';
  return 'local';
}

/** Resolve the standard Mastra Platform variables without opening a connection. */
export function resolveDatabaseConnection(env: NodeJS.ProcessEnv = process.env): DatabaseConnection {
  const provider = env.DATABASE_PROVIDER ?? inferredProvider(env);
  switch (provider) {
    case 'local':
      if (env.MASTRA_ENVIRONMENT_ID)
        throw new Error('Attach a managed database and set DATABASE_PROVIDER to a hosted provider on Mastra Platform');
      return { provider };
    case 'turso': {
      const { value, parsed } = connectionUrl(env, 'TURSO_DATABASE_URL', ['libsql:', 'https:', 'http:']);
      if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
        throw new Error('TURSO_DATABASE_URL requires HTTPS or libsql outside loopback');
      if (parsed.username || parsed.password) throw new Error('Use TURSO_AUTH_TOKEN for Turso credentials');
      if (parsed.search) throw new Error('TURSO_DATABASE_URL must not include query options');
      return { provider, url: value, authToken: required(env, 'TURSO_AUTH_TOKEN') };
    }
    case 'neon':
    case 'postgres':
      return { provider, connectionString: postgresUrl(env) };
    default:
      throw new Error('DATABASE_PROVIDER must be local, turso, neon, or postgres');
  }
}
