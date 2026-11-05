// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REPLY, SECOND } from './annotating-chat';
import {
  annotate,
  cleanUpAnnotationTests,
  markers,
  recordScrollIntoView,
  renderChat,
  typeAndSend,
} from './annotations-test-fixture';
import type { RenderedChat } from './annotations-test-fixture';

afterEach(cleanUpAnnotationTests);

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
    beforeEach(async () => {
      renderChat();
      await annotate(REPLY, 'Open rows'.length);
      fireEvent.click(screen.getByRole('button', { name: '1 annotation' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Remove annotation 1' }));
      await annotate(SECOND, 'Soft rows'.length);
    });

    it('counts only the new one', () => {
      expect(screen.getByRole('button', { name: '1 annotation' })).toBeTruthy();
    });

    it('keeps the list closed', () => {
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
