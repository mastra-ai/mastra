// Disable our restriction on `throw` because these aren't developer-facing
// error messages.
/* eslint-disable no-restricted-imports */
/* eslint-disable no-restricted-syntax */
import chalk from "chalk";
import stdFs, { Dirent, Mode, ReadStream, Stats } from "fs";
import * as fsPromises from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

export type NormalizedPath = string;

const tmpDirOverrideVar = "CONVEX_TMPDIR";
function tmpDirPath() {
  // Allow users to override the temporary directory path with an environment variable.
  // This override needs to (1) be project-specific, since the user may have projects
  // on different filesystems, but also (2) be device-specific and not checked in, since
  // it's dependent on where the user has checked out their project. So, we don't want
  // this state in the project-specific `convex.json`, which is shared across all
  // devices, or in the top-level `~/.convex` directory, which is shared across all
  // projects on the local machine.
  //
  // Therefore, just let advanced users configure this behavior with an environment
  // variable that they're responsible for managing themselves for now.
  const envTmpDir = process.env[tmpDirOverrideVar];
  return envTmpDir ?? os.tmpdir();
}
const tmpDirRoot = tmpDirPath();

let warned = false;
function warnCrossFilesystem(dstPath: string) {
  const dstDir = path.dirname(dstPath);
  if (!warned) {
    // It's hard for these to use `logMessage` without creating a circular dependency, so just log directly.
    // eslint-disable-next-line no-console
    console.warn(
      chalk.yellow(
        `Temporary directory '${tmpDirRoot}' and project directory '${dstDir}' are on different filesystems.`,
      ),
    );
    // eslint-disable-next-line no-console
    console.warn(
      chalk.gray(
        `  If you're running into errors with other tools watching the project directory, override the temporary directory location with the ${chalk.bold(
          tmpDirOverrideVar,
        )} environment variable.`,
      ),
    );
    // eslint-disable-next-line no-console
    console.warn(
      chalk.gray(
        `  Be sure to pick a temporary directory that's on the same filesystem as your project.`,
      ),
    );
    warned = true;
  }
}

export interface Filesystem {
  listDir(dirPath: string): Dirent[];

  exists(path: string): boolean;
  stat(path: string): Stats;
  readUtf8File(path: string): string;
  // createReadStream returns a stream for which [Symbol.asyncIterator]
  // yields chunks of size highWaterMark (until the last one), or 64KB if
  // highWaterMark isn't specified.
  // https://nodejs.org/api/stream.html#readablesymbolasynciterator
  createReadStream(
    path: string,
    options: { highWaterMark?: number },
  ): ReadStream;
  access(path: string): void;

  writeUtf8File(path: string, contents: string, mode?: Mode): void;
  mkdir(
    dirPath: string,
    options?: { allowExisting?: boolean; recursive?: boolean },
  ): void;
  rmdir(path: string): void;
  unlink(path: string): void;
  swapTmpFile(fromPath: TempPath, toPath: string): void;

  registerPath(path: string, st: Stats | null): void;
  invalidate(): void;
}

export type TempPath = string & { __tempPath: "tempPath" };

export interface TempDir {
  writeUtf8File(contents: string): TempPath;
  writeFileStream(
    path: TempPath,
    stream: Readable,
    onData?: (chunk: any) => void,
  ): Promise<void>;
  registerTempPath(st: Stats | null): TempPath;
  path: TempPath;
}

export async function withTmpDir(
  callback: (tmpDir: TempDir) => Promise<void>,
): Promise<void> {
  // Create temporary directories inside `tmpDirRoot` of the form `convex-<random>`.
  const tmpPath = stdFs.mkdtempSync(path.join(tmpDirRoot, "convex"));
  const tmpDir = {
    writeUtf8File(contents: string): TempPath {
      const filePath = path.join(tmpPath, crypto.randomUUID());
      nodeFs.writeUtf8File(filePath, contents);
      return filePath as TempPath;
    },
    registerTempPath(st: Stats | null): TempPath {
      const filePath = path.join(tmpPath, crypto.randomUUID());
      nodeFs.registerPath(filePath, st);
      return filePath as TempPath;
    },
    writeFileStream(
      path: TempPath,
      stream: Readable,
      onData?: (chunk: any) => void,
    ): Promise<void> {
      return nodeFs.writeFileStream(path, stream, onData);
    },
    path: tmpPath as TempPath,
  };
  try {
    await callback(tmpDir);
  } finally {
    stdFs.rmSync(tmpPath, { force: true, recursive: true });
  }
}

