### 2.6 Local vs remote

The harness ships two session types and one shared interface.

- **`Session`** (in-process) — `mastra.getHarness('coding').session(...)`. Full
session surface: messaging, queue, workspace handles, in-memory state, custom
tool registration on per-turn overrides, function-valued state updates, and
direct per-session subscriptions. Most method calls are synchronous JS calls
into the same process; reads that the in-process harness can serve from memory
(`getState`, `getDisplayState`) are sync. `getDisplayState` still returns the v1
JSON-safe `HarnessDisplayStateSnapshotV1`; implementations may keep richer
Map/Date render state internally but normalize before public delivery.
Local-only Harness surfaces such as `harness.onInterval(...)` and cross-session
`harness.subscribe(...)` live on `Harness`, not `Session`.
- **`RemoteSession`** (remote SDK) —
`mastraClient.getHarness('coding').session(...)`. A **strict subset** of
`Session` exposed over HTTP/SSE. Anything that does not cross the wire (raw
workspace handles, function-valued `addTools`, the functional form of
`setState`, `refreshSkills`) is omitted from the type entirely, so misuse is a
compile-time error rather than a runtime surprise. See §13.5 for the exact list.
Reads served from memory in-process (`getState`, `getDisplayState`) become async
over the wire, since the SDK has to fetch them.
- **`RemoteSafeSession`** (shared interface) — the portable session contract
that both `Session` and `RemoteSession` satisfy. Code intended to run in-process
or through the remote SDK should accept this type rather than the full local
`Session`. §4.8 owns the exact declaration, import map, method signatures,
identity fields, and `Awaitable<T>` helper. §13.5 owns the local-only exclusions
and explains the local/remote wrapper asymmetry, including which memory-served
reads may be sync locally but async remotely and why persisted mutators remain
`Promise`-returning on both surfaces. Portable callers should `await`
`RemoteSafeSession` results; in-process callers that need cheaper sync reads or
local-only powers narrow to `Session` explicitly.

Code that needs to run in both environments should be authored against
`RemoteSafeSession`, not `Session`. Code that only ever runs in-process (a TUI
host, a server-side workflow, a built-in tool) is free to use the full `Session`
surface.

This means the same UI or backend job can target a local harness or a remote
Mastra Server by importing the right client and constraining itself to
`RemoteSafeSession` — without implying that every method on a local `Session` is
portable to `RemoteSession`.
