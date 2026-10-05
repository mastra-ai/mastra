import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeConfiguration } from "../src/mastra/configuration.ts";
import { prepareSource, sources } from "./sources.ts";

// The native bundler imports its entry to inspect configuration. Give that import
// disposable stores so a cold build neither needs nor changes application data.
const directory = await mkdtemp(join(tmpdir(), "genui-build-"));
try {
  await prepareSource(sources, runtimeConfiguration().sourceId, {
    path: join(directory, "sales.sqlite"),
  });
  process.exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/mastra/dist/index.js", "build", "--dir", "src/mastra"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          OPENAI_API_KEY: "",
          TEMPLATE_DIRECTORY: process.cwd(),
          DATA_DIRECTORY: directory,
          MASTRA_BUILD_SKIP_INSTALL: "1",
          MASTRA_TELEMETRY_DISABLED: "true",
        },
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
