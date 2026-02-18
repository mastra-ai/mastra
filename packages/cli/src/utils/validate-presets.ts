import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Loads and validates a request context presets JSON file.
 *
 * @param presetsPath - Path to the presets JSON file (relative or absolute)
 * @returns The original JSON string content
 * @throws Error if file doesn't exist, JSON is invalid, or structure is incorrect
 */
export async function loadAndValidatePresets(presetsPath: string): Promise<string> {
  const absolutePath = resolve(process.cwd(), presetsPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Presets file not found: ${absolutePath}`);
  }

  const content = await readFile(absolutePath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in presets file: ${presetsPath}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Presets file must contain a JSON object with named presets`);
  }

  // Validate each preset value is an object
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Preset "${key}" must be a JSON object`);
    }
  }

  return content; // Return original string to preserve formatting
}

/**
 * Escapes a JSON string for safe embedding in HTML/JavaScript.
 * Handles backslashes, single quotes, newlines, carriage returns,
 * script-breaking sequences, and Unicode line terminators.
 *
 * @param json - JSON string to escape
 * @returns Escaped string safe for HTML embedding
 */
export function escapeJsonForHtml(json: string): string {
  return json
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
