import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { supportsNode, supportsNpm } from "../../scripts/runtime-range.mjs";

const execFileAsync = promisify(execFile);
const runtimeCheck = new URL("../../scripts/check-runtime.mjs", import.meta.url)
  .pathname;

describe("runtime gate", () => {
  it("accepts each supported Node and npm boundary", () => {
    for (const version of ["v22.22.0", "v22.99.99", "v24.15.0", "v25.0.0"])
      expect(supportsNode(version)).toBe(true);
    for (const version of ["v22.21.9", "v23.0.0", "v24.14.9", "not-a-version"])
      expect(supportsNode(version)).toBe(false);
    expect(supportsNpm("10.9.0")).toBe(true);
    expect(supportsNpm("10.8.9")).toBe(false);
  });

  it("accepts a supported npm and Node.js runtime", async () => {
    await expect(
      execFileAsync(process.execPath, [runtimeCheck], {
        env: {
          ...process.env,
          npm_config_user_agent: "npm/10.9.0 node/v24.15.0 darwin arm64",
        },
      }),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining("Runtime verified"),
    });
  });

  it("fails when npm reports a version below the supported range", async () => {
    await expect(
      execFileAsync(process.execPath, [runtimeCheck], {
        env: {
          ...process.env,
          npm_config_user_agent: "npm/10.8.0 node/v24.15.0 darwin arm64",
        },
      }),
    ).rejects.toThrow("Expected npm >=10.9.0");
  });
});
