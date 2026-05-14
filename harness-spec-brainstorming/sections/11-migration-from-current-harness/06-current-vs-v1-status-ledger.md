### 11.6 Current-vs-v1 status ledger

This ledger classifies every `class`, `interface`, and `type` name declared
across non-example `sections/` files against the current Mastra codebase so
implementers and reviewers can tell at a glance whether a name refers to the
same shape on both sides of `@mastra/core/harness` and
`@mastra/core/harness/v1`. The owning sections remain authoritative; this is
an index, not a redefinition.

Status values:

- `reused-current` — the name exists in current Mastra code with the same
  intended shape; per §11.1, both `@mastra/core/harness` and
  `@mastra/core/harness/v1` re-export the same underlying definition.
- `changed-v1` — the name exists in current Mastra code, but v1 semantics
  differ; the new shape lives only under `@mastra/core/harness/v1` and must
  not leak through the legacy subpath.
- `compatibility-input` — current Mastra plumbing that v1 may adapt
  internally but never re-export through the v1 subpath. §11.1 enumerates
  the legacy call sites; this ledger covers spec-declared names that act as
  wrappers or replacements for legacy plumbing.
- `new-v1` — no current implementation under that name; declared only under
  `@mastra/core/harness/v1` (or its owning wire/storage section).
- `deferred` — declared in the spec for context but intentionally not
  shipped in v1; the §11.5 and §15.3 deferrals are concept-level and do not
  presently flag any of the 256 declared names by identifier. The status is
  retained so future deferrals can land here without re-categorisation.

Export-path convention: every `changed-v1` and `new-v1` runtime name exports
from `@mastra/core/harness/v1` unless its spec section explicitly assigns it
to a wire-only or storage-only owner. Wire DTOs (§13.3) and storage-only
records (§5.1, §5.2) stay with their owning sections and are not re-exported
through the v1 runtime entry; clients reach them via the §13.3 wire surface
or §5.2 `HarnessStorageDomain` instead.

#### 11.6a Names that overlap with current Mastra code

These 20 names appear under the exact same identifier in both the v1 spec
and current `../packages/**/src`. Each row is a hallucination-risk
boundary: a worker that assumes the legacy export already implements the
v1 shape may wire the wrong implementation behind the v1 subpath.

Each entry below records one declared name with `Owner:` (spec section),
`Status:`, `Current code:`, and an optional `Notes:` line.

`Notes:` blocks are status-rationale pointers, not secondary definitions.
Keep each Note to the shortest text needed to justify the `Status:`
classification and route readers to canonical owners, normally no more
than two short cross-references plus one sentence of rationale. If a
Note needs to enumerate field families, source streams, projection
mappings, slot construction, or any other multi-claim material, that
content belongs in the owning section; the ledger should link to it. A
brief current-code mismatch may remain when the mismatch is only
meaningful as migration triage and does not define v1 behavior. This
rule scopes to §11.6a entries; §11.6b name-collision disambiguation
entries are not Notes blocks and are exempt.

**`AvailableModel`**

- Owner: §4.8a.
- Status: `reused-current`.
- Current code: `../packages/core/src/harness/types.ts:341`.
- Notes: §4.8a declares the shape inline.

**`BackgroundTask`**

- Owner: §4.8c.
- Status: `changed-v1`.
- Current code: `../packages/core/src/background-tasks/types.ts:11`.
- Notes: Spec carries the diagnostic projection (§4.8c); current code
  carries the runtime row. The v1 export is the projection. See §5.1b.2
  for the three v1-only field families that extend the row, and §5.2d
  for the new `claim*` / `renew*` / `update*` storage primitives that
  current `BackgroundTasksStorage` does not provide.

**`BackgroundTaskStatus`**

- Owner: §4.8c.
- Status: `changed-v1`.
- Current code: `../packages/core/src/background-tasks/types.ts:9`.
- Notes: v1 declares `BackgroundTaskStatus` as a transparent alias of
  `BackgroundTaskRowStatus` (§5.1b.2); no independent literals live at the
  projection site. Current code declares an independent union missing the
  `'dead'` terminal status. The alias commits the public name to the 7-literal
  storage taxonomy (`pending | running | completed | failed | cancelled |
  timed_out | dead`); current code must reach literal parity with §5.1b.2
  before the alias ships. Any future literal-set change is a public-API
  change governed by §11.6.

