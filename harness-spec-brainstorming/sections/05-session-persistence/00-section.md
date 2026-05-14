## 5. Session persistence

Sessions are durable. The runtime `Session` object is a hydrated cache of a `SessionRecord` row stored in `MastraStorage` under a new `harness` domain.

This makes the Harness usable in three deployment shapes without changing the surface:
- **Single-user TUI** — one process, one user, sessions resume across restarts.
- **Multi-tenant server** — many users, many concurrent sessions; clients hold a session ID and reconnect across requests.
- **Mobile/web with intermittent connectivity** — phone disconnects, server flushes, laptop picks up where the phone left off.
