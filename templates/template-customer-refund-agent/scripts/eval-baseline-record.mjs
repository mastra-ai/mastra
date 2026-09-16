import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import {
  evaluateDatasetAssertions,
  scorerInputFromObservation,
  scoreAxis,
  truthForDatasetCase,
} from "../test/eval/support/deterministic-semantics.js";

export const REQUIRED_AXES = [
  "groundedness",
  "policy-compliance",
  "routing-accuracy",
  "tool-call-correctness",
  "multi-turn-consistency",
  "resolution-quality",
];

const requiredReportFields = [
  "kind",
  "runner",
  "runnerSourceHash",
  "scorerSourceHashes",
  "executionMode",
  "implementationSha",
  "datasetHashes",
  "perCaseScores",
  "sixAxisScores",
  "costMicros",
  "evidenceHash",
  "regression",
];
const sha256 = /^[0-9a-f]{64}$/;
const floors = {
  groundedness: 0.9,
  "policy-compliance": 0.9,
  "routing-accuracy": 0.9,
  "tool-call-correctness": 0.9,
  "multi-turn-consistency": 0.9,
  "resolution-quality": 0.85,
};
const scorerMapping = JSON.parse(
  readFileSync(new URL("../evals/scorer-mapping.json", import.meta.url)),
);

function expectedDatasetCases() {
  const directory = new URL("../evals/datasets/", import.meta.url);
  const expected = new Map();
  const hashes = {};
  for (const file of readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .sort()) {
    const raw = readFileSync(new URL(file, directory));
    const dataset = JSON.parse(raw);
    hashes[file] = createHash("sha256").update(raw).digest("hex");
    for (const item of dataset.cases ?? []) {
      if (expected.has(item.id))
        throw new Error("eval datasets contain duplicate case identifiers");
      expected.set(item.id, {
        id: item.id,
        axis: dataset.axis,
        critical: item.critical,
        assertions: item.assertions,
      });
    }
  }
  return { expected, hashes };
}

export function reportPayload(record) {
  const payload = { ...record };
  delete payload.reportHash;
  // Review metadata is not measurement evidence. Initial references must not
  // claim a human approval that never happened.
  delete payload.approval;
  return payload;
}

export function reportHash(record) {
  return createHash("sha256")
    .update(JSON.stringify(reportPayload(record)))
    .digest("hex");
}

