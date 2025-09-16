export const DEPS_TO_IGNORE = ['#tools', '#telemetry-config'];

export const GLOBAL_EXTERNALS = [
  'pino',
  'pino-pretty',
  '@libsql/client',
  'pg',
  'libsql',
  '#tools',
  '#telemetry-config',
];
export const DEPRECATED_EXTERNALS = ['fastembed', 'nodemailer', 'jsdom', 'sqlite3'];
