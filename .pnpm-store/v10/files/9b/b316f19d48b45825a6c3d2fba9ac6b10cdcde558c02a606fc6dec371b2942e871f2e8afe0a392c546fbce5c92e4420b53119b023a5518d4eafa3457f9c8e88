import { test, describe, expect } from "vitest";
import { validateDeploymentUrl } from "./index.js";

describe("validateDeploymentUrl", () => {
  test("localhost is valid", () => {
    validateDeploymentUrl("http://127.0.0.1:8000");
    validateDeploymentUrl("http://localhost:8000");
    validateDeploymentUrl("http://0.0.0.0:8000");
  });
  test("real URLs are valid", () => {
    validateDeploymentUrl("https://small-mouse-123.convex.cloud");
  });

  test("vanity domain works", () => {
    validateDeploymentUrl("https://tshirts.com");
  });

  test("wrong protocol throws", () => {
    expect(() =>
      validateDeploymentUrl("ws://small-mouse-123.convex.cloud"),
    ).toThrow("Invalid deployment address");
  });

  test("invalid url throws", () => {
    expect(() => validateDeploymentUrl("https://:small-mouse-123:")).toThrow(
      "Invalid deployment address",
    );
  });

  test(".convex.site domain throws", () => {
    expect(() =>
      validateDeploymentUrl("https://small-mouse-123.convex.site"),
    ).toThrow("Invalid deployment address");
  });
});
