// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { deleteDB, openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThreadDraftState as createState } from './thread-draft-state';
import { readThreadDraft, writeThreadDraft } from './thread-draft-storage';

let createThreadDraftState = createState;
beforeEach(async () => {
  vi.resetModules();
  createThreadDraftState = (await import('./thread-draft-state')).createThreadDraftState;
});

const unmounts: (() => void)[] = [];
function mount(key = 'scope', threadId = 'thread') {
  const state = createThreadDraftState({ key, threadId });
  const unmount = state.subscribe(() => {});
  unmounts.push(unmount);
  return { state, unmount };
}
const ready = async (state: ReturnType<typeof createThreadDraftState>) => {
  await vi.waitFor(() => expect(state.getSnapshot().status.restoring).toBe(false));
};

afterEach(async () => {
  vi.restoreAllMocks();
  unmounts.splice(0).forEach(unmount => unmount());
  await readThreadDraft('__drain__');
  await deleteDB('mastra-composer-drafts');
});

describe('complete draft lifecycle', () => {
  it('keeps failed saves and their warning through a handoff and remount, then retries the latest draft', async () => {
    const first = mount('new');
    await ready(first.state);
    first.state.updateDraft('thread', { text: 'Saved version', attachments: [] });
    await readThreadDraft('__drain__');
    first.state.updateDraft('thread', { text: 'x'.repeat(50_001), attachments: [] });
    await vi.waitFor(() => expect(first.state.getSnapshot().status.error).toContain('50,000'));
    await first.state.move('created');
    first.unmount();
    await Promise.resolve();
    const second = mount('created');
    await ready(second.state);
    expect(second.state.getDraft('thread').text).toHaveLength(50_001);
    expect(second.state.getSnapshot().status.error).toContain('50,000');
    expect((await readThreadDraft('created')).text).toBe('');
    second.state.updateDraft('thread', { text: 'Corrected latest draft', attachments: [] });
    await vi.waitFor(() => expect(second.state.getSnapshot().status.saving).toBe(false));
    expect(second.state.getSnapshot().status.error).toBeUndefined();
    expect((await readThreadDraft('created')).text).toBe('Corrected latest draft');
    expect((await readThreadDraft('new')).text).toBe('');
  });

  it('retains unsaved edits when navigating away and back in the same tab', async () => {
    const first = mount();
    await ready(first.state);
    first.state.updateDraft('thread', { text: 'x'.repeat(50_001), attachments: [] });
    await vi.waitFor(() => expect(first.state.getSnapshot().status.error).toContain('50,000'));
    first.unmount();
    await Promise.resolve();
    const second = mount();
    await ready(second.state);
    expect(second.state.getDraft('thread').text).toHaveLength(50_001);
    expect(second.state.getSnapshot().status.error).toContain('50,000');
    second.state.updateDraft('thread', { text: '', attachments: [] });
    await readThreadDraft('__drain__');
  });

  it('rejects stale writes and handoffs from another tab without losing either in-memory draft', async () => {
    const first = mount('shared-new');
    await ready(first.state);
    vi.resetModules();
    const otherTab = await import('./thread-draft-state');
    const second = otherTab.createThreadDraftState({ key: 'shared-new', threadId: 'thread' });
    unmounts.push(second.subscribe(() => {}));
    await ready(second);
    second.updateDraft('thread', { text: 'Tab B saved', attachments: [] });
    await vi.waitFor(() => expect(second.getSnapshot().status.saving).toBe(false));
    first.state.updateDraft('thread', { text: 'Tab A unsaved', attachments: [] });
    await vi.waitFor(() => expect(first.state.getSnapshot().status.error).toContain('another tab'));
    await first.state.move('created-a');
    expect(first.state.getSnapshot().status.error).toContain('another tab');
    expect((await readThreadDraft('shared-new')).text).toBe('Tab B saved');
    expect((await readThreadDraft('created-a')).text).toBe('');
    expect(first.state.getDraft('thread').text).toBe('Tab A unsaved');
  });
  it('reloads saved drafts from storage after leaving the conversation', async () => {
    const first = mount();
    await ready(first.state);
    first.state.updateDraft('thread', { text: 'First saved version', attachments: [] });
    await vi.waitFor(() => expect(first.state.getSnapshot().status.saving).toBe(false));
    first.unmount();
    await Promise.resolve();
    await writeThreadDraft('scope', { text: 'Updated elsewhere', attachments: [] });
    const second = mount();
    await ready(second.state);
    expect(second.state.getDraft('thread').text).toBe('Updated elsewhere');
  });

  describe('when rapid edits are followed by immediate navigation', () => {
    it('persists only the newest pending draft without waiting for a debounce', async () => {
      const { state, unmount } = mount();
      await ready(state);
      const put = vi.spyOn(IDBObjectStore.prototype, 'put');
      for (let index = 0; index < 100; index++) {
        state.updateDraft('thread', { text: `Edit ${index}`, attachments: [] });
      }
      unmount();
      await vi.waitFor(() => expect(state.getSnapshot().status.saving).toBe(false));
      expect((await readThreadDraft('scope')).text).toBe('Edit 99');
      expect(put).toHaveBeenCalledTimes(1);
    });
  });

  it('reports queued saves until the newest text has been committed', async () => {
    const { state } = mount();
    await ready(state);
    state.updateDraft('thread', { text: 'First edit', attachments: [] });
    state.updateDraft('thread', { text: 'Second edit', attachments: [] });
    expect(state.getSnapshot().status.saving).toBe(true);
    await vi.waitFor(() => expect(state.getSnapshot().status.saving).toBe(false));
    expect((await readThreadDraft('scope')).text).toBe('Second edit');
  });

  it('applies edits queued during hydration without losing saved attachments', async () => {
    const attachment = {
      id: 'attachment',
      name: 'notes.txt',
      contentType: 'text/plain',
      kind: 'text' as const,
      isUrl: false,
      file: new File(['Original'], 'notes.txt', { type: 'text/plain' }),
    };
    await writeThreadDraft('scope', { text: 'Saved', attachments: [attachment] });
    const { state } = mount();
    state.updateDraft('thread', previous => ({ ...previous, text: previous.text + ' edit' }));
    await ready(state);
    await vi.waitFor(() => expect(state.getSnapshot().status.saving).toBe(false));
    expect(state.getDraft('thread').text).toBe('Saved edit');
    expect(state.getDraft('thread').attachments).toHaveLength(1);
    expect((await readThreadDraft('scope')).text).toBe('Saved edit');
  });

  it('shares pending edits across New Chat remounts with different temporary thread IDs', async () => {
    const first = mount('new', 'uuid-one');
    await ready(first.state);
    first.state.updateDraft('uuid-one', { text: 'Latest', attachments: [] });
    first.unmount();
    const second = mount('new', 'uuid-two');
    expect(second.state.getDraft('uuid-two').text).toBe('Latest');
    second.state.updateDraft('uuid-two', { text: 'Next', attachments: [] });
    await vi.waitFor(() => expect(second.state.getSnapshot().status.saving).toBe(false));
    expect((await readThreadDraft('new')).text).toBe('Next');
  });

  it('routes edits made during the New Chat handoff to the created thread', async () => {
    const { state } = mount('new');
    await ready(state);
    state.updateDraft('thread', { text: 'Follow-up', attachments: [] });
    const moving = state.move('created');
    state.updateDraft('thread', previous => ({ ...previous, text: previous.text + ' latest' }));
    await moving;
    const next = mount('created');
    expect(next.state.getDraft('thread').text).toBe('Follow-up latest');
    expect((await readThreadDraft('created')).text).toBe('Follow-up latest');
    expect((await readThreadDraft('new')).text).toBe('');
  });

  it('waits for restoration before a handoff applies further edits', async () => {
    await writeThreadDraft('new', { text: 'Saved', attachments: [] });
    const { state } = mount('new');
    const moving = state.move('created');
    state.updateDraft('thread', previous => ({ ...previous, text: previous.text + ' edit' }));
    await moving;
    await ready(state);
    expect((await readThreadDraft('created')).text).toBe('Saved edit');
  });

  it('does not overwrite a saved draft that could not be restored', async () => {
    await writeThreadDraft('scope', { text: 'Recover this saved draft', attachments: [] });
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const { state } = mount();
    await ready(state);
    state.updateDraft('thread', { text: 'Keep this new text in memory', attachments: [] });
    expect(state.getSnapshot().status.error).toContain('could not be restored');
    expect((await readThreadDraft('scope')).text).toBe('Recover this saved draft');
    expect(state.getDraft('thread').text).toBe('Keep this new text in memory');
  });

  describe('when another tab signs out', () => {
    it('clears mounted state and prevents stale pending edits from recreating drafts', async () => {
      const scope = JSON.stringify(['http://localhost:4111', '/api', 'user']);
      const key = JSON.stringify(['http://localhost:4111', '/api', 'user', 'agent', 'new']);
      const first = mount(key);
      await ready(first.state);
      vi.resetModules();
      const otherTab = await import('./thread-draft-state');
      const second = otherTab.createThreadDraftState({ key, threadId: 'thread' });
      unmounts.push(second.subscribe(() => {}));
      await ready(second);
      second.updateDraft('thread', { text: 'Pending edit', attachments: [] });
      await otherTab.clearDraftsOnLogout(scope);
      expect(second.getDraft('thread').text).toBe('');
      second.updateDraft('thread', { text: 'Must not recreate', attachments: [] });
      first.state.updateDraft('thread', { text: 'Stale other tab', attachments: [] });
      await vi.waitFor(() => expect(first.state.getSnapshot().status.error).toContain('signed out'));
      expect(first.state.getDraft('thread').text).toBe('');
      expect((await readThreadDraft(key)).text).toBe('');
    });
  });

  describe('when a saved draft is corrupted', () => {
    it('preserves the record until explicitly discarded and then saves current edits', async () => {
      await writeThreadDraft('scope', { text: 'Original', attachments: [] });
      const db = await openDB('mastra-composer-drafts');
      const corrupted = { key: 'scope', text: 42 };
      await db.put('drafts', corrupted);
      const { state } = mount();
      await ready(state);
      state.updateDraft('thread', { text: 'Keep these edits', attachments: [] });
      const stored = await db.get('drafts', 'scope');
      db.close();
      expect(state.getSnapshot().status.canDiscard).toBe(true);
      expect(stored).toEqual(corrupted);
      await state.discardUnreadable();
      expect(state.getSnapshot().status.error).toBeUndefined();
      expect((await readThreadDraft('scope')).text).toBe('Keep these edits');
    });

    it('does not discard a draft repaired by another tab', async () => {
      await writeThreadDraft('scope', { text: 'Original', attachments: [] });
      const db = await openDB('mastra-composer-drafts');
      await db.put('drafts', { key: 'scope', text: 42 });
      db.close();
      const { state } = mount();
      await ready(state);
      await writeThreadDraft('scope', { text: 'Repaired elsewhere', attachments: [] });
      await state.discardUnreadable();
      expect(state.getSnapshot().status.error).toContain('another tab');
      expect((await readThreadDraft('scope')).text).toBe('Repaired elsewhere');
    });
  });

  it('keeps an in-memory draft and feedback when browser writes fail', async () => {
    const { state } = mount();
    await ready(state);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    state.updateDraft('thread', { text: 'Still here', attachments: [] });
    await vi.waitFor(() => expect(state.getSnapshot().status.error).toContain('could not be saved'));
    expect(state.getDraft('thread').text).toBe('Still here');
    put.mockRestore();
    state.updateDraft('thread', { text: 'Retry', attachments: [] });
    await vi.waitFor(() => expect(state.getSnapshot().status.error).toBeUndefined());
    expect((await readThreadDraft('scope')).text).toBe('Retry');
  });
});