**`Harness`**

- Owner: §4.1.
- Status: `changed-v1`.
- Current code: `../packages/core/src/harness/harness.ts:101`.
- Notes: §11.1 keeps the two classes side-by-side; they are not
  assignment-compatible during `@mastra/core` v1.

**`HarnessConfig`**

- Owner: §9.1.
- Status: `changed-v1`.
- Current code: `../packages/core/src/harness/types.ts:149`.
- Notes: Mode/model/observational-memory/request-context fields all
  shift; see the §11.1 narrative for the legacy-vs-v1 split.

**`HarnessEvent`**

- Owner: §10.1.
- Status: `changed-v1`.
- Current code: `../packages/core/src/harness/types.ts:704`.
- Notes: §11.1 routes legacy events as compatibility-input through the
  §10 projector before the v1 closed union admits them. The projector
  adapts four source streams (`AgentChunkType`, Mastra workflow step
  events, the pubsub substrate, and legacy `HarnessEvent`); see §10.0
  for the source-stream enumeration, projection rules, and unmapped
  chunk families that stay compatibility-input per §15.3.

**`HarnessMessage`**

- Owner: §4.8b.
- Status: `reused-current`.
- Current code: `../packages/core/src/harness/types.ts:915`.
- Notes: §11.1 lists `HarnessMessage` as stable across both subpaths.

**`HarnessMessageContent`**

- Owner: §4.8b.
- Status: `reused-current`.
- Current code: `../packages/core/src/harness/types.ts:924`.
- Notes: Same family as `HarnessMessage`; stable per §11.1.

**`HarnessMode`**

- Owner: §9.2.
- Status: `changed-v1`.
- Current code: `../packages/core/src/harness/types.ts:42`.
- Notes: Current mode embeds a live `Agent`; v1 carries `agentId`
  (§9.2 / §11.1).

**`HarnessRequestContext`**

- Owner: §6.1.
- Status: `changed-v1`.
- Current code: `../packages/core/src/harness/types.ts:972`.
- Notes: Required fields, runtime-slot ownership, and
  `emitEvent`/`suspendTool` boundaries all shift. §11.1 forbids reusing
  legacy `requestContext.set('harness', …)` behind the v1 subpath. See
  §6.0 / §6.1 for the slot-overlay pattern over `ToolExecutionContext` /
  `RequestContext` (`context.requestContext.get('harness')`).
  `getActivityTimeline(...)` is a v1-addition read accessor on this changed
  slot surface; it returns the v1-new `SessionActivityTimeline` projection and
  has no current-code `Session.getActivityTimeline` implementation yet.

**`HarnessSubagent`**

- Owner: §9.2.
- Status: `changed-v1`.
- Current code: `../packages/core/src/harness/types.ts:76`.
- Notes: Ownership, depth limit, and resume-metadata semantics shift per
  §8 and §9.2.

**`HarnessThread`**

- Owner: §5.1a.1.
- Status: `reused-current`.
- Current code: `../packages/core/src/harness/types.ts:396`.
- Notes: §11.1 lists thread shapes as stable; the spec re-declares the
  shape to anchor the section.

**`ModelAuthStatus`**

- Owner: §4.8a.
- Status: `reused-current`.
- Current code: `../packages/core/src/harness/types.ts:333`.
- Notes: Runtime auth status for the selected model (§4.8a).

**`ObservationalMemoryConfig`**

- Owner: §9.2.
- Status: `changed-v1`.
- Current code: `../packages/memory/src/processors/observational-memory/types.ts:770`.
- Notes: Current `HarnessConfig.observationalMemory` is typed as
  `HarnessOMConfig` (current `../packages/core/src/harness/types.ts:291`);
  v1 reuses the memory-package identifier `ObservationalMemoryConfig`
  and rebuilds the boundary per §11.1.

**`PermissionPolicy`**

- Owner: §4.8a.
- Status: `reused-current`.
- Current code: `../packages/core/src/harness/types.ts:315`.
- Notes: Literal union `'allow' | 'ask' | 'deny'`.

**`PermissionRules`**

- Owner: §5.1f.
- Status: `changed-v1`.
- Current code: `../packages/core/src/harness/types.ts:321`.
- Notes: Approval grants and pending-suspension shapes reshape per
  §5.1f.

