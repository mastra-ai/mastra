### 4.5c Abort Errors

```ts
type HarnessAbortReason =
  | 'agent_aborted'
  | 'parent_aborted'
  | 'session_closed'
  | 'process_restart';

class HarnessAbortedError extends Error {
  readonly sessionId: string;
  readonly reason: HarnessAbortReason;
  // For `parent_aborted`, the parent session whose abort propagated here.
  // Absent for the other reasons.
  readonly parentSessionId?: string;
}

```
