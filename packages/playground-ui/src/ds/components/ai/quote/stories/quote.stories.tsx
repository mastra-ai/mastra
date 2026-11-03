import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp } from 'lucide-react';
import { useRef, useState } from 'react';

import { ChatQuotesProvider, useChatQuotes } from '../chat-quotes';
import { ComposerQuote } from '../composer-quote';
import { formatQuotedMessage } from '../format-quoted-message';
import { QuoteSelectionToolbar } from '../quote-selection-toolbar';
import { Button } from '@/ds/components/Button';
import {
  Composer,
  ComposerActions,
  ComposerBox,
  ComposerHeader,
  ComposerInput,
  ComposerRing,
} from '@/ds/components/Composer';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Message } from '@/ds/components/Message';
import { Txt } from '@/ds/components/Txt';

const REPLY = `I'd lean toward **Open rows** for that DataList-without-a-container feel.

Built two opt-in explorations:

- **Open rows:** no frame or lines; subtle rounded hover and selection.
- **Soft rows:** faint rounded backgrounds with small gaps.`;

function QuotingChat() {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { quotes, addQuote, removeQuote } = useChatQuotes();
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string>();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div ref={transcriptRef} className="flex flex-col gap-4">
        <Message from="user">Can we make the tables look more like a DataList without its container?</Message>
        <Message from="assistant">
          <MarkdownRenderer>{REPLY}</MarkdownRenderer>
        </Message>
      </div>
      <QuoteSelectionToolbar
        containerRef={transcriptRef}
        onQuote={text => {
          addQuote(text);
          inputRef.current?.focus();
        }}
      />
      <Composer
        aria-label="Message composer"
        onSubmit={event => {
          event.preventDefault();
          if (!draft.trim()) return;
          setSent(
            formatQuotedMessage(
              draft,
              quotes.map(quote => quote.text),
            ),
          );
          for (const quote of quotes) removeQuote(quote.id);
          setDraft('');
        }}
      >
        <ComposerHeader open={quotes.length > 0}>
          {quotes.map(quote => (
            <ComposerQuote key={quote.id} onRemove={() => removeQuote(quote.id)}>
              {quote.text}
            </ComposerQuote>
          ))}
        </ComposerHeader>
        <ComposerRing>
          <ComposerBox>
            <ComposerInput
              ref={inputRef}
              aria-label="Message"
              placeholder="Ask about the selection"
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
          'Quote part of a reply into the next message, the same way in Studio and Factory. `QuoteSelectionToolbar` floats Add to chat over text selected inside one message of the transcript it watches; a drag that runs past the message is trimmed back to it, and a selection that reaches a second message offers nothing. `ChatQuotesProvider` and `useChatQuotes` hold the waiting quotes between the transcript and the composer; mount the provider once per conversation, below whatever remounts when the thread changes. `ComposerQuote` shows each one in `ComposerHeader` with a remove control, and `formatQuotedMessage` turns the quotes and the typed text into the Markdown blockquotes the agent receives. Apps own sending, clearing quotes once a message is accepted, and `restoreQuotes` when it is not.',
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

export const WaitingQuotes: Story = {
  render: () => (
    <Composer aria-label="Message composer" className="mx-auto w-full max-w-3xl">
      <ComposerHeader>
        <ComposerQuote onRemove={() => {}}>
          Open rows: no frame or lines; subtle rounded hover and selection.
        </ComposerQuote>
        <ComposerQuote onRemove={() => {}}>
          {
            'Soft rows: faint rounded backgrounds with small gaps, a quieter surface that still separates each record from the next one when the list grows long.\n\nA second paragraph that stays hidden behind the clamp.'
          }
        </ComposerQuote>
      </ComposerHeader>
      <ComposerRing>
        <ComposerBox>
          <ComposerInput aria-label="Message" placeholder="Ask about the selection" />
          <ComposerActions />
        </ComposerBox>
      </ComposerRing>
    </Composer>
  ),
};
