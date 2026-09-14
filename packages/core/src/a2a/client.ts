export * from './error';
export * from '@a2a-js/sdk-v0_3';
// v1-only signing canonicalizer (RFC-8785 JCS after AgentCard round-trip + cleanEmpty).
// Re-exported explicitly so the server signer and client verifier canonicalize v1
// cards byte-identically to any @a2a-js/sdk v1 peer. The v0_3 alias exposes no
// canonicalizer, and this one is verified LOSSY for 0.3-shaped cards (drops
// url/protocolVersion/preferredTransport/skills) — use it for v1 cards only.
export { canonicalizeAgentCard as canonicalizeV1AgentCard } from '@a2a-js/sdk-v1';
// v1 SDK signing helpers, re-exported so signer/verifier round-trip tests (and any
// consumer wanting SDK-native signing) can reach them without the alias, which only
// resolves inside packages/core. The v0_3 alias exposes no signing helpers.
export {
  generateAgentCardSignature as generateV1AgentCardSignature,
  verifyAgentCardSignature as verifyV1AgentCardSignature,
} from '@a2a-js/sdk-v1';
export type {
  A2ANormalizedStreamEvent,
  A2AProtocolSelection,
  A2AProtocolVersion,
  A2ARemoteAgentCard,
  A2ASelectedInterface,
} from './wire-protocol';
export { selectA2AInterface, getA2ARequestHeaders } from './wire-protocol';
export {
  V0_3_TO_V1_TASK_STATE,
  V1_TO_V0_3_TASK_STATE,
  mapV0_3TaskStateToV1,
  mapV1TaskStateToV0_3,
  normalizeV1Message,
  normalizeV1Part,
  sliceTaskHistory,
  toV1Message,
  toV1Part,
} from './protocol-mappings';
export type { V0_3TaskState, V1TaskState } from './protocol-mappings';
export type {
  A2AAgentCardVerificationContext,
  A2AAgentGenerateResult,
  A2AAgentOptions,
  A2AAgentResumePayload,
  A2AAgentRunState,
  A2AAgentStreamResult,
  A2AAgentVerificationOptions,
  JSONRPCError,
  JSONRPCResponse,
  RequestCredentialsMode,
  TaskContext,
} from './types';
