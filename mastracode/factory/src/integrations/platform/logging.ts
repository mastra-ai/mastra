export function logPlatformInfo(message: string, fields?: Record<string, unknown>): void {
  writePlatformLog('info', message, fields);
}

export function logPlatformWarn(message: string, fields?: Record<string, unknown>): void {
  writePlatformLog('warn', message, fields);
}

export function logPlatformError(message: string, fields?: Record<string, unknown>): void {
  writePlatformLog('error', message, fields);
}

function writePlatformLog(level: 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>): void {
  const metadata = fields ? ` ${JSON.stringify(stripUndefined(fields))}` : '';
  process.stderr.write(`[Mastra Factory] ${level.toUpperCase()} ${message}${metadata}\n`);
}

function stripUndefined(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}
