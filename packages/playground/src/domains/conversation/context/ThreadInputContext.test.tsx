import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { deleteDB, openDB } from 'idb';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readThreadDraft, writeThreadDraft } from './thread-draft-storage';
import { ThreadInputProvider } from './ThreadInputContext';
import { useThreadInput } from './useThreadInput';

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
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
      await waitFor(() => expect(result.current.draftStatus?.saving).toBe(false));
      expect((await readThreadDraft('scope')).text).toBe('First second');
    });
  });

  describe('when a New Chat remounts with another temporary thread ID', () => {
    it('restores the flushed draft without sharing temporary thread identity', async () => {
      const first = renderHook(() => useThreadInput('temporary-one'), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ThreadInputProvider persistence={{ key: 'new', threadId: 'temporary-one' }}>{children}</ThreadInputProvider>
        ),
      });
      await waitFor(() => expect(first.result.current.draftStatus?.restoring).toBe(false));
      act(() => first.result.current.setThreadInput('Pending'));
      first.unmount();
      const second = renderHook(() => useThreadInput('temporary-two'), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ThreadInputProvider persistence={{ key: 'new', threadId: 'temporary-two' }}>{children}</ThreadInputProvider>
        ),
      });
      await waitFor(() => expect(second.result.current.threadInput).toBe('Pending'));
      act(() => second.result.current.setThreadInput(text => text + ' edit'));
      await waitFor(() => expect(second.result.current.draftStatus?.saving).toBe(false));
      expect((await readThreadDraft('new')).text).toBe('Pending edit');
    });
  });

  describe('when persistence is not enabled', () => {
    it('keeps separate threads and batched functional edits without opening storage', () => {
      const open = vi.spyOn(indexedDB, 'open');
      const { result, rerender } = renderHook(({ id }) => useThreadInput(id), {
        initialProps: { id: 'one' },
        wrapper: ({ children }: { children: ReactNode }) => <ThreadInputProvider>{children}</ThreadInputProvider>,
      });
      act(() => {
        result.current.setThreadInput(text => text + 'First');
        result.current.setThreadInput(text => text + ' second');
      });
      rerender({ id: 'other' });
      expect(result.current.threadInput).toBe('');
      act(() => result.current.setThreadInput('Other draft'));
      rerender({ id: 'one' });
      expect(result.current.threadInput).toBe('First second');
      expect(open).not.toHaveBeenCalled();
      open.mockRestore();
    });
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
