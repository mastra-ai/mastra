import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateEvalReference } from "./eval-baseline-record.mjs";

let reference;
try {
  reference = JSON.parse(
    await readFile(new URL("../evals/initial-reference.json", import.meta.url)),
  );
  validateEvalReference(reference, { initial: true });
} catch (error) {
  console.error(
    `EVAL REFERENCE INVALID: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(2);
}

const directory = await mkdtemp(join(tmpdir(), "support-eval-reference-"));
const candidatePath = join(directory, "candidate.json");
try {
  execFileSync("node", ["scripts/eval-candidate-report.mjs"], {
    stdio: "inherit",
    env: { ...process.env, SUPPORT_EVAL_CANDIDATE_OUTPUT: candidatePath },
  });
  const candidate = validateEvalReference(
    JSON.parse(await readFile(candidatePath, "utf8")),
  );
  for (const identity of ["runner", "runnerSourceHash", "executionMode"]) {
    if (candidate[identity] !== reference[identity])
      throw new Error(
        `candidate ${identity} is incompatible with the fixed reference`,
      );
  }
  if (
    JSON.stringify(candidate.scorerSourceHashes) !==
      JSON.stringify(reference.scorerSourceHashes) ||
    JSON.stringify(candidate.datasetHashes) !==
      JSON.stringify(reference.datasetHashes)
  )
    throw new Error(
      "candidate scorer or dataset identities are incompatible with the fixed reference",
    );
  const floors = {
    groundedness: 0.9,
    "policy-compliance": 0.9,
    "routing-accuracy": 0.9,
    "tool-call-correctness": 0.9,
    "multi-turn-consistency": 0.9,
    "resolution-quality": 0.85,
  };
  for (const [axis, floor] of Object.entries(floors)) {
    const candidateScore = candidate.sixAxisScores[axis];
    const referenceScore = reference.sixAxisScores[axis];
    if (candidateScore < floor || candidateScore < referenceScore - 0.02)
      throw new Error(`candidate failed ${axis} floor or regression limit`);
  }
  for (const item of candidate.perCaseScores)
    if (item.critical && item.score !== 1)
      throw new Error(`critical case failed: ${item.id}`);
} catch (error) {
  console.error(
    `EVAL REFERENCE INVALID: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(2);
} finally {
  await rm(directory, { force: true, recursive: true });
}
