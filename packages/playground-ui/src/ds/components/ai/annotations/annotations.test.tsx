// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatAnnotationsProvider, useChatAnnotations } from './chat-annotations';
import type { ChatAnnotation } from './chat-annotations';
import { ComposerAnnotations } from './composer-annotations';
import { formatAnnotatedMessage } from './format-annotated-message';
import { TranscriptAnnotations } from './transcript-annotations';
import { ChatShell } from '@/ds/components/ChatShell';
import { Composer, ComposerBox, ComposerInput } from '@/ds/components/Composer';
import { Message, MessageActions } from '@/ds/components/Message';

afterEach(() => {
  vi.useRealTimers();
  document.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  cleanup();
});

const layOutLines = (left = 40) =>
  vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
    const line = Array.from(document.querySelectorAll('p')).findIndex(paragraph =>
      paragraph.contains(this.endContainer),
    );
    return Object.assign([new DOMRect(left, 120 + 30 * line, 60, 18)], { item: () => null });
  });

const recordScrollIntoView = () => {
  const scrolled: Element[] = [];
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value(this: Element) {
      scrolled.push(this);
    },
  });
  return scrolled;
};

const REPLY = 'Open rows drop the frame and keep subtle rounded hover.';
const SECOND = 'Soft rows add faint backgrounds.';

function AnnotatingChat({
  onSend,
  showReply = true,
  reply = REPLY,
  children,
}: {
  onSend: (message: string) => void;
  showReply?: boolean;
  reply?: string;
  children?: ReactNode;
}) {
  const { takeAnnotations } = useChatAnnotations();
  const [draft, setDraft] = useState('');

  return (
    <ChatShell>
      <div role="region" aria-label="Conversation" tabIndex={0}>
        <ChatShell.Transcript data-testid="transcript">
          <TranscriptAnnotations />
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
        </ChatShell.Transcript>
      </div>
      <Message from="assistant">Outside the transcript</Message>
      <ChatShell.Dock>
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
            <ComposerInput aria-label="Message" value={draft} onChange={event => setDraft(event.target.value)} />
            <button type="submit">Send</button>
          </ComposerBox>
        </Composer>
      </ChatShell.Dock>
      {children}
    </ChatShell>
  );
}

interface RenderedChat {
  sent: string[];
  hideReply: () => void;
  editReply: (reply: string) => void;
}

