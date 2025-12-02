import { test, expect, describe, beforeEach, afterEach } from "vitest";
import { oneoffContext, Context } from "../../bundler/context.js";
import fs from "fs";
import os from "os";
import path from "path";
import { recursivelyDelete } from "./fsUtils.js";

describe("fsUtils", async () => {
  let tmpDir: string;
  let ctx: Context;

  beforeEach(async () => {
    ctx = await oneoffContext({
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });
    tmpDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
  });

  describe("recursivelyDelete", () => {
    test("deletes file", () => {
      const file = path.join(tmpDir, "file");
      ctx.fs.writeUtf8File(file, "contents");
      expect(ctx.fs.exists(file)).toBe(true);

      recursivelyDelete(ctx, file);
      expect(ctx.fs.exists(file)).toBe(false);
    });

    test("throws an error on non-existent file", () => {
      const nonexistentFile = path.join(tmpDir, "nonexistent_file");
      expect(() => {
        recursivelyDelete(ctx, nonexistentFile);
      }).toThrow("ENOENT: no such file or directory");
    });

    test("does not throw error if `force` is used", () => {
      const nonexistentFile = path.join(tmpDir, "nonexistent_file");
      recursivelyDelete(ctx, nonexistentFile, { force: true });
    });

    test("recursively deletes a directory", () => {
      const dir = path.join(tmpDir, "dir");
      ctx.fs.mkdir(dir);
      const nestedFile = path.join(dir, "nested_file");
      ctx.fs.writeUtf8File(nestedFile, "content");
      const nestedDir = path.join(dir, "nested_dir");
      ctx.fs.mkdir(nestedDir);

      expect(ctx.fs.exists(dir)).toBe(true);

      recursivelyDelete(ctx, dir);
      expect(ctx.fs.exists(dir)).toBe(false);
    });

    test("`recursive` and `force` work together", () => {
      const nonexistentDir = path.join(tmpDir, "nonexistent_dir");
      // Shouldn't throw an exception.
      recursivelyDelete(ctx, nonexistentDir, { force: true });
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
});
