// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { deleteDB } from 'idb';
import { afterEach, expect, it } from 'vitest';
import { createThreadDraftState } from '../drafts/thread-draft-state';
import { readThreadDraft, scopeAnonymousDraftKey } from '../drafts/thread-draft-storage';
import { useAgentThreadNavigation } from '../use-agent-thread-navigation';

const database = 'mastra-composer-drafts';

afterEach(async () => {
  await readThreadDraft('__drain__');
  await deleteDB(database);
  sessionStorage.clear();
});

it.each([
  ['signed-in', 'signed-user'],
  ['auth-off', undefined],
] as const)('moves the %s New Chat draft before navigating to the created thread', async (_mode, userId) => {
  const draftScope: [string, string, string | undefined, string] = ['http://localhost:4111', '/api', userId, 'support'];
  const draftKey = scopeAnonymousDraftKey(JSON.stringify([...draftScope, 'new']));
  expect(draftKey).toBeDefined();
  const state = createThreadDraftState(draftKey);
  const unsubscribe = state.subscribe(() => {});
  try {
    await waitFor(() => expect(state.getSnapshot().status.restoring).toBe(false));
    state.updateDraft({ text: 'Unsent follow-up', attachments: [] });

    let destinationAtNavigation: Promise<string> | undefined;
    const navigated: string[] = [];
    const { result } = renderHook(() =>
      useAgentThreadNavigation({
        threadId: 'new',
        draftScope,
        canPersistDraft: true,
        draftHandle: { current: { move: state.move } },
        navigateToThread: id => {
          navigated.push(id);
          destinationAtNavigation = readThreadDraft(
            scopeAnonymousDraftKey(JSON.stringify([...draftScope, id])) ?? '',
          ).then(draft => draft.text);
        },
        refreshThreads: async () => {},
      }),
    );

    expect(result.current.draftKey).toBe(draftKey);
    await act(async () => result.current.refreshThreadList());
    expect(navigated).toEqual([result.current.actualThreadId]);
    expect(await destinationAtNavigation).toBe('Unsent follow-up');
    expect((await readThreadDraft(draftKey ?? '')).text).toBe('');
  } finally {
    unsubscribe();
  }
});