**`Session`**

- Owner: §4.4.
- Status: `new-v1`.
- Current code: `../packages/core/src/auth/interfaces/session.ts:9`
  (auth, unrelated).
- Notes: Name collision only. Current `Session` is the auth resource
  session, not a Harness session. The v1 `Session` class is new under
  `@mastra/core/harness/v1`.

**`ThreadCloneMetadata`**

- Owner: §5.1a.1.
- Status: `reused-current`.
- Current code: `../packages/core/src/storage/types.ts:192`.
- Notes: Storage-owned shape; v1 re-exports through the §5.1a.1 anchor.

**`TokenUsage`**

- Owner: §4.8a.
- Status: `reused-current`.
- Current code: `../packages/core/src/harness/types.ts:422`.
- Notes: §4.8a declares the canonical shape.

**`ToolCategory`**

- Owner: §4.8a.
- Status: `reused-current`.
- Current code: `../packages/core/src/harness/types.ts:310`.
- Notes: Literal union `'read' | 'edit' | 'execute' | 'mcp' | 'other'`.

#### 11.6b Names that current Mastra carries under a different identifier

These are not exact-name overlaps with current code but are easy to confuse
with v1-declared names. Worker triage should treat them as
`compatibility-input` when the legacy identifier appears in current code,
and as the v1 name when the spec section is the source of truth.

- Current `HarnessSession` (`../packages/core/src/harness/types.ts:409`) →
  no v1 export under that name. v1 splits this surface into `Session`
  (§4.4), `SessionRecord` (§5.1a.1), and the active-session resolver matrix
  in §5.3.
- Current `HarnessEventListener` (`../packages/core/src/harness/types.ts:884`)
  → renamed to `HarnessListener` (§4.8a). Same callable shape
  `(event: HarnessEvent) => void | Promise<void>`; only the v1 alias is
  re-exported from `@mastra/core/harness/v1`.
- Current `HarnessOMConfig` (`../packages/core/src/harness/types.ts:291`)
  → v1 routes observational-memory configuration through
  `ObservationalMemoryConfig` (§9.2 / §11.6a above). The legacy field name
  stays addressable under `@mastra/core/harness` per §11.1; v1 callers use
  the renamed shape.
- Current `ToolExecutionContext`
  (`../packages/core/src/agent/durable/workflows/shared/execute-tool-calls.ts:8`)
  → an internal durable-workflow orchestration interface
  (`toolCalls`, `tools`, `runId`, `agentId`, `messageId`, `state`,
  `onToolStart` / `onToolResult` / `onToolError`); it shares the name with
  the public `ToolExecutionContext` at
  `../packages/core/src/tools/types.ts:332` but is a different shape and
  scope. Worker triage: the v1 tool-authoring surface always anchors to
  `tools/types.ts:332` (§6.1, §11.6a `HarnessRequestContext` note); the
  durable-workflow variant is implementation-internal, never re-exported
  through `@mastra/core/harness/v1`.

#### 11.6c Remaining v1-declared names by owning section

The remaining 236 declared names have no current-code occurrence under the
same identifier. They are `new-v1` unless flagged otherwise. The list is
the index that turns the 256-name surface into a reviewable map; any
future drift against current code becomes either a new row in §11.6a or a
new rename row in §11.6b.

- §4.2f — `04-public-api/02-session/06-required-agent-signal-boundary.md`:
  `AgentSignalBoundary`, `AgentSignalInput`, `AgentSignalAccepted`,
  `AgentSignalResultLookup`, `AgentSignalSubscription`,
  `AgentSignalResultStatus`, `AgentSignalTerminalEvent`.
- §4.2g — `04-public-api/02-session/07-required-agent-resume-boundary.md`:
  `AgentResumeBoundary`, `AgentResumeSupportInput`, `AgentResumeSupport`,
  `AgentResumeInput`, `AgentResumeResultLookup`, `AgentResumeResult`.
- §4.3 — `04-public-api/03-per-turn-overrides.md`: `HarnessOverrides`,
  `PersistedRunOverrides`.
- §4.4a — `04-public-api/04-operation-option-types/01-list-and-message-options.md`:
  `ListPageOptions`, `ListPage`, `ListMessagesOptions`,
  `ListThreadsOptions`, `ListSessionsOptions`, `MessageOptions`.
