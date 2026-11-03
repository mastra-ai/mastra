// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatAnnotationsProvider, useChatAnnotations } from './chat-annotations';
import type { ChatAnnotation } from './chat-annotations';
import { ComposerAnnotations } from './composer-annotations';
import { formatAnnotatedMessage } from './format-annotated-message';
import { TranscriptAnnotations } from './transcript-annotations';
import { Composer, ComposerBox, ComposerInput } from '@/ds/components/Composer';
import { Message, MessageActions } from '@/ds/components/Message';

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

const layOutLines = () =>
  vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
    const line = Array.from(document.querySelectorAll('p')).findIndex(paragraph =>
      paragraph.contains(this.endContainer),
    );
    return Object.assign([new DOMRect(40, 120 + 30 * line, 60, 18)], { item: () => null });
  });

const REPLY = 'Open rows drop the frame and keep subtle rounded hover.';
const SECOND = 'Soft rows add faint backgrounds.';

function AnnotatingChat({
  onSend,
  showReply = true,
  reply = REPLY,
}: {
  onSend: (message: string) => void;
  showReply?: boolean;
  reply?: string;
}) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { takeAnnotations } = useChatAnnotations();
  const [draft, setDraft] = useState('');

  return (
    <>
      <div role="region" aria-label="Conversation" tabIndex={0}>
        <div ref={transcriptRef} data-testid="transcript" className="relative">
          <TranscriptAnnotations containerRef={transcriptRef} composerInputRef={inputRef} />
          <Message from="user">Which table style should we use?</Message>
          {showReply && (
            <Message
              from="assistant"
              footer={
                <MessageActions>
                  <span>Model reply footer</span>
                </MessageActions>
              }
            >
              <p>{reply}</p>
              <p>{SECOND}</p>
            </Message>
          )}
        </div>
      </div>
      <Message from="assistant">Outside the transcript</Message>
      <Composer
        aria-label="Message composer"
        onSubmit={event => {
          event.preventDefault();
          onSend(formatAnnotatedMessage(draft, takeAnnotations()));
          setDraft('');
        }}
      >
        <ComposerBox>
          <ComposerAnnotations />
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
  const chat = (showReply: boolean, reply?: string) => (
    <ChatAnnotationsProvider>
      <AnnotatingChat onSend={message => sent.push(message)} showReply={showReply} reply={reply} />
    </ChatAnnotationsProvider>
  );
  const view = render(chat(true));
  return {
    sent,
    hideReply: () => view.rerender(chat(false)),
    editReply: (reply: string) => view.rerender(chat(true, reply)),
  };
};

const textNode = (text: string): Text => {
  const element = screen.getByText(text);
  const node = element.firstChild;
  if (!(node instanceof Text)) throw new Error(`"${text}" has no text node`);
  return node;
};

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

const annotate = async (paragraph: string, length: number) => {
  dragSelect([textNode(paragraph), 0], [textNode(paragraph), length]);
  fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull());
};

const markers = () =>
  Array.from(screen.getByTestId('transcript').querySelectorAll<HTMLElement>('[data-slot="annotation-marker"]'));

const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
};

