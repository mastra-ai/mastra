import { describe, expect, it, vi } from 'vitest';
import { createRunAbortController } from './run-abort';

describe('createRunAbortController', () => {
  it('returns an unaborted controller without a caller signal', () => {
    const { controller, detach } = createRunAbortController(undefined);
    expect(controller.signal.aborted).toBe(false);
    expect(() => detach()).not.toThrow();
  });

  it('aborts immediately with the reason of an already-aborted signal', () => {
    const external = new AbortController();
    external.abort('stop');
    const onExternalAbort = vi.fn();
    const { controller } = createRunAbortController(external.signal, { onExternalAbort });
    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toBe('stop');
    expect(onExternalAbort).toHaveBeenCalledTimes(1);
  });

  it('forwards a later abort with its reason and notifies once', () => {
    const external = new AbortController();
    const onExternalAbort = vi.fn();
    const { controller } = createRunAbortController(external.signal, { onExternalAbort });
    external.abort('later');
    external.abort('again');
    expect(controller.signal.reason).toBe('later');
    expect(onExternalAbort).toHaveBeenCalledTimes(1);
  });

  it('stops forwarding once detached', () => {
    const external = new AbortController();
    const onExternalAbort = vi.fn();
    const { controller, detach } = createRunAbortController(external.signal, { onExternalAbort });
    detach();
    detach();
    external.abort('ignored');
    expect(controller.signal.aborted).toBe(false);
    expect(onExternalAbort).not.toHaveBeenCalled();
  });
});