- §4.4b — `04-public-api/04-operation-option-types/02-queue-and-skill-options.md`:
  `QueueOptions`, `UseSkillOptions`.
- §4.4c — `04-public-api/04-operation-option-types/03-request-context-options.md`:
  `RequestContextInput`, `TrustedRequestContextInput`.
- §4.4d — `04-public-api/04-operation-option-types/04-inbox-response-options.md`:
  `InboxResponseOptions`, `ToolApprovalResponse`, `ToolSuspensionResponse`,
  `InboxResponseResult`.
- §4.4e — `04-public-api/04-operation-option-types/05-thread-and-file-options.md`:
  `CreateThreadOptions`, `CloneThreadOptions`, `FileAttachment`.
- §4.5a — `04-public-api/05-errors/01-admission-channel-and-inbox-errors.md`:
  `HarnessBusyError`, `HarnessQueueFullError`, `HarnessValidationError`,
  `HarnessOutputGenerationError`, `HarnessForbiddenError`,
  `HarnessOverrideConflictError`, `HarnessAdmissionConflictError`,
  `HarnessAttachmentInUseError`, `HarnessAttachmentUnavailableError`,
  `HarnessChannelActionConflictError`, `HarnessInboxItemNotFoundError`,
  `HarnessInboxResponseConflictError`, `HarnessRecoveryDeferredError`.
- §4.5b — `04-public-api/05-errors/02-session-lifecycle-errors.md`:
  `HarnessSubagentDepthExceededError`, `HarnessLiveSessionLimitError`,
  `HarnessSessionClosedError`, `HarnessSessionClosingError`,
  `HarnessSessionNotFoundError`, `HarnessSessionConflictError`,
  `HarnessSessionDeleteBlockedError`, `HarnessSkillNotFoundError`,
  `HarnessSessionDeletedError`, `HarnessChannelBindingClosedError`,
  `HarnessChannelDeliveryUnavailableError`, `HarnessRuntimeDriftError`.
- §4.5c — `04-public-api/05-errors/03-abort-errors.md`:
  `HarnessAbortReason`, `HarnessAbortedError`.
- §4.5d — `04-public-api/05-errors/04-storage-state-workspace-and-lock-errors.md`:
  `HarnessRowErrorCode`, `HarnessStorageOperation`, `HarnessStorageSubject`,
  `HarnessStorageError`, `HarnessSessionCorruptError`,
  `HarnessStateSerializationError`, `HarnessStateConflictError`,
  `HarnessConfigError`, `HarnessWorkspaceProviderMismatchError`,
  `HarnessWorkspaceLostError`, `HarnessResourceWorkspaceInUseError`,
  `HarnessSessionLockedError`.
- §4.6 — `04-public-api/06-skills.md`: `HarnessSkill`.
- §4.7 — `04-public-api/07-goals.md`: `GoalState`, `GoalJudgedTurn`,
  `GoalJudgeDecision`, `SetGoalOptions`.
- §4.8a — `04-public-api/08-public-type-surface/01-type-surface-index-and-shared-helpers.md`:
  `Awaitable`, `ReadonlyState`, `HarnessStorage`, `ToolsetInput`,
  `HarnessListener`.
- §4.8b — `04-public-api/08-public-type-surface/02-messages-results-and-streams.md`:
  `AgentResult`, `AgentToolCallSummary`, `AgentStream`.
- §4.8d — `04-public-api/08-public-type-surface/04-remote-safe-supporting-types.md`:
  `RemoteSafeSkillDescriptor`, `RemoteMessageOptions`,
  `RemoteUseSkillOptions`, `RemoteSafePermissions`,
  `ObservationalMemorySnapshot`, `RemoteSafeObservationalMemory`.
- §4.8e — `04-public-api/08-public-type-surface/05-remote-safe-session.md`:
  `RemoteSafeSession`, `RemoteSession`.
- §5.1a.1 — `05-session-persistence/01-what-gets-persisted/02-thread-and-session-records.md`:
  `ThreadMetadata`, `SessionRecord`.
