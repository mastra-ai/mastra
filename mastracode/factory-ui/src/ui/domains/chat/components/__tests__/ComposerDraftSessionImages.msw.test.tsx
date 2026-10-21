import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import assert from 'node:assert';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import {
  FACTORY_ID,
  PROJECT_REPOSITORY_ID,
  SESSION_ID,
  createdDraftSession,
  renderDraft,
  stubPreparingSession,
} from './composer-session-test-fixture';

const THREAD_URL = `/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`;
const DRAFT_URL = `/factories/${FACTORY_ID}/user/new/${SESSION_ID}`;
// `btoa('png')`: the wire payload carries base64 file data.
const SENT_SHOT = { data: 'cG5n', mediaType: 'image/png', filename: 'shot.png' };

function screenshot(): File {
  return new File(['png'], 'shot.png', { type: 'image/png' });
}

/** Accept the lazy session create and record each request body. */
function acceptSessionCreate(title: string): unknown[] {
  const createBodies: unknown[] = [];
  server.use(
    http.post(`${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`, async ({ request }) => {
      createBodies.push(await request.json());
      return HttpResponse.json({ session: createdDraftSession(title) });
    }),
  );
  return createBodies;
}

async function draftReadyForImages() {
  const message = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Attach image' })).toBeEnabled());
  return message;
}

