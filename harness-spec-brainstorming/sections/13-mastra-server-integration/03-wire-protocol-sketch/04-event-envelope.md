### 13.3d Event Envelope

**Event envelope** for per-session `/events` SSE streams:

```
id: <epoch>-<seq>
event: <event-type>
data: <json>
```

Each event uses the epoch-prefixed, session-scoped ID shape defined in §10.1
and §10.5.

Resume on reconnect for `/events` uses the standard `Last-Event-ID` header and
the §10.5 replay contract. The direct `messages?stream=true`
`AgentStream.textStream` body follows the live-only retry rule in §4.2 and
§13.2, not this replay contract. When §10.5 requires `412 Precondition Failed`
for a replay gap, the HTTP route returns that status; the client recovers by
refetching `GET /sessions/:sessionId` and resubscribing. The returned
`SessionSnapshot` includes `displayState: HarnessDisplayStateSnapshotV1` as a
point-in-time render snapshot, not durable event replay. Clients that need
history beyond the snapshot's bounded message window follow the snapshot's
message cursor and fetch `GET /threads/:threadId/messages` for the persisted
message log.

SSE authentication follows §13.2's auth-transport rule. `Last-Event-ID` never
proves identity or authority; it only selects a replay point after the route has
authenticated and authorized the caller. SDKs and fetch-based clients use the
normal `Authorization` header or deployment-secure cookies for both initial
subscription and reconnect. A browser-native `EventSource` fallback may carry
only the scoped subscription token described in §13.2, and only on the
per-session `/events` route. If that token expires or is rejected on reconnect,
the server returns the transport auth failure before streaming; the client
reacquires authorization through a normal header/cookie-authenticated request,
then opens a fresh SSE connection with the previous `Last-Event-ID`. Scoped
subscription tokens are never persisted in Harness records, never included in
request-context hashes, and never forwarded as `mastra__authToken`.
