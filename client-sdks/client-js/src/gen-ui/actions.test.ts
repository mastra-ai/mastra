import { createStateStore } from '@json-render/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tripCatalog } from './catalog.mock';
import { createGenUIActionRunner, createGenUIContextStore, createGenUIDefinition } from './index';
import type { GenUIActionHandlers } from './index';

interface BotChat {
  reply(text: string): void;
}

const definition = createGenUIDefinition({ catalog: tripCatalog, specTool: true });

function setup({ ready = true, handlers = {} as GenUIActionHandlers<typeof tripCatalog, BotChat> } = {}) {
  const replies: string[] = [];
  const chat: BotChat = { reply: text => replies.push(text) };
  const context = createGenUIContextStore();
  const store = createStateStore({ remind: true });
  let current = handlers;
  const runner = createGenUIActionRunner<BotChat>({
    definition,
    context,
    handlers: () => current,
    chat: () => chat,
  });
  const actions = runner.handlersFor({ toolCallId: 's1', store, isReady: () => ready });
  const setHandlers = (next: typeof handlers) => (current = next);
  return { runner, actions, store, context, replies, setHandlers };
}

describe('createGenUIActionRunner', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  describe('when a ready spec raises a catalog action', () => {
    it('runs the handler with validated params and the spec it came from', async () => {
      const book = vi.fn();
      const { actions } = setup({ handlers: { book } });

      await actions.book!({ city: 'Lisbon' });

      expect(book).toHaveBeenCalledWith(
        { city: 'Lisbon' },
        expect.objectContaining({ toolCallId: 's1', state: { remind: true } }),
      );
    });

    it('hands over params as the catalog schema parses them', async () => {
      const book = vi.fn();
      const { actions } = setup({ handlers: { book } });

      await actions.book!({ city: 'Lisbon', invented: true });

      expect(book.mock.calls[0]![0]).toEqual({ city: 'Lisbon' });
    });

    it('lets the handler talk to the host chat, publish context and write state', async () => {
      const { actions, store, context, replies } = setup({
        handlers: {
          book: ({ city }, { chat, context, setState }) => {
            chat.reply(`Booked ${city}`);
            context.publish('booking', { value: { city } });
            setState('/booked', city);
          },
        },
      });

      await actions.book!({ city: 'Lisbon' });

      expect(replies).toEqual(['Booked Lisbon']);
      expect(context.snapshot()).toEqual({ booking: { value: { city: 'Lisbon' } } });
      expect(store.get('/booked')).toBe('Lisbon');
    });

    it('reads the handlers at the time of the action', async () => {
      const first = vi.fn();
      const second = vi.fn();
      const { actions, setHandlers } = setup({ handlers: { book: first } });

      setHandlers({ book: second });
      await actions.book!({ city: 'Lisbon' });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });

    it('offers one handler per catalog action', () => {
      expect(Object.keys(setup().actions)).toEqual(['book']);
    });
  });

  describe('when the params do not match the catalog schema', () => {
    it('does not run the handler', async () => {
      const book = vi.fn();
      const { actions } = setup({ handlers: { book } });

      await actions.book!({ city: 42 });

      expect(book).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid params'));
    });
  });

  describe('when the spec is not ready', () => {
    it('does not run the handler', async () => {
      const book = vi.fn();
      const { actions } = setup({ ready: false, handlers: { book } });

      await actions.book!({ city: 'Lisbon' });

      expect(book).not.toHaveBeenCalled();
    });
  });

  describe('when no handler is registered for the action', () => {
    it('warns and does nothing', async () => {
      const { actions } = setup();

      await expect(actions.book!({ city: 'Lisbon' })).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith('[GenUI] No handler for action "book"');
    });
  });

  describe('when the action is raised again while it runs', () => {
    it('runs it once, then again once it settles', async () => {
      let finish = () => {};
      const book = vi.fn(() => new Promise<void>(resolve => (finish = resolve)));
      const { actions } = setup({ handlers: { book } });

      const running = actions.book!({ city: 'Lisbon' });
      await actions.book!({ city: 'Lisbon' });
      expect(book).toHaveBeenCalledOnce();

      finish();
      await running;
      void actions.book!({ city: 'Porto' });
      expect(book).toHaveBeenCalledTimes(2);
    });

    it('lets it run again once the runner is reset', async () => {
      const book = vi.fn(() => new Promise<void>(() => {}));
      const { actions, runner } = setup({ handlers: { book } });

      void actions.book!({ city: 'Lisbon' });
      runner.reset();
      void actions.book!({ city: 'Lisbon' });

      expect(book).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the handler throws', () => {
    it('rejects so json-render runs onError, and frees the action', async () => {
      const book = vi.fn().mockRejectedValueOnce(new Error('sold out')).mockResolvedValueOnce(undefined);
      const { actions } = setup({ handlers: { book } });

      await expect(actions.book!({ city: 'Lisbon' })).rejects.toThrow('sold out');
      await actions.book!({ city: 'Lisbon' });

      expect(book).toHaveBeenCalledTimes(2);
    });
  });
});
