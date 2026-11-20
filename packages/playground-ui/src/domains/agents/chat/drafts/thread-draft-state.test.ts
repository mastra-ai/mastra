// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDraftsOnLogout, createThreadDraftState } from './thread-draft-state';
import { readThreadDraft, writeThreadDraft } from './thread-draft-storage';

const unmounts: (() => void)[] = [];
function mount(key = 'scope') {
  const state = createThreadDraftState(key);
  const unmount = state.subscribe(() => {});
  unmounts.push(unmount);
  return { state, unmount };
}
const ready = async (state: ReturnType<typeof createThreadDraftState>) => {
  await vi.waitFor(() => expect(state.getSnapshot().status.restoring).toBe(false));
};
const saved = async (state: ReturnType<typeof createThreadDraftState>) => {
  await vi.waitFor(() => expect(state.getSnapshot().status.saving).toBe(false));
};
afterEach(async () => {
  vi.restoreAllMocks();
  unmounts.splice(0).forEach(unmount => unmount());
  await readThreadDraft('__drain__');
  await deleteDB('mastra-composer-drafts');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('draft persistence lifecycle', () => {
  describe('when an update leaves the text and attachments unchanged', () => {
    it('does not notify subscribers or schedule a save', async () => {
      const { state } = mount();
      await ready(state);
      state.updateDraft(previous => ({ ...previous, text: 'Same' }));
      await saved(state);
      const listener = vi.fn();
      unmounts.push(state.subscribe(listener));
      const put = vi.spyOn(IDBObjectStore.prototype, 'put');
      // Dictation re-applies the current transcript on every render; a new object with
      // identical content must not re-render the composer or the loop never settles.
      state.updateDraft(previous => ({ ...previous, text: 'Same' }));
      state.updateDraft({ text: 'Same', attachments: state.getSnapshot().draft.attachments });
      expect(listener).not.toHaveBeenCalled();
      expect(state.getSnapshot().status.saving).toBe(false);
      expect(put).not.toHaveBeenCalled();
    });
  });

  describe('when typing pauses', () => {
    it('updates memory immediately and saves after 300ms without edits', async () => {
      const { state } = mount();
      await ready(state);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      state.updateDraft(previous => ({ ...previous, text: 'First' }));
      await vi.advanceTimersByTimeAsync(200);
      state.updateDraft(previous => ({ ...previous, text: 'Latest' }));
      expect(state.getSnapshot().draft.text).toBe('Latest');
      await vi.advanceTimersByTimeAsync(299);
      expect((await readThreadDraft('scope')).text).toBe('');
      await vi.advanceTimersByTimeAsync(1);
      expect((await readThreadDraft('scope')).text).toBe('Latest');
    });
  });

  describe('when typing continues without pausing', () => {
    it('saves once per second instead of postponing indefinitely', async () => {
      const { state } = mount();
      await ready(state);
      const put = vi.spyOn(IDBObjectStore.prototype, 'put');
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      for (let index = 0; index < 10; index++) {
        state.updateDraft(previous => ({ ...previous, text: `Edit ${index}` }));
        await vi.advanceTimersByTimeAsync(100);
      }
      expect((await readThreadDraft('scope')).text).toBe('Edit 9');
      expect(put).toHaveBeenCalledTimes(1);
      state.updateDraft(previous => ({ ...previous, text: 'Final' }));
      await vi.advanceTimersByTimeAsync(300);
      expect((await readThreadDraft('scope')).text).toBe('Final');
    });
  });

  describe('when leaving the conversation with a pending draft', () => {
    it('flushes before the replacement controller reads storage', async () => {
      const first = mount();
      await ready(first.state);
      first.state.updateDraft(previous => ({ ...previous, text: 'Last keystroke' }));
      first.unmount();
      const second = mount();
      await ready(second.state);
      expect(second.state.getSnapshot().draft.text).toBe('Last keystroke');
    });

    it('coalesces a burst of text edits into one flushed snapshot', async () => {
      const { state, unmount } = mount();
      await ready(state);
      const put = vi.spyOn(IDBObjectStore.prototype, 'put');
      for (let index = 0; index < 100; index++) {
        state.updateDraft(previous => ({ ...previous, text: `Edit ${index}` }));
      }
      unmount();
      expect((await readThreadDraft('scope')).text).toBe('Edit 99');
      expect(put).toHaveBeenCalledTimes(1);
    });
  });

  describe('when New Chat becomes a saved conversation', () => {
    it('moves the latest draft without recreating the old slot', async () => {
      const { state } = mount('new');
      await ready(state);
      state.updateDraft(previous => ({ ...previous, text: 'Follow-up' }));
      const moving = state.move('created');
      state.updateDraft(previous => ({ ...previous, text: 'Latest follow-up' }));
      await moving;
      await saved(state);
      expect((await readThreadDraft('created')).text).toBe('Latest follow-up');
      expect((await readThreadDraft('new')).text).toBe('');
    });

    it('leaves a fresh New Chat independent of the outgoing handoff', async () => {
      await writeThreadDraft('new', { text: 'Submitted', attachments: [] });
      const first = mount('new');
      await ready(first.state);
      first.state.updateDraft({ text: '', attachments: [] });
      const moving = first.state.move('created');
      const second = mount('new');
      await moving;
      await ready(second.state);
      expect(second.state.getSnapshot().draft.text).toBe('');
      second.state.updateDraft({ text: 'Independent question', attachments: [] });
      await saved(second.state);
      expect((await readThreadDraft('new')).text).toBe('Independent question');
      expect((await readThreadDraft('created')).text).toBe('');
    });
  });

  describe('when edits arrive during restoration', () => {
    it('applies them to the restored text without losing attachments', async () => {
      await writeThreadDraft('scope', {
        text: 'Saved',
        attachments: [
          {
            id: 'file',
            name: 'notes.txt',
            contentType: 'text/plain',
            kind: 'text',
            isUrl: false,
            file: new File(['Original'], 'notes.txt', { type: 'text/plain' }),
          },
        ],
      });
      const { state } = mount();
      state.updateDraft(previous => ({ ...previous, text: previous.text + ' edit' }));
      await ready(state);
      await saved(state);
      const draft = await readThreadDraft('scope');
      expect(draft.text).toBe('Saved edit');
      expect(await draft.attachments[0].file.text()).toBe('Original');
    });
  });

  describe('when a pending draft is submitted', () => {
    it('clears it immediately and cancels the old typing timer', async () => {
      await writeThreadDraft('scope', { text: 'Saved', attachments: [] });
      const { state } = mount();
      await ready(state);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      state.updateDraft(previous => ({ ...previous, text: 'New edit' }));
      state.updateDraft(previous => ({ ...previous, text: '' }));
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(1000);
      expect((await readThreadDraft('scope')).text).toBe('');
    });
  });

  describe('when the browser hides the page', () => {
    it.each(['visibilitychange', 'pagehide'])('flushes pending text on %s without a prompt', async event => {
      vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'hidden' }));
      vi.stubGlobal('window', new EventTarget());
      const { state } = mount();
      await ready(state);
      state.updateDraft(previous => ({ ...previous, text: 'Before leaving' }));
      (event === 'pagehide' ? window : document).dispatchEvent(new Event(event));
      expect((await readThreadDraft('scope')).text).toBe('Before leaving');
    });
  });

  describe('when this tab signs out', () => {
    it('cancels pending writes before clearing that user’s drafts', async () => {
      const scope = ['http://localhost:4111', '/api', 'user'];
      const key = JSON.stringify([...scope, 'agent', 'new']);
      const { state, unmount } = mount(key);
      await ready(state);
      state.updateDraft(previous => ({ ...previous, text: 'Private edit' }));
      await clearDraftsOnLogout(JSON.stringify(scope));
      unmount();
      expect(state.getSnapshot().draft.text).toBe('');
      expect((await readThreadDraft(key)).text).toBe('');
    });
  });

  describe('when a save fails', () => {
    it('keeps editing usable and retries on the next edit', async () => {
      const { state } = mount();
      await ready(state);
      const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
        throw new DOMException('Full', 'QuotaExceededError');
      });
      state.updateDraft({ text: 'Still here', attachments: [] });
      await saved(state);
      expect(state.getSnapshot().status.error).toContain('could not be saved');
      expect(state.getSnapshot().draft.text).toBe('Still here');
      put.mockRestore();
      state.updateDraft({ text: 'Next edit', attachments: [] });
      await saved(state);
      expect(state.getSnapshot().status.error).toBeUndefined();
      expect((await readThreadDraft('scope')).text).toBe('Next edit');
    });

    it('restores only the last successful save after remounting', async () => {
      await writeThreadDraft('scope', { text: 'Last saved', attachments: [] });
      const first = mount();
      await ready(first.state);
      first.state.updateDraft({ text: 'x'.repeat(50_001), attachments: [] });
      await saved(first.state);
      expect(first.state.getSnapshot().status.error).toContain('50,000');
      first.unmount();
      const second = mount();
      await ready(second.state);
      expect(second.state.getSnapshot().draft.text).toBe('Last saved');
    });
  });

  describe('when two tabs edit the same draft', () => {
    it('keeps the last saved snapshot without requiring conflict recovery', async () => {
      const { state: first } = mount('shared');
      await ready(first);
      vi.resetModules();
      const otherTab = await import('./thread-draft-state');
      const second = otherTab.createThreadDraftState('shared');
      unmounts.push(second.subscribe(() => {}));
      await ready(second);
      first.updateDraft({ text: 'First tab', attachments: [] });
      await saved(first);
      second.updateDraft({ text: 'Last tab', attachments: [] });
      await saved(second);
      expect(second.getSnapshot().status.error).toBeUndefined();
      expect((await readThreadDraft('shared')).text).toBe('Last tab');
    });
  });

  describe('when a saved record is unreadable', () => {
    it('starts empty and replaces the record on the next edit', async () => {
      await readThreadDraft('__init__');
      const db = await openDB('mastra-composer-drafts');
      await db.put('drafts', { key: 'broken', text: 42 });
      db.close();
      const { state } = mount('broken');
      await ready(state);
      expect(state.getSnapshot().draft).toEqual({ text: '', attachments: [] });
      expect(state.getSnapshot().status.error).toBeUndefined();
      state.updateDraft({ text: 'New draft', attachments: [] });
      await saved(state);
      expect((await readThreadDraft('broken')).text).toBe('New draft');
    });
  });
});
