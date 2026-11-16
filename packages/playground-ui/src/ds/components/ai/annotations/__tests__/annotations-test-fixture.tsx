import '@/test/inert-resize-observer';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';

import { ProvidedChat } from './annotating-chat';

export const cleanUpAnnotationTests = () => {
  vi.useRealTimers();
  document.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  cleanup();
};

export const TRANSCRIPT_WIDTH = 800;

export const layOutLines = (left = 40) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, TRANSCRIPT_WIDTH, 600));
  vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
    const line = Array.from(document.querySelectorAll('p')).findIndex(paragraph =>
      paragraph.contains(this.endContainer),
    );
    return Object.assign([new DOMRect(left, 120 + 30 * line, 60, 18)], { item: () => null });
  });
};

export const recordScrollIntoView = () => {
  const scrolled: Element[] = [];
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value(this: Element) {
      scrolled.push(this);
    },
  });
  return scrolled;
};

export interface RenderedChat {
  sent: string[];
  hideReply: () => void;
  editReply: (reply: string) => void;
}

export const renderChat = (): RenderedChat => {
  const sent: string[] = [];
  const onSend = (message: string) => sent.push(message);
  const view = render(<ProvidedChat onSend={onSend} showReply />);
  return {
    sent,
    hideReply: () => view.rerender(<ProvidedChat onSend={onSend} showReply={false} />),
    editReply: (reply: string) => view.rerender(<ProvidedChat onSend={onSend} showReply reply={reply} />),
  };
};

export const textNode = (text: string): Text => {
  const element = screen.getByText(text);
  const node = element.firstChild;
  if (!(node instanceof Text)) throw new Error(`"${text}" has no text node`);
  return node;
};

export const dragSelect = (start: [Node, number], end: [Node, number]) => {
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

export const annotate = async (paragraph: string, end: number, start = 0) => {
  dragSelect([textNode(paragraph), start], [textNode(paragraph), end]);
  fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull());
};

export const markers = () =>
  Array.from(screen.getByTestId('transcript').querySelectorAll<HTMLElement>('[data-slot="annotation-marker"]'));

export const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
};

export const settleSelection = () =>
  act(() => {
    vi.runOnlyPendingTimers();
  });
