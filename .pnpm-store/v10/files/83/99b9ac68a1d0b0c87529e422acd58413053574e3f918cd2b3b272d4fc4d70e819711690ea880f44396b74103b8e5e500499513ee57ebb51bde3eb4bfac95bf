import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkVersion } from "./updates.js";
import { getVersion } from "./versionApi.js";
import { logMessage } from "../../bundler/log.js";
import { autoUpdateCursorRules } from "./cursorRules.js";

// Mock dependencies
vi.mock("./versionApi.js", () => ({
  getVersion: vi.fn(),
}));

vi.mock("./cursorRules.js", () => ({
  autoUpdateCursorRules: vi.fn(),
}));

vi.mock("../../bundler/log.js", () => ({
  logMessage: vi.fn(),
}));

const mockGetVersion = vi.mocked(getVersion);
const mockLogMessage = vi.mocked(logMessage);
const mockAutoUpdateCursorRules = vi.mocked(autoUpdateCursorRules);

describe("updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("checkVersion", () => {
    it("logs message and updates Cursor rules", async () => {
      mockGetVersion.mockResolvedValue({
        message: "New version available: 1.2.3",
        cursorRulesHash:
          "02e43fc1ff0ee48db8da468f5c7525877d8056fcd56c77d78a166ac447efb91c",
      });

      await checkVersion();

      expect(mockGetVersion).toHaveBeenCalled();
      expect(mockLogMessage).toHaveBeenCalledWith(
        "New version available: 1.2.3",
      );
      expect(mockAutoUpdateCursorRules).toHaveBeenCalledWith(
        "02e43fc1ff0ee48db8da468f5c7525877d8056fcd56c77d78a166ac447efb91c",
      );
    });

    it("does not log when version has no message", async () => {
      mockGetVersion.mockResolvedValue({
        message: null,
        cursorRulesHash:
          "02e43fc1ff0ee48db8da468f5c7525877d8056fcd56c77d78a166ac447efb91c",
      });

      await checkVersion();

      expect(mockGetVersion).toHaveBeenCalled();
      expect(mockLogMessage).not.toHaveBeenCalled();
    });

    it("doesn’t do anything when getVersion returns null", async () => {
      mockGetVersion.mockResolvedValue(null);

      await checkVersion();

      expect(mockGetVersion).toHaveBeenCalled();
      expect(mockLogMessage).not.toHaveBeenCalled();
      expect(mockAutoUpdateCursorRules).not.toHaveBeenCalled();
    });

    it("does not update cursor rules when version has no cursor rules", async () => {
      mockGetVersion.mockResolvedValue({
        message: "New version available: 1.2.3",
        cursorRulesHash: null,
      });

      await checkVersion();
      expect(mockAutoUpdateCursorRules).not.toHaveBeenCalled();
    });
  });
});
