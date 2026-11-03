// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatQuotesProvider, useChatQuotes } from './chat-quotes';
import { ComposerQuote } from './composer-quote';
import { formatQuotedMessage } from './format-quoted-message';
import { QuoteSelectionToolbar } from './quote-selection-toolbar';
import { Composer, ComposerBox, ComposerHeader, ComposerInput } from '@/ds/components/Composer';
import { Message, MessageActions } from '@/ds/components/Message';

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  cleanup();
});

const REPLY = 'Open rows drop the frame and keep subtle rounded hover.';

/** A transcript and composer wired the way Studio and Factory wire them. */
function QuotingChat({ onSend }: { onSend: (message: string) => void }) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { quotes, addQuote, removeQuote } = useChatQuotes();
  const [draft, setDraft] = useState('');

  return (
    <>
      <div ref={transcriptRef}>
        <Message from="user">Which table style should we use?</Message>
        <Message
          from="assistant"
          footer={
            <MessageActions>
              <span>Model reply footer</span>
            </MessageActions>
          }
        >
          <p>{REPLY}</p>
          <p>Soft rows add faint backgrounds.</p>
        </Message>
      </div>
      <Message from="assistant">Outside the transcript</Message>
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
          onSend(
            formatQuotedMessage(
              draft,
              quotes.map(quote => quote.text),
            ),
          );
          for (const quote of quotes) removeQuote(quote.id);
          setDraft('');
        }}
      >
        <ComposerHeader open={quotes.length > 0} aria-label="Quotes">
          {quotes.map(quote => (
            <ComposerQuote key={quote.id} onRemove={() => removeQuote(quote.id)}>
              {quote.text}
            </ComposerQuote>
          ))}
        </ComposerHeader>
        <ComposerBox>
          <ComposerInput
            ref={inputRef}
            aria-label="Message"
            value={draft}
            onChange={event => setDraft(event.target.value)}
          />
          <button type="submit">Send</button>
        </ComposerBox>
      </Composer>
    </>
  );
}

const renderChat = () => {
  const sent: string[] = [];
  render(
    <ChatQuotesProvider>
      <QuotingChat onSend={message => sent.push(message)} />
    </ChatQuotesProvider>,
  );
  return sent;
};

const textNode = (text: string): Text => {
  const element = screen.getByText(text);
  const node = element.firstChild;
  if (!(node instanceof Text)) throw new Error(`"${text}" has no text node`);
  return node;
};

/** Drags a selection with the mouse: press, select, release. */
const dragSelect = (start: [Node, number], end: [Node, number]) => {
  const target = start[0].parentElement ?? document.body;
  fireEvent.pointerDown(target);
  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.pointerUp(target);
};

const quotesHeader = () => screen.getByRole('textbox', { name: 'Message' }).closest('form');

describe('QuoteSelectionToolbar', () => {
  describe('when the person selects part of a reply and adds it to the chat', () => {
    it('shows the quote in the composer header and sends it as a blockquote before the typed text', async () => {
      const sent = renderChat();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);

      fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));

      const form = quotesHeader();
      if (!form) throw new Error('Composer form is missing');
      expect(within(form).getByText('Open rows')).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Message' }));
      expect(document.getSelection()?.isCollapsed ?? true).toBe(true);

      fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Why this one?' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(sent).toEqual(['> Open rows\n\nWhy this one?']);
      expect(within(form).queryByText('Open rows')).toBeNull();
    });
  });

  describe('when the person removes a quote before sending', () => {
    it('sends only the typed text', async () => {
      const sent = renderChat();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));

      fireEvent.click(screen.getByRole('button', { name: 'Remove quote' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Never mind' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(sent).toEqual(['Never mind']);
    });
  });

  describe('when the same passage is added twice', () => {
    it('keeps a single quote', async () => {
      renderChat();
      for (let attempt = 0; attempt < 2; attempt++) {
        dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
        fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull());
      }

      expect(screen.getAllByRole('button', { name: 'Remove quote' })).toHaveLength(1);
    });
  });

  describe('when a drag runs past the end of the reply into its footer', () => {
    it('trims the selection back to the reply and quotes only its text', async () => {
      const sent = renderChat();
      const lastParagraph = textNode('Soft rows add faint backgrounds.');
      const footer = textNode('Model reply footer');
      dragSelect([lastParagraph, 'Soft rows add '.length], [footer, 'Model'.length]);

      fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'More?' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(sent).toEqual(['> faint backgrounds.\n\nMore?']);
    });
  });

  describe('when the selection reaches into a second message', () => {
    it('offers nothing, since it is not a quote of one message', async () => {
      renderChat();
      dragSelect([textNode('Which table style should we use?'), 6], [textNode(REPLY), 9]);

      await act(() => new Promise(resolve => setTimeout(resolve, 20)));
      expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull();
    });
  });

  describe('when the selected message is outside the transcript', () => {
    it('offers nothing', async () => {
      renderChat();
      dragSelect([textNode('Outside the transcript'), 0], [textNode('Outside the transcript'), 7]);

      await act(() => new Promise(resolve => setTimeout(resolve, 20)));
      expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull();
    });
  });

  describe('when the person presses Escape', () => {
    it('hides the toolbar and leaves the selection alone', async () => {
      renderChat();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      await screen.findByRole('button', { name: 'Add to chat' });

      fireEvent.keyDown(document.body, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull());
      expect(document.getSelection()?.toString()).toBe('Open rows');
    });
  });
});
