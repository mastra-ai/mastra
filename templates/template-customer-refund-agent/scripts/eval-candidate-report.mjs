import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { reportHash } from "./eval-baseline-record.mjs";
import { distributableFingerprint } from "./distributable-snapshot.mjs";

const directory = await mkdtemp(join(tmpdir(), "support-eval-report-"));
const reportPath = join(directory, "native-report.json");
try {
  execFileSync(
    "npx",
    [
      "vitest",
      "run",
      "test/eval/phase004-native-execution.eval.test.ts",
      "test/eval/supervisor-read-only.eval.test.ts",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        SUPPORT_EVAL_REPORT_PATH: reportPath,
        SUPPORT_KNOWLEDGE_RETRIEVAL: "",
        OPENAI_API_KEY: "",
        OPENAI_BASE_URL: "",
      },
    },
  );
  const execution = JSON.parse(await readFile(reportPath, "utf8"));
  // Identify the evaluated files, including uncommitted changes and copies
  // extracted from a monorepo, without requiring repository metadata.
  const implementationSha = await distributableFingerprint(
    resolve(import.meta.dirname, ".."),
  );
  const report = {
    kind: "support-eval-candidate",
    runner: execution.runner,
    executionMode: execution.executionMode,
    implementationSha,
    implementationIdentityKind: "distributable-content-sha256",
    ...execution,
    regression: "compare-against-fixed-initial-reference",
  };
  report.reportHash = reportHash(report);
  if (process.env.SUPPORT_EVAL_CANDIDATE_OUTPUT)
    await writeFile(
      process.env.SUPPORT_EVAL_CANDIDATE_OUTPUT,
      JSON.stringify(report),
    );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(directory, { force: true, recursive: true });
}
