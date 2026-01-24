import * as path from 'node:path';

/**
 * Ensure a path uses forward slashes (for consistency).
 */
export function normalizeSlashes(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/**
 * Generate a timestamped filename for observability files.
 * Format: {type}-{YYYY-MM-DD}-{HHmmss}-{random}.jsonl
 */
export function generateFilename(type: 'traces' | 'spans' | 'logs' | 'metrics' | 'scores'): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toISOString().split('T')[1]!.replace(/[:.]/g, '').slice(0, 6); // HHmmss
  const random = Math.random().toString(36).slice(2, 8);

  return `${type}-${date}-${time}-${random}.jsonl`;
}
