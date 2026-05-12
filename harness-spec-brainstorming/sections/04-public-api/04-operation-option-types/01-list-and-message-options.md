### 4.4a List and Message Options

```ts
interface ListPageOptions {
  cursor?: string;
  limit?: number;
}

interface ListPage<T> {
  items: T[];
  nextCursor?: string;
  truncated: boolean;
}

interface ListMessagesOptions extends ListPageOptions {
  // Defaults to chronological `asc`. `desc` is for recent-window reads; the
  // cursor still uses the stable `(createdAt, id)` message key.
  order?: 'asc' | 'desc';
}

interface ListThreadsOptions extends ListPageOptions {}

interface ListSessionsOptions extends ListPageOptions {
  includeClosed?: boolean;
}

interface MessageOptions<S extends PublicSchema | undefined = undefined> extends HarnessOverrides {
  content: string;
  files?: FileAttachment[];
  // Optional caller-supplied idempotency key for signal-driven messages from
  // retrying transports. Normal interactive callers omit this. Channel/webhook
  // bridges set it so retries do not create duplicate signals after a crash.
  // The harness passes this to the underlying signal boundary and returns the
  // original accepted signal/run metadata on duplicate admission. Not valid
  // with `sync: true` / `output`, because that form bypasses signals.
  admissionId?: string;
  // `output` requires `sync: true`. Together they select the explicit
  // sync-generate message form: it calls agent.generate() on a fresh runId,
  // bypasses the signal pathway, is not retry-safe in v1, and is the only
  // message form that can throw HarnessBusyError.
  output?: S;
  sync?: boolean;
  // `stream: true` returns `Promise<AgentStream>`. The promise resolves at
  // the admission boundary (rejecting with the same admission errors as the
  // non-stream form); after that the stream carries chunks of the turn that
  // answers this signal. Mutually exclusive with `output` and `sync: true`.
  stream?: boolean;
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

```