async function dropScreenshot(container: HTMLElement) {
  const form = container.querySelector('form');
  assert(form);
  fireEvent.drop(form, { dataTransfer: { files: [screenshot()] } });
  expect(await screen.findByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();
}

describe('Starting a user session with images attached', () => {
  describe('attaching on the draft', () => {
    it('accepts an image chosen with the file picker without creating the session', async () => {
      stubPreparingSession();
      const createBodies = acceptSessionCreate('unused');
      const user = userEvent.setup();
      renderDraft();
      await draftReadyForImages();

      await user.upload(screen.getByLabelText('Attach images'), screenshot());

      expect(await screen.findByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();
      expect(screen.queryByText('Images can be attached once the session is ready.')).not.toBeInTheDocument();
      expect(createBodies).toEqual([]);
    });

    it('accepts a pasted image', async () => {
      stubPreparingSession();
      acceptSessionCreate('unused');
      renderDraft();
      const message = await draftReadyForImages();

      fireEvent.paste(message, { clipboardData: { files: [screenshot()] } });

      expect(await screen.findByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();
    });

    it('accepts a dropped image', async () => {
      stubPreparingSession();
      acceptSessionCreate('unused');
      const { container } = renderDraft();
      await draftReadyForImages();

      await dropScreenshot(container);

      expect(screen.queryByText('Images can be attached once the session is ready.')).not.toBeInTheDocument();
    });
  });

  describe('sending the first prompt', () => {
    it('creates the session and sends the images with the first prompt', async () => {
      const preparation = stubPreparingSession({ createdSessionTitle: 'what is wrong here' });
      const createBodies = acceptSessionCreate('what is wrong here');
      const user = userEvent.setup();
      const { client, container } = renderDraft();
      const message = await draftReadyForImages();
      await dropScreenshot(container);

      await user.type(message, 'what is wrong here');
      await user.keyboard('{Enter}');

      await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent(THREAD_URL));
      expect(createBodies).toEqual([{ sessionId: SESSION_ID, title: 'what is wrong here', visibility: 'private' }]);
      await waitFor(() => expect(preparation.posted).toEqual(['what is wrong here']));
      expect(preparation.postedFiles).toEqual([SENT_SHOT]);
      expect(screen.queryByRole('button', { name: 'Remove shot.png' })).not.toBeInTheDocument();

      preparation.finishWorkspace();
      await waitForMutationsIdle(client);
      await waitFor(() => expect(preparation.delivered).toEqual(['what is wrong here']));
    });

    it('starts a session from an image-only first prompt', async () => {
      const preparation = stubPreparingSession();
      const createBodies = acceptSessionCreate('');
      const user = userEvent.setup();
      const { client, container } = renderDraft();
      await draftReadyForImages();
      await dropScreenshot(container);

      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(preparation.posted).toEqual(['']));
      expect(createBodies).toEqual([{ sessionId: SESSION_ID, title: '', visibility: 'private' }]);
      expect(preparation.postedFiles).toEqual([SENT_SHOT]);

      preparation.finishWorkspace();
      await waitForMutationsIdle(client);
      await waitFor(() => expect(preparation.delivered).toEqual(['']));
    });

    it('sends no images when the attachment was removed before sending', async () => {
      const preparation = stubPreparingSession({ createdSessionTitle: 'text only' });
      acceptSessionCreate('text only');
      const user = userEvent.setup();
      const { client, container } = renderDraft();
      const message = await draftReadyForImages();
      await dropScreenshot(container);

      await user.click(screen.getByRole('button', { name: 'Remove shot.png' }));
      await user.type(message, 'text only');
      await user.keyboard('{Enter}');

      await waitFor(() => expect(preparation.posted).toEqual(['text only']));
      expect(preparation.postedFiles).toEqual([]);

      preparation.finishWorkspace();
      await waitForMutationsIdle(client);
    });

    it('applies the draft-selected model before sending the prompt and its images', async () => {
      const preparation = stubPreparingSession({ createdSessionTitle: 'use my model' });
      acceptSessionCreate('use my model');
      const user = userEvent.setup();
      const { client, container } = renderDraft();
      const message = await draftReadyForImages();

      await user.click(await screen.findByLabelText('Session model'));
      await user.click(await screen.findByRole('option', { name: /gpt-5.4-mini/ }));
      await dropScreenshot(container);
      await user.type(message, 'use my model');
      await user.keyboard('{Enter}');

      await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent(THREAD_URL));
      preparation.finishWorkspace();
      await waitForMutationsIdle(client);
      await waitFor(() => expect(preparation.delivered).toEqual(['use my model']));
      expect(preparation.operations).toEqual(['model:openai/gpt-5.4-mini', 'message']);
      expect(preparation.postedFiles).toEqual([SENT_SHOT]);
    });
  });

  describe('when the first prompt fails', () => {
    it('keeps the text and images in the composer when the session cannot be created', async () => {
      const preparation = stubPreparingSession();
      server.use(
        http.post(`${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
          HttpResponse.json({ message: 'Database unavailable' }, { status: 500 }),
        ),
      );
      const user = userEvent.setup();
      const { container } = renderDraft();
      const message = await draftReadyForImages();
      await dropScreenshot(container);

      await user.type(message, 'look at this');
      await user.keyboard('{Enter}');

      expect(await screen.findByText(/Could not create the session: Database unavailable/)).toBeInTheDocument();
      expect(screen.getByTestId('pathname')).toHaveTextContent(DRAFT_URL);
      expect(message).toHaveValue('look at this');
      expect(screen.getByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();
      expect(preparation.posted).toEqual([]);
    });

    it('puts the text and images back in the composer when the first send fails', async () => {
      const preparation = stubPreparingSession({ createdSessionTitle: 'look at this', failDispatch: true });
      acceptSessionCreate('look at this');
      const user = userEvent.setup();
      const { client, container } = renderDraft();
      const message = await draftReadyForImages();
      await dropScreenshot(container);

      await user.type(message, 'look at this');
      await user.keyboard('{Enter}');
      await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent(THREAD_URL));
      await waitFor(() => expect(preparation.postedFiles).toEqual([SENT_SHOT]));

      preparation.finishWorkspace();
      await waitForMutationsIdle(client);

      expect(await screen.findByText(/Sandbox is gone/)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('look at this'));
      expect(screen.getByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();
      expect(preparation.delivered).toEqual([]);
    });
  });
});
