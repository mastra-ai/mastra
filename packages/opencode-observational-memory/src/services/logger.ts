import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const LOG_FILE = join(homedir(), '.opencode-observational-memory.log');

// Ensure log directory exists
const logDir = dirname(LOG_FILE);
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

/**
 * Log a message to the plugin log file
 */
export function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const logEntry = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data)}\n`
    : `[${timestamp}] ${message}\n`;

  try {
    appendFileSync(LOG_FILE, logEntry);
  } catch {
    // Silently fail if logging fails
  }
}

/**
 * Log an error to the plugin log file
 */
export function logError(message: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  log(`ERROR: ${message}`, { error: errorMessage });
}
