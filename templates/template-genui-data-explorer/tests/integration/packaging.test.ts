import { extractionFingerprint } from "../../scripts/standalone-files.ts";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { z } from "zod";
import { expect, it } from "vitest";

async function extraction() {
  try {
    const fixture = z
      .object({ directory: z.string(), fingerprint: z.string() })
      .parse(JSON.parse(await readFile(".data/standalone.json", "utf8")));
    const current = await extractionFingerprint(process.cwd());
    if (
      current !== fixture.fingerprint ||
      (await extractionFingerprint(fixture.directory)) !== current
    )
      throw new Error(
        "Stale standalone extraction. Refresh preparation before running check-only quality tests.",
      );
    return fixture.directory;
  } catch {
    throw new Error(
      "Prepare the independent fixture with npm run standalone:prepare before test:quality. This check-only runner never installs dependencies.",
    );
  }
}
async function run(directory: string, args: string[]) {
  return new Promise<{ code: number | null; output: string }>((complete, reject) => {
    const child = spawn("npm", args, {
      cwd: directory,
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
        NEXT_TELEMETRY_DISABLED: "1",
        COPILOTKIT_TELEMETRY_DISABLED: "true",
        npm_config_workspaces: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => complete({ code, output }));
  });
}
it("standalone_npm_checks_use_mastra_vitest_and_oxfmt", async () => {
  const directory = await extraction();
  expect(resolve(directory).startsWith(resolve(process.cwd(), ".."))).toBe(false);
  for (const script of ["typecheck", "test:unit", "test:integration", "format:check", "build"]) {
    const result = await run(directory, ["run", script]);
    expect(result.code, `${script}: ${result.output.slice(-3000)}`).toBe(0);
  }
  const assertions = await run(directory, [
    "exec",
    "--",
    "vitest",
    "run",
    "--config",
    "tests/failing-eval.config.ts",
  ]);
  expect(assertions.code).not.toBe(0);
  expect(assertions.output).toContain("Eval did not pass");
  expect(assertions.output).toContain("exact-money");
  expect(assertions.output).not.toContain("No test files found");
  const manifest = z
    .object({
      packages: z.record(z.string(), z.object({ resolved: z.string().optional() }).passthrough()),
    })
    .parse(JSON.parse(await readFile(join(directory, "package-lock.json"), "utf8")));
  expect(
    Object.values(manifest.packages).every(
      (item) => !item.resolved?.startsWith("file:") && !item.resolved?.includes("mastra-upstream"),
    ),
  ).toBe(true);
});
it("standalone_template_runs_grounded_workspace", async () => {
  await extraction();
  const result = await run(process.cwd(), ["run", "test:standalone:browser"]);
  expect(result.code, result.output.slice(-5000)).toBe(0);
});
