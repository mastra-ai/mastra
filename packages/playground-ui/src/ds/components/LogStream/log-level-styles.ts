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

export const logLevelBarClass: Record<LogLevel, string> = {
  debug: 'before:bg-muted-foreground',
  info: 'before:bg-info-indicator',
  warn: 'before:bg-warning-indicator',
  error: 'before:bg-destructive-indicator',
  fatal: 'before:bg-destructive-indicator',
};
