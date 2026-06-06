# File attachments in chat input

## Origin PR / commit

- PR: [#13574](https://github.com/mastra-ai/mastra/pull/13574) — added Harness file attachment support with filename preservation and text-file handling.
- Later changes: [#13712](https://github.com/mastra-ai/mastra/pull/13712) — added editor-level clipboard image/text paste helpers; [#13953](https://github.com/mastra-ai/mastra/pull/13953) — wires TUI pasted images into pending attachments and teaches observational memory to preserve/estimate image/file parts.

## User-visible behavior

- What the user can do: send a chat message with attached files through `Harness.sendMessage({ content, files })` or pasted images through the TUI editor.
- Success looks like: text attachments are visible to the model as fenced text with a filename label; binary/non-text/image attachments remain file/image parts with media type and filename metadata; OM can observe attachment placeholders plus the actual image/file parts.
- Must preserve: filenames survive storage/signal/model-message conversions, pasted-image markers map only to selected pending images, and old text-only callers continue to send plain string content.

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
| Pending files/images | Caller/TUI before submit (`TUIState.pendingImages` for pasted images) | Harness `sendMessage()` / `sendSignal()` |
| Submitted attachment payload | Harness signal content + persisted message parts | Agent model input, history rehydration, observational memory |
| Text attachment projection | `Harness.createMessageInput()` | Model prompt input |
| Attachment token estimates | `providerMetadata.mastra.tokenEstimate` + memory `TokenCounter` cache | Observational memory thresholds/context budgets |
| Filename/media type | File part metadata | Signal, adapter, model-message conversion, observer attachment labels |

## Key files

- `packages/core/src/harness/harness.ts` — `sendMessage({ content, files })`, text-file fencing, binary file part preservation, signal-to-Harness content conversion.
- `packages/core/src/harness/types.ts` — Harness API message/input types.
- `packages/core/src/agent/message-list/adapters/AIV4Adapter.ts` — file parts to AI SDK v4 `experimental_attachments`.
- `packages/core/src/agent/message-list/adapters/AIV5Adapter.ts` — file/image URL/data URI conversion and duplicate legacy attachment avoidance.
- `packages/core/src/agent/__tests__/agent-signals.test.ts` — signal round-trip and legacy rehydration coverage for file parts.
- `packages/core/src/agent/message-list/prompt/attachments-to-parts.ts` — attachment normalization helper for model prompt parts.
- `mastracode/src/tui/mastra-tui.ts` — pasted-image pending state, placeholder consumption, optimistic image rendering, and Harness signal/file dispatch.
- `packages/memory/src/processors/observational-memory/observer-agent.ts` and `token-counter.ts` — attachment placeholders, observer input parts, and provider-aware attachment token estimates.

## Dependencies / related features

- [Interactive chat](../tui/interactive-chat.md) — TUI submit path can attach pending files/images.
- [Clipboard paste](../tui/clipboard-paste.md) — editor-level image paste can become pending image attachments.
- [Prompt context and project instructions](./prompt-context.md) — attachments are part of per-run model input, not static prompt instructions.
- [Observational memory](../memory/observational-memory.md) — observer input must avoid losing or duplicating attachment context.

## Existing tests

- `packages/core/src/harness/signal-messages.test.ts` — direct Harness message input shield for `sendMessage({ content, files })`: text attachments become labeled fenced text, binary file parts preserve `filename`/`mediaType`, and text fences outgrow embedded backtick runs.
- `packages/core/src/agent/__tests__/agent-signals.test.ts` — file signal contents, filename preservation, DB round-trip, legacy stash recovery.
- `packages/core/src/agent/message-list/adapters/AIV5Adapter-file-ui-part.test.ts` — URL/data-URI file/image parts and mixed text+file conversion.
- `packages/core/src/agent/message-list/prompt/attachments-to-parts.test.ts` — raw base64/data URI/URL attachment normalization.
- `mastracode/src/tui/__tests__/mastra-tui-images.test.ts` and image cases in `mastra-tui-queueing.test.ts` — pending pasted-image placeholder behavior.
- `packages/memory/src/processors/observational-memory/__tests__/observational-memory.test.ts` and `token-counter.test.ts` — observer attachment formatting, tool-result attachment hoisting, image-heavy threshold checks, and attachment token estimates.
- Existing base64/image tests cover `experimental_attachments` compatibility.

## Missing tests

- TUI attachment submit test proving pending images/files are cleared only after successful send and are preserved in history.
- End-to-end test from real paste through Harness persistence and OM observation.
- Loaded-history display test for user messages with attached files/images.

## Known risks / regressions

- Text-file handling intentionally injects file content into model-visible text; large files or backtick-heavy content can affect prompt size and formatting.
- Attachment data shape crosses several compatibility layers (`mediaType` vs `mimeType`, v4 `experimental_attachments`, v5 file parts, observer `image`/`file` parts), so one adapter can regress while another still passes.
- Current coverage is stronger in signal/adapter/OM layers than in full TUI-to-Harness submission.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
