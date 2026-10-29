import { posix } from 'node:path';

/**
 * Parser and in-memory applier for the apply_patch format used by OpenAI Codex
 * and OpenCode:
 *
 * ```
 * *** Begin Patch
 * *** Add File: path/to/new.ts
 * +line one
 * *** Update File: path/to/existing.ts
 * *** Move to: path/to/renamed.ts
 * @@ optional context line
 *  unchanged line
 * -removed line
 * +added line
 * *** Delete File: path/to/old.ts
 * *** End Patch
 * ```
 *
 * Parsing and applying are pure: nothing here touches a filesystem.
 */

export class ApplyPatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplyPatchError';
  }
}

export interface UpdateChunk {
  /** Line from `@@ <context>` used to locate the chunk, if given. */
  context?: string;
  oldLines: string[];
  newLines: string[];
  /**
   * For each entry of `newLines`, the index in `oldLines` it was copied from
   * when it is a context line. Lets context keep the file's exact text when
   * the hunk only matched after ignoring whitespace.
   */
  contextSource: Array<number | undefined>;
  /** Set by `*** End of File`: the chunk must match the end of the file. */
  isEndOfFile: boolean;
}

export type PatchOperation =
  | { type: 'add'; path: string; content: string }
  | { type: 'delete'; path: string }
  | { type: 'update'; path: string; moveTo?: string; chunks: UpdateChunk[] };

const BEGIN_PATCH = '*** Begin Patch';
const END_PATCH = '*** End Patch';
const ADD_FILE = '*** Add File: ';
const DELETE_FILE = '*** Delete File: ';
const UPDATE_FILE = '*** Update File: ';
const MOVE_TO = '*** Move to: ';
const END_OF_FILE = '*** End of File';

function isFileHeader(line: string): boolean {
  return (
    line.startsWith(ADD_FILE) || line.startsWith(DELETE_FILE) || line.startsWith(UPDATE_FILE) || line === END_PATCH
  );
}

function headerPath(line: string, prefix: string, lineNumber: number): string {
  const path = line.slice(prefix.length).trim();
  if (!path) {
    throw new ApplyPatchError(`Line ${lineNumber}: missing file path after "${prefix.trim()}"`);
  }
  // Canonical form so 'a.ts', './a.ts' and 'src//../a.ts' count as one path
  // for the duplicate check and share one write lock.
  return posix.normalize(path);
}

/**
 * Parse a patch into its file operations. Throws {@link ApplyPatchError} on
 * malformed input or when the same path is touched more than once.
 */
export function parsePatch(patch: string): PatchOperation[] {
  const lines = patch.replace(/\r\n/g, '\n').split('\n');
  // Tolerate surrounding blank lines.
  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();

  if (lines[0]?.trim() !== BEGIN_PATCH) {
    throw new ApplyPatchError(`The first line of the patch must be "${BEGIN_PATCH}"`);
  }
  if (lines.length < 2 || lines[lines.length - 1]!.trim() !== END_PATCH) {
    throw new ApplyPatchError(`The last line of the patch must be "${END_PATCH}"`);
  }

  const operations: PatchOperation[] = [];
  let i = 1;
  const last = lines.length - 1;

  while (i < last) {
    const line = lines[i]!;
    const lineNumber = i + 1;

    if (line.startsWith(ADD_FILE)) {
      const path = headerPath(line, ADD_FILE, lineNumber);
      i++;
      const contentLines: string[] = [];
      while (i < last && !isFileHeader(lines[i]!)) {
        const bodyLine = lines[i]!;
        if (!bodyLine.startsWith('+')) {
          throw new ApplyPatchError(`Line ${i + 1}: every line of an added file must start with "+"`);
        }
        contentLines.push(bodyLine.slice(1));
        i++;
      }
      operations.push({ type: 'add', path, content: contentLines.length ? contentLines.join('\n') + '\n' : '' });
      continue;
    }

    if (line.startsWith(DELETE_FILE)) {
      operations.push({ type: 'delete', path: headerPath(line, DELETE_FILE, lineNumber) });
      i++;
      continue;
    }

    if (line.startsWith(UPDATE_FILE)) {
      const path = headerPath(line, UPDATE_FILE, lineNumber);
      i++;
      let moveTo: string | undefined;
      if (i < last && lines[i]!.startsWith(MOVE_TO)) {
        moveTo = headerPath(lines[i]!, MOVE_TO, i + 1);
        i++;
      }

      const chunks: UpdateChunk[] = [];
      let current: UpdateChunk | undefined;
      while (i < last && !isFileHeader(lines[i]!)) {
        const bodyLine = lines[i]!;
        if (bodyLine === '@@' || bodyLine.startsWith('@@ ')) {
          const context = bodyLine.slice(2).trim();
          current = {
            context: context || undefined,
            oldLines: [],
            newLines: [],
            contextSource: [],
            isEndOfFile: false,
          };
          chunks.push(current);
        } else if (bodyLine.trim() === END_OF_FILE) {
          if (!current) {
            throw new ApplyPatchError(`Line ${i + 1}: "${END_OF_FILE}" must follow a hunk`);
          }
          current.isEndOfFile = true;
          current = undefined;
        } else {
          if (!current) {
            // The first hunk of a file may omit its "@@" header.
            if (chunks.length > 0) {
              throw new ApplyPatchError(`Line ${i + 1}: expected "@@" to start a new hunk`);
            }
            current = { oldLines: [], newLines: [], contextSource: [], isEndOfFile: false };
            chunks.push(current);
          }
          const marker = bodyLine[0];
          const text = bodyLine.slice(1);
          if (bodyLine === '' || marker === ' ') {
            current.contextSource.push(current.oldLines.length);
            current.oldLines.push(text);
            current.newLines.push(text);
          } else if (marker === '-') {
            current.oldLines.push(text);
          } else if (marker === '+') {
            current.contextSource.push(undefined);
            current.newLines.push(text);
          } else {
            throw new ApplyPatchError(
              `Line ${i + 1}: hunk lines must start with " " (context), "-" (remove) or "+" (add)`,
            );
          }
        }
        i++;
      }

      if (chunks.length === 0 && !moveTo) {
        throw new ApplyPatchError(`Line ${lineNumber}: "${UPDATE_FILE.trim()}" for ${path} has no hunks`);
      }
      // A context-only hunk (`@@ class B {` with no lines) narrows the search for the
      // next hunk, so it is allowed unless it is bare or the last one.
      const isEmpty = (chunk: UpdateChunk) => chunk.oldLines.length === 0 && chunk.newLines.length === 0;
      if (chunks.some((chunk, k) => isEmpty(chunk) && (chunk.context === undefined || k === chunks.length - 1))) {
        throw new ApplyPatchError(`Line ${lineNumber}: "${UPDATE_FILE.trim()}" for ${path} has an empty hunk`);
      }
      operations.push({ type: 'update', path, moveTo, chunks });
      continue;
    }

    throw new ApplyPatchError(
      `Line ${lineNumber}: expected "${ADD_FILE.trim()}", "${UPDATE_FILE.trim()}" or "${DELETE_FILE.trim()}", got "${line}"`,
    );
  }

  if (operations.length === 0) {
    throw new ApplyPatchError('The patch contains no file operations');
  }

  const seen = new Set<string>();
  for (const path of patchPaths(operations)) {
    if (seen.has(path)) {
      throw new ApplyPatchError(`The patch touches ${path} more than once; combine those changes into one operation`);
    }
    seen.add(path);
  }

  return operations;
}

