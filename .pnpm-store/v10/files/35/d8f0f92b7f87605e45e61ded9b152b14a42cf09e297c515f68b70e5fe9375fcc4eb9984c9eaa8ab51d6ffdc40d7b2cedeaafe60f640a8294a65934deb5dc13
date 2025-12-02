import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getVersion,
  downloadLatestCursorRules,
  validateVersionResult,
} from "./versionApi.js";

// Mock Sentry
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("versionApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getVersion", () => {
    it("returns version data on successful response", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: "New version available",
          cursorRulesHash: "abc123",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await getVersion();

      expect(result).toEqual({
        message: "New version available",
        cursorRulesHash: "abc123",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://version.convex.dev/v1/version",
        {
          headers: {
            "Convex-Client": expect.stringMatching(/^npm-cli-/),
          },
        },
      );
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await getVersion();

      expect(result).toBeNull();
    });

    it("returns null on non-ok response", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await getVersion();

      expect(result).toBeNull();
    });

    it("returns null on invalid JSON response", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue("invalid json"),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await getVersion();

      expect(result).toBeNull();
    });
  });

  describe("getCursorRules", () => {
    it("returns rules text on successful response", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("# Cursor rules content"),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await downloadLatestCursorRules();

      expect(result).toBe("# Cursor rules content");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://version.convex.dev/v1/cursor_rules",
        {
          headers: {
            "Convex-Client": expect.stringMatching(/^npm-cli-/),
          },
        },
      );
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await downloadLatestCursorRules();

      expect(result).toBeNull();
    });

    it("returns null on non-ok response", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await downloadLatestCursorRules();

      expect(result).toBeNull();
    });
  });

  describe("validateVersionResult", () => {
    it("validates correct version result", () => {
      const validResult = {
        message: "New version available",
        cursorRulesHash: "abc123",
      };

      const result = validateVersionResult(validResult);

      expect(result).toEqual(validResult);
    });

    it("validates result with null message", () => {
      const validResult = {
        message: null,
        cursorRulesHash: "abc123",
      };

      const result = validateVersionResult(validResult);

      expect(result).toEqual(validResult);
    });

    it("validates result with null cursorRulesHash", () => {
      const validResult = {
        message: "New version available",
        cursorRulesHash: null,
      };

      const result = validateVersionResult(validResult);

      expect(result).toEqual(validResult);
    });

    it("returns null for non-object input", () => {
      const result = validateVersionResult("not an object");
      expect(result).toBeNull();
    });

    it("returns null for null input", () => {
      const result = validateVersionResult(null);
      expect(result).toBeNull();
    });

    it("returns null for invalid message type", () => {
      const invalidResult = {
        message: 123, // should be string or null
        cursorRulesHash: "abc123",
      };

      const result = validateVersionResult(invalidResult);
      expect(result).toBeNull();
    });

    it("returns null for invalid cursorRulesHash type", () => {
      const invalidResult = {
        message: "New version available",
        cursorRulesHash: 123, // should be string or null
      };

      const result = validateVersionResult(invalidResult);
      expect(result).toBeNull();
    });
  });
});
