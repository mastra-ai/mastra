import { test, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { nodeFs } from "./fs.js";

test("nodeFs filesystem operations behave as expected", async () => {
  const tmpdir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
  try {
    const parentDirPath = path.join(tmpdir, "testdir");
    const dirPath = path.join(parentDirPath, "nestedDir");
    const filePath = path.join(dirPath, "text.txt");

    // Test making and listing directories.
    try {
      nodeFs.mkdir(dirPath);
      throw new Error(
        "Expected `mkdir` to fail because the containing directory doesn't exist yet.",
      );
    } catch (e: any) {
      expect(e.code).toEqual("ENOENT");
    }

    nodeFs.mkdir(parentDirPath);
    nodeFs.mkdir(dirPath);
    try {
      nodeFs.mkdir(dirPath);
      throw new Error("Expected `mkdir` to fail without allowExisting");
    } catch (e: any) {
      expect(e.code).toEqual("EEXIST");
    }
    nodeFs.mkdir(dirPath, { allowExisting: true });

    const dirEntries = nodeFs.listDir(parentDirPath);
    expect(dirEntries).toHaveLength(1);
    expect(dirEntries[0].name).toEqual("nestedDir");

    const nestedEntries = nodeFs.listDir(dirPath);
    expect(nestedEntries).toHaveLength(0);

    // Test file based methods for nonexistent paths.
    expect(nodeFs.exists(filePath)).toEqual(false);
    try {
      nodeFs.stat(filePath);
      throw new Error("Expected `stat` to fail for nonexistent paths");
    } catch (e: any) {
      expect(e.code).toEqual("ENOENT");
    }
    try {
      nodeFs.readUtf8File(filePath);
      throw new Error("Expected `readUtf8File` to fail for nonexistent paths");
    } catch (e: any) {
      expect(e.code).toEqual("ENOENT");
    }
    try {
      nodeFs.access(filePath);
      throw new Error("Expected `access` to fail for nonexistent paths");
    } catch (e: any) {
      expect(e.code).toEqual("ENOENT");
    }

    // Test creating a file and accessing it.
    const message = "it's trompo o'clock";
    nodeFs.writeUtf8File(filePath, message);
    expect(nodeFs.exists(filePath)).toEqual(true);
    nodeFs.stat(filePath);
    expect(nodeFs.readUtf8File(filePath)).toEqual(message);
    nodeFs.access(filePath);

    // Test unlinking a file and directory.
    try {
      nodeFs.unlink(dirPath);
      throw new Error("Expected `unlink` to fail on a directory");
    } catch (e: any) {
      if (os.platform() === "linux") {
        expect(e.code).toEqual("EISDIR");
      } else {
        expect(e.code).toEqual("EPERM");
      }
    }
    nodeFs.unlink(filePath);
    expect(nodeFs.exists(filePath)).toEqual(false);
  } finally {
    fs.rmSync(tmpdir, { recursive: true });
  }
});
