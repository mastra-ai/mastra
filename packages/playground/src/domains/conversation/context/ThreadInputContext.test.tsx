import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { deleteDB, openDB } from 'idb';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { readThreadDraft, writeThreadDraft } from './thread-draft-storage';
import { ThreadInputProvider } from './ThreadInputContext';
import { useThreadInput } from './useThreadInput';

afterEach(async () => {
  cleanup();
  await readThreadDraft('__drain__');
  await deleteDB('mastra-composer-drafts');
  localStorage.clear();
});

describe('ThreadInputProvider', () => {
  describe('when updates are batched', () => {
    it('applies functional updates queued during restoration to the latest text', async () => {
      const { result } = renderHook(() => useThreadInput('one'), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ThreadInputProvider persistence={{ key: 'scope', threadId: 'one' }}>{children}</ThreadInputProvider>
        ),
      });
      act(() => {
        result.current.setThreadInput(text => text + 'First');
        result.current.setThreadInput(text => text + ' second');
      });
      await waitFor(() => expect(result.current.threadInput).toBe('First second'));
      expect((await readThreadDraft('scope')).text).toBe('First second');
    });
  });

  describe('when persistence is not enabled', () => {
    it('keeps the default composer in memory only', async () => {
      const { result } = renderHook(() => useThreadInput(), {
        wrapper: ({ children }: { children: ReactNode }) => <ThreadInputProvider>{children}</ThreadInputProvider>,
      });
      act(() => result.current.setThreadInput('Temporary'));
      expect(result.current.threadInput).toBe('Temporary');
      await readThreadDraft('__drain__');
      const db = await openDB('mastra-composer-drafts');
      try {
        expect(await db.count('drafts')).toBe(0);
      } finally {
        db.close();
      }
    });
  });

  describe('when another thread uses the same provider', () => {
    it('does not overwrite the persisted thread', async () => {
      await writeThreadDraft('scope', { text: 'Keep the active draft', attachments: [] });
      const { result } = renderHook(() => useThreadInput('other'), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ThreadInputProvider persistence={{ key: 'scope', threadId: 'one' }}>{children}</ThreadInputProvider>
        ),
      });
      act(() => result.current.setThreadInput('Another thread'));
      await waitFor(() => expect(result.current.threadInput).toBe('Another thread'));
      expect((await readThreadDraft('scope')).text).toBe('Keep the active draft');
    });
  });
});
