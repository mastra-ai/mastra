"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import chalk from "chalk";
import stdFs from "fs";
import * as fsPromises from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
const tmpDirOverrideVar = "CONVEX_TMPDIR";
function tmpDirPath() {
  const envTmpDir = process.env[tmpDirOverrideVar];
  return envTmpDir ?? os.tmpdir();
}
const tmpDirRoot = tmpDirPath();
let warned = false;
function warnCrossFilesystem(dstPath) {
  const dstDir = path.dirname(dstPath);
  if (!warned) {
    console.warn(
      chalk.yellow(
        `Temporary directory '${tmpDirRoot}' and project directory '${dstDir}' are on different filesystems.`
      )
    );
    console.warn(
      chalk.gray(
        `  If you're running into errors with other tools watching the project directory, override the temporary directory location with the ${chalk.bold(
          tmpDirOverrideVar
        )} environment variable.`
      )
    );
    console.warn(
      chalk.gray(
        `  Be sure to pick a temporary directory that's on the same filesystem as your project.`
      )
    );
    warned = true;
  }
}
export async function withTmpDir(callback) {
  const tmpPath = stdFs.mkdtempSync(path.join(tmpDirRoot, "convex"));
  const tmpDir = {
    writeUtf8File(contents) {
      const filePath = path.join(tmpPath, crypto.randomUUID());
      nodeFs.writeUtf8File(filePath, contents);
      return filePath;
    },
    registerTempPath(st) {
      const filePath = path.join(tmpPath, crypto.randomUUID());
      nodeFs.registerPath(filePath, st);
      return filePath;
    },
    writeFileStream(path2, stream, onData) {
      return nodeFs.writeFileStream(path2, stream, onData);
    },
    path: tmpPath
  };
  try {
    await callback(tmpDir);
  } finally {
    stdFs.rmSync(tmpPath, { force: true, recursive: true });
  }
}
export class NodeFs {
  listDir(dirPath) {
    return stdFs.readdirSync(dirPath, { withFileTypes: true });
  }
  exists(path2) {
    try {
      stdFs.statSync(path2);
      return true;
    } catch (e) {
      if (e.code === "ENOENT") {
        return false;
      }
      throw e;
    }
  }
  stat(path2) {
    return stdFs.statSync(path2);
  }
  readUtf8File(path2) {
    return stdFs.readFileSync(path2, { encoding: "utf-8" });
  }
  createReadStream(path2, options) {
    return stdFs.createReadStream(path2, options);
  }
  // To avoid issues with filesystem events triggering for our own streamed file
  // writes, writeFileStream is intentionally not on the Filesystem interface
  // and not implemented by RecordingFs.
  async writeFileStream(path2, stream, onData) {
    const fileHandle = await fsPromises.open(path2, "wx", 420);
    try {
      for await (const chunk of stream) {
        if (onData) {
          onData(chunk);
        }
        await fileHandle.write(chunk);
      }
    } finally {
      await fileHandle.close();
    }
  }
  access(path2) {
    return stdFs.accessSync(path2);
  }
  writeUtf8File(path2, contents, mode) {
    const fd = stdFs.openSync(path2, "w", mode);
    try {
      stdFs.writeFileSync(fd, contents, { encoding: "utf-8" });
      stdFs.fsyncSync(fd);
    } finally {
      stdFs.closeSync(fd);
    }
  }
  mkdir(dirPath, options) {
    try {
      stdFs.mkdirSync(dirPath, { recursive: options?.recursive });
    } catch (e) {
      if (options?.allowExisting && e.code === "EEXIST") {
        return;
      }
      throw e;
    }
  }
  rmdir(path2) {
    stdFs.rmdirSync(path2);
  }
  unlink(path2) {
    return stdFs.unlinkSync(path2);
  }
  swapTmpFile(fromPath, toPath) {
    try {
      return stdFs.renameSync(fromPath, toPath);
    } catch (e) {
      if (e.code === "EXDEV") {
        warnCrossFilesystem(toPath);
        stdFs.copyFileSync(fromPath, toPath);
        return;
      }
      throw e;
    }
  }
  registerPath(_path, _st) {
  }
  invalidate() {
  }
}
export const nodeFs = new NodeFs();
export class RecordingFs {
  constructor(traceEvents) {
    // Absolute path -> Set of observed child names
    __publicField(this, "observedDirectories", /* @__PURE__ */ new Map());
    // Absolute path -> observed stat (or null if observed nonexistent)
    __publicField(this, "observedFiles", /* @__PURE__ */ new Map());
    // Have we noticed that files have changed while recording?
    __publicField(this, "invalidated", false);
    __publicField(this, "traceEvents");
    this.traceEvents = traceEvents;
  }
  listDir(dirPath) {
    const absDirPath = path.resolve(dirPath);
    const dirSt = nodeFs.stat(absDirPath);
    this.registerNormalized(absDirPath, dirSt);
    const entries = nodeFs.listDir(dirPath);
    for (const entry of entries) {
      const childPath = path.join(absDirPath, entry.name);
      const childSt = nodeFs.stat(childPath);
      this.registerPath(childPath, childSt);
    }
    const observedNames = new Set(entries.map((e) => e.name));
    const existingNames = this.observedDirectories.get(absDirPath);
    if (existingNames) {
      if (!setsEqual(observedNames, existingNames)) {
        if (this.traceEvents) {
          console.log(
            "Invalidating due to directory children mismatch",
            observedNames,
            existingNames
          );
        }
        this.invalidated = true;
      }
    }
    this.observedDirectories.set(absDirPath, observedNames);
    return entries;
  }
  exists(path2) {
    try {
      const st = nodeFs.stat(path2);
      this.registerPath(path2, st);
      return true;
    } catch (err) {
      if (err.code === "ENOENT") {
        this.registerPath(path2, null);
        return false;
      }
      throw err;
    }
  }
  stat(path2) {
    try {
      const st = nodeFs.stat(path2);
      this.registerPath(path2, st);
      return st;
    } catch (err) {
      if (err.code === "ENOENT") {
        this.registerPath(path2, null);
      }
      throw err;
    }
  }
  readUtf8File(path2) {
    try {
      const st = nodeFs.stat(path2);
      this.registerPath(path2, st);
      return nodeFs.readUtf8File(path2);
    } catch (err) {
      if (err.code === "ENOENT") {
        this.registerPath(path2, null);
      }
      throw err;
    }
  }
  createReadStream(path2, options) {
    try {
      const st = nodeFs.stat(path2);
      this.registerPath(path2, st);
      return nodeFs.createReadStream(path2, options);
    } catch (err) {
      if (err.code === "ENOENT") {
        this.registerPath(path2, null);
      }
      throw err;
    }
  }
  access(path2) {
    try {
      const st = nodeFs.stat(path2);
      this.registerPath(path2, st);
      return nodeFs.access(path2);
    } catch (err) {
      if (err.code === "ENOENT") {
        this.registerPath(path2, null);
      }
      throw err;
    }
  }
  writeUtf8File(filePath, contents, mode) {
    const absPath = path.resolve(filePath);
    nodeFs.writeUtf8File(filePath, contents, mode);
    this.updateOnWrite(absPath);
  }
  mkdir(dirPath, options) {
    const absPath = path.resolve(dirPath);
    try {
      stdFs.mkdirSync(absPath, { recursive: options?.recursive });
    } catch (e) {
      if (options?.allowExisting && e.code === "EEXIST") {
        const st = nodeFs.stat(absPath);
        this.registerNormalized(absPath, st);
        return;
      }
      throw e;
    }
    this.updateOnWrite(absPath);
  }
  rmdir(dirPath) {
    const absPath = path.resolve(dirPath);
    stdFs.rmdirSync(absPath);
    this.updateOnDelete(absPath);
  }
  unlink(filePath) {
    const absPath = path.resolve(filePath);
    stdFs.unlinkSync(absPath);
    this.updateOnDelete(absPath);
  }
  swapTmpFile(fromPath, toPath) {
    const absToPath = path.resolve(toPath);
    nodeFs.swapTmpFile(fromPath, absToPath);
    this.updateOnWrite(absToPath);
  }
  updateOnWrite(absPath) {
    const newSt = nodeFs.stat(absPath);
    this.observedFiles.set(absPath, newSt);
    const parentPath = path.resolve(path.dirname(absPath));
    const observedParent = this.observedDirectories.get(parentPath);
    if (observedParent !== void 0) {
      observedParent.add(path.basename(absPath));
    }
  }
  updateOnDelete(absPath) {
    this.observedFiles.set(absPath, null);
    const parentPath = path.resolve(path.dirname(absPath));
    const observedParent = this.observedDirectories.get(parentPath);
    if (observedParent !== void 0) {
      observedParent.delete(path.basename(absPath));
    }
  }
  registerPath(p, st) {
    const absPath = path.resolve(p);
    this.registerNormalized(absPath, st);
  }
  invalidate() {
    this.invalidated = true;
  }
  registerNormalized(absPath, observed) {
    const existing = this.observedFiles.get(absPath);
    if (existing !== void 0) {
      const stMatch = stMatches(observed, existing);
      if (!stMatch.matches) {
        if (this.traceEvents) {
          console.log(
            "Invalidating due to st mismatch",
            absPath,
            observed,
            existing,
            stMatch.reason
          );
        }
        this.invalidated = true;
      }
    }
    this.observedFiles.set(absPath, observed);
  }
  finalize() {
    if (this.invalidated) {
      return "invalidated";
    }
    return new Observations(this.observedDirectories, this.observedFiles);
  }
}
export class Observations {
  constructor(directories, files) {
    __publicField(this, "directories");
    __publicField(this, "files");
    this.directories = directories;
    this.files = files;
  }
  paths() {
    const out = [];
    for (const path2 of this.directories.keys()) {
      out.push(path2);
    }
    for (const path2 of this.files.keys()) {
      out.push(path2);
    }
    return out;
  }
  overlaps({
    absPath
  }) {
    let currentSt;
    try {
      currentSt = nodeFs.stat(absPath);
    } catch (e) {
      if (e.code === "ENOENT") {
        currentSt = null;
      } else {
        throw e;
      }
    }
    const observedSt = this.files.get(absPath);
    if (observedSt !== void 0) {
      const stMatch = stMatches(observedSt, currentSt);
      if (!stMatch.matches) {
        const reason = `modified (${stMatch.reason})`;
        return { overlaps: true, reason };
      }
    }
    const parentPath = path.resolve(path.dirname(absPath));
    const observedParent = this.directories.get(parentPath);
    if (observedParent !== void 0) {
      const filename = path.basename(absPath);
      if (currentSt === null && observedParent.has(filename)) {
        return { overlaps: true, reason: "deleted" };
      }
      if (currentSt !== null && !observedParent.has(filename)) {
        return { overlaps: true, reason: "added" };
      }
    }
    return { overlaps: false };
  }
}
function setsEqual(a, b) {
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
export function stMatches(a, b) {
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
          reason: `file inode (${a.ino} vs. ${b.ino})`
        };
      }
      if (a.size !== b.size) {
        return {
          matches: false,
          reason: `file size (${a.size} vs. ${b.size})`
        };
      }
      if (a.mtimeMs !== b.mtimeMs) {
        return {
          matches: false,
          reason: `file mtime (${a.mtimeMs} vs. ${b.mtimeMs})`
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
          reason: `dir inode (${a.ino} vs. ${b.ino})`
        };
      }
      return { matches: true };
    }
    if (a.ino !== b.ino) {
      return {
        matches: false,
        reason: `special inode (${a.ino} vs. ${b.ino})`
      };
    }
    return { matches: true };
  }
  return { matches: false, reason: "deleted mismatch" };
}
export function consistentPathSort(a, b) {
  for (let i = 0; i < Math.min(a.name.length, b.name.length); i++) {
    if (a.name.charCodeAt(i) !== b.name.charCodeAt(i)) {
      return a.name.charCodeAt(i) - b.name.charCodeAt(i);
    }
  }
  return a.name.length - b.name.length;
}
//# sourceMappingURL=fs.js.map