- §5.1a.2 — `05-session-persistence/01-what-gets-persisted/03-display-records.md`:
  `HarnessDisplayStateSnapshotV1`, `HarnessDisplayTokenUsageSnapshotV1`,
  `HarnessDisplayMessageSnapshotV1`, `HarnessDisplayToolSnapshotV1`,
  `HarnessDisplayPendingBaseSnapshotV1`,
  `HarnessDisplayPendingApprovalSnapshotV1`,
  `HarnessDisplayPendingSuspensionSnapshotV1`,
  `HarnessDisplayPendingQuestionSnapshotV1`,
  `HarnessDisplayPendingPlanSnapshotV1`,
  `HarnessDisplaySubagentSnapshotV1`, `HarnessDisplayTaskSnapshotV1`.
- §5.1b.1 — `05-session-persistence/01-what-gets-persisted/05-session-summary-records.md`:
  `SessionSummary`, `SessionLifecycleStatus`, `PendingInboxKind`,
  `SessionThreadLabel`, `SessionRunProjection`, `SessionGoalSummary`,
  `SessionChannelBindingSummary`, `SessionPendingInboxSummary`.
- §5.1b.2 — `05-session-persistence/01-what-gets-persisted/06-background-task-records.md`:
  `DurableWorkKind`, `DurableWorkStatus`, `DurableWorkProofKind`,
  `BackgroundTaskRowStatus`, `BackgroundTaskOwnerRef`,
  `BackgroundTaskRowBase`, `BackgroundTaskDiagnosticRow`,
  `BackgroundTaskReconstructableRow`, `BackgroundTaskStorageRow`,
  `ClaimableBackgroundTaskRow`.
- §5.1b.3 — `05-session-persistence/01-what-gets-persisted/07-durable-work-summary.md`:
  `DurableWorkSummary`.
- §5.1b.4 — `05-session-persistence/01-what-gets-persisted/08-activity-and-session-list-records.md`:
  `DurableWorkListSummary`, `DurableWorkSnapshotWindow`,
  `SessionMessageCursor`, `SessionMessageWindow`,
  `ActivityTimelineOptions`, `SessionActivityTimeline`,
  `ActivityTimelineEntryKind`, `ActivityTimelineSourceKind`,
  `ActivityTimelineEntry`, `SessionListItem`.
- §5.1c — `05-session-persistence/01-what-gets-persisted/09-session-snapshot.md`:
  `SessionSnapshot`.
- §5.1d — `05-session-persistence/01-what-gets-persisted/10-queue-admission-and-tombstones.md`:
  `QueuedItem`, `QueueAdmissionReceipt`, `OperationAdmissionTombstone`.
- §5.1e — `05-session-persistence/01-what-gets-persisted/11-background-wakeups-runs-and-attachments.md`:
  `HarnessWakeupItem`, `HarnessRunStatus`, `HarnessRunOperationRef`,
  `HarnessRunOperationalState`, `PersistedAttachment`,
  `PersistedRequestContextInput`.
- §5.1f — `05-session-persistence/01-what-gets-persisted/12-permissions-pending-and-inbox.md`:
  `SessionGrants`, `ToolApprovalReasonSource`, `PendingApproval`,
  `PendingToolSuspension`, `PendingQuestion`, `PendingPlanApproval`,
  `InboxResponseReceipt`.
- §5.1h — `05-session-persistence/01-what-gets-persisted/14-channel-records.md`:
  `ChannelBindingMode`, `ChannelBinding`,
  `HarnessProviderCallbackBindingStatus`, `HarnessProviderCallbackBinding`,
  `ChannelInboxItem`, `ChannelProviderDeliveryReceipt`, `ChannelOutboxItem`,
  `ChannelActionToken`, `ChannelActionReceipt`.
- §5.2a — `05-session-persistence/02-storage-shape/01-thread-message-session-methods.md`:
  `HarnessStorageDomain`.
- §6.1 — `06-tool-authoring-contract/01-harnessrequestcontext.md`:
  `SetStateFn`, `JsonValue`, `HarnessCustomEventInput`, `SuspendToolParams`.
- §7 — `07-sandbox-command-registry/00-section.md`: `SandboxConfig`,
  `CommandDefinition`.
- §9.1 — `09-configuration/01-harness-config.md`: `ListLimitConfig`.
- §9.2 — `09-configuration/02-runtime-registrations.md`:
  `BackgroundTaskExecutorRegistration`,
  `BackgroundTaskCompletionPolicyRegistration`, `IntervalHandler`.