/** Every path a set of operations reads or writes, including move destinations. */
export function patchPaths(operations: PatchOperation[]): string[] {
  return operations.flatMap(op => (op.type === 'update' && op.moveTo ? [op.path, op.moveTo] : [op.path]));
}

/**
 * Find `pattern` in `lines` at or after `start`. Tries an exact match first,
 * then ignores trailing whitespace, then ignores surrounding whitespace.
 */
function seekSequence(lines: string[], pattern: string[], start: number, endOfFile: boolean): number {
  if (pattern.length === 0) return start;
  if (pattern.length > lines.length) return -1;

  const lastStart = lines.length - pattern.length;
  const from = endOfFile ? lastStart : start;
  const normalizers: Array<(s: string) => string> = [s => s, s => s.trimEnd(), s => s.trim()];

  for (const normalize of normalizers) {
    for (let i = from; i <= lastStart; i++) {
      let matched = true;
      for (let j = 0; j < pattern.length; j++) {
        if (normalize(lines[i + j]!) !== normalize(pattern[j]!)) {
          matched = false;
          break;
        }
      }
      if (matched) return i;
    }
  }
  return -1;
}

/**
 * Apply update hunks to file content in memory. Throws {@link ApplyPatchError}
 * when a hunk cannot be located. Preserves the file's line endings and whether
 * it ends with a newline.
 */
export function applyChunks(content: string, chunks: UpdateChunk[], path: string): string {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const hadTrailingNewline = content.length === 0 || content.endsWith('\n');
  const lines = content.split(/\r?\n/);
  if (hadTrailingNewline) lines.pop();

  const replacements: Array<{ start: number; deleteCount: number; newLines: string[] }> = [];
  let cursor = 0;

  for (const chunk of chunks) {
    if (chunk.context !== undefined) {
      const contextIndex = seekSequence(lines, [chunk.context], cursor, false);
      if (contextIndex === -1) {
        throw new ApplyPatchError(`Could not find context line "${chunk.context}" in ${path}`);
      }
      cursor = contextIndex + 1;
    }

    if (chunk.oldLines.length === 0 && chunk.newLines.length === 0) {
      continue;
    }

    if (chunk.oldLines.length === 0) {
      // Pure insertion: after the context line if one was given, otherwise at the end.
      const at = chunk.context !== undefined ? cursor : lines.length;
      replacements.push({ start: at, deleteCount: 0, newLines: chunk.newLines });
      cursor = at;
      continue;
    }

    let oldLines = chunk.oldLines;
    let newLines = chunk.newLines;
    let index = seekSequence(lines, oldLines, cursor, chunk.isEndOfFile);
    if (index === -1 && oldLines[oldLines.length - 1] === '') {
      // A trailing blank context line often stands for the file's final newline.
      oldLines = oldLines.slice(0, -1);
      if (newLines[newLines.length - 1] === '') newLines = newLines.slice(0, -1);
      index = seekSequence(lines, oldLines, cursor, chunk.isEndOfFile);
    }
    if (index === -1) {
      throw new ApplyPatchError(
        `Could not find the lines to replace in ${path}:\n${chunk.oldLines.join('\n')}\n` +
          'Read the file again and make sure context and "-" lines match its current content.',
      );
    }
    replacements.push({
      start: index,
      deleteCount: oldLines.length,
      newLines: newLines.map((line, k) => {
        const source = chunk.contextSource[k];
        return source !== undefined && source < oldLines.length ? lines[index + source]! : line;
      }),
    });
    cursor = index + oldLines.length;
  }

  for (const { start, deleteCount, newLines } of [...replacements].reverse()) {
    lines.splice(start, deleteCount, ...newLines);
  }

  if (lines.length === 0) return '';
  return lines.join(eol) + (hadTrailingNewline ? eol : '');
}
