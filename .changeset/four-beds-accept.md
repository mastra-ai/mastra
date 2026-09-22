---
'@mastra/playground-ui': major
---

Chat events now have one shell. `ChatEvent` is exported and owns both presentations through `density`: `row` for a dense transcript line, `card` for a block in a conversation. `ChatSignal`, `ChatNotification` and `ChatSkill` are presets over it, so a system reminder and a state signal are the same component with a different icon and body — not two implementations.

```tsx
import { ChatEvent } from '@mastra/playground-ui/components/ai/chat-event';

<ChatEvent density="card" collapsible icon={<FileText className="size-4" />} label="System reminder" detail="/repo/AGENTS.md" aria-label="Signal: system reminder">
  <Txt variant="meta" font="mono">Keep changes scoped to the requested package.</Txt>
</ChatEvent>;
```

**A row only folds when its body says more than its line**

A short single-line message fits in the row preview, so opening the disclosure used to reveal a copy of the line above it. Such a row is now a single line with no disclosure; rows whose message is truncated or spans several lines keep theirs, as do notifications carrying a link. Because folding is now the exception, a row that folds shows its chevron at rest instead of on hover, and a row preset picks its own preview typography — a notification message reads as prose, a signal preview stays monospaced.

**`ChatTimeGap` replaced by `TranscriptDivider`**

The transcript separator moved out of the chat-event family — it is a `role="separator"` rule, not an event — and no longer parses a time string. It takes the label and, separately, the timestamp that belongs in `title`, and renders nothing at all when the label is empty.

```tsx
// Before
import { ChatTimeGap } from '@mastra/playground-ui/components/ai/chat-event';

<ChatTimeGap text="24 minutes later — Sep 17, 2026, 2:24 PM" />;

// After
import { TranscriptDivider } from '@mastra/playground-ui/components/ai/transcript-divider';

<TranscriptDivider label="24 minutes later" title="Sep 17, 2026, 2:24 PM" />;
<TranscriptDivider label="Context compacted" />;
```

**Placement moved to the caller**

`ChatSignal` (card) and `ChatNotification` (notice) no longer set their own width or vertical margin, so they can be placed in a narrow container such as a user message bubble:

```tsx
<div className="my-2 max-w-[80%]">
  <ChatSignal variant="card" kind="state" label="workspace" message="The workspace is ready." />
</div>
```

The card also drops its own border and canvas fill for the shared raised-surface recipe, and its mode pill is now a `Badge`. Reminder bodies are monospaced in both densities; previously only the card was.
