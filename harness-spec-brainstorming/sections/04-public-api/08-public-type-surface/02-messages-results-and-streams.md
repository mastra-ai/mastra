### 4.8b Messages, Results, and Streams

```ts
// Public thread-message projection returned by Session and Harness thread
// read APIs. It is JSON-safe and uses epoch milliseconds, not Date objects or
// provider-native message instances. Storage/message-log ownership lives in
// §5.1; route pagination lives in §13.2/§13.3.
interface HarnessMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: HarnessMessageContent[];
  createdAt: number;
  stopReason?: 'complete' | 'tool_use' | 'aborted' | 'error';
  errorMessage?: string;
}

type HarnessMessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_call'; id: string; name: string; args: JsonValue }
  | { type: 'tool_result'; id: string; name: string; result: JsonValue; isError: boolean }
  | { type: 'system_reminder'; message: string; reminderType?: string; path?: string; precedesMessageId?: string; gapText?: string; gapMs?: number; timestamp?: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'file'; data: string; mediaType: string; filename?: string }
  | { type: 'om_observation_start'; tokensToObserve: number; operationType?: 'observation' | 'reflection' }
  | { type: 'om_observation_end'; tokensObserved: number; observationTokens: number; durationMs: number; operationType?: 'observation' | 'reflection'; observations?: string; currentTask?: string; suggestedResponse?: string }
  | { type: 'om_observation_failed'; error: string; tokensAttempted?: number; operationType?: 'observation' | 'reflection' }
  | { type: 'om_thread_title_updated'; threadId: string; oldTitle?: string; newTitle: string };

// Operation-scoped terminal success result for non-stream `message(...)`,
// `queue(...)`, and untyped `useSkill(...)`. Typed `sync: true` generation and
// typed skill calls return `InferPublicSchema<S>` directly and do not use this
// envelope. If those typed paths are implemented with current
// `Agent.generate(..., { structuredOutput })`, the public value is the
// `FullOutput<T>.object` projection only; the `FullOutput` wrapper is not a
// public Harness type. Failures and expired lookups are represented by
// operation error states (§10.2, §13.3), not by AgentResult.
interface AgentResult {
  readonly runId: string;
  readonly signalId: string;
  readonly queuedItemId?: string;
  readonly admissionId?: string;
  // Canonical thread-message records attributable to this operation. A
  // successful tool-only turn may have no assistant text but still has terminal
  // operation evidence.
  readonly messageIds: string[];
  readonly text?: string;
  readonly content?: JsonValue[];
  readonly toolCalls?: AgentToolCallSummary[];
  // Present only when usage can be attributed to this operation rather than
  // merely to the enclosing run.
  readonly usage?: TokenUsage;
  readonly finishReason?: string;
  readonly completedAt: number;
  // JSON-normalized provider metadata. Provider-native objects, credentials,
  // handles, functions, and non-JSON values do not cross this boundary.
  readonly providerMetadata?: JsonValue;
}

interface AgentToolCallSummary {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly status: 'completed' | 'failed';
  readonly isError?: boolean;
  // Bounded, JSON-safe public projection only; full tool event streams and raw
  // tool payloads remain with their owning event/message records.
  readonly result?: JsonValue;
  readonly subagentSessionId?: string;
}

// When AgentResult is embedded in an operation event, result lookup response,
// signal-result status, queue receipt, or reconstructed storage result, its
// identity fields must exactly match the enclosing carrier/ledger values. The
// carrier remains the routing and indexing authority; a mismatch is corrupt
// serialization and the nested result must not override carrier identity.
// AgentStream is the public Harness facade for `message({ stream: true })`;
// it does not expose the current MastraModelOutput object directly.
// `textStream` is the only v1 AgentStream chunk surface: it yields plain
// strings. Structured `text_delta`, tool, final, and error observations remain
// HarnessEvent or result-lookup shapes owned by §10 and §13, not AgentStream
// iteration types.
interface AgentStream {
  readonly runId: string;
  readonly signalId: string;
  readonly textStream: AsyncIterable<string>;
}

```
