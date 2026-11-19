import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ChatAnnotationsProvider, useChatAnnotations } from '../chat-annotations';
import { ComposerAnnotationList } from '../composer-annotation-list';
import { ComposerAnnotations } from '../composer-annotations';
import { formatAnnotatedMessage } from '../format-annotated-message';
import { TranscriptAnnotations } from '../transcript-annotations';
import { Button } from '@/ds/components/Button';
import { ChatShell } from '@/ds/components/ChatShell';
import { Composer, ComposerActions, ComposerBox, ComposerInput, ComposerRing } from '@/ds/components/Composer';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Message } from '@/ds/components/Message';
import { Txt } from '@/ds/components/Txt';
import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';

const REPLY = `I'd lean toward **Open rows** for that DataList-without-a-container feel.

Built two opt-in explorations:

- **Open rows:** no frame or lines; subtle rounded hover and selection.
- **Soft rows:** faint rounded backgrounds with small gaps.`;

const FOLLOW_UP = `Opened the pull request with the approved styling for Factory and Studio.

128 tests and browser checks passed. Existing dependency issues still block the full typecheck and lint.`;

function AnnotatingChat() {
  const { annotations, takeAnnotations } = useChatAnnotations();
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string>();
  const empty = !draft.trim() && annotations.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <ChatShell className="h-[32rem]">
        <ChatShell.Stage>
          <ChatShell.Viewport>
            <ChatShell.Content>
              <ChatShell.Transcript className="flex-1 gap-4 py-4">
                <TranscriptAnnotations />
                <Message from="user">Can we make the tables look more like a DataList without its container?</Message>
                <Message from="assistant">
                  <MarkdownRenderer>{REPLY}</MarkdownRenderer>
                </Message>
                <Message from="user">Ok perfect, let's open up a PR for it please</Message>
                <Message from="assistant">
                  <MarkdownRenderer>{FOLLOW_UP}</MarkdownRenderer>
                </Message>
                <Message from="user">Can you also check the dark theme?</Message>
                <Message from="assistant">
                  <MarkdownRenderer>{REPLY}</MarkdownRenderer>
                </Message>
              </ChatShell.Transcript>
            </ChatShell.Content>
            <ChatShell.Dock>
              <ChatShell.Column>
                <Composer
                  aria-label="Message composer"
                  onSubmit={event => {
                    event.preventDefault();
                    if (empty) return;
                    setSent(formatAnnotatedMessage(draft, takeAnnotations()));
                    setDraft('');
                  }}
                >
                  <ComposerRing>
                    <ComposerBox>
                      <ComposerAnnotations />
                      <ComposerInput
                        aria-label="Message"
                        placeholder="Ask about the annotations"
                        value={draft}
                        onChange={event => setDraft(event.target.value)}
                      />
                      <ComposerActions className="justify-end">
                        <Button type="submit" size="icon-md" tooltip="Send" disabled={empty}>
                          <IconArrowUp />
                        </Button>
                      </ComposerActions>
                    </ComposerBox>
                  </ComposerRing>
                </Composer>
              </ChatShell.Column>
            </ChatShell.Dock>
          </ChatShell.Viewport>
        </ChatShell.Stage>
      </ChatShell>
      {sent && (
        <div className="flex flex-col gap-2">
          <Txt variant="caption" tone="muted">
            The agent receives
          </Txt>
          <pre className="whitespace-pre-wrap">{sent}</pre>
        </div>
      )}
    </div>
  );
}

const meta: Meta<typeof TranscriptAnnotations> = {
  title: 'AI/Annotations',
  component: TranscriptAnnotations,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Annotate parts of the transcript for the next message, the same way in Studio and Factory. Mount `ChatAnnotationsProvider` once per conversation, below whatever remounts when the thread changes. Inside a `ChatShell`, render `TranscriptAnnotations` in `ChatShell.Transcript` and `ComposerAnnotations` at the top of `ComposerBox`; adding an annotation focuses the `ComposerInput` in `ChatShell.Dock`. When sending, `takeAnnotations()` hands the waiting annotations to `formatAnnotatedMessage`, and `restoreAnnotations` puts them back if the message fails. In the transcript, Add to chat floats over text selected inside one message: a drag that runs past the message is trimmed back to it, and a selection that reaches a second message offers nothing. Each annotation gets a numbered comment bubble at the end of its passage and tints it; hovering a bubble deepens the tint, and clicking it opens a card to comment on the passage or remove it. The composer chip opens the numbered list, to find or remove each one. The agent receives a numbered Markdown list, each passage quoted with its comment, then the typed text.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TranscriptAnnotations>;

export const SelectAndAdd: Story = {
  render: () => (
    <ChatAnnotationsProvider>
      <AnnotatingChat />
    </ChatAnnotationsProvider>
  ),
};

export const WaitingAnnotations: Story = {
  render: () => {
    const offPage = { element: document.createElement('p'), start: 0, end: 0, text: '', textBefore: '', textAfter: '' };
    return (
      <Composer aria-label="Message composer" className="mx-auto w-full max-w-3xl">
        <ComposerRing>
          <ComposerBox>
            <ComposerAnnotationList
              annotations={[
                {
                  id: 'open',
                  text: 'Open rows: no frame or lines; subtle rounded hover and selection.',
                  source: offPage,
                  comment: 'Make this the default for chat tables.',
                },
                {
                  id: 'soft',
                  text: 'Soft rows: faint rounded backgrounds with small gaps, a quieter surface that still separates each record from the next one when the list grows long.\n\nA second paragraph that stays hidden behind the clamp.',
                  source: offPage,
                },
              ]}
              onRemove={() => {}}
            />
            <ComposerInput aria-label="Message" placeholder="Ask about the annotations" />
            <ComposerActions />
          </ComposerBox>
        </ComposerRing>
      </Composer>
    );
  },
};
