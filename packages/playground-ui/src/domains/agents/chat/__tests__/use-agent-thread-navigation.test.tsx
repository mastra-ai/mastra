// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { deleteDB } from 'idb';
import { afterEach, expect, it } from 'vitest';
import { createThreadDraftState } from '../drafts/thread-draft-state';
import { readThreadDraft } from '../drafts/thread-draft-storage';
import { useAgentThreadNavigation } from '../use-agent-thread-navigation';

const database = 'mastra-composer-drafts';

afterEach(async () => {
  await readThreadDraft('__drain__');
  await deleteDB(database);
});

it('moves the New Chat draft before navigating to the created thread', async () => {
  const draftScope: [string, string, string, string] = ['http://localhost:4111', '/api', 'signed-user', 'support'];
  const state = createThreadDraftState(JSON.stringify([...draftScope, 'new']));
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
          destinationAtNavigation = readThreadDraft(JSON.stringify([...draftScope, id])).then(draft => draft.text);
        },
        refreshThreads: async () => {},
      }),
    );

    await act(async () => result.current.refreshThreadList());
    expect(navigated).toEqual([result.current.actualThreadId]);
    expect(await destinationAtNavigation).toBe('Unsent follow-up');
    expect((await readThreadDraft(JSON.stringify([...draftScope, 'new']))).text).toBe('');
  } finally {
    unsubscribe();
  }
});
