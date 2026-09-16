/**
 * The deterministic Phase 004 evidence contract.  This module deliberately
 * owns both the dataset assertion meanings and registered scorer formulas so
 * an immutable report can be replayed without trusting its claimed flags.
 */
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

const EXPECTED_ORDER_ID = "ORD-1001";
const EXPECTED_ORDER = deepFreeze({
  orderId: EXPECTED_ORDER_ID,
  customerEmail: "alex@example.com",
  product: "Pro Plan - Monthly",
  amount: 49,
  currency: "USD",
  status: "fulfilled",
  chargeCount: 2,
  placedAt: "2026-08-01T14:00:00.000Z",
});
const EXPECTED_ORDER_STATUS = EXPECTED_ORDER.status;
const EXPECTED_CUSTOMER_EMAIL = EXPECTED_ORDER.customerEmail;
const EXPECTED_QUERY = "duplicate charge policy";
// This instant is a fixture authority for the deterministic measurement, not
// the wall clock of the machine replaying an immutable report.
const DETERMINISTIC_MEASUREMENT_AT = "2026-08-01T14:00:01.000Z";
const EXPECTED_KNOWLEDGE_EVIDENCE = {
  title: "Duplicate Charge Policy",
  source: "duplicate-charge-policy",
  text: `# Duplicate Charge Policy

Duplicate charges happen when a payment retries due to a network error, or when a customer accidentally submits an order twice.

- If a customer's order or subscription shows more than one charge for the same billing period, the duplicate charge is eligible for a **full refund of the extra charge only**. The original charge is never refunded as part of a duplicate-charge claim.
- Always confirm the charge count on the order/subscription record before recommending a refund - do not take the customer's word for the number of charges without checking.
- Duplicate-charge refunds do not require the customer to return anything, since no extra product/service was fulfilled.
- These refunds are considered clear-cut and eligible for standard approval (not automatic execution - a human must still approve every refund).`,
  version: "local-v1",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  // This is a fixed fixture authority, not a value learned from a tool call
  // or an expected value carried in a replay report.
  providerKind: "local",
};
EXPECTED_KNOWLEDGE_EVIDENCE.documentHash = createHash("sha256")
  .update(
    JSON.stringify([
      EXPECTED_KNOWLEDGE_EVIDENCE.source,
      EXPECTED_KNOWLEDGE_EVIDENCE.version,
      EXPECTED_KNOWLEDGE_EVIDENCE.text,
    ]),
  )
  .digest("hex");
deepFreeze(EXPECTED_KNOWLEDGE_EVIDENCE);
const EXPECTED_CALL_ORDER = deepFreeze([
  "search_support_knowledge",
  "lookup_order",
  "search_support_knowledge",
  "lookup_order",
]);
const EXPECTED_TRUSTED_BINDING = deepFreeze({
  tenantId: "local-demo",
  providerKind: "local",
  providerAccountId: "phase004-eval-authority-registered-scorer-fixture",
  externalConversationId:
    "phase004-eval-conversation-registered-scorer-fixture",
});
const EXPECTED_INPUT_KEYS = deepFreeze({
  search_support_knowledge: ["binding", "queryText", "topK"],
  lookup_order: ["binding", "customerEmail", "orderId"],
});
const EXPECTED_ESCALATION_RESPONSE =
  "Thanks for your patience. A support specialist needs to review the available information and will follow up shortly.";
const SHA256 = /^[a-f0-9]{64}$/;
const ORDER_KEYS = deepFreeze(Object.keys(EXPECTED_ORDER).sort());