// Use `nodeFs` when you just want to read and write to the local filesystem
// and don't care about collecting the paths touched. One-off commands
// should use the singleton `nodeFs`.
export class NodeFs implements Filesystem {
  listDir(dirPath: string) {
    return stdFs.readdirSync(dirPath, { withFileTypes: true });
  }
  exists(path: string) {
    try {
      stdFs.statSync(path);
      return true;
    } catch (e: any) {
      if (e.code === "ENOENT") {
        return false;
      }
      throw e;
    }
  }
  stat(path: string) {
    return stdFs.statSync(path);
  }
  readUtf8File(path: string) {
    return stdFs.readFileSync(path, { encoding: "utf-8" });
  }
  createReadStream(
    path: string,
    options: { highWaterMark?: number },
  ): ReadStream {
    return stdFs.createReadStream(path, options);
  }
  // To avoid issues with filesystem events triggering for our own streamed file
  // writes, writeFileStream is intentionally not on the Filesystem interface
  // and not implemented by RecordingFs.
  async writeFileStream(
    path: string,
    stream: Readable,
    onData?: (chunk: any) => void,
  ): Promise<void> {
    // 'wx' means O_CREAT | O_EXCL | O_WRONLY
    // 0o644 means owner has readwrite access, everyone else has read access.
    const fileHandle = await fsPromises.open(path, "wx", 0o644);
    try {
      for await (const chunk of stream) {
        // For some reason, adding `stream.on("data", onData)` causes issues with
        // the stream, but calling a callback here works.
        if (onData) {
          onData(chunk);
        }
        await fileHandle.write(chunk);
      }
    } finally {
      await fileHandle.close();
    }
  }
  access(path: string) {
    return stdFs.accessSync(path);
  }
  writeUtf8File(path: string, contents: string, mode?: Mode) {
    const fd = stdFs.openSync(path, "w", mode);
    try {
      stdFs.writeFileSync(fd, contents, { encoding: "utf-8" });
      stdFs.fsyncSync(fd);
    } finally {
      stdFs.closeSync(fd);
    }
  }
  mkdir(
    dirPath: string,
    options?: { allowExisting?: boolean; recursive?: boolean },
  ): void {
    try {
      stdFs.mkdirSync(dirPath, { recursive: options?.recursive });
    } catch (e: any) {
      if (options?.allowExisting && e.code === "EEXIST") {
        return;
      }
      throw e;
    }
  }
  rmdir(path: string) {
    stdFs.rmdirSync(path);
  }
  unlink(path: string) {
    return stdFs.unlinkSync(path);
  }
  swapTmpFile(fromPath: TempPath, toPath: string) {
    try {
      return stdFs.renameSync(fromPath, toPath);
    } catch (e: any) {
      // Fallback to copying the file if we're on different volumes.
      if (e.code === "EXDEV") {
        warnCrossFilesystem(toPath);
        stdFs.copyFileSync(fromPath, toPath);
        return;
      }
      throw e;
    }
  }
  registerPath(_path: string, _st: Stats | null) {
    // The node filesystem doesn't track reads, so we don't need to do anything here.
  }
  invalidate() {
    // We don't track invalidations for the node filesystem either.
  }
}
export const nodeFs = new NodeFs();

// Filesystem implementation that records all paths observed. This is useful
// for implementing continuous watch commands that need to manage a filesystem
// watcher and know when a command's inputs were invalidated.
export class RecordingFs implements Filesystem {
  // Absolute path -> Set of observed child names
  private observedDirectories: Map<string, Set<string>> = new Map();

  // Absolute path -> observed stat (or null if observed nonexistent)
  private observedFiles: Map<string, Stats | null> = new Map();

  // Have we noticed that files have changed while recording?
  private invalidated = false;

  private traceEvents: boolean;

  constructor(traceEvents: boolean) {
    this.traceEvents = traceEvents;
  }

  listDir(dirPath: string): Dirent[] {
    const absDirPath = path.resolve(dirPath);

    // Register observing the directory itself.
    const dirSt = nodeFs.stat(absDirPath);
    this.registerNormalized(absDirPath, dirSt);

    // List the directory and register observing all of its children.
    const entries = nodeFs.listDir(dirPath);
    for (const entry of entries) {
      const childPath = path.join(absDirPath, entry.name);
      const childSt = nodeFs.stat(childPath);
      this.registerPath(childPath, childSt);
    }

    // Register observing the directory's children.
    const observedNames = new Set(entries.map((e) => e.name));
    const existingNames = this.observedDirectories.get(absDirPath);
    if (existingNames) {
      if (!setsEqual(observedNames, existingNames)) {
        if (this.traceEvents) {
          // eslint-disable-next-line no-console
          console.log(
            "Invalidating due to directory children mismatch",
            observedNames,
            existingNames,
          );
        }
        this.invalidated = true;
      }
    }
    this.observedDirectories.set(absDirPath, observedNames);

    return entries;
  }