function validScore(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The report is deliberately not a bag of prose.  These are the runtime
 * observations emitted by phase004-native-execution: each axis has a
 * different independently useful fact, so a rehashed placeholder cannot
 * masquerade as a measurement.
 */
function validExecutionSummary(axis, summary, expectedCase, measuredScore) {
  if (
    !plainObject(summary) ||
    summary.schemaVersion !== 1 ||
    summary.caseId !== expectedCase.id ||
    summary.scorerId !== scorerMapping[axis]?.scorerId ||
    !validScore(summary.score) ||
    summary.score !== measuredScore ||
    !plainObject(summary.modelOutputs)
  )
    return false;
  if (!plainObject(summary.assertions) || !plainObject(expectedCase.assertions))
    return false;
  const optionalRecord = (value) => value === undefined || plainObject(value);
  const optionalStrings = (value) =>
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"));
  const optionalRecords = (value) =>
    value === undefined ||
    (Array.isArray(value) && value.every((item) => plainObject(item)));
  if (
    !optionalRecord(summary.workflow) ||
    !optionalRecord(summary.authorization) ||
    !optionalRecord(summary.financial) ||
    !optionalRecord(summary.refundEffects) ||
    !optionalRecord(summary.order) ||
    !optionalRecord(summary.modelOutputs.triage) ||
    !optionalRecord(summary.modelOutputs.draft) ||
    !optionalStrings(summary.modelOutputs.answers) ||
    !optionalRecords(summary.modelOutputs.turns)
  )
    return false;
  if (!Array.isArray(summary.toolCalls)) return false;
  const toolCalls = summary.toolCalls;
  const validCall = (call) =>
    plainObject(call) &&
    nonEmptyString(call.name) &&
    plainObject(call.input) &&
    Object.hasOwn(call, "result") &&
    plainObject(call.result) &&
    typeof call.rawResultHash === "string" &&
    sha256.test(call.rawResultHash) &&
    call.rawResultHash ===
      createHash("sha256").update(JSON.stringify(call.result)).digest("hex") &&
    typeof call.sequence === "number" &&
    Number.isInteger(call.sequence) &&
    call.sequence > 0 &&
    typeof call.turn === "number" &&
    Number.isInteger(call.turn) &&
    call.turn > 0;
  if (!toolCalls.every(validCall)) return false;
  try {
    const observation = {
      triage: summary.modelOutputs.triage,
      draft: summary.modelOutputs.draft,
      calls: toolCalls,
      workflow: summary.workflow,
      authorization: summary.authorization,
      financial: summary.financial,
      historyEstablished: summary.historyEstablished,
      refundEffects: summary.refundEffects,
      order: summary.order,
      answers: summary.modelOutputs.answers,
      turns: summary.modelOutputs.turns,
    };
    const recomputedAssertions = evaluateDatasetAssertions(
      expectedCase.assertions,
      observation,
      expectedCase.id,
    );
    if (
      JSON.stringify(summary.assertions) !==
        JSON.stringify(recomputedAssertions) ||
      !Object.values(recomputedAssertions).every((value) => value === true)
    )
      return false;
    const recomputedScore = scoreAxis(
      axis,
      scorerInputFromObservation(axis, observation),
      truthForDatasetCase(axis, expectedCase.assertions, expectedCase.id),
    );
    return (
      recomputedScore === summary.score && recomputedScore === measuredScore
    );
  } catch {
    return false;
  }
}

function aggregateEvidenceHash(perCaseScores) {
  return createHash("sha256")
    .update(JSON.stringify(perCaseScores))
    .digest("hex");
}

/** Validates measurement evidence, not a claimed human approval. */
export function validateEvalReference(reference, { initial = false } = {}) {
  if (!plainObject(reference))
    throw new Error("eval reference is not an object");
  if (!requiredReportFields.every((field) => reference[field] !== undefined))
    throw new Error(
      "eval reference lacks measured report provenance or scores",
    );
  if (
    typeof reference.reportHash !== "string" ||
    reference.reportHash !== reportHash(reference)
  )
    throw new Error("eval reference hash does not match its report content");
  if (
    typeof reference.implementationSha !== "string" ||
    !/^[0-9a-f]{7,64}$/.test(reference.implementationSha)
  )
    throw new Error("eval reference implementation SHA is malformed");
  if (
    typeof reference.runner !== "string" ||
    !reference.runner ||
    !sha256.test(reference.runnerSourceHash)
  )
    throw new Error("eval reference runner provenance is malformed");
  if (
    !plainObject(reference.scorerSourceHashes) ||
    !Object.values(reference.scorerSourceHashes).every(
      (value) => typeof value === "string" && sha256.test(value),
    )
  )
    throw new Error("eval reference scorer provenance is malformed");
  if (
    !plainObject(reference.datasetHashes) ||
    Object.keys(reference.datasetHashes).length !== REQUIRED_AXES.length ||
    !Object.values(reference.datasetHashes).every(
      (value) => typeof value === "string" && sha256.test(value),
    )
  )
    throw new Error("eval reference dataset identities are malformed");
  if (
    !plainObject(reference.sixAxisScores) ||
    REQUIRED_AXES.some((axis) => !validScore(reference.sixAxisScores[axis]))
  )
    throw new Error(
      "eval reference does not contain all six finite axis scores",
    );
  if (
    !Array.isArray(reference.perCaseScores) ||
    reference.perCaseScores.length === 0
  )
    throw new Error("eval reference has no execution cases");
  const { expected, hashes } = expectedDatasetCases();
  if (JSON.stringify(reference.datasetHashes) !== JSON.stringify(hashes))
    throw new Error(
      "eval reference dataset hashes do not match the versioned datasets",
    );
  const ids = new Set();
  const totals = Object.fromEntries(
    REQUIRED_AXES.map((axis) => [axis, { sum: 0, count: 0 }]),
  );
  for (const item of reference.perCaseScores) {
    if (
      !plainObject(item) ||
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      !REQUIRED_AXES.includes(item.axis) ||
      typeof item.critical !== "boolean" ||
      !validScore(item.score) ||
      !plainObject(item.evidence) ||
      !sha256.test(item.evidence.evidenceHash) ||
      item.evidence.evidenceHash !==
        createHash("sha256")
          .update(JSON.stringify(item.evidence.summary))
          .digest("hex")
    )
      throw new Error(
        `eval reference contains invalid, duplicate, or unevidenced case data: ${item.id}`,
      );
    const expectedCase = expected.get(item.id);
    if (
      !expectedCase ||
      expectedCase.axis !== item.axis ||
      expectedCase.critical !== item.critical
    )
      throw new Error(
        "eval reference case identity, axis, or critical coverage is inconsistent with the dataset",
      );
    if (
      !validExecutionSummary(
        item.axis,
        item.evidence.summary,
        expectedCase,
        item.score,
      )
    )
      throw new Error(
        `eval reference contains invalid, duplicate, or unevidenced case data: ${item.id}`,
      );
    if (item.critical && item.score !== 1)
      throw new Error(
        "eval reference contains an invalid or failed critical case",
      );
    ids.add(item.id);
    totals[item.axis].sum += item.score;
    totals[item.axis].count += 1;
  }
  if (
    ids.size !== expected.size ||
    [...expected.keys()].some((id) => !ids.has(id))
  )
    throw new Error(
      "eval reference does not cover every versioned dataset case exactly once",
    );
  for (const axis of REQUIRED_AXES) {
    const actual = totals[axis].count
      ? totals[axis].sum / totals[axis].count
      : Number.NaN;
    if (Math.abs(actual - reference.sixAxisScores[axis]) > Number.EPSILON)
      throw new Error(
        "eval reference axis aggregates do not match per-case measurements",
      );
    if (actual < floors[axis])
      throw new Error(`eval reference failed ${axis} threshold`);
  }
  if (
    !Number.isFinite(reference.costMicros) ||
    reference.costMicros < 0 ||
    !sha256.test(reference.evidenceHash) ||
    reference.evidenceHash !== aggregateEvidenceHash(reference.perCaseScores)
  )
    throw new Error("eval reference usage or execution evidence is malformed");
  if (
    reference.executionMode ===
      "deterministic-scripted-transport-no-paid-routes" &&
    (reference.costMicros !== 0 ||
      reference.pricing !== "not-applicable-deterministic-transport")
  )
    throw new Error("deterministic eval reference must record zero paid usage");
  if (
    initial &&
    (reference.kind !== "support-eval-initial-reference" ||
      reference.initialReference !== true ||
      reference.historicalComparison !== null)
  )
    throw new Error(
      "eval reference is not an explicitly labeled initial reference",
    );
  return reference;
}

// Compatibility name only; it no longer adds a fabricated approval barrier.
export const validateApprovedBaseline = validateEvalReference;