describe('AnnotationSelectionToolbar', () => {
  describe('when the person selects part of a reply and adds it to the chat', () => {
    it('numbers it in the transcript, counts it in the composer, and sends it as a blockquote first', async () => {
      const { sent } = renderChat();

      await annotate(REPLY, 'Open rows'.length);

      expect(markers().map(marker => marker.textContent)).toEqual(['1']);
      expect(screen.getByRole('button', { name: '1 annotation' })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Message' }));
      expect(document.getSelection()?.isCollapsed ?? true).toBe(true);

      typeAndSend('Why this one?');

      expect(sent).toEqual(['1. > Open rows\n\nWhy this one?']);
      expect(markers()).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /annotation/ })).toBeNull();
    });
  });

  describe('when the person adds several passages', () => {
    it('numbers them in the order added and sends them all in that order', async () => {
      const { sent } = renderChat();

      await annotate(SECOND, 'Soft rows'.length);
      await annotate(REPLY, 'Open rows'.length);

      expect(markers().map(marker => marker.textContent)).toEqual(['1', '2']);
      fireEvent.click(screen.getByRole('button', { name: '2 annotations' }));
      const list = await screen.findByRole('list', { name: 'Annotations' });
      expect(
        within(list)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['1Soft rows', '2Open rows']);

      typeAndSend('Compare them');

      expect(sent).toEqual(['1. > Soft rows\n\n2. > Open rows\n\nCompare them']);
    });
  });

  describe('when the person removes an annotation before sending', () => {
    it('renumbers the rest and leaves the removed passage out of the message', async () => {
      const { sent } = renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      await annotate(REPLY, 'Open rows'.length);

      fireEvent.click(screen.getByRole('button', { name: '2 annotations' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Remove annotation 1' }));

      expect(markers().map(marker => marker.textContent)).toEqual(['1']);
      typeAndSend('Only this one');
      expect(sent).toEqual(['1. > Open rows\n\nOnly this one']);
    });
  });

  describe('when the person removes the last annotation from the open list and adds another', () => {
    it('keeps the list closed', async () => {
      renderChat();
      await annotate(REPLY, 'Open rows'.length);
      fireEvent.click(screen.getByRole('button', { name: '1 annotation' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Remove annotation 1' }));

      await annotate(SECOND, 'Soft rows'.length);

      expect(screen.getByRole('button', { name: '1 annotation' })).toBeTruthy();
      expect(screen.queryByRole('list', { name: 'Annotations' })).toBeNull();
    });
  });

  describe('when the person clicks an annotation and comments on it', () => {
    it('opens a card on the passage and sends the comment with that annotation', async () => {
      layOutLines();
      const { sent } = renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      await annotate(REPLY, 'Open rows'.length);

      fireEvent.click(screen.getByRole('button', { name: 'Annotation 1' }));
      const card = await screen.findByRole('dialog', { name: 'Annotation 1' });
      expect(within(card).getByText('Soft rows')).toBeTruthy();
      const comment = within(card).getByRole('textbox', { name: 'Comment on annotation 1' });
      await waitFor(() => expect(document.activeElement).toBe(comment));

      fireEvent.change(comment, { target: { value: 'Drop this one.' } });
      fireEvent.click(within(card).getByRole('button', { name: 'Done' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Annotation 1' })).toBeNull());

      expect(screen.getByRole('button', { name: 'Annotation 1, with a comment' })).toBeTruthy();
      typeAndSend('Thoughts?');
      expect(sent).toEqual(['1. > Soft rows\n\n   Drop this one.\n\n2. > Open rows\n\nThoughts?']);
    });
  });

  describe('when the person removes an annotation from its card', () => {
    it('closes the card and renumbers the rest', async () => {
      layOutLines();
      const { sent } = renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      await annotate(REPLY, 'Open rows'.length);

      fireEvent.click(screen.getByRole('button', { name: 'Annotation 1' }));
      const card = await screen.findByRole('dialog', { name: 'Annotation 1' });
      fireEvent.click(within(card).getByRole('button', { name: 'Remove annotation 1' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(markers().map(marker => marker.textContent)).toEqual(['1']);
      typeAndSend('Just this');
      expect(sent).toEqual(['1. > Open rows\n\nJust this']);
    });
  });

  describe('when the same passage is added twice', () => {
    it('keeps a single annotation', async () => {
      renderChat();
      await annotate(REPLY, 'Open rows'.length);
      await annotate(REPLY, 'Open rows'.length);

      expect(screen.getByRole('button', { name: '1 annotation' })).toBeTruthy();
      expect(markers()).toHaveLength(1);
    });
  });

  describe('when the message an annotation came from leaves the page', () => {
    it('drops its mark from the transcript but still sends the passage', async () => {
      layOutLines();
      const { sent, hideReply } = renderChat();
      await annotate(REPLY, 'Open rows'.length);

      expect(markers().map(mark => mark.hidden)).toEqual([false]);

      hideReply();

      await waitFor(() => expect(markers().map(mark => mark.hidden)).toEqual([true]));
      typeAndSend('Still relevant?');
      expect(sent).toEqual(['1. > Open rows\n\nStill relevant?']);
    });
  });

  describe('when text before an annotated passage changes inside its message', () => {
    it('keeps its mark on that passage and still sends it', async () => {
      layOutLines();
      const { sent, editReply } = renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      const [marker] = markers();
      const line = marker?.style.top;

      editReply(`Rewritten: ${REPLY}`);
      await act(() => new Promise(requestAnimationFrame));

      expect(marker?.hidden).toBe(false);
      expect(marker?.style.top).toBe(line);
      typeAndSend('Still relevant?');
      expect(sent).toEqual(['1. > Soft rows\n\nStill relevant?']);
    });
  });

  describe('when the annotated words also appear earlier in the message and a long line lands before both', () => {
    it('keeps its mark on the copy that was annotated', async () => {
      layOutLines();
      const { editReply } = renderChat();
      editReply('Soft rows or open rows?');
      await annotate(SECOND, 'Soft rows'.length);
      const [marker] = markers();
      const line = marker?.style.top;

      editReply('A much longer opening line now comes first. Soft rows or open rows?');
      await act(() => new Promise(requestAnimationFrame));

      expect(marker?.hidden).toBe(false);
      expect(marker?.style.top).toBe(line);
    });
  });

  describe('when a drag runs past the end of the reply into its footer', () => {
    it('trims the selection back to the reply and annotates only its text', async () => {
      const { sent } = renderChat();
      dragSelect([textNode(SECOND), 'Soft rows add '.length], [textNode('Model reply footer'), 'Model'.length]);

      fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));
      typeAndSend('More?');

      expect(sent).toEqual(['1. > faint backgrounds.\n\nMore?']);
    });
  });

  describe('when the selection reaches into a second message', () => {
    it('offers nothing, since no single message holds the passage', async () => {
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

  describe('when the person presses Tab while the toolbar shows', () => {
    it('moves focus to Add to chat, so Enter adds the passage', async () => {
      const user = userEvent.setup();
      const { sent } = renderChat();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      const add = await screen.findByRole('button', { name: 'Add to chat' });

      await user.tab();
      expect(document.activeElement).toBe(add);
      await user.keyboard('{Enter}');

      typeAndSend('Why?');
      expect(sent).toEqual(['1. > Open rows\n\nWhy?']);
    });
  });

  describe('when the scrolled conversation took focus from the click and the person presses Tab', () => {
    it('still moves focus to Add to chat', async () => {
      renderChat();
      const conversation = screen.getByRole('region', { name: 'Conversation' });
      conversation.focus();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      const add = await screen.findByRole('button', { name: 'Add to chat' });

      fireEvent.keyDown(conversation, { key: 'Tab' });

      expect(document.activeElement).toBe(add);
    });
  });

  describe('when focus is already on Add to chat and the person presses Tab again', () => {
    it('lets focus leave the toolbar', async () => {
      const user = userEvent.setup();
      renderChat();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      const add = await screen.findByRole('button', { name: 'Add to chat' });
      await user.tab();

      const tabbedOn = fireEvent.keyDown(add, { key: 'Tab' });

      expect(tabbedOn).toBe(true);
    });
  });
});

describe('ChatAnnotationsProvider', () => {
  describe('when a comment changes while the message taking its annotation is being prepared', () => {
    it('still clears the annotation that went out, so the next message does not repeat it', () => {
      const { result } = renderHook(() => useChatAnnotations(), { wrapper: ChatAnnotationsProvider });
      act(() =>
        result.current.addAnnotation({
          text: 'Open rows',
          source: {
            element: document.createElement('p'),
            start: 0,
            end: 9,
            text: 'Openrows',
            textBefore: '',
            textAfter: '',
          },
        }),
      );
      const takeAtSubmit = result.current.takeAnnotations;
      act(() => {
        for (const { id } of result.current.annotations) result.current.setAnnotationComment(id, 'Late comment');
      });

      let taken: ChatAnnotation[] = [];
      act(() => {
        taken = takeAtSubmit();
      });

      expect(taken.map(annotation => annotation.text)).toEqual(['Open rows']);
      expect(result.current.annotations).toEqual([]);
    });
  });
});

describe('TranscriptAnnotations', () => {
  describe('when two transcripts share the page and one of them goes away', () => {
    it('keeps tinting the passage annotated in the other', async () => {
      const highlights = new Map<string, { ranges: Range[] }>();
      vi.stubGlobal('CSS', { highlights });
      vi.stubGlobal(
        'Highlight',
        class {
          ranges: Range[];
          priority = 0;
          constructor(...ranges: Range[]) {
            this.ranges = ranges;
          }
        },
      );
      layOutLines();
      const tinted = () => highlights.get('chat-annotation')?.ranges.map(range => range.toString());
      const chats = (showRight: boolean) => (
        <>
          <ChatAnnotationsProvider>
            <AnnotatingChat onSend={() => {}} reply="Left reply about open rows." />
          </ChatAnnotationsProvider>
          {showRight && (
            <ChatAnnotationsProvider>
              <AnnotatingChat onSend={() => {}} reply="Right reply about soft rows." />
            </ChatAnnotationsProvider>
          )}
        </>
      );
      const view = render(chats(true));
      await annotate('Left reply about open rows.', 'Left reply'.length);
      await annotate('Right reply about soft rows.', 'Right reply'.length);
      await waitFor(() => expect(tinted()).toEqual(['Left reply', 'Right reply']));

      view.rerender(chats(false));

      expect(tinted()).toEqual(['Left reply']);
    });
  });
});
