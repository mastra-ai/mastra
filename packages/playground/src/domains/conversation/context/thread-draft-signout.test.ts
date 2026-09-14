// @vitest-environment node
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as stateModule from './thread-draft-state';
import * as storageModule from './thread-draft-storage';

const NativeBroadcastChannel = globalThis.BroadcastChannel;
const channels: BroadcastChannel[] = [];
const unmounts: (() => void)[] = [];
const scope = JSON.stringify(['http://localhost:4111', '/api', 'user']);
const key = JSON.stringify(['http://localhost:4111', '/api', 'user', 'agent', 'new']);
let states = stateModule;
let storage = storageModule;

beforeEach(async () => {
  vi.resetModules();
  states = await import('./thread-draft-state');
  storage = await import('./thread-draft-storage');
  vi.stubGlobal('window', {});
  vi.stubGlobal(
    'BroadcastChannel',
    class extends NativeBroadcastChannel {
      constructor(name: string) {
        super(name);
        channels.push(this);
      }
    },
  );
});

afterEach(async () => {
  channels.splice(0).forEach(channel => channel.close());
  unmounts.splice(0).forEach(unmount => unmount());
  await storage.readThreadDraft('__drain__');
  await deleteDB('mastra-composer-drafts');
  vi.unstubAllGlobals();
});

function subscribe(state: ReturnType<typeof stateModule.createThreadDraftState>) {
  unmounts.push(state.subscribe(() => {}));
}

const ready = async (state: ReturnType<typeof stateModule.createThreadDraftState>) => {
  await vi.waitFor(() => expect(state.getSnapshot().status.restoring).toBe(false));
};

const sendSignout = (version: string) => {
  const sender = new BroadcastChannel('mastra-composer-signouts');
  sender.postMessage({ scope, version });
};

describe('draft sign-out notifications', () => {
  describe('when restoration reads the sign-out version before notification delivery', () => {
    it('invalidates the existing state and prevents later edits from recreating the draft', async () => {
      const state = states.createThreadDraftState({ key, threadId: 'thread' });
      const version = await storage.clearUserThreadDrafts(scope);
      subscribe(state);
      await ready(state);
      sendSignout(version);
      await vi.waitFor(() => expect(state.getSnapshot().status.error).toContain('signed out'));
      state.updateDraft('thread', { text: 'Must not recreate this draft', attachments: [] });
      expect(state.getDraft('thread').text).toBe('');
      expect((await storage.readThreadDraft(key)).text).toBe('');
    });
  });

  describe('when the sign-out notification arrives before restoration starts', () => {
    it('does not restore or save into the invalidated state', async () => {
      const state = states.createThreadDraftState({ key, threadId: 'thread' });
      const version = await storage.clearUserThreadDrafts(scope);
      sendSignout(version);
      await vi.waitFor(() => expect(state.getSnapshot().status.error).toContain('signed out'));
      subscribe(state);
      await storage.readThreadDraft('__drain__');
      state.updateDraft('thread', { text: 'Must not save', attachments: [] });
      expect(state.getSnapshot().status.error).toContain('signed out');
      expect((await storage.readThreadDraft(key)).text).toBe('');
    });
  });

  describe('when a fresh composer mounts after the sign-out event was handled', () => {
    it('saves normally after signing in again', async () => {
      const previous = states.createThreadDraftState({ key, threadId: 'thread' });
      subscribe(previous);
      await ready(previous);
      const version = await storage.clearUserThreadDrafts(scope);
      sendSignout(version);
      await vi.waitFor(() => expect(previous.getSnapshot().status.error).toContain('signed out'));
      const next = states.createThreadDraftState({ key, threadId: 'thread' });
      subscribe(next);
      await ready(next);
      next.updateDraft('thread', { text: 'New signed-in draft', attachments: [] });
      await vi.waitFor(() => expect(next.getSnapshot().status.saving).toBe(false));
      expect(next.getSnapshot().status.error).toBeUndefined();
      expect((await storage.readThreadDraft(key)).text).toBe('New signed-in draft');
    });
  });
});
