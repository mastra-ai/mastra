# Notification inbox signals

## Origin PR / commit

- PR: [#17241](https://github.com/mastra-ai/mastra/pull/17241) — adds thread-scoped notification records, notification/summary signal delivery, and the `notification_inbox` tool.
- Later changes: none known.

## User-visible behavior

- What the user can do: receive compact notification summaries in chat, then use `notification_inbox` to list, read, search, mark seen, dismiss, or archive pending notifications for the current thread.
- Success looks like: urgent/medium idle notifications deliver as inline notification cards, active-run low/medium notifications summarize instead of interrupting, high active notifications get an immediate summary plus later full delivery, and `read` can deliver unread details after a summary.
- Must preserve: thread scoping, priority-based delivery policy, dedupe/coalesce keys, persisted statuses, summary counts by source/priority, and agent guidance that tells the model when to call `notification_inbox`.

## Entry points / commands

- Commands / shortcuts / flags: `notification_inbox` tool actions `list`, `read`, `markSeen`, `dismiss`, `archive`, and `search`.
- Automatic triggers: `Agent.sendNotificationSignal(...)`, notification dispatch workflow/due dispatcher, and sources such as GitHub Signals creating notification records.

## TUI states

- Idle: notifications can stream as `NotificationComponent` cards when the target thread can accept signals.
- Active / modal / error: notification summaries render as inline system-spaced rows with the hint to inspect pending details through `notification_inbox`.

## Headless / non-TUI behavior

- Supported: core storage, delivery policy, dispatcher, workflow, and tool are UI-agnostic.
- Not supported / unknown: no dedicated headless formatter beyond the underlying signal/tool result payloads was verified.

## Streaming / loading / interrupted states

- Streaming / loading: notification and summary signals travel as signal/data parts and TUI handlers insert notification components before trailing assistant text.
- Abort / retry / resume: failed immediate delivery increments attempts and leaves records pending; due-dispatch and inbox `read` can retry/deliver later.

## Streaming vs loaded-from-history behavior

- While actively streaming: `handleMessageUpdate()` converts streamed `notification` / `notification_summary` parts into inline notification components.
- After reload / history reconstruction: `render-messages.ts` renders persisted notification content parts from `HarnessMessage` history.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Notification record | `NotificationRecord` in the notifications storage domain | dispatch policy, inbox tool, GitHub Signals, TUI signal rendering |
| Delivery policy | `resolveNotificationDeliveryDecision()` / `defaultNotificationDeliveryDecision()` | `Agent.sendNotificationSignal()`, dispatcher, priority batching |
| Summary signal metadata | `summarizeNotifications()` and `createNotificationSummarySignal()` | TUI summary component, inbox-guidance prompt, thread history |
| Inbox tool state | `createNotificationInboxTool({ storage })` | Mastra Code `notification_inbox`, tool guidance, unread detail delivery |
| TUI notification projection | `NotificationComponent` and `NotificationSummaryComponent` | streamed message updates and loaded history rendering |

## Key files

- `packages/core/src/notifications/types.ts` — notification priorities, statuses, record fields, and list/update input shapes.
- `packages/core/src/notifications/storage.ts` and `storage/domains/notifications/*` — storage boundary, filtering, status updates, and coalescing behavior.
- `packages/core/src/notifications/delivery-policy.ts` — urgent/high/medium/low active-vs-idle delivery decisions.
- `packages/core/src/notifications/dispatcher.ts` and `workflow.ts` — due notification dispatch, summary grouping, retries, and workflow helper.
- `packages/core/src/notifications/signals.ts` — notification and notification-summary signal creation/metadata.
- `packages/core/src/notifications/tool.ts` — `notification_inbox` CRUD/search/read implementation.
- `packages/core/src/agent/agent.ts` — public `sendNotificationSignal()` API.
- `mastracode/src/agents/tools.ts`, `tool-names.ts`, `permissions.ts`, and `agents/prompts/tool-guidance.ts` — Mastra Code tool registration, category, name, and usage guidance.
- `mastracode/src/tui/components/notification.ts`, `notification-summary.ts`, `handlers/message.ts`, and `render-messages.ts` — streamed and historical TUI rendering.

## Dependencies / related features

- [Agent signals and streaming follow-ups](./agent-signals.md) — notification signals reuse the agent signal stream/history path.
- [Processor state signals](./processor-state-signals.md) — notification parts share TUI inline-boundary handling with other signal variants.
- [Interactive TUI chat](../tui/interactive-chat.md) — notification cards render in the chat transcript.
- [GitHub signal subscriptions](../git/github-signal-subscriptions.md) — GitHub Signals is the first concrete notification producer verified in this batch.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — `notification_inbox` is registered as an edit-category tool.

## Existing tests

- `packages/core/src/notifications/notifications.test.ts` — storage filtering, coalescing, signal creation, inbox tool actions, delivery policy, dispatcher, and workflow helper.
- `packages/core/src/agent/__tests__/agent-signals.test.ts` — `sendNotificationSignal()` idle delivery, rejection persistence, active priority batching, urgent overrides, and summary delivery.
- `mastracode/src/agents/extra-tools.test.ts` — tool registration, category, tool-guidance inclusion, and Mastra Code wrapper coverage proving `notification_inbox read` reaches the notifications storage domain, delivers unread details, and marks records seen for the current thread.
- `mastracode/src/tui/__tests__/render-messages.test.ts` — loaded-history notification and summary rendering.
- `mastracode/src/tui/handlers/__tests__/message.test.ts` — streamed notification and summary rendering.

## Missing tests

- End-to-end Mastra Code run where a summarized notification appears, the model calls `notification_inbox read`, and the full notification is delivered into the same thread.
- Persistence/reload regression covering pending, delivered, seen, dismissed, archived, and coalesced notification records across a real storage backend.

## Known risks / regressions

- Notification delivery spans storage, signal runtime, TUI rendering, and model tool guidance; regressions can either silently hide urgent work or interrupt active runs too aggressively.
- `notification_inbox` is an edit-category tool because it mutates inbox status, so permission/category changes can block unread delivery.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