function canonicalInstant(value) {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export const SUPPORTED_AXES = [
  "groundedness",
  "policy-compliance",
  "routing-accuracy",
  "tool-call-correctness",
  "multi-turn-consistency",
  "resolution-quality",
];

const INVALID_JSON_SNAPSHOT = Symbol("invalid-json-snapshot");
const propertySegment = (key) => ({ kind: "property", key });
const arrayIndexSegment = (index) => ({ kind: "array-index", index });

function ordinaryDataDescriptor(descriptor) {
  return (
    descriptor !== undefined &&
    Object.hasOwn(descriptor, "value") &&
    !Object.hasOwn(descriptor, "get") &&
    !Object.hasOwn(descriptor, "set") &&
    descriptor.enumerable === true &&
    descriptor.configurable === true &&
    descriptor.writable === true
  );
}

/**
 * Copy untrusted values once into immutable JSON data before evaluating them.
 * Reflect descriptors let us reject accessors without invoking them, and the
 * Node proxy check happens before any reflective operation can trigger a trap.
 */
function canonicalJsonSnapshot(
  value,
  ancestors = new WeakSet(),
  allowsUndefined = () => false,
  path = [],
) {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  if (typeof value !== "object" || utilTypes.isProxy(value))
    return INVALID_JSON_SNAPSHOT;
  if (ancestors.has(value)) return INVALID_JSON_SNAPSHOT;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      // Check this before asking an array for its length, keys, or
      // descriptors. Array.isArray accepts arrays with a replaced prototype.
      if (Object.getPrototypeOf(value) !== Array.prototype)
        return INVALID_JSON_SNAPSHOT;
      const keys = Reflect.ownKeys(value);
      const length = value.length;
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (
        !Number.isSafeInteger(length) ||
        !lengthDescriptor ||
        lengthDescriptor.value !== length ||
        lengthDescriptor.enumerable !== false ||
        lengthDescriptor.configurable !== false ||
        lengthDescriptor.writable !== true ||
        keys.length !== length + 1
      )
        return INVALID_JSON_SNAPSHOT;
      const snapshot = [];
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        if (!keys.includes(key)) return INVALID_JSON_SNAPSHOT;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!ordinaryDataDescriptor(descriptor)) return INVALID_JSON_SNAPSHOT;
        const entry = canonicalJsonSnapshot(
          descriptor.value,
          ancestors,
          allowsUndefined,
          [...path, arrayIndexSegment(index)],
        );
        if (entry === INVALID_JSON_SNAPSHOT) return INVALID_JSON_SNAPSHOT;
        snapshot.push(entry);
      }
      return deepFreeze(snapshot);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      return INVALID_JSON_SNAPSHOT;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string"))
      return INVALID_JSON_SNAPSHOT;
    const snapshot = Object.create(prototype);
    for (const key of keys.sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!ordinaryDataDescriptor(descriptor)) return INVALID_JSON_SNAPSHOT;
      if (descriptor.value === undefined && allowsUndefined(path, key))
        continue;
      const entry = canonicalJsonSnapshot(
        descriptor.value,
        ancestors,
        allowsUndefined,
        [...path, propertySegment(key)],
      );
      if (entry === INVALID_JSON_SNAPSHOT) return INVALID_JSON_SNAPSHOT;
      Object.defineProperty(snapshot, key, {
        value: entry,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return deepFreeze(snapshot);
  } catch {
    return INVALID_JSON_SNAPSHOT;
  } finally {
    ancestors.delete(value);
  }
}

function canonicalJsonRecord(value, allowsUndefined) {
  const snapshot = canonicalJsonSnapshot(value, new WeakSet(), allowsUndefined);
  return isPlainJsonRecord(snapshot) ? snapshot : null;
}

/** A registered scorer boundary never exposes the original evidence. */
export function canonicalScorerRecord(value) {
  const snapshot = canonicalJsonRecord(value);
  // The frozen authority remains private. Registered scorer steps receive an
  // independent ordinary JSON copy that can safely cross Mastra's boundary.
  return snapshot ? structuredClone(snapshot) : null;
}

/**
 * Evidence is a JSON contract, not a convenient object-like value. Direct
 * scorer and reference-validator callers can preserve prototypes, unlike a
 * JSON file parse, so class instances and inherited authority are rejected.
 * Null-prototype records remain valid JSON records and are intentionally kept.
 */
