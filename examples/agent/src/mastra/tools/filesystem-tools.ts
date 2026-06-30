/**
 * Read-only filesystem tools for the workflow-builder demo.
 *
 * Sandboxed: every path is resolved against a base directory and rejected if
 * it escapes (no `..`-traversal, no symlinks pointing outside the sandbox).
 * Defaults to `process.cwd()`; override with `WB_FS_BASE` env var.
 *
 * Limits chosen so a runaway workflow on a huge tree can't OOM the process:
 * - `list-files` returns at most 500 entries (truncated flag in output).
 * - `read-file` refuses files >1 MB and likely-binary content.
 */
import { createTool } from '@mastra/core/tools';
import { stat, readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { z } from 'zod';

const FS_BASE = resolve(process.env.WB_FS_BASE ?? process.cwd());
const MAX_LIST_ENTRIES = 500;
const MAX_FILE_BYTES = 1_000_000;

/** Resolve a user-supplied path against the sandbox base and assert no escape. */
async function resolveInsideBase(input: string): Promise<string> {
  const joined = isAbsolute(input) ? input : join(FS_BASE, input);
  // realpath resolves symlinks so a symlink inside the sandbox pointing OUT
  // can't be used to read /etc/passwd.
  let abs: string;
  try {
    abs = await realpath(joined);
  } catch {
    // Path doesn't exist (yet) or is unreadable — resolve without realpath so
    // we can still surface the "not found" error from the caller's stat/read.
    abs = resolve(joined);
  }
  const rel = relative(FS_BASE, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `Path "${input}" is outside the allowed sandbox (${FS_BASE}). Set WB_FS_BASE to widen the sandbox.`,
    );
  }
  return abs;
}

/**
 * Heuristic: treat content as binary if it contains NUL bytes in the first 8KB.
 * Good enough for "don't try to summarise a PNG to the agent" — not a
 * security boundary.
 */
function looksBinary(buf: Buffer): boolean {
  const sniff = buf.subarray(0, Math.min(8192, buf.length));
  return sniff.includes(0);
}

export const listFilesTool = createTool({
  id: 'list-files',
  description:
    'List the immediate children of a directory under the workflow-builder sandbox (default = cwd). Returns each entry with name, type, and size in bytes. Does not recurse.',
  inputSchema: z.object({
    dir: z
      .string()
      .describe('Path to the directory. Relative paths are resolved against the sandbox base. Use "." for the base.'),
  }),
  outputSchema: z.object({
    dir: z.string(),
    entries: z.array(
      z.object({
        name: z.string(),
        type: z.enum(['file', 'directory', 'symlink', 'other']),
        size: z.number(),
      }),
    ),
    truncated: z.boolean(),
  }),
  execute: async ({ dir }) => {
    const abs = await resolveInsideBase(dir);
    const dirStat = await stat(abs);
    if (!dirStat.isDirectory()) {
      throw new Error(`list-files: "${dir}" is not a directory.`);
    }

    const raw = await readdir(abs, { withFileTypes: true });
    const limited = raw.slice(0, MAX_LIST_ENTRIES);

    const entries = await Promise.all(
      limited.map(async dirent => {
        let size = 0;
        let type: 'file' | 'directory' | 'symlink' | 'other' = 'other';
        if (dirent.isDirectory()) type = 'directory';
        else if (dirent.isSymbolicLink()) type = 'symlink';
        else if (dirent.isFile()) type = 'file';

        if (type === 'file' || type === 'symlink') {
          try {
            const entryStat = await stat(join(abs, dirent.name));
            size = entryStat.size;
          } catch {
            size = 0;
          }
        }
        return { name: dirent.name, type, size };
      }),
    );

    return {
      dir: abs,
      entries,
      truncated: raw.length > MAX_LIST_ENTRIES,
    };
  },
});

export const readFileTool = createTool({
  id: 'read-file',
  description:
    'Read a single text file from the workflow-builder sandbox (default = cwd) and return its content as a string. Refuses binary files and files >1 MB.',
  inputSchema: z.object({
    path: z
      .string()
      .describe('Path to the file. Relative paths are resolved against the sandbox base.'),
  }),
  outputSchema: z.object({
    path: z.string(),
    bytes: z.number(),
    content: z.string(),
  }),
  execute: async ({ path }) => {
    const abs = await resolveInsideBase(path);
    const info = await stat(abs);
    if (!info.isFile()) {
      throw new Error(`read-file: "${path}" is not a regular file.`);
    }
    if (info.size > MAX_FILE_BYTES) {
      throw new Error(`read-file: "${path}" is ${info.size} bytes; max is ${MAX_FILE_BYTES}.`);
    }
    const buf = await readFile(abs);
    if (looksBinary(buf)) {
      throw new Error(`read-file: "${path}" looks like a binary file (contains NUL bytes); refusing to return content.`);
    }
    return {
      path: abs,
      bytes: info.size,
      content: buf.toString('utf8'),
    };
  },
});
