export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const logLevelTextClass: Record<LogLevel, string> = {
  debug: 'text-muted-foreground',
  info: 'text-info-indicator',
  warn: 'text-warning-foreground',
  error: 'text-destructive-foreground',
  fatal: 'text-destructive-foreground',
};

export const logLevelDotClass: Record<LogLevel, string> = {
  debug: 'bg-muted-foreground',
  info: 'bg-info-indicator',
  warn: 'bg-warning-indicator',
  error: 'bg-destructive-indicator',
  fatal: 'bg-destructive-indicator',
};
