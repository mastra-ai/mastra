---
'@mastra/playground-ui': minor
---

Added chat annotations, so a person can point the agent at parts of the transcript and comment on them. Select text in a message and click **Add to chat**, or press Tab to reach it: the passage gets a numbered comment bubble that stays with the text as you scroll, clicking the bubble opens a card to comment on the passage or remove it, and the composer counts what is waiting. The agent receives a numbered Markdown list, each passage quoted with its comment, ahead of the typed text. Count waiting `annotations` as content when enabling Send, so they can go out without typed text.

Mount `ChatAnnotationsProvider` once per conversation, render `TranscriptAnnotations` inside the scrolled transcript and `ComposerAnnotations` in the composer, and format the outgoing message with `takeAnnotations()`:

```tsx
import {
  ChatAnnotationsProvider,
  ComposerAnnotations,
  formatAnnotatedMessage,
  TranscriptAnnotations,
  useChatAnnotations,
} from '@mastra/playground-ui/components/ai/annotations';

<ChatAnnotationsProvider>
  <div ref={transcriptRef} className="relative">
    <TranscriptAnnotations containerRef={transcriptRef} composerInputRef={inputRef} />
    {messages}
  </div>
  <ComposerBox>
    <ComposerAnnotations />
    <ComposerInput ref={inputRef} />
  </ComposerBox>
</ChatAnnotationsProvider>;

// When sending, inside the provider:
const { takeAnnotations, restoreAnnotations } = useChatAnnotations();
const annotations = takeAnnotations();
send(formatAnnotatedMessage(draft, annotations)).catch(() => restoreAnnotations(annotations));
```
