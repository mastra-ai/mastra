/**
 * JSON cell parser for CSV import
 * Auto-parses JSON strings in cells, with warnings for malformed JSON
 */

export interface ParsedCell {
  parsed: unknown;
  warning?: string;
}

export interface ParsedRow {
  data: Record<string, unknown>;
  warnings: string[];
}

/**
 * Parse a single cell value, attempting JSON parse if it looks like JSON
 * - null/undefined/empty string -> { parsed: null }
 * - JSON string (starts with { or [) -> attempt parse, warn on failure
 * - Plain string -> keep as-is
 */
export function parseJSONCell(value: string | null | undefined): ParsedCell {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return { parsed: null };
  }

  const trimmed = value.trim();

  // Check if it looks like JSON (starts with { or [)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsedValue = JSON.parse(trimmed);
      return { parsed: parsedValue };
    } catch {
      // JSON parse failed, keep as string with warning
      return {
        parsed: value,
        warning: 'Could not parse as JSON, keeping as string',
      };
    }
  }

  // Plain string, keep as-is
  return { parsed: value };
}

/**
 * Parse all values in a row, converting empty strings to null
 * and applying JSON parsing where applicable
 */
export function parseRow(row: Record<string, unknown>): ParsedRow {
  const data: Record<string, unknown> = {};
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(row)) {
    // Convert value to string for parseJSONCell (PapaParse returns strings)
    const stringValue = value === null || value === undefined ? null : value === '' ? '' : String(value);

    const result = parseJSONCell(stringValue);
    data[key] = result.parsed;

    if (result.warning) {
      warnings.push(`${key}: ${result.warning}`);
    }
  }

  return { data, warnings };
}
