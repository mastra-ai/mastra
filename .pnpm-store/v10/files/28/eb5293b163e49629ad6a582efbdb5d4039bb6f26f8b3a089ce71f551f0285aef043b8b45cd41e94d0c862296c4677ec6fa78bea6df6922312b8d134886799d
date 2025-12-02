import * as Sentry from "@sentry/node";
import { downloadLatestCursorRules } from "./versionApi.js";
import { logMessage } from "../../bundler/log.js";
import { hashSha256 } from "./utils/hash.js";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { autoUpdateCursorRules } from "./cursorRules.js";
import { promises as fs } from "fs";
import path from "path";

// Mock dependencies
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
}));

vi.mock("./versionApi.js", () => ({
  downloadLatestCursorRules: vi.fn(),
}));

vi.mock("../../bundler/log.js", () => ({
  logMessage: vi.fn(),
}));

vi.mock("./utils/hash.js", () => ({
  hashSha256: vi.fn(),
}));

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

const mockGetCursorRules = vi.mocked(downloadLatestCursorRules);
const mockLogMessage = vi.mocked(logMessage);
const mockHashSha256 = vi.mocked(hashSha256);
const mockCaptureException = vi.mocked(Sentry.captureException);
const mockFs = vi.mocked(fs);

describe("cursorRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("autoUpdateCursorRules", () => {
    test("does nothing when expectedRulesHash is null", async () => {
      await autoUpdateCursorRules(null);

      expect(mockFs.readFile).not.toHaveBeenCalled();
      expect(mockGetCursorRules).not.toHaveBeenCalled();
    });

    test("does nothing when current rules hash is null", async () => {
      mockFs.readFile.mockImplementation(() => {
        throw new Error("File not found");
      });

      await autoUpdateCursorRules("expected-hash");

      expect(mockGetCursorRules).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
    });

    test("does nothing when hashes match", async () => {
      mockFs.readFile.mockResolvedValue("current rules content");
      mockHashSha256.mockReturnValue("expected-hash");

      await autoUpdateCursorRules("expected-hash");

      expect(mockGetCursorRules).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    test("updates rules when hashes don't match", async () => {
      mockFs.readFile.mockResolvedValue("current rules content");
      mockHashSha256.mockReturnValue("current-hash");
      mockGetCursorRules.mockResolvedValue("new rules content");

      await autoUpdateCursorRules("expected-hash");

      expect(mockGetCursorRules).toHaveBeenCalled();

      const rulesLocation = path.join(
        process.cwd(),
        ".cursor/rules/convex_rules.mdc",
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        rulesLocation,
        "new rules content",
        "utf8",
      );
    });

    test("does nothing when getCursorRules returns null", async () => {
      mockFs.readFile.mockResolvedValue("current rules content");
      mockHashSha256.mockReturnValue("current-hash");
      mockGetCursorRules.mockResolvedValue(null);

      await autoUpdateCursorRules("expected-hash");

      expect(mockFs.writeFile).not.toHaveBeenCalled();
      expect(mockLogMessage).not.toHaveBeenCalled();
    });

    test("handles file system errors during update", async () => {
      mockFs.readFile.mockResolvedValue("current rules content");
      mockHashSha256.mockReturnValue("current-hash");
      mockGetCursorRules.mockResolvedValue("new rules content");
      mockFs.writeFile.mockImplementation(() => {
        throw new Error("Write error");
      });

      await autoUpdateCursorRules("expected-hash");

      expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
      expect(mockLogMessage).not.toHaveBeenCalled();
    });
  });
});
