import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { SESSION_ID, releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const REPLY = 'Open rows drop the frame and keep a subtle rounded hover.';

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
            content: { format: 2, parts: [{ type: 'text', text: REPLY }] },
          },
        ],
      }),
    ),
  );
}

/** Drags a selection over the start of the reply with the mouse: press, select, release. */
async function selectFromReply(length: number) {
  const paragraph = await screen.findByText(REPLY);
  const text = paragraph.firstChild;
  if (!(text instanceof Text)) throw new Error('The reply has no text node');
  fireEvent.pointerDown(paragraph);
  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, length);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  fireEvent.pointerUp(paragraph);
}

async function renderSessionWithReply() {
  const session = stubPreparingSession();
  stubReply();
  const { client } = renderThread();
  await releaseSession(session.finishWorkspace, client);
  return session;
}

const composerForm = () => {
  const form = screen.getByRole('textbox', { name: 'Message' }).closest('form');
  if (!form) throw new Error('The composer has no form');
  return form;
};

afterEach(() => {
  document.getSelection()?.removeAllRanges();
});

describe('Composer quotes', () => {
  describe('when part of a reply is added to the chat', () => {
    it('waits in the composer header and reaches the agent as a blockquote ahead of the typed message', async () => {
      const user = userEvent.setup();
      const session = await renderSessionWithReply();

      await selectFromReply('Open rows'.length);
      await user.click(await screen.findByRole('button', { name: 'Add to chat' }));

      expect(within(composerForm()).getByText('Open rows')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus();

      await user.keyboard('Why this one?');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(session.delivered).toEqual(['> Open rows\n\nWhy this one?']));
      expect(screen.queryByRole('button', { name: 'Remove quote' })).not.toBeInTheDocument();
    });
  });

  describe('when the quote is removed before sending', () => {
    it('sends only the typed message', async () => {
      const user = userEvent.setup();
      const session = await renderSessionWithReply();

      await selectFromReply('Open rows'.length);
      await user.click(await screen.findByRole('button', { name: 'Add to chat' }));
      await user.click(screen.getByRole('button', { name: 'Remove quote' }));
      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Never mind');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(session.delivered).toEqual(['Never mind']));
    });
  });

  describe('when the message with the quote fails to send', () => {
    it('puts the quote back in the composer header', async () => {
      const user = userEvent.setup();
      const session = stubPreparingSession({ failDispatch: true });
      stubReply();
      const { client } = renderThread();
      await releaseSession(session.finishWorkspace, client);

      await selectFromReply('Open rows'.length);
      await user.click(await screen.findByRole('button', { name: 'Add to chat' }));
      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Why this one?');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(session.posted).toEqual(['> Open rows\n\nWhy this one?']));
      expect(await within(composerForm()).findByText('Open rows')).toBeInTheDocument();
    });
  });
});
