export interface EnvironmentVariableEntry {
  key: string;
  value: string;
}

export const ENV_FILE_MAX_SIZE = 64 * 1024;
export const DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE = 'Environment variable keys must be unique';

export class DuplicateEnvironmentVariableKeyError extends Error {
  constructor(public readonly key: string) {
    super(DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE);
    this.name = 'DuplicateEnvironmentVariableKeyError';
  }
}

export function createEmptyEnvironmentVariableEntry(): EnvironmentVariableEntry {
  return { key: '', value: '' };
}

export function rowsFromEnvironmentVariables(envVars: Record<string, unknown> | undefined): EnvironmentVariableEntry[] {
  const entries = Object.entries(envVars ?? {});
  return entries.length > 0
    ? entries.map(([key, value]) => ({ key, value: String(value) }))
    : [createEmptyEnvironmentVariableEntry()];
}

export function getDuplicateEnvironmentVariableKeys(rows: readonly EnvironmentVariableEntry[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;

    if (seen.has(key)) {
      duplicates.add(key);
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

export function collectEnvironmentVariables(rows: readonly EnvironmentVariableEntry[]): Record<string, string> {
  const envVars: Record<string, string> = {};
  const seen = new Set<string>();

  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;

    if (seen.has(key)) {
      throw new DuplicateEnvironmentVariableKeyError(key);
    }

    seen.add(key);
    envVars[key] = row.value;
  }

  return envVars;
}

/**
 * Parse text in `.env` file format into key-value entries.
 *
 * Handles:
 * - `KEY=value`
 * - Blank lines and comment lines (`#`)
 * - Double-quoted and single-quoted values
 * - Multi-line quoted values, such as private keys
 * - Values containing `=`
 * - Inline comments after unquoted values
 * - Optional `export KEY=value` prefix
 */
export function parseEnvFileText(text: string): EnvironmentVariableEntry[] {
  const results: EnvironmentVariableEntry[] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const currentLine = lines[lineIndex];
    if (currentLine === undefined) break;
    const line = currentLine.trim();
    if (!line || line.startsWith('#')) {
      lineIndex++;
      continue;
    }

    const stripped = line.replace(/^export\s+/, '');
    const eqIndex = stripped.indexOf('=');
    if (eqIndex === -1) {
      lineIndex++;
      continue;
    }

    const key = stripped.slice(0, eqIndex).trim();
    if (!key) {
      lineIndex++;
      continue;
    }

    const rawValue = stripped.slice(eqIndex + 1);
    const valueAfterLeadingWhitespace = rawValue.trimStart();
    let value = valueAfterLeadingWhitespace;
    const quote = value.length > 0 && (value[0] === '"' || value[0] === "'") ? value[0] : null;

    if (quote) {
      const closingIndex = findClosingQuoteIndex(value, quote, 1);
      if (closingIndex !== -1) {
        value = value.slice(1, closingIndex);
      } else {
        const parts = [value.slice(1)];
        lineIndex++;

        while (lineIndex < lines.length) {
          const nextLine = lines[lineIndex];
          if (nextLine === undefined) break;
          const endIndex = findClosingQuoteIndex(nextLine, quote);
          if (endIndex !== -1) {
            parts.push(nextLine.slice(0, endIndex));
            break;
          }
          parts.push(nextLine);
          lineIndex++;
        }

        value = parts.join('\n');
      }

      value = unescapeQuotedValue(value, quote);
    } else {
      value = rawValue;
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex);
      }
      value = value.trim();
    }

    results.push({ key, value });
    lineIndex++;
  }

  return results;
}

function findClosingQuoteIndex(value: string, quote: '"' | "'", startIndex = 0): number {
  for (let index = startIndex; index < value.length; index++) {
    if (value[index] === quote && !isEscaped(value, index)) {
      return index;
    }
  }
  return -1;
}

function isEscaped(value: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

function unescapeQuotedValue(value: string, quote: '"' | "'"): string {
  let result = '';

  for (let index = 0; index < value.length; index++) {
    const current = value[index];
    const next = value[index + 1];

    if (current !== '\\' || next === undefined) {
      result += current;
      continue;
    }

    if (quote === "'" && (next === quote || next === '\\')) {
      result += next;
      index++;
      continue;
    }

    if (quote === '"') {
      if (next === quote || next === '\\') {
        result += next;
        index++;
        continue;
      }

      if (next === 'n') {
        result += '\n';
        index++;
        continue;
      }

      if (next === 'r') {
        result += '\r';
        index++;
        continue;
      }

      if (next === 't') {
        result += '\t';
        index++;
        continue;
      }
    }

    result += current;
  }

  return result;
}

function escapeDoubleQuotedValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function shouldQuoteValue(value: string) {
  return value.includes('\n') || value.includes('\r') || value.includes(' #') || /^\s|\s$/.test(value);
}

export function rowsToEnvFileText(rows: readonly EnvironmentVariableEntry[]): string {
  const lines: string[] = [];

  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;

    const value = row.value;
    lines.push(shouldQuoteValue(value) ? `${key}="${escapeDoubleQuotedValue(value)}"` : `${key}=${value}`);
  }

  return lines.join('\n');
}

export async function readEnvFile(
  file: File,
  options: { maxSize?: number } = {},
): Promise<{ ok: true; entries: EnvironmentVariableEntry[] } | { ok: false; error: string }> {
  const maxSize = options.maxSize ?? ENV_FILE_MAX_SIZE;

  if (file.size > maxSize) {
    return { ok: false, error: `File is too large (max ${Math.ceil(maxSize / 1024)} KB).` };
  }

  let text: string;
  try {
    text = await readFileText(file);
  } catch {
    return { ok: false, error: 'Could not read the selected file. Please try again.' };
  }

  if (text.includes('\0')) {
    return { ok: false, error: 'File appears to be binary. Please import a plain-text .env file.' };
  }

  const entries = parseEnvFileText(text);
  if (entries.length === 0) {
    return { ok: false, error: 'No valid environment variables found in the file.' };
  }

  return { ok: true, entries };
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    try {
      return await file.text();
    } catch {
      // happy-dom exposes Blob.text but does not implement every Blob source.
      // Fall through to FileReader, which is the browser path we need anyway.
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader returned non-text content.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed.'));
    reader.readAsText(file);
  });
}
