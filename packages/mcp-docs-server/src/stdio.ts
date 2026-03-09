#!/usr/bin/env node
import { writeErrorLog, setLogLevel } from './logger';
import type { LogLevel } from './logger';
import { runServer } from './index';

// Parse --log-level argument
function parseLogLevel(): LogLevel | undefined {
  const args = process.argv.slice(2);
  const logLevelIndex = args.indexOf('--log-level');
  if (logLevelIndex === -1 || logLevelIndex === args.length - 1) {
    return undefined;
  }
  const level = args[logLevelIndex + 1];
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];
  if (validLevels.includes(level as LogLevel)) {
    return level as LogLevel;
  }
  console.error(`Invalid log level: ${level}. Valid levels: ${validLevels.join(', ')}`);
  return undefined;
}

const logLevel = parseLogLevel();
if (logLevel) {
  setLogLevel(logLevel);
}

runServer().catch(error => {
  const errorMessage = 'Fatal error running server';
  console.error(errorMessage, error);
  writeErrorLog(errorMessage, {
    error:
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error,
  });
  process.exit(1);
});
