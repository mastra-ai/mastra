---
'@mastra/core': minor
'mastracode': minor
---

Added MastraCode GitHub PR signal subscriptions. MastraCode now wires a local `GithubSignals` controller into its code agent, explicitly rehydrates persisted subscriptions at startup, shows active PR subscriptions in the status line, emits a one-time subscription hint when recent activity looks like PR work, and renders GitHub CI, comment, review, pending, and command-error reminders with GitHub-specific styling and structured PR/user metadata.

GitHub notification polling now uses a shared LibSQL-backed inbox cache in the MastraCode database. This intentionally replaces the filesystem JSON/lockfile cache design for MastraCode with the existing local database so cache writes, indexed per-PR reads, master lease state, and rate-limit state are all coordinated through one durable store. One local process acquires the account lease, polls `gh api /notifications` with ETags, writes bounded per-PR notification rows, and other MastraCode instances read the shared cache for their subscribed PRs. Active-run notifications are queued behind a compact pending reminder and can be delivered with `github({ action: 'pending' })` or by the five-minute pending flush. Comment and review notifications remain gated to authorized repository contributors or configured bots, and shared rate-limit state prevents repeated reminder spam while GitHub is limiting requests.
