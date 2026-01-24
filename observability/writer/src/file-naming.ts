import type { ObservabilityEventType } from './types.js';

/**
 * File naming conventions for observability data.
 *
 * Pattern: {basePath}/{type}/{projectId}/{timestamp}_{uuid}.jsonl
 *
 * Examples:
 * - observability/traces/proj_123/20250123T120000Z_abc123.jsonl
 * - observability/spans/proj_456/20250123T120500Z_def456.jsonl
 * - observability/logs/proj_123/20250123T121000Z_ghi789.jsonl
 */

/**
 * Generate a UUID v4 (simplified implementation)
 */
function generateUuid(): string {
  // Using crypto.randomUUID if available (Node.js 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }

  // Fallback for older environments
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Format a date as ISO 8601 basic format (no separators)
 * Example: 20250123T120000Z
 */
function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate a file path for a new observability file
 */
export function generateFilePath(options: {
  basePath: string;
  type: ObservabilityEventType;
  projectId: string;
  timestamp?: Date;
}): string {
  const { basePath, type, projectId, timestamp = new Date() } = options;

  const timestampStr = formatTimestamp(timestamp);
  const uuid = generateUuid();
  const filename = `${timestampStr}_${uuid}.jsonl`;

  // Normalize path separators and remove trailing slashes
  const normalizedBase = basePath.replace(/\/+$/, '');

  return `${normalizedBase}/${type}/${projectId}/${filename}`;
}

/**
 * Generate the directory path for a specific event type and project
 */
export function generateDirectoryPath(options: {
  basePath: string;
  type: ObservabilityEventType;
  projectId: string;
}): string {
  const { basePath, type, projectId } = options;
  const normalizedBase = basePath.replace(/\/+$/, '');
  return `${normalizedBase}/${type}/${projectId}`;
}

/**
 * Parse a file path to extract metadata
 */
export function parseFilePath(filePath: string): {
  basePath: string;
  type: string;
  projectId: string;
  timestamp: string;
  uuid: string;
} | null {
  // Match pattern: {basePath}/{type}/{projectId}/{timestamp}_{uuid}.jsonl
  // The basePath can be anything up to 3 path segments before the filename
  // We match from the end: /{type}/{projectId}/{timestamp}_{uuid}.jsonl
  const match = filePath.match(/^(.+)\/([^/]+)\/([^/]+)\/(\d{8}T\d{6}Z)_([a-f0-9]+)\.jsonl$/);

  if (!match) {
    return null;
  }

  const [, basePath, type, projectId, timestamp, uuid] = match;

  // All capture groups are required, so they will be defined if match succeeded
  if (!basePath || !type || !projectId || !timestamp || !uuid) {
    return null;
  }

  return { basePath, type, projectId, timestamp, uuid };
}

/**
 * Check if a file is in the "pending" state (not yet processed by ingestion worker)
 */
export function isPendingFile(filePath: string): boolean {
  return filePath.endsWith('.jsonl') && !filePath.includes('/processed/');
}

/**
 * Generate the processed file path (for moving after ingestion)
 */
export function getProcessedFilePath(filePath: string): string {
  // Insert 'processed' before the filename
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) {
    return `processed/${filePath}`;
  }

  const directory = filePath.slice(0, lastSlash);
  const filename = filePath.slice(lastSlash + 1);
  return `${directory}/processed/${filename}`;
}
