// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REPLY, SECOND } from './annotating-chat';
import {
  cleanUpAnnotationTests,
  dragSelect,
  renderChat,
  settleSelection,
  textNode,
  typeAndSend,
} from './annotations-test-fixture';
import type { RenderedChat } from './annotations-test-fixture';

afterEach(cleanUpAnnotationTests);

describe('AnnotationSelectionToolbar', () => {
  let chat: RenderedChat;
  let user: UserEvent;

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

  describe('when the browser holds a second selection range, as Firefox allows', () => {
    it('offers nothing, since one passage is one range', async () => {
      vi.useFakeTimers();
      renderChat();
      vi.spyOn(Selection.prototype, 'rangeCount', 'get').mockReturnValue(2);
      dragSelect([textNode(REPLY), 0], [textNode(REPLY), 'Open rows'.length]);

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
});
