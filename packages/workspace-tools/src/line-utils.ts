/**
 * Line Utilities
 *
 * Utility functions for working with line-based content:
 * - Extract lines by range
 * - Convert character positions to line numbers
 * - Format content with line number prefixes
 */

/**
 * Line range where content was found
 */
export interface LineRange {
  /** Starting line number (1-indexed) */
  start: number;
  /** Ending line number (1-indexed, inclusive) */
  end: number;
}

/**
 * Extract lines from content by line range.
 *
 * @param content - The document content
 * @param startLine - Starting line number (1-indexed)
 * @param endLine - Ending line number (1-indexed, inclusive)
 * @returns Object with extracted content and metadata
 */
export function extractLines(
  content: string,
  startLine?: number,
  endLine?: number,
): {
  content: string;
  lines: { start: number; end: number };
  totalLines: number;
} {
  const allLines = content.split('\n');
  const totalLines = allLines.length;

  // Default to full content
  const start = Math.max(1, startLine ?? 1);
  const end = Math.min(totalLines, endLine ?? totalLines);

  // Extract the requested range (convert to 0-indexed)
  const extractedLines = allLines.slice(start - 1, end);

  return {
    content: extractedLines.join('\n'),
    lines: { start, end },
    totalLines,
  };
}

/**
 * Extract lines using offset/limit style parameters (like Claude Code).
 *
 * @param content - The document content
 * @param offset - Line number to start from (1-indexed, default: 1)
 * @param limit - Maximum number of lines to read (default: all remaining)
 * @returns Object with extracted content and metadata
 */
export function extractLinesWithLimit(
  content: string,
  offset?: number,
  limit?: number,
): {
  content: string;
  lines: { start: number; end: number };
  totalLines: number;
} {
  const startLine = offset ?? 1;
  const endLine = limit ? startLine + limit - 1 : undefined;
  return extractLines(content, startLine, endLine);
}

/**
 * Format content with line number prefixes.
 * Output format matches Claude Code: "     1→content here"
 *
 * @param content - The content to format
 * @param startLineNumber - The line number of the first line (1-indexed)
 * @returns Formatted content with line numbers
 */
export function formatWithLineNumbers(content: string, startLineNumber: number = 1): string {
  const lines = content.split('\n');
  const maxLineNum = startLineNumber + lines.length - 1;
  const padWidth = Math.max(6, String(maxLineNum).length + 1);

  return lines
    .map((line, i) => {
      const lineNum = startLineNumber + i;
      return `${String(lineNum).padStart(padWidth)}→${line}`;
    })
    .join('\n');
}

/**
 * Count occurrences of a string in content.
 *
 * @param content - The content to search
 * @param searchString - The string to find
 * @returns Number of occurrences
 */
export function countOccurrences(content: string, searchString: string): number {
  if (!searchString) return 0;

  let count = 0;
  let position = 0;

  while ((position = content.indexOf(searchString, position)) !== -1) {
    count++;
    position += searchString.length;
  }

  return count;
}

/**
 * Replace a string in content, with validation for uniqueness.
 *
 * @param content - The content to modify
 * @param oldString - The string to find and replace
 * @param newString - The replacement string
 * @param replaceAll - If true, replace all occurrences; if false, require unique match
 * @returns Object with result content and metadata
 * @throws Error if oldString is not found or not unique (when replaceAll is false)
 */
export function replaceString(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false,
): {
  content: string;
  replacements: number;
} {
  const count = countOccurrences(content, oldString);

  if (count === 0) {
    throw new StringNotFoundError(oldString);
  }

  if (!replaceAll && count > 1) {
    throw new StringNotUniqueError(oldString, count);
  }

  if (replaceAll) {
    // Replace all occurrences
    const result = content.split(oldString).join(newString);
    return { content: result, replacements: count };
  } else {
    // Replace first (and only) occurrence
    const result = content.replace(oldString, newString);
    return { content: result, replacements: 1 };
  }
}

/**
 * Error thrown when string is not found during replacement.
 */
export class StringNotFoundError extends Error {
  constructor(public readonly searchString: string) {
    super(`The specified text was not found. Make sure you use the exact text from the file.`);
    this.name = 'StringNotFoundError';
  }
}

/**
 * Error thrown when string appears multiple times but unique match required.
 */
export class StringNotUniqueError extends Error {
  constructor(
    public readonly searchString: string,
    public readonly occurrences: number,
  ) {
    super(
      `The specified text appears ${occurrences} times. Provide more surrounding context to make the match unique, or use replace_all to replace all occurrences.`,
    );
    this.name = 'StringNotUniqueError';
  }
}
