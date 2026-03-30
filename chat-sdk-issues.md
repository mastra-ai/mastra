# Chat SDK (`vercel/chat`) — Issues Encountered

Issues discovered during the Mastra Channels integration (`@mastra/core` + `chat` SDK v4.20.2–v4.23.0).

---

## 1. Discord: `convertButtonElement` drops `button.value`

**Package:** `@chat-adapter/discord`
**File:** `packages/adapter-discord/src/cards.ts`
**Severity:** Limitation — Discord API only has `custom_id` (100 chars), no separate `value` field

`convertButtonElement` maps `ButtonElement` to Discord's `APIButtonComponent` but only uses `button.id` for `custom_id`, completely discarding `button.value`. On the receiving side, `handleComponentInteraction` in `index.ts` sets both `actionId` and `value` to the raw `customId` string.

This is partly a Discord API limitation: buttons only have a single `custom_id` field (max 100 characters) with no separate `value` field. The SDK's `Button({ id, value })` abstraction doesn't map cleanly to Discord's model.

**Our workaround:** We encode the `runId` directly in the button `id` (e.g., `tool_approve:<runId>`) and use a catch-all `onAction` handler that parses the prefix. Cosmetic data (`toolName`, `argsSummary`) is stored in an in-memory `pendingApprovals` map — it's best-effort and lost on restart, but the approval/denial flow still works without it since `resumeStream` only needs the `runId`.

**Remaining concern:** The SDK's `onAction("exact-id", handler)` overload cannot be used with dynamic IDs. If the SDK supported prefix matching or predicate-based filtering, this pattern would be cleaner. Additionally, if `button.value` data exceeds what can fit in the 100-char `custom_id`, there's no way to pass it through Discord without external storage.

**Existing issue:** None found as of 2026-03-30.

---

## 2. Discord: Duplicate text + embed rendering for Cards

**Package:** `@chat-adapter/discord`
**File:** `packages/adapter-discord/src/index.ts`
**Severity:** Bug — visual duplication on every card message

When posting a `CardElement`, the Discord adapter renders *both* `payload.content` (via `cardToFallbackText`) and `payload.embeds` (via `cardToDiscordPayload`). Discord displays both simultaneously, resulting in the card content appearing twice — once as plain text above the embed and once inside the embed itself.

Additionally, the adapter uses `extractCard()` which strips the `PostableCard` wrapper, ignoring any custom `fallbackText` the user provides. Even wrapping in `{ card, fallbackText: " " }` won't suppress the duplicate because the adapter auto-generates fallback from the card structure.

**Impact:** Every card message on Discord shows duplicated content. Purely cosmetic but looks broken.

**Existing issue:** [#246](https://github.com/vercel/chat/issues/246)

---

## 3. Telegram: Legacy `Markdown` parse mode causes entity parse failures

**Package:** `@chat-adapter/telegram`
**File:** `packages/adapter-telegram/src/index.ts`
**Severity:** Bug — crashes message delivery for formatted content

The Telegram adapter uses `parse_mode: "Markdown"` (legacy) instead of `"MarkdownV2"`. Legacy Markdown has severe limitations:
- No support for nested formatting (e.g., bold inside code)
- No proper escaping mechanism for special characters
- Mismatched or nested asterisks cause `Bad Request: can't parse entities`

When a `CardElement` is posted:
1. `cardToFallbackText` wraps the card title in `*...*` (bold)
2. If the card title or children contain `**bold**` markdown, the result has triple asterisks (`***text**...`) 
3. Telegram's API rejects this with `ValidationError: Bad Request: can't parse entities at byte offset N`

This also affects any `CardText` containing markdown formatting — backticks, asterisks, or brackets can all trigger parse failures.

**Impact:** Tool call cards, approval cards, and any formatted card content fails to post on Telegram. The `formatError` hook catches the error, but the original message is lost.

**Recommended fix:** Switch to `MarkdownV2` parse mode and properly escape special characters (`. - ( ) ! > # + = | { }`) outside of entities. `MarkdownV2` supports all current formatting plus underline, strikethrough, and spoilers.

**Related issue:** [#276](https://github.com/vercel/chat/issues/276) (different symptom — empty edit validation error, but same root cause: legacy Markdown limitations)

**Existing issue for this specific failure:** None found as of 2026-03-30.

---

## 4. Slack: `onAction` creates unwanted sub-threads in DMs

**Package:** `@chat-adapter/slack`  
**File:** `packages/adapter-slack/src/index.ts`
**Severity:** Bug — breaks conversation flow in DMs

When a user clicks an interactive button (e.g., tool approval) in a Slack DM, the adapter's `handleBlockActions` sets `threadTs` to the message's own timestamp if `thread_ts` is missing (line ~1246). The SDK then creates a thread rooted at the card message, causing all subsequent replies to appear as a sub-thread instead of continuing the flat DM conversation.

**Impact:** In DMs, clicking a button causes the bot's response to appear in a nested "thread" under the card message. The user sees "2 replies" on the card and has to click into it to see the result. This breaks the expected flat DM flow.

**Workaround:** In `onAction`, reconstruct the original `ThreadImpl` from stored/encoded thread data instead of using `event.thread`. We encode the original `threadId` and `platform` in the button's `value` JSON and reconstruct the thread explicitly.

**Existing issue:** None found as of 2026-03-30.

---

## 5. Slack: `event.thread.post(asyncIterable)` fails in `onAction` with `team_not_found`

**Package:** `@chat-adapter/slack`
**Severity:** Bug

Posting an async iterable (streaming response) via `event.thread.post()` inside an `onAction` handler fails with a `team_not_found` error.

**Existing issue:** [#313](https://github.com/vercel/chat/issues/313)

---

## 6. `detectMention` fails in multi-workspace OAuth mode

**Package:** `chat`
**File:** `packages/chat/src/chat.ts`
**Severity:** Bug

`detectMention` fails when operating in multi-workspace OAuth mode, causing `onNewMention` to never fire when `message.channels` is subscribed.

**Existing issue:** [#308](https://github.com/vercel/chat/issues/308)

---

## Summary

| # | Issue | Adapter | Existing Issue | Severity |
|---|-------|---------|----------------|----------|
| 1 | Button `value` dropped in Discord | Discord | **Not filed** | Low (worked around) |
| 2 | Duplicate text + embed for Cards | Discord | #246 | Medium |
| 3 | Legacy Markdown parse failures | Telegram | **Not filed** | High |
| 4 | `onAction` creates sub-threads in DMs | Slack | **Not filed** | Medium |
| 5 | `team_not_found` in `onAction` streaming | Slack | #313 | High |
| 6 | `detectMention` fails multi-workspace | Core | #308 | High |
