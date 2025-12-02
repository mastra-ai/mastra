import { describe, test, expect } from "vitest";
import { hashSha256 } from "./hash.js";

describe("hashSha256", () => {
  test("hashes empty string", () => {
    const result = hashSha256("");
    expect(result).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  test("hashes simple string", () => {
    const result = hashSha256("hello world");
    expect(result).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  test("hashes unicode string", () => {
    const result = hashSha256("hello 🌍 world");
    expect(result).toBe(
      "d234e59bf292eb39b3c8ba2ee06c21b50c9040530b577e5bf53f028099b37f54",
    );
  });
});
