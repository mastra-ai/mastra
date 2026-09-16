import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Mastra } from "@mastra/core/mastra";
import type { LanguageModelV2 } from "@ai-sdk/provider";

type NativeApprovalOptions = Parameters<
  Awaited<ReturnType<Mastra["getAgent"]>>["approveToolCallGenerate"]
>[0];

/**
 * This is intentionally an application-process secret, rather than case
 * metadata. A case's durable decision permits native recovery, but cannot be
 * replayed by an HTTP client as a financial bearer credential.
 */
const signingKey = randomBytes(32);
const MAX_AGE_MS = 60_000;

export interface NativeRefundExecutionAuthorization {
  readonly issuedAt: number;
  readonly nativeRunId: string;
  readonly nativeToolCallId: string;
  readonly commandFingerprint: string;
  readonly caseId: string;
  readonly turnId: string;
  readonly dispatchId: string;
  readonly leaseToken: string;
  readonly signature: string;
}

type NativeAgentContext = {
  agent?: { agentId?: string; toolCallId?: string };
};
type NativeApproval = {
  runId?: string;
  toolCallId?: string;
  fingerprint?: string;
};

interface NativeResumeScope {
  caseId: string;
  turnId: string;
  nativeRunId: string;
  nativeToolCallId: string;
  commandFingerprint: string;
  dispatchId: string;
  leaseToken: string;
}
const nativeResumeScope = new AsyncLocalStorage<NativeResumeScope>();

/**
 * The only public capability issuer. It owns the AsyncLocalStorage scope and
 * invokes Mastra's official native approval transition itself; callers cannot
 * pair a fabricated scope with an arbitrary tool callback.
 */
export function resumeApprovedNativeTool<T>(input: {
  mastra: Mastra;
  approved: boolean;
  scope: NativeResumeScope;
  model?: LanguageModelV2;
  requestContext?: NativeApprovalOptions["requestContext"];
}): Promise<T> {
  const { approved, scope, model, requestContext } = input;
  const agent = input.mastra.getAgent("refundExecutionAgent");
  return nativeResumeScope.run(
    Object.freeze({ ...scope }),
    () =>
      (approved
        ? agent.approveToolCallGenerate({
            runId: scope.nativeRunId,
            toolCallId: scope.nativeToolCallId,
            ...(model === undefined ? {} : { model }),
            ...(requestContext === undefined ? {} : { requestContext }),
          })
        : agent.declineToolCallGenerate({
            runId: scope.nativeRunId,
            toolCallId: scope.nativeToolCallId,
            ...(model === undefined ? {} : { model }),
            ...(requestContext === undefined ? {} : { requestContext }),
          })) as Promise<T>,
  );
}

function payload(value: Omit<NativeRefundExecutionAuthorization, "signature">) {
  return `${value.issuedAt}:${value.nativeRunId}:${value.nativeToolCallId}:${value.commandFingerprint}:${value.caseId}:${value.turnId}:${value.dispatchId}:${value.leaseToken}`;
}

function signature(
  value: Omit<NativeRefundExecutionAuthorization, "signature">,
) {
  return createHmac("sha256", signingKey)
    .update(payload(value))
    .digest("base64url");
}

/**
 * Mints an authorization only when Mastra executes a tool inside the active
 * approved-native resume scope. Plain context fields are diagnostic data, not
 * authority: direct callers cannot mint a capability by constructing them.
 */
export async function withNativeRefundExecutionAuthorization<T>(
  context: NativeAgentContext | undefined,
  native: NativeApproval | undefined,
  commandFingerprint: string,
  execute: (authorization: NativeRefundExecutionAuthorization) => Promise<T>,
): Promise<T> {
  if (
    nativeResumeScope.getStore()?.nativeRunId !== native?.runId ||
    nativeResumeScope.getStore()?.nativeToolCallId !== native?.toolCallId ||
    nativeResumeScope.getStore()?.commandFingerprint !== commandFingerprint ||
    context?.agent?.agentId !== "refund-execution-agent" ||
    !native?.runId ||
    !native.toolCallId ||
    context.agent.toolCallId !== native.toolCallId ||
    native.fingerprint !== commandFingerprint
  )
    throw new Error(
      "Refund execution requires the approved native refund agent tool context.",
    );
  const unsigned = {
    issuedAt: Date.now(),
    nativeRunId: native.runId,
    nativeToolCallId: native.toolCallId,
    commandFingerprint,
    caseId: nativeResumeScope.getStore()!.caseId,
    turnId: nativeResumeScope.getStore()!.turnId,
    dispatchId: nativeResumeScope.getStore()!.dispatchId,
    leaseToken: nativeResumeScope.getStore()!.leaseToken,
  };
  return execute({ ...unsigned, signature: signature(unsigned) });
}

export function hasNativeRefundExecutionAuthorization(
  value: unknown,
  expected: {
    nativeRunId: string;
    nativeToolCallId: string;
    commandFingerprint: string;
    caseId: string;
  },
): value is NativeRefundExecutionAuthorization {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NativeRefundExecutionAuthorization>;
  if (
    typeof candidate.issuedAt !== "number" ||
    !Number.isSafeInteger(candidate.issuedAt) ||
    typeof candidate.signature !== "string" ||
    candidate.nativeRunId !== expected.nativeRunId ||
    candidate.nativeToolCallId !== expected.nativeToolCallId ||
    candidate.commandFingerprint !== expected.commandFingerprint ||
    candidate.caseId !== expected.caseId ||
    typeof candidate.turnId !== "string" ||
    typeof candidate.dispatchId !== "string" ||
    typeof candidate.leaseToken !== "string" ||
    Math.abs(Date.now() - candidate.issuedAt) > MAX_AGE_MS
  )
    return false;
  const unsigned = {
    issuedAt: candidate.issuedAt,
    nativeRunId: candidate.nativeRunId,
    nativeToolCallId: candidate.nativeToolCallId,
    commandFingerprint: candidate.commandFingerprint,
    caseId: candidate.caseId,
    turnId: candidate.turnId,
    dispatchId: candidate.dispatchId,
    leaseToken: candidate.leaseToken,
  };
  const supplied = Buffer.from(candidate.signature);
  const expectedSignature = Buffer.from(signature(unsigned));
  return (
    supplied.length === expectedSignature.length &&
    timingSafeEqual(supplied, expectedSignature)
  );
}
