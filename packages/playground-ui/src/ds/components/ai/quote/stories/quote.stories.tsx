import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp } from 'lucide-react';
import { useRef, useState } from 'react';

import { ChatQuotesProvider, useChatQuotes } from '../chat-quotes';
import { ComposerQuotes } from '../composer-quotes';
import { formatQuotedMessage } from '../format-quoted-message';
import { QuoteMarkers } from '../quote-markers';
import { QuoteSelectionToolbar } from '../quote-selection-toolbar';
import { Button } from '@/ds/components/Button';
import { Composer, ComposerActions, ComposerBox, ComposerInput, ComposerRing } from '@/ds/components/Composer';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Message } from '@/ds/components/Message';
import { Txt } from '@/ds/components/Txt';

const REPLY = `I'd lean toward **Open rows** for that DataList-without-a-container feel.

Built two opt-in explorations:

- **Open rows:** no frame or lines; subtle rounded hover and selection.
- **Soft rows:** faint rounded backgrounds with small gaps.`;

const FOLLOW_UP = `Opened the pull request with the approved styling for Factory and Studio.

128 tests and browser checks passed. Existing dependency issues still block the full typecheck and lint.`;

function QuotingChat() {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { quotes, addQuote, removeQuote } = useChatQuotes();
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string>();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* The marks are placed in the scrolled content, so they travel with the text. */}
      <div className="h-96 overflow-y-auto rounded-xl" data-testid="story-transcript">
        <div ref={transcriptRef} className="relative flex flex-col gap-4 py-4">
          <QuoteMarkers quotes={quotes} />
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
        </div>
      </div>
      <QuoteSelectionToolbar
        containerRef={transcriptRef}
        onQuote={quote => {
          addQuote(quote);
          inputRef.current?.focus();
        }}
      />
      <Composer
        aria-label="Message composer"
        onSubmit={event => {
          event.preventDefault();
          if (!draft.trim()) return;
          const quoted = quotes.map(quote => quote.text);
          setSent(formatQuotedMessage(draft, quoted));
          for (const quote of quotes) removeQuote(quote.id);
          setDraft('');
        }}
      >
        <ComposerRing>
          <ComposerBox>
            <ComposerQuotes quotes={quotes} onRemove={removeQuote} />
            <ComposerInput
              ref={inputRef}
              aria-label="Message"
              placeholder="Ask about the annotations"
              value={draft}
              onChange={event => setDraft(event.target.value)}
            />
            <ComposerActions className="justify-end">
              <Button type="submit" size="icon-md" tooltip="Send" disabled={!draft.trim()}>
                <ArrowUp />
              </Button>
            </ComposerActions>
          </ComposerBox>
        </ComposerRing>
      </Composer>
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

const meta: Meta<typeof QuoteSelectionToolbar> = {
  title: 'AI/Quote',
  component: QuoteSelectionToolbar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Annotate parts of the transcript for the next message, the same way in Studio and Factory. `QuoteSelectionToolbar` floats Add to chat over text selected inside one message of the transcript it watches; a drag that runs past the message is trimmed back to it, and a selection that reaches a second message offers nothing. `QuoteMarkers` numbers each annotation where it was selected and tints its text; render it inside the scrolled content, below a positioned ancestor, so the marks travel with the text. `ComposerQuotes` shows them as one chip in `ComposerBox` that opens their numbered list, to find or remove each one. `ChatQuotesProvider` and `useChatQuotes` hold them between the transcript and the composer; mount the provider once per conversation, below whatever remounts when the thread changes. `formatQuotedMessage` turns them and the typed text into the Markdown blockquotes the agent receives. Apps own sending, clearing annotations once a message is accepted, and `restoreQuotes` when it is not.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof QuoteSelectionToolbar>;

export const SelectAndAdd: Story = {
  render: () => (
    <ChatQuotesProvider>
      <QuotingChat />
    </ChatQuotesProvider>
  ),
};

export const WaitingAnnotations: Story = {
  render: () => (
    <Composer aria-label="Message composer" className="mx-auto w-full max-w-3xl">
      <ComposerRing>
        <ComposerBox>
          <ComposerQuotes
            quotes={[
              { id: 'open', text: 'Open rows: no frame or lines; subtle rounded hover and selection.' },
              {
                id: 'soft',
                text: 'Soft rows: faint rounded backgrounds with small gaps, a quieter surface that still separates each record from the next one when the list grows long.\n\nA second paragraph that stays hidden behind the clamp.',
              },
            ]}
            onRemove={() => {}}
          />
          <ComposerInput aria-label="Message" placeholder="Ask about the annotations" />
          <ComposerActions />
        </ComposerBox>
      </ComposerRing>
    </Composer>
  ),
};