  exists(path: string): boolean {
    try {
      const st = nodeFs.stat(path);
      this.registerPath(path, st);
      return true;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        this.registerPath(path, null);
        return false;
      }
      throw err;
    }
  }
  stat(path: string): Stats {
    try {
      const st = nodeFs.stat(path);
      this.registerPath(path, st);
      return st;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        this.registerPath(path, null);
      }
      throw err;
    }
  }
  readUtf8File(path: string): string {
    try {
      const st = nodeFs.stat(path);
      this.registerPath(path, st);
      return nodeFs.readUtf8File(path);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        this.registerPath(path, null);
      }
      throw err;
    }
  }
  createReadStream(
    path: string,
    options: { highWaterMark?: number },
  ): ReadStream {
    try {
      const st = nodeFs.stat(path);
      this.registerPath(path, st);
      return nodeFs.createReadStream(path, options);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        this.registerPath(path, null);
      }
      throw err;
    }
  }
  access(path: string) {
    try {
      const st = nodeFs.stat(path);
      this.registerPath(path, st);
      return nodeFs.access(path);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        this.registerPath(path, null);
      }
      throw err;
    }
  }

  writeUtf8File(filePath: string, contents: string, mode?: Mode) {
    const absPath = path.resolve(filePath);

    nodeFs.writeUtf8File(filePath, contents, mode);

    this.updateOnWrite(absPath);
  }

  mkdir(
    dirPath: string,
    options?: { allowExisting?: boolean; recursive?: boolean },
  ): void {
    const absPath = path.resolve(dirPath);
    try {
      stdFs.mkdirSync(absPath, { recursive: options?.recursive });
    } catch (e: any) {
      if (options?.allowExisting && e.code === "EEXIST") {
        const st = nodeFs.stat(absPath);
        this.registerNormalized(absPath, st);
        return;
      }
      throw e;
    }
    this.updateOnWrite(absPath);
  }

  rmdir(dirPath: string) {
    const absPath = path.resolve(dirPath);
    stdFs.rmdirSync(absPath);
    this.updateOnDelete(absPath);
  }
  unlink(filePath: string) {
    const absPath = path.resolve(filePath);
    stdFs.unlinkSync(absPath);
    this.updateOnDelete(absPath);
  }
  swapTmpFile(fromPath: TempPath, toPath: string) {
    const absToPath = path.resolve(toPath);
    nodeFs.swapTmpFile(fromPath, absToPath);
    this.updateOnWrite(absToPath);
  }

  private updateOnWrite(absPath: string) {
    // Stat the file or dir after writing and make it our expected observation. If we read the file after
    // writing it and it doesn't match this stat (implying a subsequent write), we'll invalidate
    // the current reader.
    const newSt = nodeFs.stat(absPath);
    // Skip invalidation checking since we don't want to conflict if we previously read this file.
    this.observedFiles.set(absPath, newSt);

    // If we observed the parent, add our newly created file.
    const parentPath = path.resolve(path.dirname(absPath));
    const observedParent = this.observedDirectories.get(parentPath);
    if (observedParent !== undefined) {
      observedParent.add(path.basename(absPath));
    }
  }
  private updateOnDelete(absPath: string) {
    // Expect this file to be gone.
    this.observedFiles.set(absPath, null);

    // Unlink it from our parent if observed.
    const parentPath = path.resolve(path.dirname(absPath));
    const observedParent = this.observedDirectories.get(parentPath);
    if (observedParent !== undefined) {
      observedParent.delete(path.basename(absPath));
    }
  }

  registerPath(p: string, st: Stats | null) {
    const absPath = path.resolve(p);
    this.registerNormalized(absPath, st);
  }

  invalidate() {
    this.invalidated = true;
  }

  registerNormalized(absPath: string, observed: Stats | null): void {
    const existing = this.observedFiles.get(absPath);
    if (existing !== undefined) {
      const stMatch = stMatches(observed, existing);
      if (!stMatch.matches) {
        if (this.traceEvents) {
          // eslint-disable-next-line no-console
          console.log(
            "Invalidating due to st mismatch",
            absPath,
            observed,
            existing,
            stMatch.reason,
          );
        }
        this.invalidated = true;
      }
    }
    this.observedFiles.set(absPath, observed);
  }

  finalize(): Observations | "invalidated" {
    if (this.invalidated) {
      return "invalidated";
    }
    return new Observations(this.observedDirectories, this.observedFiles);
  }
}

