/**
 * Line Utilities
 *
 * Utility functions for working with line-based content:
 * - Extract lines by range
 * - Convert character positions to line numbers
 * - Find line ranges containing specific terms
 * - Format content with line number prefixes
 */

import type { LineRange } from '../artifacts';
import { tokenize } from './bm25';
import type { TokenizeOptions } from './bm25';

// Re-export LineRange for convenience
export type { LineRange };

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
 * Convert a character index to a line number.
 * Useful for converting RAG chunk character offsets to line numbers.
 *
 * @param content - The full document content
 * @param charIndex - The character index (0-indexed)
 * @returns The line number (1-indexed), or undefined if charIndex is out of bounds
 */
export function charIndexToLineNumber(content: string, charIndex: number): number | undefined {
  if (charIndex < 0 || charIndex > content.length) {
    return undefined;
  }

  // Count newlines before the character index
  let lineNumber = 1;
  for (let i = 0; i < charIndex && i < content.length; i++) {
    if (content[i] === '\n') {
      lineNumber++;
    }
  }

  return lineNumber;
}

/**
 * Convert character range to line range.
 * Useful for converting RAG chunk character offsets to line ranges.
 *
 * @param content - The full document content
 * @param startCharIdx - Start character index (0-indexed)
 * @param endCharIdx - End character index (0-indexed, exclusive)
 * @returns LineRange (1-indexed) or undefined if indices are out of bounds
 */
export function charRangeToLineRange(content: string, startCharIdx: number, endCharIdx: number): LineRange | undefined {
  const startLine = charIndexToLineNumber(content, startCharIdx);
  // For end, we want the line containing the last character (endCharIdx - 1)
  const endLine = charIndexToLineNumber(content, Math.max(0, endCharIdx - 1));

  if (startLine === undefined || endLine === undefined) {
    return undefined;
  }

  return { start: startLine, end: endLine };
}

/**
 * Find the line range where query terms appear in content.
 * Returns the range spanning from the first to the last line containing any query term.
 *
 * @param content - The document content
 * @param queryTerms - Tokenized query terms to find
 * @param options - Tokenization options (should match indexing options)
 * @returns LineRange if terms found, undefined otherwise
 */
export function findLineRange(
  content: string,
  queryTerms: string[],
  options: TokenizeOptions = {},
): LineRange | undefined {
  if (queryTerms.length === 0) return undefined;

  const lines = content.split('\n');

  // Default tokenize options for matching
  const defaultOpts = { lowercase: true, removePunctuation: true, minLength: 2 };
  const opts = { ...defaultOpts, ...options };

  // Normalize query terms for matching
  const normalizedTerms = new Set(queryTerms.map(t => (opts.lowercase ? t.toLowerCase() : t)));

  let firstMatchLine: number | undefined;
  let lastMatchLine: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const lineTokens = tokenize(lines[i]!, options);

    // Check if any query term appears in this line
    for (const token of lineTokens) {
      if (normalizedTerms.has(token)) {
        const lineNum = i + 1; // 1-indexed
        if (firstMatchLine === undefined) {
          firstMatchLine = lineNum;
        }
        lastMatchLine = lineNum;
        break; // Found a match on this line, move to next line
      }
    }
  }

  if (firstMatchLine !== undefined && lastMatchLine !== undefined) {
    return { start: firstMatchLine, end: lastMatchLine };
  }

  return undefined;
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
