/**
 * OpenCode / OpenAI apply_patch parser.
 *
 * Accepts the marker-based patch language:
 *
 *   *** Begin Patch
 *   *** Add File: path
 *   +contents
 *   *** Update File: path
 *   *** Move to: new-path
 *   @@ optional context
 *    context
 *   -old
 *   +new
 *   *** Delete File: path
 *   *** End Patch
 */

export const BEGIN_PATCH = '*** Begin Patch';
export const END_PATCH = '*** End Patch';
export const ADD_FILE = '*** Add File: ';
export const DELETE_FILE = '*** Delete File: ';
export const UPDATE_FILE = '*** Update File: ';
export const MOVE_TO = '*** Move to: ';
export const END_OF_FILE = '*** End of File';

export type PatchLineType = 'context' | 'add' | 'remove';

export interface PatchLine {
  type: PatchLineType;
  text: string;
}

export interface PatchChunk {
  /** Optional @@ header used to disambiguate repeated snippets. */
  changeContext?: string;
  lines: PatchLine[];
  isEndOfFile?: boolean;
}

export type PatchHunk =
  | { type: 'add'; path: string; contents: string }
  | { type: 'delete'; path: string }
  | { type: 'update'; path: string; movePath?: string; chunks: PatchChunk[] };

export class ApplyPatchParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplyPatchParseError';
  }
}

export class ApplyPatchHunkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplyPatchHunkError';
  }
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parsePathHeader(line: string, prefix: string): string {
  const path = line.slice(prefix.length).trim();
  if (!path) {
    throw new ApplyPatchParseError(`Missing path in apply_patch header: ${line}`);
  }
  return path;
}

function isFileOperationHeader(line: string): boolean {
  return line.startsWith(ADD_FILE) || line.startsWith(DELETE_FILE) || line.startsWith(UPDATE_FILE);
}

/**
 * Parse apply_patch text into file operations.
 * @throws {ApplyPatchParseError} if the patch is empty or malformed
 */
export function parseApplyPatch(patchText: string): PatchHunk[] {
  if (typeof patchText !== 'string' || patchText.trim() === '') {
    throw new ApplyPatchParseError('patchText is required');
  }

  const text = normalizeNewlines(patchText);
  const rawLines = text.split('\n');

  let start = 0;
  while (start < rawLines.length && rawLines[start] === '') start++;
  let end = rawLines.length - 1;
  while (end >= start && rawLines[end] === '') end--;

  if (start > end || rawLines[start] !== BEGIN_PATCH) {
    throw new ApplyPatchParseError("apply_patch input must start with '*** Begin Patch'");
  }
  if (rawLines[end] !== END_PATCH) {
    throw new ApplyPatchParseError("apply_patch input must end with '*** End Patch'");
  }

  const inner = rawLines.slice(start + 1, end);
  if (inner.length === 0) {
    throw new ApplyPatchParseError('patch rejected: empty patch');
  }

  const hunks: PatchHunk[] = [];
  let index = 0;
  while (index < inner.length) {
    const line = inner[index] ?? '';
    if (line.startsWith(ADD_FILE)) {
      const parsed = parseAddFile(inner, index);
      hunks.push(parsed.hunk);
      index = parsed.nextIndex;
    } else if (line.startsWith(DELETE_FILE)) {
      const parsed = parseDeleteFile(inner, index);
      hunks.push(parsed.hunk);
      index = parsed.nextIndex;
    } else if (line.startsWith(UPDATE_FILE)) {
      const parsed = parseUpdateFile(inner, index);
      hunks.push(parsed.hunk);
      index = parsed.nextIndex;
    } else if (line === '') {
      index++;
    } else {
      throw new ApplyPatchParseError(`Invalid apply_patch file operation header: ${line}`);
    }
  }

  if (hunks.length === 0) {
    throw new ApplyPatchParseError('apply_patch verification failed: no hunks found');
  }

  return hunks;
}

function parseAddFile(lines: string[], index: number): { hunk: PatchHunk; nextIndex: number } {
  const path = parsePathHeader(lines[index] ?? '', ADD_FILE);
  index += 1;
  const contentLines: string[] = [];
  while (index < lines.length && !isFileOperationHeader(lines[index] ?? '')) {
    const line = lines[index] ?? '';
    if (!line.startsWith('+')) {
      throw new ApplyPatchParseError(`Invalid Add File line in ${path}: ${line}`);
    }
    contentLines.push(line.slice(1));
    index += 1;
  }
  const contents = contentLines.length === 0 ? '' : `${contentLines.join('\n')}\n`;
  return { hunk: { type: 'add', path, contents }, nextIndex: index };
}

function parseDeleteFile(lines: string[], index: number): { hunk: PatchHunk; nextIndex: number } {
  const path = parsePathHeader(lines[index] ?? '', DELETE_FILE);
  index += 1;
  if (index < lines.length && !isFileOperationHeader(lines[index] ?? '') && lines[index] !== '') {
    throw new ApplyPatchParseError(`Delete File patch for ${path} must not include a diff`);
  }
  return { hunk: { type: 'delete', path }, nextIndex: index };
}

