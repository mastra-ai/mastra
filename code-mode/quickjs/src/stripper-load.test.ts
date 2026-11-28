import { describe, expect, it, vi } from 'vitest';

// The default stripper is loaded lazily, on the first run that needs it. Making
// that load fail stands in for a host where it cannot initialise — Cloudflare
// Workers, where evaluating `ts-blank-space` throws `ReferenceError: __filename
// is not defined`. That lazy import is the package's only use of the module, so
// mocking it here cannot affect anything else.
vi.mock('ts-blank-space', () => ({ default: 'not a stripper' }));

import { QuickJsCodeModeTransport } from './transport';

describe('QuickJsCodeModeTransport default stripper', () => {
  it('reports an actionable error when it cannot be loaded', async () => {
    const transport = new QuickJsCodeModeTransport();

    const error = await transport.run({ program: 'return 1;', toolIds: [], dispatch: async () => undefined }).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    // Names the cause, so a hosted caller can see why it failed …
    expect(message).toMatch(/default TypeScript stripper could not be loaded/);
    expect(message).toMatch(/did not expose a callable default export/);
    // … and the fix, which is the whole point of the message.
    expect(message).toMatch(/pass a stripTypes function/);
    expect((error as Error).cause).toBeInstanceOf(Error);
  });
});
