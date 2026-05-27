export const DEPS_TO_IGNORE = ['#tools', 'execa'];

// Keep Mastra runtime packages external to avoid reintroducing the ESM TLA
// circular chunk deadlocks fixed in #14860/#14863.
export const MASTRA_RUNTIME_EXTERNALS = [
  '@mastra/core',
  '@mastra/dsql',
  '@mastra/libsql',
  '@mastra/memory',
  '@mastra/mssql',
  '@mastra/pg',
];

export const GLOBAL_EXTERNALS = [
  'pino',
  'pino-pretty',
  '@libsql/client',
  'pg',
  'libsql',
  '#tools',
  'typescript',
  'undici',
  'readable-stream',
  'bufferutil',
  'utf-8-validate',
  'execa',
];
export const DEPRECATED_EXTERNALS = ['fastembed', 'nodemailer', 'jsdom', 'sqlite3'];

export function mergeBundlerExternals(...externalLists: (readonly string[] | undefined)[]) {
  return Array.from(new Set(externalLists.flatMap(externals => externals ?? []).filter(Boolean)));
}

export function getSafeBundlerExternals(
  userExternals: readonly string[] = [],
  { includeDeprecated = false }: { includeDeprecated?: boolean } = {},
) {
  return mergeBundlerExternals(
    GLOBAL_EXTERNALS,
    includeDeprecated ? DEPRECATED_EXTERNALS : undefined,
    MASTRA_RUNTIME_EXTERNALS,
    userExternals,
  );
}
