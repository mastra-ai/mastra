import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Exercise the shipped bootstrap, not a copy of its reconnect logic.
const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Studio bootstrap script is missing');

function bootStudio(initialServerId = 'server-a') {
  const sources: EventSourceStub[] = [];
  const retries: (() => void)[] = [];
  const reload = vi.fn();
  class EventSourceStub {
    onopen?: () => void;
    onerror?: () => void;
    onmessage?: (event: Pick<MessageEvent<string>, 'data' | 'lastEventId'>) => void;
    close = vi.fn();
    constructor(readonly url: string) {
      sources.push(this);
    }
  }
  const injectedScript = script!.replace("'%%MASTRA_DEV_SERVER_INSTANCE_ID%%'", JSON.stringify(initialServerId));
  runInNewContext(injectedScript, {
    window: { location: { reload }, addEventListener: vi.fn() },
    EventSource: EventSourceStub,
    setTimeout: (callback: () => void) => retries.push(callback),
  });
  const message = (id: string, data = 'connected') => {
    sources.at(-1)!.onopen?.();
    sources.at(-1)!.onmessage?.({ data, lastEventId: id });
  };
  const reconnect = () => {
    sources.at(-1)!.onerror?.();
    const retry = retries.shift();
    if (!retry) throw new Error('No reconnect scheduled');
    retry();
  };
  return { message, reconnect, reload };
}

describe('Studio refresh connection', () => {
  describe('when the initial connection opens', () => {
    it('keeps the current page', () => {
      const studio = bootStudio();
      studio.message('server-a');
      expect(studio.reload).not.toHaveBeenCalled();
    });
  });

  describe('when a reconnect reaches the same server', () => {
    it('preserves the open chat', () => {
      const studio = bootStudio();
      studio.message('server-a');
      studio.reconnect();
      studio.message('server-a');
      expect(studio.reload).not.toHaveBeenCalled();
    });
  });

  describe('when a restart broadcast was missed while disconnected', () => {
    it('reloads after reconnecting to the new server', () => {
      const studio = bootStudio();
      studio.message('server-a');
      studio.reconnect();
      studio.message('server-b');
      expect(studio.reload).toHaveBeenCalledOnce();
    });
  });

  describe('when the server restarts before the first successful handshake', () => {
    it('compares the handshake with the generation of the loaded HTML', () => {
      const studio = bootStudio('server-a');
      studio.reconnect();
      studio.message('server-b');
      expect(studio.reload).toHaveBeenCalledOnce();
    });
  });

  describe('when the server explicitly requests a refresh', () => {
    it('reloads the page', () => {
      const studio = bootStudio();
      studio.message('server-a');
      studio.message('server-a', 'refresh');
      expect(studio.reload).toHaveBeenCalledOnce();
    });
  });

  describe('when an older server does not supply an instance ID', () => {
    it('continues to honor explicit refresh messages', () => {
      const studio = bootStudio('');
      studio.message('');
      studio.reconnect();
      studio.message('');
      expect(studio.reload).not.toHaveBeenCalled();
      studio.message('', 'refresh');
      expect(studio.reload).toHaveBeenCalledOnce();
    });
  });
});
