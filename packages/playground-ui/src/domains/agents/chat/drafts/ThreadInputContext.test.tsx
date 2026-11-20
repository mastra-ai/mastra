// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { deleteDB } from 'idb';
import { useContext } from 'react';
import { afterEach, expect, it } from 'vitest';
import { readThreadDraft, scopeAnonymousDraftKey, writeThreadDraft } from './thread-draft-storage';
import { ThreadInputContext } from './thread-input-context';
import { ThreadInputProvider } from './ThreadInputContext';

const key = JSON.stringify(['http://localhost:4111', '/api', null, 'support', 'new']);
const signedKey = JSON.stringify(['http://localhost:4111', '/api', 'signed-user', 'support', 'new']);

function Composer() {
  const input = useContext(ThreadInputContext);
  return (
    <>
      <input
        aria-label="Draft"
        value={input.getThreadInput('new')}
        onChange={event => input.setThreadInputForThread('new', event.target.value)}
      />
      <span data-testid="restoring">{String(input.drafts?.status.restoring)}</span>
    </>
  );
}

afterEach(async () => {
  await readThreadDraft('__drain__');
  await deleteDB('mastra-composer-drafts');
  sessionStorage.clear();
});

it('restores an auth-off draft after a reload within the same browser session', async () => {
  const firstSession = render(
    <ThreadInputProvider persistence={{ key, threadId: 'new' }}>
      <Composer />
    </ThreadInputProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('restoring').textContent).toBe('false'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'Unsent recipe' } });
  firstSession.unmount();

  render(
    <ThreadInputProvider persistence={{ key, threadId: 'new' }}>
      <Composer />
    </ThreadInputProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Draft' }).getAttribute('value')).toBe('Unsent recipe'),
  );
});

it('does not restore a previous anonymous browser session draft', async () => {
  const firstSession = render(
    <ThreadInputProvider persistence={{ key, threadId: 'new' }}>
      <Composer />
    </ThreadInputProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('restoring').textContent).toBe('false'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'Private draft' } });
  expect(screen.getByRole('textbox', { name: 'Draft' }).getAttribute('value')).toBe('Private draft');
  firstSession.unmount();
  await readThreadDraft('__drain__');
  const priorKey = scopeAnonymousDraftKey(key);
  expect((await readThreadDraft(priorKey ?? '')).text).toBe('Private draft');
  sessionStorage.clear();

  const nextSession = render(
    <ThreadInputProvider persistence={{ key, threadId: 'new' }}>
      <Composer />
    </ThreadInputProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('restoring').textContent).toBe('false'));
  expect(screen.getByRole('textbox', { name: 'Draft' }).getAttribute('value')).toBe('');
  expect((await readThreadDraft(priorKey ?? '')).text).toBe('Private draft');
  nextSession.unmount();
});

it('does not restore an unscoped anonymous draft from the old format', async () => {
  await writeThreadDraft(key, { text: 'Previous visitor draft', attachments: [] });
  render(
    <ThreadInputProvider persistence={{ key, threadId: 'new' }}>
      <Composer />
    </ThreadInputProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('restoring').textContent).toBe('false'));
  expect(screen.getByRole('textbox', { name: 'Draft' }).getAttribute('value')).toBe('');
});

it('still restores a signed-in user draft across remounts', async () => {
  const firstSession = render(
    <ThreadInputProvider persistence={{ key: signedKey, threadId: 'new' }}>
      <Composer />
    </ThreadInputProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('restoring').textContent).toBe('false'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'Keep this draft' } });
  firstSession.unmount();

  const nextSession = render(
    <ThreadInputProvider persistence={{ key: signedKey, threadId: 'new' }}>
      <Composer />
    </ThreadInputProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Draft' }).getAttribute('value')).toBe('Keep this draft'),
  );
  nextSession.unmount();
});
