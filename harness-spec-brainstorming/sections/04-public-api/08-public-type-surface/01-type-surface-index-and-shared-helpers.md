### 4.8a Type Surface Index and Shared Helpers

```ts
// Local schema objects used by in-process calls and by JS SDK ergonomics.
// Raw HTTP uses WireSchemaRef / WireHarnessSkillDescriptor from §13.3 instead.
import type { PublicSchema, InferPublicSchema } from '@mastra/core/schema';
import type { ToolsInput as MastraToolsInput } from '@mastra/core/agent';

// Public export / owner map:
// - §4.8 declares shared helpers used by several public surfaces:
//   Awaitable, ReadonlyState, TokenUsage, AvailableModel, ModelAuthStatus,
//   ToolCategory, PermissionPolicy, ToolsetInput, HarnessListener,
//   HarnessMessage, HarnessMessageContent, AgentResult, AgentStream,
//   BackgroundTask, RemoteSafeSkillDescriptor, RemoteSafePermissions,
//   ObservationalMemorySnapshot, RemoteSafeObservationalMemory,
//   RemoteSafeSession, and RemoteSession.
// - §4.4 owns operation, inbox, thread-option, list-page, request-context, and
//   file-attachment option objects: MessageOptions, QueueOptions,
//   UseSkillOptions, InboxResponseOptions, ToolApprovalResponse,
//   ToolSuspensionResponse, InboxResponseResult, CreateThreadOptions,
//   CloneThreadOptions, FileAttachment, RequestContextInput, and list options.
// - §4.6 owns HarnessSkill; §4.7 owns GoalState and SetGoalOptions; §5.1 owns
//   HarnessThread, PermissionRules, SessionGrants,
//   HarnessDisplayStateSnapshotV1, and SessionActivityTimeline; §6.1 owns
//   JsonValue and HarnessRequestContext; §9 owns HarnessMode, HarnessSubagent, and
//   HarnessWorkspaceConfig; §10 owns HarnessEvent; §13.3 owns the shared wire
//   DTOs and envelopes it declares, including WireSchemaRef,
//   WireSchemaDescriptor, WireHarnessSkillDescriptor, WireListPage,
//   MessageRequest, SkillInvocationRequest, WireAttachment,
//   MessageAdmissionResponse, QueueAdmissionResponse, MessageResultResponse,
//   QueueResultResponse, and HarnessErrorResponse.
// This index closes only the shared type-surface gap. Cross-layer name
// correspondence for major route families is indexed in §13.3. Broader result
// and stream chunk/replay schemas are deferred by §15.3; signal/resume,
// event-union, and schema-bearing wire refinements stay with HC-189, HC-190,
// HC-208, and HC-342.

// Shared helper for reads that are synchronous on an in-process Session but
// necessarily asynchronous on RemoteSession because they cross HTTP.
type Awaitable<T> = T | Promise<T>;

// Recursive read-only view for plain JSON-compatible session state. The runtime
// guarantee is stronger than this type alias: returned state snapshots must not
// share mutable references with canonical session state.
type ReadonlyState<T> =
  T extends readonly (infer U)[] ? readonly ReadonlyState<U>[] :
  T extends object ? { readonly [K in keyof T]: ReadonlyState<T[K]> } :
  T;

// Bound view over the Harness v1 storage domain. §5.2 owns the
// `HarnessStorageDomain` method shape and namespace-binding contract; this is
// not a remote SDK surface and not an alias to current deprecated
// `MastraStorage` property access.
type HarnessStorage = HarnessStorageDomain;

// Spec-side alias for the single named tool map accepted by Harness config and
// per-turn local additions. Current Mastra exposes this shape as `ToolsInput`;
// grouped model-call `toolsets` are an implementation assembly detail, not a
// separate public Harness option.
type ToolsetInput = MastraToolsInput;

// Tool approval grouping and policies. §4.2 owns the permission evaluation
// order; §5.1 owns the persisted rules/grants rows.
type ToolCategory = 'read' | 'edit' | 'execute' | 'mcp' | 'other';
type PermissionPolicy = 'allow' | 'ask' | 'deny';

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
  // Public, persisted, and wire payloads may include provider-specific usage
  // details only after canonical JSON normalization. Implementations may keep
  // richer provider-native usage internally, but it is not this public shape.
  raw?: JsonValue;
}

interface AvailableModel {
  id: string;
  provider: string;
  modelName: string;
  hasApiKey: boolean;
  apiKeyEnvVar?: string;
  useCount: number;
}

// Runtime availability for the currently selected model. Config validation and
// catalog listing remain separate surfaces (§9).
interface ModelAuthStatus {
  hasAuth: boolean;
  apiKeyEnvVar?: string;
}

// Public subscription callback for the event union owned by §10. Listener
// promise rejections are implementation-observed delivery failures; they do
// not roll back the event or any storage transition that produced it.
type HarnessListener = (event: HarnessEvent) => void | Promise<void>;

```
