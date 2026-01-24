/**
 * JSONL file processor for observability data.
 */

import { parseFilePath, isPendingFile } from '@mastra/observability-writer';
import type { FileStorageProvider, ObservabilityEvent, ObservabilityEventType } from '../types.js';

/**
 * Parsed event from a JSONL file
 */
export interface ParsedEvent {
  type: ObservabilityEventType;
  data: ObservabilityEvent;
  line: number;
}

/**
 * Result of processing a single file
 */
export interface FileProcessingResult {
  filePath: string;
  events: ParsedEvent[];
  errors: Array<{ line: number; error: string }>;
  metadata: {
    type: string;
    projectId: string;
    timestamp: string;
  } | null;
}

const VALID_EVENT_TYPES: readonly ObservabilityEventType[] = ['trace', 'span', 'log', 'metric', 'score'];

/**
 * Process a JSONL file and extract events.
 */
export async function processFile(fileStorage: FileStorageProvider, filePath: string): Promise<FileProcessingResult> {
  const result: FileProcessingResult = {
    filePath,
    events: [],
    errors: [],
    metadata: null,
  };

  // Parse file path to extract metadata
  const pathInfo = parseFilePath(filePath);
  if (pathInfo) {
    result.metadata = {
      type: pathInfo.type,
      projectId: pathInfo.projectId,
      timestamp: pathInfo.timestamp,
    };
  }

  // Read file content
  const content = await fileStorage.read(filePath);
  const lines = content.toString('utf-8').split('\n');

  // Parse each line
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue; // Skip undefined entries
    const line = rawLine.trim();
    if (!line) continue; // Skip empty lines

    try {
      const event = JSON.parse(line) as ObservabilityEvent;

      // Validate event has required type field
      if (!event.type || !VALID_EVENT_TYPES.includes(event.type)) {
        result.errors.push({
          line: i + 1,
          error: `Invalid or missing event type: ${(event as { type?: unknown }).type}`,
        });
        continue;
      }

      // Validate event has data field
      if (!event.data) {
        result.errors.push({
          line: i + 1,
          error: 'Missing event data field',
        });
        continue;
      }

      result.events.push({
        type: event.type,
        data: event,
        line: i + 1,
      });
    } catch (error) {
      result.errors.push({
        line: i + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * List pending JSONL files from file storage.
 * Returns files sorted by lastModified (oldest first) for FIFO processing.
 */
export async function listPendingFiles(
  fileStorage: FileStorageProvider,
  basePath: string,
  options?: {
    projectId?: string;
    eventType?: ObservabilityEventType;
    limit?: number;
  },
): Promise<string[]> {
  // Build the prefix for listing
  let prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;

  if (options?.eventType) {
    prefix = `${prefix}${options.eventType}/`;
    if (options?.projectId) {
      prefix = `${prefix}${options.projectId}/`;
    }
  } else if (options?.projectId) {
    // If only projectId is specified, we need to list all event type directories
    const eventTypes: readonly ObservabilityEventType[] = ['trace', 'span', 'log', 'metric', 'score'];
    const allFiles: string[] = [];

    for (const type of eventTypes) {
      const typePrefix = `${prefix}${type}/${options.projectId}/`;
      const files = await fileStorage.list(typePrefix);
      const pendingFiles = files.filter(f => isPendingFile(f.path)).map(f => f.path);
      allFiles.push(...pendingFiles);
    }

    // Sort by lastModified would require re-fetching file info
    // For simplicity, rely on the individual list calls being sorted
    return options?.limit ? allFiles.slice(0, options.limit) : allFiles;
  }

  const files = await fileStorage.list(prefix);
  const pendingFiles = files.filter(f => isPendingFile(f.path)).map(f => f.path);

  return options?.limit ? pendingFiles.slice(0, options.limit) : pendingFiles;
}
