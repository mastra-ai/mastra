import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { SESSION_ID, releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const REPLY = 'Open rows drop the frame and keep a subtle rounded hover.';
const SECOND = 'Soft rows add faint backgrounds with small gaps.';

function stubReply() {
  server.use(
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () =>
      HttpResponse.json({
        messages: [
          {
            id: 'user-1',
            role: 'user',
            threadId: SESSION_ID,
            createdAt: '2026-07-23T10:00:00.000Z',
            content: { format: 2, parts: [{ type: 'text', text: 'Which table style should we use?' }] },
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            threadId: SESSION_ID,
            createdAt: '2026-07-23T10:00:05.000Z',
            content: { format: 2, parts: [{ type: 'text', text: `${REPLY}\n\n${SECOND}` }] },
          },
        ],
      }),
    ),
  );
}

/** Drags a selection over the start of a paragraph with the mouse: press, select, release. */
async function selectFrom(paragraphText: string, length: number) {
  const paragraph = await screen.findByText(paragraphText);
  const text = paragraph.firstChild;
  if (!(text instanceof Text)) throw new Error('The paragraph has no text node');
  fireEvent.pointerDown(paragraph);
  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, length);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  fireEvent.pointerUp(paragraph);
}

async function annotate(user: ReturnType<typeof userEvent.setup>, paragraphText: string, length: number) {
  await selectFrom(paragraphText, length);
  await user.click(await screen.findByRole('button', { name: 'Add to chat' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to chat' })).not.toBeInTheDocument());
}

async function renderSessionWithReply(options: Parameters<typeof stubPreparingSession>[0] = {}) {
  const session = stubPreparingSession(options);
  stubReply();
  const { client } = renderThread();
  await releaseSession(session.finishWorkspace, client);
  return session;
}

const markers = () =>
  Array.from(document.querySelectorAll('[data-slot="quote-marker"]')).map(marker => marker.textContent);

afterEach(() => {
  document.getSelection()?.removeAllRanges();
});

describe('Composer annotations', () => {
  describe('when part of a reply is added to the chat', () => {
    it('is numbered in the transcript and reaches the agent as a blockquote ahead of the typed message', async () => {
      const user = userEvent.setup();
      const session = await renderSessionWithReply();

      await annotate(user, REPLY, 'Open rows'.length);

      expect(markers()).toEqual(['1']);
      expect(screen.getByRole('button', { name: '1 annotation' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus();

      await user.keyboard('Why this one?');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(session.delivered).toEqual(['1. > Open rows\n\nWhy this one?']));
      expect(screen.queryByRole('button', { name: /annotation/ })).not.toBeInTheDocument();
      expect(markers()).toEqual([]);
    });
  });

  describe('when two passages are added and one is removed', () => {
    it('lists them by number and sends only the one left', async () => {
      const user = userEvent.setup();
      const session = await renderSessionWithReply();

      await annotate(user, SECOND, 'Soft rows'.length);
      await annotate(user, REPLY, 'Open rows'.length);
      expect(markers()).toEqual(['1', '2']);

      await user.click(screen.getByRole('button', { name: '2 annotations' }));
      const list = await screen.findByRole('list', { name: 'Annotations' });
      expect(
        within(list)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['1Soft rows', '2Open rows']);
      await user.click(within(list).getByRole('button', { name: 'Remove annotation 1' }));

      expect(markers()).toEqual(['1']);
      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Only this one');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(session.delivered).toEqual(['1. > Open rows\n\nOnly this one']));
    });
  });

  describe('when the message with the annotation fails to send', () => {
    it('puts the annotation back in the composer and the transcript', async () => {
      const user = userEvent.setup();
      const session = await renderSessionWithReply({ failDispatch: true });

      await annotate(user, REPLY, 'Open rows'.length);
      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Why this one?');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(session.posted).toEqual(['1. > Open rows\n\nWhy this one?']));
      expect(await screen.findByRole('button', { name: '1 annotation' })).toBeInTheDocument();
      expect(markers()).toEqual(['1']);
    });
  });
});
