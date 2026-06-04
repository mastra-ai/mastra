# File attachments in chat input

## Origin PR / commit

- PR: [#13574](https://github.com/mastra-ai/mastra/pull/13574) — added Harness file attachment support with filename preservation and text-file handling.

## User-visible behavior

- What the user can do: send a chat message with attached files through `Harness.sendMessage({ content, files })`.
- Success looks like: text attachments are visible to the model as fenced text with a filename label; binary/non-text attachments remain file parts with media type and filename metadata.
- Must preserve: filenames survive storage/signal/model-message conversions, and old text-only callers continue to send plain string content.

## Entry points / commands

- Commands / shortcuts / flags: no direct slash command; programmatic Harness `sendMessage({ content, files })`.
- Automatic triggers: TUI image/file paste paths can pass collected attachments into Harness message send.

## TUI states

- Idle: pending attachment state can be accumulated before submit.
- Active / modal / error: submitted attachments travel with the user message; errors should not leave stale pending attachments.

## Headless / non-TUI behavior

- Supported: Harness API accepts `files` without requiring TUI components.
- Not supported / unknown: dedicated headless CLI attachment entry point was not verified.

## Streaming / loading / interrupted states

- Streaming / loading: files are converted before the signal is sent; streaming output does not change attachment payloads.
- Abort / retry / resume: persisted user-message signal data should preserve file parts for replay/rehydration.

## Streaming vs loaded-from-history behavior

- While actively streaming: `createMessageInput()` turns files into mixed signal content before `sendSignal()`.
- After reload / history reconstruction: message-list/signal adapters rehydrate file/image parts from persisted signal metadata or canonical message parts.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Pending files | Caller/TUI before submit | Harness `sendMessage()` |
| Submitted attachment payload | Harness signal content + persisted message parts | Agent model input, history rehydration |
| Text attachment projection | `Harness.createMessageInput()` | Model prompt input |
| Filename/media type | File part metadata | Signal, adapter, model-message conversion |

## Key files

- `packages/core/src/harness/harness.ts` — `sendMessage({ content, files })`, text-file fencing, binary file part preservation, signal-to-Harness content conversion.
- `packages/core/src/harness/types.ts` — Harness API message/input types.
- `packages/core/src/agent/message-list/adapters/AIV4Adapter.ts` — file parts to AI SDK v4 `experimental_attachments`.
- `packages/core/src/agent/message-list/adapters/AIV5Adapter.ts` — file/image URL/data URI conversion and duplicate legacy attachment avoidance.
- `packages/core/src/agent/__tests__/agent-signals.test.ts` — signal round-trip and legacy rehydration coverage for file parts.
- `packages/core/src/agent/message-list/prompt/attachments-to-parts.ts` — attachment normalization helper for model prompt parts.

## Dependencies / related features

- [Interactive chat](../tui/interactive-chat.md) — TUI submit path can attach pending files/images.
- [Prompt context and project instructions](./prompt-context.md) — attachments are part of per-run model input, not static prompt instructions.
- [Observational memory](../memory/observational-memory.md) — observer input must avoid losing or duplicating attachment context.

## Existing tests

- `packages/core/src/agent/__tests__/agent-signals.test.ts` — file signal contents, filename preservation, DB round-trip, legacy stash recovery.
- `packages/core/src/agent/message-list/adapters/AIV5Adapter-file-ui-part.test.ts` — URL/data-URI file/image parts and mixed text+file conversion.
- `packages/core/src/agent/message-list/prompt/attachments-to-parts.test.ts` — raw base64/data URI/URL attachment normalization.
- Existing base64/image tests cover `experimental_attachments` compatibility.

## Missing tests

- Direct Harness test for `sendMessage({ content, files })` proving text files become fenced text and binary files retain `filename`/`mediaType` through the signal.
- TUI attachment submit test proving pending images/files are cleared only after successful send and are preserved in history.
- Loaded-history display test for user messages with attached files/images.

## Known risks / regressions

- Text-file handling intentionally injects file content into model-visible text; large files or backtick-heavy content can affect prompt size and formatting.
- Attachment data shape crosses several compatibility layers (`mediaType` vs `mimeType`, v4 `experimental_attachments`, v5 file parts), so one adapter can regress while another still passes.
- Current coverage is stronger in signal/adapter layers than in Harness `sendMessage()` itself.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
