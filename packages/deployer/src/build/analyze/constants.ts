export const DEPS_TO_IGNORE = ['#tools', 'execa', 'effect', 'sury', '@ast-grep/napi'];

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
  '@ast-grep/napi',
];
export const DEPRECATED_EXTERNALS = ['fastembed', 'nodemailer', 'jsdom', 'sqlite3'];