const renderChat = (): RenderedChat => {
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

const settleSelection = () =>
  act(() => {
    vi.runOnlyPendingTimers();
  });

describe('TranscriptAnnotations', () => {
  let chat: RenderedChat;
  let user: UserEvent;

  describe('when the person selects part of a reply and adds it to the chat', () => {
    beforeEach(async () => {
      chat = renderChat();
      await annotate(REPLY, 'Open rows'.length);
    });

    it('numbers the passage in the transcript', () => {
      expect(markers().map(marker => marker.textContent)).toEqual(['1']);
    });

    it('counts the annotation in the composer', () => {
      expect(screen.getByRole('button', { name: '1 annotation' })).toBeTruthy();
    });

    it('focuses the message box', () => {
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Message' }));
    });

    it('clears the selection', () => {
      expect(document.getSelection()?.isCollapsed ?? true).toBe(true);
    });

    describe('when the person types a message and sends it', () => {
      beforeEach(() => {
        typeAndSend('Why this one?');
      });

      it('sends the passage as a blockquote ahead of the message', () => {
        expect(chat.sent).toEqual(['1. > Open rows\n\nWhy this one?']);
      });

      it('removes the number from the transcript', () => {
        expect(markers()).toHaveLength(0);
      });

      it('clears the annotation from the composer', () => {
        expect(screen.queryByRole('button', { name: /annotation/ })).toBeNull();
      });
    });
  });

  describe('when the person adds several passages', () => {
    beforeEach(async () => {
      chat = renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      await annotate(REPLY, 'Open rows'.length);
    });

    it('numbers them in the order added', () => {
      expect(markers().map(marker => marker.textContent)).toEqual(['1', '2']);
    });

    it('sends them all in that order', () => {
      typeAndSend('Compare them');

      expect(chat.sent).toEqual(['1. > Soft rows\n\n2. > Open rows\n\nCompare them']);
    });
  });

  describe('when the same passage is added twice', () => {
    beforeEach(async () => {
      renderChat();
      await annotate(REPLY, 'Open rows'.length);
      await annotate(REPLY, 'Open rows'.length);
    });

    it('counts it once in the composer', () => {
      expect(screen.getByRole('button', { name: '1 annotation' })).toBeTruthy();
    });

    it('numbers it once in the transcript', () => {
      expect(markers()).toHaveLength(1);
    });
  });

  describe('when the person clicks an annotation', () => {
    let card: HTMLElement;

    beforeEach(async () => {
      user = userEvent.setup();
      layOutLines();
      chat = renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      await annotate(REPLY, 'Open rows'.length);
      fireEvent.click(screen.getByRole('button', { name: 'Annotation 1' }));
      card = await screen.findByRole('dialog', { name: 'Annotation 1' });
    });

    it('opens a card holding its passage', () => {
      expect(within(card).getByText('Soft rows')).toBeTruthy();
    });

    it('focuses the comment box', async () => {
      const comment = within(card).getByRole('textbox', { name: 'Comment on annotation 1' });

      await waitFor(() => expect(document.activeElement).toBe(comment));
    });

    describe('when the person comments and presses Done', () => {
      beforeEach(async () => {
        fireEvent.change(within(card).getByRole('textbox', { name: 'Comment on annotation 1' }), {
          target: { value: 'Drop this one.' },
        });
        fireEvent.click(within(card).getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Annotation 1' })).toBeNull());
      });

      it('marks the annotation as commented', () => {
        expect(screen.getByRole('button', { name: 'Annotation 1, with a comment' })).toBeTruthy();
      });

      it('sends the comment with that annotation', () => {
        typeAndSend('Thoughts?');

        expect(chat.sent).toEqual(['1. > Soft rows\n\n   Drop this one.\n\n2. > Open rows\n\nThoughts?']);
      });
    });

    describe('when the person removes it from its card', () => {
      beforeEach(() => {
        fireEvent.click(within(card).getByRole('button', { name: 'Remove annotation 1' }));
      });

      it('closes the card', async () => {
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      });

      it('renumbers the rest', () => {
        expect(markers().map(marker => marker.textContent)).toEqual(['1']);
      });

      it('leaves it out of the message', () => {
        typeAndSend('Just this');

        expect(chat.sent).toEqual(['1. > Open rows\n\nJust this']);
      });
    });

    describe('when the person clicks the same annotation again', () => {
      it('closes its card', async () => {
        await user.click(screen.getByRole('button', { name: 'Annotation 1' }));

        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Annotation 1' })).toBeNull());
      });
    });
  });

  describe('when the message an annotation came from leaves the page', () => {
    beforeEach(async () => {
      layOutLines();
      chat = renderChat();
      await annotate(REPLY, 'Open rows'.length);
    });

    it('hides its mark', async () => {
      expect(markers().map(mark => mark.hidden)).toEqual([false]);

      chat.hideReply();

      await waitFor(() => expect(markers().map(mark => mark.hidden)).toEqual([true]));
    });

    it('still sends the passage', () => {
      chat.hideReply();

      typeAndSend('Still relevant?');

      expect(chat.sent).toEqual(['1. > Open rows\n\nStill relevant?']);
    });
  });

  describe('when text before an annotated passage changes inside its message', () => {
    let line: string | undefined;

    beforeEach(async () => {
      layOutLines();
      chat = renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      line = markers()[0]?.style.top;
      chat.editReply(`Rewritten: ${REPLY}`);
      await act(() => new Promise(requestAnimationFrame));
    });

    it('keeps its mark on that passage', () => {
      const [marker] = markers();

      expect(marker?.hidden).toBe(false);
      expect(marker?.style.top).toBe(line);
    });

    it('still sends the passage', () => {
      typeAndSend('Still relevant?');

      expect(chat.sent).toEqual(['1. > Soft rows\n\nStill relevant?']);
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

  describe('when text inside the message scrolls sideways', () => {
    it('moves the mark with its passage', async () => {
      layOutLines();
      renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      const [marker] = markers();

      layOutLines(10);
      fireEvent.scroll(screen.getByText(SECOND));
      await act(() => new Promise(requestAnimationFrame));

      expect(marker?.style.left).toBe('69px');
    });
  });

  describe('when a drag runs past the end of the reply into its footer', () => {
    it('annotates only the text of the reply', async () => {
      chat = renderChat();
      dragSelect([textNode(SECOND), 'Soft rows add '.length], [textNode('Model reply footer'), 'Model'.length]);

      fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));
      typeAndSend('More?');

      expect(chat.sent).toEqual(['1. > faint backgrounds.\n\nMore?']);
    });
  });

  describe('when the selection reaches into a second message', () => {
    it('offers nothing, since no single message holds the passage', async () => {
      vi.useFakeTimers();
      renderChat();
      dragSelect([textNode('Which table style should we use?'), 6], [textNode(REPLY), 9]);

      await settleSelection();

      expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull();
    });
  });

  describe('when the selected message is outside the transcript', () => {
    it('offers nothing', async () => {
      vi.useFakeTimers();
      renderChat();
      dragSelect([textNode('Outside the transcript'), 0], [textNode('Outside the transcript'), 7]);

      await settleSelection();

      expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull();
    });
  });

  describe('when the person selects with the keyboard after a context menu swallowed the pointer release', () => {
    it('offers Add to chat', async () => {
      renderChat();
      const paragraph = screen.getByText(REPLY);
      fireEvent.pointerDown(paragraph, { button: 2 });
      fireEvent.contextMenu(paragraph);

      const range = document.createRange();
      range.setStart(textNode(REPLY), 0);
      range.setEnd(textNode(REPLY), 'Open rows'.length);
      document.getSelection()?.addRange(range);
      fireEvent(document, new Event('selectionchange'));

      expect(await screen.findByRole('button', { name: 'Add to chat' })).toBeTruthy();
    });
  });

  describe('when the person presses Escape while Add to chat shows', () => {
    beforeEach(async () => {
      renderChat();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      await screen.findByRole('button', { name: 'Add to chat' });
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });

    it('hides Add to chat', async () => {
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull());
    });

    it('leaves the selection alone', () => {
      expect(document.getSelection()?.toString()).toBe('Open rows');
    });
  });

  describe('when the person presses Tab while Add to chat shows', () => {
    let add: HTMLElement;
    let conversation: HTMLElement;

    beforeEach(async () => {
      user = userEvent.setup();
      chat = renderChat();
      conversation = screen.getByRole('region', { name: 'Conversation' });
      conversation.focus();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      add = await screen.findByRole('button', { name: 'Add to chat' });
      await user.tab();
    });

    it('moves focus to Add to chat', () => {
      expect(document.activeElement).toBe(add);
    });

    it('adds the passage on Enter', async () => {
      await user.keyboard('{Enter}');
      typeAndSend('Why?');

      expect(chat.sent).toEqual(['1. > Open rows\n\nWhy?']);
    });

    describe('when the person presses Tab again', () => {
      beforeEach(async () => {
        await user.tab();
      });

      it('hands focus back to the conversation', () => {
        expect(document.activeElement).toBe(conversation);
      });

      it('hides Add to chat', async () => {
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull());
      });
    });

    describe('when the person presses Escape', () => {
      it('hands focus back to the conversation', async () => {
        await user.keyboard('{Escape}');

        expect(document.activeElement).toBe(conversation);
      });
    });
  });

  describe('when Add to chat is scrolled out of sight and the person presses Tab', () => {
    it('closes it, so Tab moves on without stopping there', async () => {
      renderChat();
      const conversation = screen.getByRole('region', { name: 'Conversation' });
      conversation.focus();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      const add = await screen.findByRole('button', { name: 'Add to chat' });
      vi.spyOn(add, 'focus').mockImplementation(() => {});

      fireEvent.keyDown(conversation, { key: 'Tab' });

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull());
    });
  });

  describe('when focus is on the page rather than the conversation and the person presses Tab', () => {
    it('leaves Tab to the browser', async () => {
      renderChat();
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);
      await screen.findByRole('button', { name: 'Add to chat' });

      const tabbedOn = fireEvent.keyDown(document.body, { key: 'Tab' });

      expect(tabbedOn).toBe(true);
    });
  });

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

  describe('when another composer sits in the shell outside its dock', () => {
    it('focuses the conversation composer after adding a passage', async () => {
      render(
        <ChatAnnotationsProvider>
          <AnnotatingChat onSend={() => {}}>
            <ComposerInput aria-label="Comment" />
          </AnnotatingChat>
        </ChatAnnotationsProvider>,
      );

      await annotate(REPLY, 'Open rows'.length);

      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Message' }));
    });
  });
});

