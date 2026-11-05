---
'@mastra/playground-ui': minor
---

Added chat annotations, so a person can point the agent at parts of the transcript and comment on them.

- Select text in a message and choose **Add to chat**, or press Tab to reach it.
- The passage gets a numbered comment bubble that stays with the text as you scroll. Selecting the bubble opens a card to comment on the passage or remove it.
- The composer counts what is waiting.
- The agent receives a numbered Markdown list, each passage quoted with its comment, ahead of the typed text.

Added `ChatShell.Transcript`, the conversation's reading column. It is positioned, so overlays such as annotation bubbles travel with the text.

**Usage**

Mount `ChatAnnotationsProvider` once per conversation, below whatever remounts when the thread changes. Render `TranscriptAnnotations` in `ChatShell.Transcript` and `ComposerAnnotations` in the composer inside `ChatShell.Dock`; adding an annotation focuses that composer's `ComposerInput`. Format the outgoing message with `takeAnnotations()`, and count waiting `annotations` as content when enabling Send, so they can go out without typed text.

```tsx
import { useState } from 'react';
import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { ComposerBox, ComposerInput } from '@mastra/playground-ui/components/Composer';
import {
  ChatAnnotationsProvider,
  ComposerAnnotations,
  formatAnnotatedMessage,
  TranscriptAnnotations,
  useChatAnnotations,
} from '@mastra/playground-ui/components/ai/annotations';

function Thread({ messages }) {
  return (
    <ChatAnnotationsProvider>
      <ChatShell>
        <ChatShell.Stage>
          <ChatShell.Viewport>
            <ChatShell.Content>
              <ChatShell.Transcript>
                <TranscriptAnnotations />
                {messages}
              </ChatShell.Transcript>
            </ChatShell.Content>
            <ChatShell.Dock>
              <MessageComposer />
            </ChatShell.Dock>
          </ChatShell.Viewport>
        </ChatShell.Stage>
      </ChatShell>
    </ChatAnnotationsProvider>
  );
}

function MessageComposer() {
  const [draft, setDraft] = useState('');
  const { annotations, takeAnnotations, restoreAnnotations } = useChatAnnotations();

  const submit = () => {
    const taken = takeAnnotations();
    send(formatAnnotatedMessage(draft, taken)).catch(() => restoreAnnotations(taken));
  };

  return (
    <ComposerBox>
      <ComposerAnnotations />
      <ComposerInput value={draft} onChange={event => setDraft(event.target.value)} />
      <button type="button" disabled={!draft.trim() && annotations.length === 0} onClick={submit}>
        Send
      </button>
    </ComposerBox>
  );
}
```
