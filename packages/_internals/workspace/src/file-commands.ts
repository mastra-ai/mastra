import { posix } from 'node:path';

/**
 * Shell scripts for the file operations a sandbox can only do atomically (or
 * without moving file bytes over the network) by running a command inside the
 * VM. Each builder takes absolute paths and returns one POSIX `sh` script; the
 * caller runs it with `sh -c` and maps the exit codes below to typed errors.
 */

/** Exit codes the scripts use for outcomes the caller turns into typed errors. Any other non-zero code is a plain failure. */
export const FILE_COMMAND_EXIT = {
  notFound: 20,
  isDirectory: 21,
  exists: 22,
  notDirectory: 23,
  destIsDirectory: 24,
} as const;

/** Single-quote a string for safe POSIX shell interpolation. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const { notFound, isDirectory, exists, notDirectory, destIsDirectory } = FILE_COMMAND_EXIT;

/** `[ -e ]` is false for a broken symlink, which still occupies the path. */
const present = (variable: string) => `{ [ -e "$${variable}" ] || [ -L "$${variable}" ]; }`;

/**
 * A sibling temp path for `path`, so a later `ln` / `mv` onto `path` stays on
 * one filesystem. Hidden, and unique per call.
 */
export function siblingTempPath(path: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return posix.join(posix.dirname(path), `.${posix.basename(path)}.mastra-tmp-${suffix}`);
}

/**
 * Hard-link `$tmp` to `$dest` and delete `$tmp`, failing with `exists` when
 * something is at `$dest`. `ln` onto a directory (or a link to one) would
 * create the link inside it and succeed, so that case is undone and reported
 * as taken too.
 */
function linkTempIntoPlace(): string[] {
  return [
    `ln "$tmp" "$dest" 2>/dev/null || { rm -f "$tmp"; ${present('dest')} && exit ${exists}; exit 1; }`,
    `if [ -d "$dest" ]; then rm -f "$dest/$(basename "$tmp")" "$tmp"; exit ${exists}; fi`,
    `rm -f "$tmp"`,
  ];
}

export interface CopyCommandOptions {
  /** Copy a directory and everything under it. Without it a directory source fails with `isDirectory`. */
  recursive?: boolean;
  /** `false` fails with `exists` when the destination is taken, atomically. Default `true`. */
  overwrite?: boolean;
}

/**
 * Copy `src` to `dest` inside the sandbox, creating `dest`'s parent.
 *
 * A file source copies its content (a symlinked source is followed). A
 * directory source with `recursive` copies its contents into `dest`, keeping
 * symlinks inside the tree as links. With `overwrite: false` the destination
 * is claimed atomically: a directory with an exclusive `mkdir`, a file by
 * copying to a temp name and hard-linking it into place (`link(2)` fails when
 * the destination exists).
 *
 * Exits: `notFound` (no source), `isDirectory` (directory source without
 * `recursive`), `destIsDirectory` (a file onto an existing directory or a link
 * to one), `exists`.
 */
export function copyCommand(src: string, dest: string, options: CopyCommandOptions = {}): string {
  const noClobber = options.overwrite === false;
  return [
    `src=${shellQuote(src)}`,
    `dest=${shellQuote(dest)}`,
    // A broken symlink has nothing to copy.
    `[ -e "$src" ] || exit ${notFound}`,
    `mkdir -p "$(dirname "$dest")" || exit 1`,
    `if [ -d "$src" ]; then`,
    options.recursive ? `  :` : `  exit ${isDirectory}`,
    noClobber ? `  mkdir "$dest" 2>/dev/null || exit ${exists}` : `  mkdir -p "$dest" || exit 1`,
    `  cp -R -P "$src"/. "$dest"/ || exit 1`,
    `  exit 0`,
    `fi`,
    noClobber ? `${present('dest')} && exit ${exists}` : `if [ -d "$dest" ]; then exit ${destIsDirectory}; fi`,
    ...(noClobber
      ? [
          `tmp=${shellQuote(siblingTempPath(dest))}`,
          `cp "$src" "$tmp" || { rm -f "$tmp"; exit 1; }`,
          ...linkTempIntoPlace(),
        ]
      : [`cp "$src" "$dest" || exit 1`]),
  ].join('\n');
}

/**
 * Move `src` to `dest` without replacing anything at `dest`, creating `dest`'s
 * parent. A skipped `mv -n` is detected by the source surviving, whatever
 * its exit code; the no-clobber rename itself is atomic.
 *
 * Exits: `notFound` (no source), `exists`.
 */
export function moveNoClobberCommand(src: string, dest: string): string {
  return [
    `src=${shellQuote(src)}`,
    `dest=${shellQuote(dest)}`,
    `${present('src')} || exit ${notFound}`,
    `${present('dest')} && exit ${exists}`,
    `mkdir -p "$(dirname "$dest")" || exit 1`,
    // coreutils 9.2+ exits nonzero when -n skips; older versions exit 0.
    `mv -n "$src" "$dest" 2>/dev/null || { ${present('src')} && ${present('dest')} && exit ${exists}; exit 1; }`,
    `${present('src')} && exit ${exists}`,
    `exit 0`,
  ].join('\n');
}

/**
 * Append the bytes already written to `tmp` onto `dest`, then delete `tmp`.
 * The content travels as a file rather than a command argument, so it has no
 * size limit. Creates `dest` (and its parent) when missing.
 *
 * Exits: `isDirectory` (dest is a directory).
 */
export function appendFromCommand(tmp: string, dest: string): string {
  return [
    `tmp=${shellQuote(tmp)}`,
    `dest=${shellQuote(dest)}`,
    `if [ -d "$dest" ]; then rm -f "$tmp"; exit ${isDirectory}; fi`,
    `mkdir -p "$(dirname "$dest")" && cat "$tmp" >> "$dest"`,
    `status=$?`,
    `rm -f "$tmp"`,
    `exit $status`,
  ].join('\n');
}

/**
 * Publish the file already written to `tmp` at `dest` only if nothing is
 * there, then delete `tmp`. `ln` (`link(2)`) is the atomic exclusivity check;
 * `tmp` must be on the same filesystem, e.g. from {@link siblingTempPath}.
 *
 * Exits: `exists`, `notDirectory` (dest's parent is not a directory).
 */
export function linkNoClobberCommand(tmp: string, dest: string): string {
  return [
    `tmp=${shellQuote(tmp)}`,
    `dest=${shellQuote(dest)}`,
    `if [ ! -d "$(dirname "$dest")" ]; then rm -f "$tmp"; exit ${notDirectory}; fi`,
    `if ${present('dest')}; then rm -f "$tmp"; exit ${exists}; fi`,
    ...linkTempIntoPlace(),
  ].join('\n');
}