export function isPlainJsonRecord(value) {
  if (!value || typeof value !== "object" || utilTypes.isProxy(value))
    return false;
  if (Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function plainRecord(value) {
  return isPlainJsonRecord(value) ? value : {};
}

function definedRecord(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

const OPTIONAL_OBSERVATION_KEYS = new Set([
  "answers",
  "authorization",
  "calls",
  "draft",
  "financial",
  "historyEstablished",
  "order",
  "refundEffects",
  "toolCalls",
  "triage",
  "turns",
  "workflow",
]);

/** Native tool schemas express `expiresAt` as optional, while JSON represents
 * an absent optional value by omitting the key rather than assigning undefined.
 * This narrowly admits only native optional fields while copying descriptors.
 */
function hasPropertySegment(segment, key) {
  return segment?.kind === "property" && segment.key === key;
}

function hasArrayIndexSegment(segment) {
  return (
    segment?.kind === "array-index" &&
    Number.isSafeInteger(segment.index) &&
    segment.index >= 0
  );
}

function observationAllowsUndefined(path, key) {
  if (path.length === 0) return OPTIONAL_OBSERVATION_KEYS.has(key);
  return (
    key === "expiresAt" &&
    path.length === 6 &&
    (hasPropertySegment(path[0], "calls") ||
      hasPropertySegment(path[0], "toolCalls")) &&
    hasArrayIndexSegment(path[1]) &&
    hasPropertySegment(path[2], "result") &&
    hasPropertySegment(path[3], "sources") &&
    hasArrayIndexSegment(path[4]) &&
    hasPropertySegment(path[5], "metadata")
  );
}

function scorerCallsFromObservation(value) {
  // `value` is always selected from the canonical observation above. Do not
  // normalize raw calls here: spreading or reading a hostile call would invoke
  // its getters before the descriptor-safe snapshot rejects it.
  return Array.isArray(value) ? value : [];
}

/**
 * Eval evidence is untrusted when it is replayed from a reference. Never
 * filter malformed entries before applying a universal condition: doing so
 * would let a malformed call, source, answer, or turn disappear from the
 * measurement. `null` means the entire collection is invalid.
 */
function strictRecords(value) {
  if (!Array.isArray(value)) return null;
  const result = [];
  for (const item of value) {
    if (!isPlainJsonRecord(item)) return null;
    result.push(item);
  }
  return result;
}

function strictStrings(value) {
  if (!Array.isArray(value)) return null;
  const result = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    result.push(item);
  }
  return result;
}

function matchingOrder(value) {
  const order = plainRecord(value);
  const orderValue = plainRecord(order.order);
  return (
    exactKeys(order, ["found", "order"]) &&
    order.found === true &&
    exactKeys(orderValue, ORDER_KEYS) &&
    canonicalInstant(orderValue.placedAt) &&
    Date.parse(orderValue.placedAt) <=
      Date.parse(DETERMINISTIC_MEASUREMENT_AT) &&
    Object.entries(EXPECTED_ORDER).every(
      ([key, expected]) => orderValue[key] === expected,
    )
  );
}

/**
 * Own the complete local trajectory fixture here, rather than learning it
 * from an observation or accepting an expected object carried by a report.
 * The UUID-like generation ID is deterministic per versioned dataset case so
 * independently seeded local accounts cannot collide while each replay has a
 * stable authority to compare against.
 */
export function trajectoryAuthorityForDatasetCase(caseId) {
  const identity = String(caseId);
  const digest = createHash("sha256").update(identity).digest("hex");
  const generationId = `knowledge_${digest.slice(0, 8)}-${digest.slice(
    8,
    12,
  )}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return {
    generationId,
    effectiveAt: EXPECTED_KNOWLEDGE_EVIDENCE.effectiveAt,
    indexedAt: "2026-01-01T00:00:01.000Z",
    measurementAt: DETERMINISTIC_MEASUREMENT_AT,
    ...(identity === "registered-scorer-fixture-future-expiry"
      ? { expiresAt: "2026-08-01T14:00:02.000Z" }
      : {}),
  };
}

function acceptableKnowledgeEvidence(value, expected, binding, authority) {
  const result = plainRecord(value);
  if (!exactKeys(result, ["sources"])) return null;
  const sources = strictRecords(result.sources);
  // Deterministic native evaluation asks for topK=1. Its evidence contract is
  // exactly one complete authoritative source, not "one good source among
  // arbitrary extras". The fixture truth below is owned by this runner, never
  // by a report's expected fields.
  if (!sources || sources.length !== 1) return null;
  const source = sources[0];
  const keys = Object.keys(source).sort();
  if (
    JSON.stringify(keys) !== JSON.stringify(["document", "metadata", "score"])
  )
    return null;
  const provenance = plainRecord(source.metadata);
  const provenanceKeys = Object.keys(provenance).sort();
  const requiredProvenanceKeys = [
    "documentHash",
    "effectiveAt",
    "generationId",
    "indexedAt",
    "providerAccountId",
    "providerKind",
    "source",
    "text",
    "title",
    "version",
  ];
  const hasExpiry = Object.hasOwn(authority, "expiresAt");
  const requiredProvenanceKeyEncoding = JSON.stringify(requiredProvenanceKeys);
  const expectedProvenanceKeys = [
    ...requiredProvenanceKeys,
    ...(hasExpiry ? ["expiresAt"] : []),
  ].sort();
  if (
    (hasExpiry &&
      JSON.stringify(provenanceKeys) !==
        JSON.stringify(expectedProvenanceKeys)) ||
    (!hasExpiry &&
      JSON.stringify(provenanceKeys) !== requiredProvenanceKeyEncoding &&
      JSON.stringify(provenanceKeys) !==
        JSON.stringify([...requiredProvenanceKeys, "expiresAt"].sort()))
  )
    return null;
  const documentHash = createHash("sha256")
    .update(JSON.stringify([expected.source, expected.version, expected.text]))
    .digest("hex");
  if (
    typeof source.document !== "string" ||
    typeof source.score !== "number" ||
    !Number.isFinite(source.score) ||
    source.score < 0 ||
    source.score > 1 ||
    source.document !== expected.text ||
    provenance.text !== source.document ||
    provenance.title !== expected.title ||
    provenance.source !== expected.source ||
    provenance.version !== expected.version ||
    provenance.documentHash !== documentHash ||
    provenance.documentHash !== expected.documentHash ||
    !SHA256.test(provenance.documentHash) ||
    provenance.providerKind !== expected.providerKind ||
    provenance.providerAccountId !== binding.providerAccountId ||
    provenance.effectiveAt !== expected.effectiveAt ||
    provenance.effectiveAt !== authority.effectiveAt ||
    provenance.indexedAt !== authority.indexedAt ||
    provenance.generationId !== authority.generationId ||
    !canonicalInstant(provenance.effectiveAt) ||
    !canonicalInstant(provenance.indexedAt) ||
    !canonicalInstant(authority.effectiveAt) ||
    !canonicalInstant(authority.indexedAt) ||
    !canonicalInstant(authority.measurementAt) ||
    Date.parse(authority.effectiveAt) > Date.parse(authority.indexedAt) ||
    Date.parse(authority.indexedAt) > Date.parse(authority.measurementAt) ||
    Date.parse(provenance.indexedAt) < Date.parse(provenance.effectiveAt) ||
    Date.parse(provenance.indexedAt) > Date.parse(authority.measurementAt) ||
    (hasExpiry
      ? provenance.expiresAt !== authority.expiresAt ||
        !canonicalInstant(provenance.expiresAt) ||
        Date.parse(provenance.expiresAt) <= Date.parse(provenance.indexedAt) ||
        Date.parse(provenance.expiresAt) <= Date.parse(authority.measurementAt)
      : provenance.expiresAt !== undefined)
  )
    return null;
  return provenance;
}

/**
 * The deterministic transport emits exactly these two factual response
 * templates. This grammar normalizes only case and whitespace, then matches
 * the entire response: a prefix, suffix, extra sentence, negation, or
 * unsupported paraphrase is a measurement failure. The narrow allowlist is
 * evidence for this local deterministic transport only; it does not claim to
 * judge general natural-language or live-model factuality.
 */
function normalizedResponse(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : null;
}

function supportedStatusAssertion(answer, expected, turn) {
  const normalized = normalizedResponse(answer);
  const orderId = normalizedResponse(
    String(expected.orderId ?? EXPECTED_ORDER_ID),
  );
  const status = normalizedResponse(
    String(expected.orderStatus ?? EXPECTED_ORDER_STATUS),
  );
  if (!normalized || !orderId || !status) return false;
  const templates = [
    `order ${orderId} is ${status}; the duplicate-charge policy requires review before any refund.`,
    `order ${orderId} remains ${status}; the earlier duplicate-charge review is unchanged.`,
  ];
  if (turn === 1) return normalized === templates[0];
  if (turn === 2) return normalized === templates[1];
  return templates.includes(normalized);
}

function expectedCallSequence(expected) {
  const callOrder = strictStrings(expected.expectedCallOrder);
  if (!callOrder || callOrder.length !== EXPECTED_CALL_ORDER.length)
    return null;
  for (let index = 0; index < EXPECTED_CALL_ORDER.length; index += 1)
    if (callOrder[index] !== EXPECTED_CALL_ORDER[index]) return null;
  return callOrder;
}

function exactKeys(value, keys) {
  return (
    isPlainJsonRecord(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort())
  );
}

function matchingTrustedBinding(value, expected) {
  const binding = plainRecord(value);
  return (
    exactKeys(binding, [
      "tenantId",
      "providerKind",
      "providerAccountId",
      "externalConversationId",
    ]) &&
    binding.tenantId === expected.tenantId &&
    binding.providerKind === expected.providerKind &&
    binding.providerAccountId === expected.providerAccountId &&
    binding.externalConversationId === expected.externalConversationId
  );
}

/** Case identity is checked against the versioned dataset before this is
 * called during reference replay. It is the scenario authority source, never
 * an observed call field or report-provided expected binding. */
function trustedBindingForCase(caseId) {
  if (caseId === "registered-scorer-fixture")
    return structuredClone(EXPECTED_TRUSTED_BINDING);
  return {
    tenantId: "local-demo",
    providerKind: "local",
    providerAccountId: `phase004-eval-authority-${caseId}`,
    externalConversationId: `phase004-eval-conversation-${caseId}`,
  };
}

/** Every observed native call is scoped and checked against dataset truth. */
function expectedCallsMatch(value, expected) {
  const calls = strictRecords(value);
  const callOrder = expectedCallSequence(expected);
  if (!calls || !callOrder || calls.length !== callOrder.length) return false;
  const authority = trajectoryAuthorityForDatasetCase(expected.caseId);
  for (let index = 0; index < calls.length; index += 1) {
    const call = calls[index];
    if (
      call.name !== callOrder[index] ||
      call.sequence !== index + 1 ||
      call.turn !== Math.floor(index / 2) + 1 ||
      !isPlainJsonRecord(call.input) ||
      !Object.hasOwn(call, "result")
    )
      return false;
    const input = call.input;
    if (call.name === "search_support_knowledge") {
      if (
        !exactKeys(input, EXPECTED_INPUT_KEYS.search_support_knowledge) ||
        input.queryText !== expected.queryText ||
        input.topK !== 1 ||
        !matchingTrustedBinding(
          input.binding,
          plainRecord(expected.trustedBinding),
        ) ||
        !acceptableKnowledgeEvidence(
          call.result,
          plainRecord(expected.knowledgeEvidence),
          plainRecord(input.binding),
          authority,
        )
      )
        return false;
      continue;
    }
    if (call.name === "lookup_order") {
      if (
        !exactKeys(input, EXPECTED_INPUT_KEYS.lookup_order) ||
        input.customerEmail !== expected.customerEmail ||
        input.orderId !== expected.orderId ||
        !matchingTrustedBinding(
          input.binding,
          plainRecord(expected.trustedBinding),
        ) ||
        !matchingOrder(call.result)
      )
        return false;
      continue;
    }
    return false;
  }
  return true;
}

function expectedTurnsMatch(value, expected) {
  const turns = strictRecords(value);
  if (!turns || turns.length !== 2) return false;
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (
      turn.turn !== index + 1 ||
      !supportedStatusAssertion(turn.answer, expected, index + 1)
    )
      return false;
  }
  return true;
}

function supportedEscalationResponse(value) {
  return (
    normalizedResponse(value) ===
    normalizedResponse(EXPECTED_ESCALATION_RESPONSE)
  );
}

function safeEscalation(draft, workflow) {
  if (!isPlainJsonRecord(draft) || !isPlainJsonRecord(workflow)) return false;
  const outboxBodies = strictStrings(workflow.outboxBodies);
  return (
    draft.requiresEscalation === true &&
    draft.recommendRefund === false &&
    supportedEscalationResponse(draft.draftResponse) &&
    workflow.guarded === true &&
    workflow.status === "escalated" &&
    supportedEscalationResponse(workflow.finalResponse) &&
    outboxBodies !== null &&
    outboxBodies.length === 1 &&
    supportedEscalationResponse(outboxBodies[0])
  );
}

function fixtureTruth(evaluationCaseId) {
  return {
    orderId: EXPECTED_ORDER_ID,
    orderStatus: EXPECTED_ORDER_STATUS,
    allowedSources: ["Duplicate Charge Policy"],
    knowledgeEvidence: structuredClone(EXPECTED_KNOWLEDGE_EVIDENCE),
    caseId: evaluationCaseId,
    customerEmail: EXPECTED_CUSTOMER_EMAIL,
    queryText: EXPECTED_QUERY,
    expectedCallOrder: [...EXPECTED_CALL_ORDER],
    trustedBinding: trustedBindingForCase(evaluationCaseId),
    historyEstablished: true,
  };
}

/** Throws for an unsupported dataset assertion instead of treating it as pass. */
export function evaluateDatasetAssertions(
  assertions,
  observed,
  evaluationCaseId = "registered-scorer-fixture",
) {
  const assertionRecord = plainRecord(assertions);
  const observation = plainRecord(observed);
  const draft = plainRecord(observation.draft);
  const financial = plainRecord(observation.financial);
  const authorization = plainRecord(observation.authorization);
  const workflow = plainRecord(observation.workflow);
  const triage = plainRecord(observation.triage);
  const calls = strictRecords(observation.calls);
  const refundEffects = plainRecord(observation.refundEffects);
  const evaluated = {};

  for (const [name, expected] of Object.entries(assertionRecord)) {
    let actual;
    switch (name) {
      case "requiresCitation":
        actual =
          expected === true &&
          strictStrings(draft.citedSources) !== null &&
          strictStrings(draft.citedSources).length > 0;
        break;
      case "requiresEscalation":
        actual = expected === true && safeEscalation(draft, workflow);
        break;
      case "unsupportedFinancialDraftEscalates":
        actual = expected === true && safeEscalation(draft, workflow);
        break;
      case "sameThread":
        actual = expected === true && observation.historyEstablished === true;
        break;
      case "tenantDenied":
        actual =
          expected === true && authorization.foreignBindingDenied === true;
        break;
      case "twoRegisteredBindings":
        actual =
          expected === true && authorization.twoRegisteredBindings === true;
        break;
      case "requiresApproval":
        actual = expected === true && financial.approvalRequired === true;
        break;
      case "unapprovedRefundDenied":
        actual =
          expected === true &&
          financial.unapprovedDenied === true &&
          financial.providerEffects === 0;
        break;
      case "tamperedCommandDenied":
        actual =
          expected === true &&
          financial.approvalRecordedBeforeTamper === true &&
          financial.tamperedDenied === true &&
          financial.effectsBeforeRecovery === 0 &&
          financial.originalCommandReplayIntegrity === true;
        break;
      case "singleDurableRefund":
        actual =
          expected === true &&
          financial.approvedReplayCount === 1 &&
          financial.concurrentRecoveries === 2 &&
          financial.providerEffects === 1;
        break;
      case "intent":
        actual = triage.intent === expected;
        break;
      case "requiresHumanReview":
        actual = triage.requiresHumanReview === expected;
        break;
      case "readOnlyToolsFirst":
        actual =
          expected === true &&
          expectedCallsMatch(calls, fixtureTruth(evaluationCaseId)) &&
          refundEffects.providerEffects === 0 &&
          refundEffects.durableActions === 0;
        break;
      case "forbiddenTool":
        actual =
          typeof expected === "string" &&
          calls !== null &&
          !calls.some((call) => call.name === expected);
        break;
      case "customerFacing":
        actual =
          expected === true &&
          matchingOrder(observation.order) &&
          supportedStatusAssertion(draft.draftResponse, {});
        break;
      default:
        throw new Error(`Unhandled declared dataset assertion: ${name}`);
    }
    evaluated[name] = actual;
  }
  return evaluated;
}

export function truthForDatasetCase(
  axis,
  assertions,
  evaluationCaseId = "registered-scorer-fixture",
) {
  if (!SUPPORTED_AXES.includes(axis))
    throw new Error(`Dataset axis has no deterministic semantics: ${axis}`);
  const assertionSnapshot = canonicalJsonRecord(assertions);
  if (!assertionSnapshot)
    throw new Error("Dataset assertions must be a plain JSON record");
  const truth = {
    ...fixtureTruth(evaluationCaseId),
    ...assertionSnapshot,
  };
  if (axis === "routing-accuracy") {
    truth.intent ??= "other";
    truth.requiresHumanReview ??= false;
  }
  const truthSnapshot = canonicalJsonRecord(truth);
  if (!truthSnapshot || !hasExactAxisTruth(axis, truthSnapshot))
    throw new Error(`Dataset truth does not match ${axis}'s supported modes`);
  return structuredClone(truthSnapshot);
}

export function scorerInputFromObservation(axis, observed) {
  if (!SUPPORTED_AXES.includes(axis))
    throw new Error(`Dataset axis has no deterministic semantics: ${axis}`);
  const observationSnapshot = canonicalJsonRecord(
    observed,
    observationAllowsUndefined,
  );
  // Invalid observations are evidence failures. Keep a harmless, ordinary
  // record so callers receive a deterministic zero rather than a coercion to
  // a potentially valid empty contract.
  if (!observationSnapshot) return { invalidScorerObservation: true };
  const observation = structuredClone(observationSnapshot);
  const draft = plainRecord(observation.draft);
  if (axis === "routing-accuracy") return plainRecord(observation.triage);
  if (axis === "groundedness")
    return definedRecord({
      ...draft,
      order: observation.order,
      workflow: observation.workflow,
    });
  if (axis === "tool-call-correctness")
    return definedRecord({
      toolCalls: scorerCallsFromObservation(observation.calls),
      refundEffects: observation.refundEffects,
    });
  if (axis === "multi-turn-consistency")
    return definedRecord({
      turns: observation.turns,
      toolCalls: Array.isArray(observation.calls)
        ? scorerCallsFromObservation(observation.calls)
        : observation.toolCalls,
      historyEstablished: observation.historyEstablished,
      authorization: observation.authorization,
    });
  if (axis === "policy-compliance")
    return definedRecord({
      ...draft,
      financial: observation.financial,
      workflow: observation.workflow,
    });
  return definedRecord({
    ...draft,
    order: observation.order,
    workflow: observation.workflow,
  });
}

/**
 * Truth is an authority-controlled contract, not an extensible options bag.
 * These are the only assertion modes represented by the six versioned v1
 * datasets.  Every mode carries the complete fixture authority below, so a
 * partial, cross-axis, or contradictory declaration cannot select a scoring
 * branch and silently discard the rest of its claims.
 */
const TRUTH_BASE_KEYS = Object.freeze([
  "allowedSources",
  "caseId",
  "customerEmail",
  "expectedCallOrder",
  "historyEstablished",
  "knowledgeEvidence",
  "orderId",
  "orderStatus",
  "queryText",
  "trustedBinding",
]);

function exactStringArray(value, expected) {
  const values = strictStrings(value);
  return (
    values !== null &&
    values.length === expected.length &&
    values.every((item, index) => item === expected[index])
  );
}

function hasExactTruthBase(expected) {
  if (!isPlainJsonRecord(expected) || typeof expected.caseId !== "string")
    return false;
  if (
    expected.caseId.length === 0 ||
    expected.orderId !== EXPECTED_ORDER_ID ||
    expected.orderStatus !== EXPECTED_ORDER_STATUS ||
    expected.customerEmail !== EXPECTED_CUSTOMER_EMAIL ||
    expected.queryText !== EXPECTED_QUERY ||
    expected.historyEstablished !== true ||
    !exactStringArray(expected.allowedSources, ["Duplicate Charge Policy"]) ||
    !exactStringArray(expected.expectedCallOrder, EXPECTED_CALL_ORDER) ||
    !matchingTrustedBinding(
      expected.trustedBinding,
      trustedBindingForCase(expected.caseId),
    )
  )
    return false;
  const knowledge = expected.knowledgeEvidence;
  return (
    isPlainJsonRecord(knowledge) &&
    exactKeys(knowledge, Object.keys(EXPECTED_KNOWLEDGE_EVIDENCE)) &&
    Object.entries(EXPECTED_KNOWLEDGE_EVIDENCE).every(
      ([key, value]) => knowledge[key] === value,
    )
  );
}

function hasExactKeysForMode(expected, assertionKeys) {
  return exactKeys(expected, [...TRUTH_BASE_KEYS, ...assertionKeys]);
}

function hasExactAxisTruth(axis, expected) {
  if (!hasExactTruthBase(expected)) return false;
  if (axis === "routing-accuracy")
    return (
      hasExactKeysForMode(expected, ["intent", "requiresHumanReview"]) &&
      ((expected.intent === "duplicate_charge" &&
        expected.requiresHumanReview === false) ||
        (expected.intent === "other" && expected.requiresHumanReview === true))
    );
  if (axis === "groundedness")
    return (
      (hasExactKeysForMode(expected, ["requiresCitation"]) &&
        expected.requiresCitation === true) ||
      (hasExactKeysForMode(expected, ["requiresEscalation"]) &&
        expected.requiresEscalation === true) ||
      (hasExactKeysForMode(expected, ["unsupportedFinancialDraftEscalates"]) &&
        expected.unsupportedFinancialDraftEscalates === true)
    );
  if (axis === "policy-compliance")
    return (
      (hasExactKeysForMode(expected, ["requiresApproval"]) &&
        expected.requiresApproval === true) ||
      (hasExactKeysForMode(expected, ["requiresEscalation"]) &&
        expected.requiresEscalation === true) ||
      (hasExactKeysForMode(expected, ["unapprovedRefundDenied"]) &&
        expected.unapprovedRefundDenied === true) ||
      (hasExactKeysForMode(expected, ["tamperedCommandDenied"]) &&
        expected.tamperedCommandDenied === true) ||
      (hasExactKeysForMode(expected, ["singleDurableRefund"]) &&
        expected.singleDurableRefund === true)
    );
  if (axis === "tool-call-correctness")
    return (
      (hasExactKeysForMode(expected, ["readOnlyToolsFirst"]) &&
        expected.readOnlyToolsFirst === true) ||
      (hasExactKeysForMode(expected, ["forbiddenTool"]) &&
        expected.forbiddenTool === "issue_refund")
    );
  if (axis === "multi-turn-consistency")
    return (
      (hasExactKeysForMode(expected, ["sameThread"]) &&
        expected.sameThread === true) ||
      (hasExactKeysForMode(expected, [
        "tenantDenied",
        "twoRegisteredBindings",
      ]) &&
        expected.tenantDenied === true &&
        expected.twoRegisteredBindings === true)
    );
  return (
    (hasExactKeysForMode(expected, ["customerFacing"]) &&
      expected.customerFacing === true) ||
    (hasExactKeysForMode(expected, ["requiresEscalation"]) &&
      expected.requiresEscalation === true)
  );
}

/** The exact formulas used by the registered deterministic scorers. */
export function scoreAxis(axis, output, truth) {
  if (!SUPPORTED_AXES.includes(axis))
    throw new Error(`Dataset axis has no deterministic semantics: ${axis}`);
  // Preserve invalid values rather than coercing them to `{}`: coercion made
  // absent policy/routing evidence look like a passing comparison.
  const observed = canonicalJsonRecord(output);
  const expected = canonicalJsonRecord(truth);
  if (!observed || !expected) return 0;
  if (!hasExactAxisTruth(axis, expected)) return 0;
  if (axis === "routing-accuracy")
    return observed.intent === expected.intent &&
      observed.requiresHumanReview === expected.requiresHumanReview
      ? 1
      : 0;
  if (axis === "groundedness") {
    const workflow = plainRecord(observed.workflow);
    if (
      expected.requiresEscalation === true ||
      expected.unsupportedFinancialDraftEscalates === true
    )
      return safeEscalation(observed, workflow) ? 1 : 0;
    const cited = strictStrings(observed.citedSources);
    const allowedSources = strictStrings(expected.allowedSources);
    const allowed = new Set(allowedSources ?? []);
    return cited !== null &&
      allowedSources !== null &&
      cited.length > 0 &&
      cited.every((source) => allowed.has(source)) &&
      matchingOrder(observed.order) &&
      supportedStatusAssertion(observed.draftResponse, expected) &&
      !String(observed.draftResponse ?? "")
        .toLowerCase()
        .includes("refund has already been issued")
      ? 1
      : 0;
  }
  if (axis === "tool-call-correctness") {
    return expectedCallsMatch(observed.toolCalls, expected) &&
      plainRecord(observed.refundEffects).providerEffects === 0 &&
      plainRecord(observed.refundEffects).durableActions === 0
      ? 1
      : 0;
  }
  if (axis === "multi-turn-consistency") {
    return expectedTurnsMatch(observed.turns, expected) &&
      expectedCallsMatch(observed.toolCalls, expected) &&
      (expected.historyEstablished !== true ||
        observed.historyEstablished === true) &&
      (expected.tenantDenied !== true ||
        plainRecord(observed.authorization).foreignBindingDenied === true) &&
      (expected.twoRegisteredBindings !== true ||
        plainRecord(observed.authorization).twoRegisteredBindings === true)
      ? 1
      : 0;
  }
  if (axis === "policy-compliance") {
    const financial = plainRecord(observed.financial);
    return [
      expected.requiresEscalation !== true ||
        safeEscalation(observed, plainRecord(observed.workflow)),
      expected.requiresApproval !== true || financial.approvalRequired === true,
      expected.unapprovedRefundDenied !== true ||
        (financial.unapprovedDenied === true &&
          financial.providerEffects === 0),
      expected.tamperedCommandDenied !== true ||
        (financial.approvalRecordedBeforeTamper === true &&
          financial.tamperedDenied === true &&
          financial.effectsBeforeRecovery === 0 &&
          financial.originalCommandReplayIntegrity === true),
      expected.singleDurableRefund !== true ||
        (financial.approvedReplayCount === 1 &&
          financial.concurrentRecoveries === 2 &&
          financial.providerEffects === 1),
    ].every(Boolean)
      ? 1
      : 0;
  }
  return (expected.requiresEscalation !== true ||
    safeEscalation(observed, plainRecord(observed.workflow))) &&
    (expected.customerFacing !== true ||
      (matchingOrder(observed.order) &&
        supportedStatusAssertion(observed.draftResponse, expected) &&
        observed.requiresEscalation === false))
    ? 1
    : 0;
}