describe('ComposerAnnotations', () => {
  let chat: RenderedChat;

  describe('when the person opens the list of several annotations', () => {
    beforeEach(async () => {
      chat = renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      await annotate(REPLY, 'Open rows'.length);
      fireEvent.click(screen.getByRole('button', { name: '2 annotations' }));
    });

    it('lists them in the order added', async () => {
      const list = await screen.findByRole('list', { name: 'Annotations' });

      expect(
        within(list)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['1Soft rows', '2Open rows']);
    });

    describe('when the person removes the first one', () => {
      beforeEach(async () => {
        fireEvent.click(await screen.findByRole('button', { name: 'Remove annotation 1' }));
      });

      it('renumbers the rest in the transcript', () => {
        expect(markers().map(marker => marker.textContent)).toEqual(['1']);
      });

      it('leaves it out of the message', () => {
        typeAndSend('Only this one');

        expect(chat.sent).toEqual(['1. > Open rows\n\nOnly this one']);
      });
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

  describe('when the person shows an annotation that starts a paragraph after the first', () => {
    it('scrolls that paragraph into view', async () => {
      const scrolled = recordScrollIntoView();
      renderChat();
      await annotate(SECOND, 'Soft rows'.length);
      fireEvent.click(screen.getByRole('button', { name: '1 annotation' }));

      fireEvent.click(await screen.findByTitle('Show in chat'));

      expect(scrolled).toEqual([screen.getByText(SECOND)]);
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
