// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatAnnotationsProvider } from '../chat-annotations';
import { AnnotatingChat, REPLY, SECOND } from './annotating-chat';
import {
  annotate,
  cleanUpAnnotationTests,
  layOutLines,
  markers,
  renderChat,
  TRANSCRIPT_WIDTH,
  typeAndSend,
} from './annotations-test-fixture';
import type { RenderedChat } from './annotations-test-fixture';
import { ComposerInput } from '@/ds/components/Composer';

afterEach(cleanUpAnnotationTests);

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
      await waitFor(() => expect(markers().map(mark => mark.hidden)).toEqual([false]));
    });

    it('hides its mark', async () => {
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

    it('keeps showing its mark', () => {
      expect(markers()[0]?.hidden).toBe(false);
    });

    it('keeps its mark on the line of that passage', () => {
      expect(markers()[0]?.style.top).toBe(line);
    });

    it('still sends the passage', () => {
      typeAndSend('Still relevant?');

      expect(chat.sent).toEqual(['1. > Soft rows\n\nStill relevant?']);
    });
  });

  describe('when the annotated words also appear earlier in the message and a long line lands before both', () => {
    let marker: HTMLElement | undefined;
    let line: string | undefined;

    beforeEach(async () => {
      layOutLines();
      const { editReply } = renderChat();
      editReply('Soft rows or open rows?');
      await annotate(SECOND, 'Soft rows'.length);
      [marker] = markers();
      line = marker?.style.top;
      editReply('A much longer opening line now comes first. Soft rows or open rows?');
      await act(() => new Promise(requestAnimationFrame));
    });

    it('keeps showing its mark', () => {
      expect(marker?.hidden).toBe(false);
    });

    it('keeps its mark on the copy that was annotated', () => {
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

  describe('when two passages end on the same letter', () => {
    const BUBBLE_WIDTH = 20;
    const bubbleLefts = () => markers().map(marker => Number.parseFloat(marker.style.left));

    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(BUBBLE_WIDTH);
    });

    it('sets the later bubble beside the earlier one, so both stay clickable', async () => {
      layOutLines();
      renderChat();
      await annotate(REPLY, 'Open rows'.length);
      await annotate(REPLY, 'Open rows'.length, 'Open '.length);

      const [first = 0, second = 0] = bubbleLefts();
      expect(second).toBeGreaterThanOrEqual(first + BUBBLE_WIDTH);
    });

    describe('when that letter sits at the right edge of the transcript', () => {
      beforeEach(async () => {
        layOutLines(TRANSCRIPT_WIDTH - 60);
        renderChat();
        await annotate(REPLY, 'Open rows'.length);
        await annotate(REPLY, 'Open rows'.length, 'Open '.length);
      });

      it('keeps both bubbles inside the transcript', () => {
        expect(Math.max(...bubbleLefts()) + BUBBLE_WIDTH).toBeLessThanOrEqual(TRANSCRIPT_WIDTH);
      });

      it('still keeps them apart', () => {
        const [first = 0, second = 0] = bubbleLefts();
        expect(Math.abs(second - first)).toBeGreaterThanOrEqual(BUBBLE_WIDTH);
      });
    });
  });

  function TwoChats({ showRight }: { showRight: boolean }) {
    return (
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
  }

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
      const view = render(<TwoChats showRight />);
      await annotate('Left reply about open rows.', 'Left reply'.length);
      await annotate('Right reply about soft rows.', 'Right reply'.length);
      await waitFor(() => expect(tinted()).toEqual(['Left reply', 'Right reply']));

      view.rerender(<TwoChats showRight={false} />);

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