export type WatchEvent = {
  name: "add" | "addDir" | "change" | "unlink" | "unlinkDir";
  absPath: string;
};

export class Observations {
  directories: Map<string, Set<string>>;
  files: Map<string, Stats | null>;

  constructor(
    directories: Map<string, Set<string>>,
    files: Map<string, Stats | null>,
  ) {
    this.directories = directories;
    this.files = files;
  }

  paths(): string[] {
    const out = [];
    for (const path of this.directories.keys()) {
      out.push(path);
    }
    for (const path of this.files.keys()) {
      out.push(path);
    }
    return out;
  }

  overlaps({
    absPath,
  }: WatchEvent): { overlaps: false } | { overlaps: true; reason: string } {
    let currentSt: null | Stats;
    try {
      currentSt = nodeFs.stat(absPath);
    } catch (e: any) {
      if (e.code === "ENOENT") {
        currentSt = null;
      } else {
        throw e;
      }
    }

    // First, check to see if we observed `absPath` as a file.
    const observedSt = this.files.get(absPath);
    if (observedSt !== undefined) {
      const stMatch = stMatches(observedSt, currentSt);
      if (!stMatch.matches) {
        const reason = `modified (${stMatch.reason})`;
        return { overlaps: true, reason };
      }
    }

    // Second, check if we listed the directory this file is in.
    const parentPath = path.resolve(path.dirname(absPath));
    const observedParent = this.directories.get(parentPath);
    if (observedParent !== undefined) {
      const filename = path.basename(absPath);

      // If the file is gone now, but we observed it in its directory, then
      // it was deleted.
      if (currentSt === null && observedParent.has(filename)) {
        return { overlaps: true, reason: "deleted" };
      }

      // If the file exists now, but we didn't see it when listing its directory,
      // then it was added.
      if (currentSt !== null && !observedParent.has(filename)) {
        return { overlaps: true, reason: "added" };
      }
    }

    return { overlaps: false };
  }
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const elem of a.keys()) {
    if (!b.has(elem)) {
      return false;
    }
  }
  return true;
}

export function stMatches(
  a: Stats | null,
  b: Stats | null,
): { matches: true } | { matches: false; reason: string } {
  if (a === null && b === null) {
    return { matches: true };
  }
  if (a !== null && b !== null) {
    if (a.dev !== b.dev) {
      return { matches: false, reason: "device boundary" };
    }
    if (a.isFile() || b.isFile()) {
      if (!a.isFile() || !b.isFile()) {
        return { matches: false, reason: "file type" };
      }
      if (a.ino !== b.ino) {
        return {
          matches: false,
          reason: `file inode (${a.ino} vs. ${b.ino})`,
        };
      }
      if (a.size !== b.size) {
        return {
          matches: false,
          reason: `file size (${a.size} vs. ${b.size})`,
        };
      }
      if (a.mtimeMs !== b.mtimeMs) {
        return {
          matches: false,
          reason: `file mtime (${a.mtimeMs} vs. ${b.mtimeMs})`,
        };
      }
      return { matches: true };
    }
    if (a.isDirectory() || b.isDirectory()) {
      if (!b.isDirectory() || !b.isDirectory()) {
        return { matches: false, reason: "dir file type" };
      }
      if (a.ino !== b.ino) {
        return {
          matches: false,
          reason: `dir inode (${a.ino} vs. ${b.ino})`,
        };
      }
      return { matches: true };
    }
    // If we have something other than a file or directory, just compare inodes.
    if (a.ino !== b.ino) {
      return {
        matches: false,
        reason: `special inode (${a.ino} vs. ${b.ino})`,
      };
    }
    return { matches: true };
  }
  return { matches: false, reason: "deleted mismatch" };
}

// Sort consistent with unix directory listings.
export function consistentPathSort(a: Dirent, b: Dirent) {
  for (let i = 0; i < Math.min(a.name.length, b.name.length); i++) {
    if (a.name.charCodeAt(i) !== b.name.charCodeAt(i)) {
      return a.name.charCodeAt(i) - b.name.charCodeAt(i);
    }
  }
  return a.name.length - b.name.length;
}
