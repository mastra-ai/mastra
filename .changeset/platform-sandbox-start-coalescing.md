---
'@mastra/platform-workspace': patch
---

Coalesce concurrent `PlatformSandbox.start()` callers onto a single in-flight attempt

Two callers hitting `start()` on the same instance before the first one resolves used to both race to `POST /v1/projects/:pid/sandbox` (or `GET /sandbox/:id` on the reattach path), burning N proxy provisions and leaving `N-1` stray sandboxes behind. Fleet-level coalescing on the caller side masked most of this, but the underlying invariant "providers move in lockstep" was false — `@mastra/railway` `RailwaySandbox` has always had `_startInFlight` coalescing.

`start()` now publishes a single shared promise via `??=` **before** the first `await`, so a second caller entering `start()` while the first is mid-round-trip joins the existing promise instead of racing past the null check. The slot is cleared in `.finally()` on both success and failure paths so a failed attempt isn't a permanent latch — the next call starts fresh. Failures propagate to every joined caller.

Bug fix; no public API surface change. Callers already awaiting `start()` see the same success/failure semantics; the only observable difference is one upstream call instead of N.