function parseUpdateFile(lines: string[], index: number): { hunk: PatchHunk; nextIndex: number } {
  const path = parsePathHeader(lines[index] ?? '', UPDATE_FILE);
  index += 1;
  let movePath: string | undefined;
  if (index < lines.length && (lines[index] ?? '').startsWith(MOVE_TO)) {
    movePath = parsePathHeader(lines[index] ?? '', MOVE_TO);
    index += 1;
  }

  const chunks: PatchChunk[] = [];
  let current: PatchChunk | undefined;

  const flush = () => {
    if (current && (current.lines.length > 0 || current.changeContext || current.isEndOfFile)) {
      chunks.push(current);
    }
    current = undefined;
  };

  while (index < lines.length && !isFileOperationHeader(lines[index] ?? '')) {
    const line = lines[index] ?? '';
    if (line.startsWith('@@')) {
      flush();
      const header = line.slice(2).trim();
      current = { changeContext: header || undefined, lines: [] };
      index += 1;
      continue;
    }
    if (line === END_OF_FILE) {
      current ??= { lines: [] };
      current.isEndOfFile = true;
      flush();
      index += 1;
      continue;
    }
    if (line === '') {
      // Blank lines between hunks are ignored; blank context is " \n".
      index += 1;
      continue;
    }
    const prefix = line[0];
    if (prefix !== ' ' && prefix !== '-' && prefix !== '+') {
      throw new ApplyPatchParseError(`Invalid Update File line in ${path}: ${line}`);
    }
    current ??= { lines: [] };
    const type: PatchLineType = prefix === '+' ? 'add' : prefix === '-' ? 'remove' : 'context';
    current.lines.push({ type, text: line.slice(1) });
    index += 1;
  }

  flush();
  if (chunks.length === 0) {
    throw new ApplyPatchParseError(`Update File patch for ${path} must include a hunk`);
  }

  return { hunk: { type: 'update', path, movePath, chunks }, nextIndex: index };
}

/**
 * Collect every path a parsed patch will write, create, delete, or move.
 */
export function getPatchPaths(hunks: PatchHunk[]): string[] {
  const paths: string[] = [];
  for (const hunk of hunks) {
    paths.push(hunk.path);
    if (hunk.type === 'update' && hunk.movePath) {
      paths.push(hunk.movePath);
    }
  }
  return paths;
}

/**
 * Extract write paths from raw patch text.
 * Returns an empty array when the text cannot be parsed so callers can
 * skip locking and let the tool report the parse error.
 */
export function getApplyPatchWritePaths(input: { patchText?: string }): string[] {
  try {
    return getPatchPaths(parseApplyPatch(input.patchText ?? ''));
  } catch {
    return [];
  }
}

function findUniqueSequence(lines: string[], pattern: string[], from: number): number {
  if (pattern.length === 0) {
    return from;
  }

  let found = -1;
  const lastStart = lines.length - pattern.length;
  for (let i = from; i <= lastStart; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (lines[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      if (found !== -1) {
        throw new ApplyPatchHunkError(
          'Hunk matches multiple locations. Add more context or a @@ header to make the match unique.',
        );
      }
      found = i;
    }
  }

  if (found === -1) {
    throw new ApplyPatchHunkError('Hunk does not match file contents. Read the file and update the patch context.');
  }

  return found;
}

/**
 * Apply update chunks to existing file content.
 * @throws {ApplyPatchHunkError} if a hunk does not match uniquely
 */
export function applyChunks(content: string, chunks: PatchChunk[]): string {
  const hadTrailingNewline = content.endsWith('\n');
  let lines = content === '' ? [] : content.split('\n');
  if (hadTrailingNewline && lines[lines.length - 1] === '') {
    lines = lines.slice(0, -1);
  }

  for (const chunk of chunks) {
    const oldLines: string[] = [];
    const newLines: string[] = [];
    for (const line of chunk.lines) {
      if (line.type !== 'add') oldLines.push(line.text);
      if (line.type !== 'remove') newLines.push(line.text);
    }

    let from = 0;
    if (chunk.changeContext) {
      const contextIndex = lines.findIndex(line => line.includes(chunk.changeContext!));
      if (contextIndex === -1) {
        throw new ApplyPatchHunkError(`Could not find context "${chunk.changeContext}" in the file.`);
      }
      from = contextIndex;
    }

    if (oldLines.length === 0) {
      if (chunk.isEndOfFile || (from === 0 && !chunk.changeContext)) {
        lines.push(...newLines);
        continue;
      }
      const insertAt = chunk.changeContext ? from + 1 : lines.length;
      lines.splice(insertAt, 0, ...newLines);
      continue;
    }

    const matchIndex = findUniqueSequence(lines, oldLines, from);
    lines.splice(matchIndex, oldLines.length, ...newLines);
  }

  if (lines.length === 0) {
    return hadTrailingNewline ? '\n' : '';
  }

  let result = lines.join('\n');
  if (hadTrailingNewline && !result.endsWith('\n')) {
    result += '\n';
  }
  return result;
}
