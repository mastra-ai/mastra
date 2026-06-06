# Clipboard paste

## Origin PR / commit

- PR: [#13712](https://github.com/mastra-ai/mastra/pull/13712) — added explicit Ctrl+V / Alt+V clipboard text and image paste handling in the TUI editor.
- Later changes: [#13953](https://github.com/mastra-ai/mastra/pull/13953) — wires editor image paste into real TUI pending images, `[image]` placeholders, optimistic rendering, and Harness file/image signal dispatch.

## User-visible behavior

- What the user can do: press Ctrl+V (or Alt+V) in the TUI editor to paste clipboard text or image data.
- Success looks like: text clipboard contents enter the editor through the bracketed-paste path; image clipboard contents add a pending image, insert a `[image]` marker, render optimistically, and submit as Harness file/image content.
- Must preserve: bracketed paste handling for terminal-native paste, remote/local image URL/path detection, stale pending-image dropping when the marker is removed, and normal editor shortcuts.

## Entry points / commands

- Commands / shortcuts / flags: Ctrl+V, Alt+V, terminal bracketed-paste markers.
- Automatic triggers: bracketed paste payloads that are empty, image file paths, or remote image URLs can become image attachments.

## TUI states

- Idle: editor accepts paste input and converts it before submit.
- Active / modal / error: paste state is editor-local; no persisted paste state should survive a failed submit.

## Headless / non-TUI behavior

- Supported: none verified; clipboard helpers are TUI/editor utilities.
- Not supported / unknown: headless `--prompt` clipboard ingestion.

## Streaming / loading / interrupted states

- Streaming / loading: pasted text/images affect only the next prompt being edited.
- Abort / retry / resume: already-submitted image/file parts rely on the chat attachment pipeline; editor clipboard state is transient.

## Streaming vs loaded-from-history behavior

- While actively streaming: clipboard paste is unavailable unless the editor is accepting queued/follow-up input.
- After reload / history reconstruction: only submitted text/file/image message parts remain; clipboard state is recomputed from the host clipboard.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Host clipboard text/image | OS clipboard via platform helpers | `CustomEditor.handleExplicitPaste()` |
| Bracketed paste buffer | `CustomEditor.pendingBracketedPaste` | Editor text insertion and image-source detection |
| Image paste callback | TUI/editor integration via `onImagePaste` | Pending-image state and attachment submit path |
| Pending pasted images | `TUIState.pendingImages` + `[image]` editor placeholders | Optimistic user rendering, queued follow-ups, Harness signal content |
| Local/remote image source | Pasted payload normalization | `readPastedImageSource()` |

## Key files

- `mastracode/src/clipboard/index.ts` — platform-specific text/image clipboard read/write helpers.
- `mastracode/src/tui/components/custom-editor.ts` — Ctrl+V/Alt+V handling, bracketed paste accumulation, image URL/path detection, and image-paste callback dispatch.
- `mastracode/src/tui/mastra-tui.ts` — real `onImagePaste` wiring, pending-image consumption, optimistic message rendering, queued follow-up image preservation, and Harness signal/file dispatch.
- `mastracode/src/clipboard/__tests__/index.test.ts` — macOS image extraction coverage.
- `mastracode/src/tui/components/__tests__/custom-editor.test.ts` — local path, file URL, remote URL, empty paste, and Alt+V explicit paste coverage.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — clipboard paste enters the same editor used for prompts and queued follow-ups.
- [File attachments in chat input](../chat/file-attachments.md) — pasted images must become message attachments after editor integration.
- [File autocomplete](./file-autocomplete.md) — shares editor shortcut handling and path-oriented input behavior.
- [Help and shortcuts](./help-and-shortcuts.md) — shortcut surface should include paste behavior if user-facing help expands.

## Existing tests

- `mastracode/src/clipboard/__tests__/index.test.ts` — macOS PNG/TIFF clipboard extraction and failure fallback.
- `mastracode/src/tui/components/__tests__/custom-editor.test.ts` — image path/URL paste handling, Ctrl+V explicit text paste through bracketed-paste markers, and Alt+V explicit image paste.
- `mastracode/src/tui/__tests__/mastra-tui-images.test.ts` and image cases in `mastra-tui-queueing.test.ts` — pending-image placeholder consumption, stale-image dropping, and image-only submissions.
- `mastracode/scripts/mc-e2e/scenarios/clipboard-image-paste.ts` — real PTY bracketed paste of a prepared PNG path, `[image]` editor insertion, submitted `[1 image]` confirmed history rendering, and AIMock-backed model response with nonzero request count.

## Missing tests

- Linux clipboard tests for `xclip` / `wl-paste` text and image fallbacks.
- [x] End-to-end TUI/Harness test proving a real pasted image goes through `onImagePaste` → pending image → submitted image attachment visible in confirmed TUI history: covered by `clipboard-image-paste`.
- Linux clipboard tests for `xclip` / `wl-paste` are deferred to a future Linux CI lane; the current darwin/local recovery run cannot execute those platform helper binaries hermetically.

## Known risks / regressions

- Pasted image ownership is split between editor-local placeholders and `TUIState.pendingImages`; removing or reordering `[image]` markers must not send stale images.
- Clipboard helpers use synchronous OS commands on paste events, so command timeouts and missing platform utilities can affect perceived editor responsiveness.
- Image extraction has a 50MB buffer cap on Linux; oversized clipboard images fail closed.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
