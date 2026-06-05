# GitHub signal subscriptions

## Origin PR / commit

- PR: [#17447](https://github.com/mastra-ai/mastra/pull/17447) — adds experimental GitHub PR subscriptions backed by reactive signals, gitcrawl sync, polling, and notification delivery.
- Later changes: [#17538](https://github.com/mastra-ai/mastra/pull/17538) — auto-subscribes each thread to the checked-out branch PR at `agent_end` when experimental GitHub Signals are enabled.

## User-visible behavior

- What the user can do: enable experimental GitHub Signals, subscribe/unsubscribe the current thread to a PR, inspect subscription status, sync subscribed PRs, and receive notifications for CI/review/mergeability/closure activity.
- Success looks like: `/github subscribe 123` stores thread metadata, syncs the PR through gitcrawl, emits a status signal, optionally sends a baseline notification, polls at the configured interval, and turns meaningful snapshot changes into notification inbox records; when the current git branch has an open PR, the TUI silently auto-subscribes the active thread once after an agent run ends.
- Must preserve: single-thread polling ownership, deduped subscribe signals, snapshot cursor fields, bot/noise suppression, CI failure/recovery classification, review-thread notifications, and hidden subscribe/unsubscribe operation signals in chat history.

## Entry points / commands

- Commands / shortcuts / flags: `/github subscribe <pr>`, `/github unsubscribe <pr>`, `/github sync`, `/github status`; tools/signals `github_subscribe_pr` and `github_unsubscribe_pr`.
- Automatic triggers: output processor detects PR-work evidence and emits a one-time subscription hint; input processor handles subscribe/unsubscribe reactive signals; polling syncs subscribed PRs; TUI `handleAgentEnd()` calls `tryAutoSubscribeToBranchPR()` once per thread after agent completion.

## TUI states

- Idle: subscription commands show modal/status feedback and polling can deliver GitHub notifications through the notification inbox system.
- Active / modal / error: subscribe/unsubscribe operation signals are hidden in normal chat rendering; user-facing status appears through `github-sync-status` / command feedback.

## Headless / non-TUI behavior

- Supported: `GithubSignals` is a core Processor-style integration that can run without the TUI when configured with thread storage and a sync client.
- Not supported / unknown: interactive `/github` command UX is TUI-specific.

## Streaming / loading / interrupted states

- Streaming / loading: processor input steps handle subscribe/unsubscribe signals before model execution; output steps can emit subscription hints after a response mentions PR work; TUI agent-end cleanup can fire a branch-PR auto-subscribe after the run finishes without blocking the completed response.
- Abort / retry / resume: polling stores cursors in thread metadata so later syncs compare against the last observed PR snapshot rather than chat render state.

## Streaming vs loaded-from-history behavior

- While actively streaming: GitHub status/hint notifications flow as reactive or notification signals.
- After reload / history reconstruction: thread metadata under `metadata.mastra.githubSignals` restores subscriptions and cursors; TUI hides raw subscribe/unsubscribe reactive signals to avoid duplicate UI.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| GitHub subscriptions | Thread metadata `metadata.mastra.githubSignals.subscriptions` | `/github` command, `GithubSignals` processor, polling state, status-line badges |
| PR snapshot cursor | `GithubPRSubscription.lastObserved*` fields | activity classifier, dedupe, polling diff decisions |
| Repository resolution | `GitRemoteRepositoryResolver` or configured owner/repo | subscribe commands/signals using number-only PR references |
| Polling timers | `GithubSignals` per-thread polling map | background sync, `syncThreadNow`, status/debug command |
| Branch auto-subscribe guard | module-level `autoSubscribeCheckedThreads` set in `agent-lifecycle.ts` | one-time per-thread `agent_end` auto-subscribe attempts |
| GitHub notification records | notification inbox records with `source: 'github'` | notification inbox tool, TUI notification cards, model prompt guidance |

## Key files

- `mastracode/src/github-signals/index.ts` — signal factories, processor, gitcrawl sync client, repository resolver, polling, subscription metadata, snapshot hashing, and notification classification.
- `mastracode/src/tui/commands/github.ts` — `/github` subscribe/unsubscribe/sync/status command handling, thread-metadata display, branch PR detection via `gh pr view`, and `tryAutoSubscribeToBranchPR()`.
- `mastracode/src/tui/handlers/agent-lifecycle.ts` — once-per-thread `agent_end` hook that triggers branch PR auto-subscribe after a run completes.
- `mastracode/src/tui/event-dispatch.ts`, `status-line.ts`, and notification components — GitHub signal/status projection in the TUI.
- `mastracode/src/onboarding/settings.ts` and settings UI components — `experimentalGithubSignals` setting persistence.
- `mastracode/src/index.ts` — wires `GithubSignals` into input processors when the experimental setting is enabled.
- `packages/core/src/notifications/*` — GitHub activity notifications are delivered through the shared notification inbox system.

## Dependencies / related features

- [Notification inbox signals](../chat/notification-inbox-signals.md) — GitHub activity is delivered as notification records/signals.
- [Agent signals and streaming follow-ups](../chat/agent-signals.md) — subscribe/unsubscribe/status/hint messages use reactive signal plumbing.
- [Processor state signals](../chat/processor-state-signals.md) — hidden reactive-signal filtering prevents raw GitHub operation signals from duplicating UI.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — `experimentalGithubSignals` is a persisted signal setting.
- [Persistent conversations](../threads/persistent-conversations.md) — subscriptions are thread-scoped metadata.

## Existing tests

- `mastracode/src/github-signals/index.test.ts` — signal factories, subscription hints, subscribe/unsubscribe processing, polling, sync client, snapshot normalization/classification, metadata updates, and notification delivery.
- `mastracode/src/tui/commands/__tests__/github.test.ts` — command parsing/status/sync behavior plus `tryAutoSubscribeToBranchPR()` branch detection, disabled setting guard, missing processor guard, no-current-PR no-op, and swallowed subscribe errors.
- `mastracode/src/__tests__/index.test.ts` — enabling `experimentalGithubSignals` wires the processor and starts polling for existing subscriptions.
- `mastracode/src/tui/__tests__/render-messages.test.ts` and `handlers/__tests__/message.test.ts` — raw GitHub subscribe/unsubscribe reactive signals are hidden from chat rendering.

## Missing tests

- Full local integration with a real gitcrawl database and GitHub CLI/git remote configuration.
- End-to-end TUI run from `/github subscribe` through polling, notification summary, `notification_inbox read`, and thread reload.
- Multi-thread/process polling handoff regression for more than one open Mastra Code process.
- Direct `handleAgentEnd()` lifecycle test proving auto-subscribe runs once per thread and does not run on abort/error cleanup paths unless intentionally added.

## Known risks / regressions

- The feature depends on external gitcrawl data and GitHub state; stale/corrupt sync data can produce noisy or missing notifications.
- Polling intentionally keeps only one thread active at a time, so future multi-thread watch behavior must revisit timer ownership.
- Branch auto-subscribe depends on local `gh pr view` and a module-level once-per-thread guard; a stale guard or branch change in the same thread can skip a later desired subscription attempt.
- Activity classification suppresses bot/noisy/pending states; overly broad suppression can hide important review/CI changes.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
