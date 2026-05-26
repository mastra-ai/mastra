---
'mastracode': patch
---

**Recover from stale Harness v1 session leases on startup.**

A crashed or killed MastraCode process used to block the next launch with an opaque `HarnessSessionLockedError`. The runtime now waits out the stale lease automatically (up to 60s on startup, 2s mid-session) and emits status messages while it retries.

After 5s of waiting, when stdin is a TTY, an interactive prompt offers `(W)ait / (F)orce-claim / (N)ew thread / (Q)uit`. The choice can also be set via environment variable for scripts, headless mode, or CI:

```bash
# Force-claim the foreign lease immediately on the next startup
MASTRACODE_LEASE_RECOVERY=force-claim mastracode

# Abandon the locked thread and start a new one
MASTRACODE_LEASE_RECOVERY=new-thread mastracode

# Fail fast with a recovery error instead of waiting
MASTRACODE_LEASE_RECOVERY=quit mastracode
```

When recovery times out or the user quits, the runtime throws a new `MastraCodeSessionLeaseRecoveryError` (exported from `mastracode`) carrying the underlying `HarnessSessionLockedError` as its `cause`, plus `sessionId`, `currentOwnerId`, and `expiresAt` fields for downstream handlers.

Also fixes a long-standing terminal-state bug surfaced by this scenario: after a crashed or `SIGKILL`'d MastraCode, the parent shell would stay stuck emitting raw CSI-u keypress sequences until manually `reset`. The CLI now restores pi-tui's keyboard mode (kitty progressive enhancement, modifyOtherKeys, bracketed paste) on `SIGINT`/`SIGTERM`/`SIGHUP`/`exit`/`uncaughtException`/`unhandledRejection`, and also emits the restore sequence once at launch so the next mastracode invocation cleans up after a prior ungraceful exit it couldn't trap.