- §9.3 — `09-configuration/03-channel-configuration.md`:
  `HarnessChannelConfig`, `ChannelIngressPolicy`, `ChannelDeliverySemantics`,
  `ChannelOutboxOperationKind`, `ChannelOutboxDeliveryPlan`,
  `HarnessChannelTransportRequest`, `HarnessChannelAdapter`,
  `HarnessChannelRouteContext`, `HarnessChannelDeliveryContext`,
  `ChannelIngressContext`, `ChannelIngressEnvelope`, `ChannelActionEnvelope`.
- §9.4 — `09-configuration/04-workspace-configuration.md`:
  `HarnessWorkspaceConfig`, `WorkspaceProvider`, `WorkspaceStateUpdate`,
  `WorkspaceCreateContext`, `WorkspaceResumeContext`, `WorkspaceFactoryFn`.
- §10.1 — `10-events/01-event-shape.md`: `HarnessEventBase`.
- §10.2 — `10-events/02-built-in-event-union.md`: `HarnessEventError`,
  `LifecycleEvent`, `StateEvent`, `TurnEvent`, `OperationEvent`,
  `ToolEvent`, `SubagentEvent`, `SuspensionEvent`, `AttachmentEvent`,
  `ChannelEvent`, `GoalEvent`, `StorageErrorEvent`, `CustomEventType`,
  `CustomEvent`.
- §13.1 — `13-mastra-server-integration/01-registration.md`:
  `HarnessChannelProviderSelector`.
- §13.3b — `13-mastra-server-integration/03-wire-protocol-sketch/02-request-payloads.md`:
  `JsonSchema`, `WireSchemaRef`, `WireSchemaDescriptor`, `MessageRequest`,
  `WireAttachment`, `SkillInvocationRequest`, `WireHarnessSkillDescriptor`,
  `WireListPage`.
- §13.3c — `13-mastra-server-integration/03-wire-protocol-sketch/03-conditional-session-version-mutations.md`:
  `ThreadSettingRequest`, `CloneThreadRequest`.
- §13.3e — `13-mastra-server-integration/03-wire-protocol-sketch/05-operation-result-lookups.md`:
  `MessageAdmissionResponse`, `QueueAdmissionResponse`,
  `MessageResultResponse`, `QueueExhaustedErrorProjection`,
  `QueueResultResponse`.
- §13.3f — `13-mastra-server-integration/03-wire-protocol-sketch/06-error-envelope.md`:
  `HarnessPublicErrorProjection`, `HarnessErrorResponseBase`,
  `HarnessErrorResponse`.
- §13.4e — `13-mastra-server-integration/04-client-sdk/05-pending-inbox-view-model.md`:
  `PendingInboxItemKind` (transparent alias of `PendingInboxKind` (§5.1b.1);
  the projection re-exports the canonical kind union rather than redeclaring
  it), `PendingInboxCardState`, `PendingInboxItemBase`, `PendingInboxItem`.
- §14 — `14-channels/00-section.md`: `ResolveChannelBindingOptions`,
  `ChannelIngressOptions`, `ChannelIngressResult`, `ChannelActionOptions`,
  `ChannelActionResult`, `ChannelOutboxEnqueueOptions`,
  `ChannelDispatchOptions`, `MastraChannelOperatorDispatchOptions`,
  `ChannelDispatchResult`.
- §14.3 — `14-channels/03-request-context.md`: `ChannelRequestContext`,
  `BaseChannelRequestContext`, `InboundChannelRequestContext`,
  `BindingBackedChannelRequestContext`.
- §14.5 — `14-channels/05-approval-and-inbox-bridge.md`:
  `ChannelActionAudience`.

Maintenance rule: when a new top-level `class`, `interface`, or `type` is
added to a non-example `sections/` file, add it to the appropriate §11.6c
section bucket; when a current-code shape is renamed, removed, or gains a
matching v1 export, update §11.6a or §11.6b. When referencing a child
section, use the heading-letter form (e.g. `§5.1b.2`, `§13.3d`), not the
file-ordinal form (`§5.1.6`, `§13.3.4`). File ordinals are filesystem state,
not section identity. Counts at this snapshot: 155 non-example `.md` files,
256 declared occurrences, 256 unique names, 20 exact overlaps with current
`../packages/{core,server,memory,mcp,deployer,cli}/src`.
