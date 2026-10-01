export const DEPS_TO_IGNORE = ['#tools', 'execa', 'effect', 'sury', '@ast-grep/napi', '@hono/node-ws'];

export const GLOBAL_EXTERNALS = [
  'pino',
  'pino-pretty',
  '@libsql/client',
  'pg',
  'libsql',
  '#tools',
  'typescript',
  '@mastra/schema-compat',
  '@mastra/schema-compat/validation-runtime',
  'undici',
  'readable-stream',
  'bufferutil',
  'utf-8-validate',
  'execa',
  '@ast-grep/napi',
  '@hono/node-ws',
];
export const WORKSPACE_EXTERNALS = ['@mastra/schema-compat'];
export const DEPRECATED_EXTERNALS = ['fastembed', 'nodemailer', 'jsdom', 'sqlite3'];
