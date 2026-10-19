import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let writes: string[];

async function load() {
  vi.resetModules();
  return import('./terminal-background.js');
}

describe('terminal background', () => {
  const originalIsTTY = process.stdout.isTTY;

  beforeEach(() => {
    writes = [];
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      writes.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  });

  it('writes nothing while disabled', async () => {
    const bg = await load();
    bg.paintTerminalBackground('#1e1e2e');
    bg.resetTerminalBackground();
    expect(writes).toEqual([]);
  });

  it('paints with OSC 11 and resets with OSC 111', async () => {
    const bg = await load();
    bg.setTerminalBackgroundEnabled(true);
    bg.paintTerminalBackground('#1e1e2e');
    bg.resetTerminalBackground();
    bg.resetTerminalBackground();
    expect(writes).toEqual(['\x1b]11;#1e1e2e\x07', '\x1b]111\x07']);
  });

  it('repaints the remembered color after a suspend', async () => {
    const bg = await load();
    bg.setTerminalBackgroundEnabled(true);
    bg.paintTerminalBackground('#1e1e2e');
    bg.resetTerminalBackground();
    bg.restoreTerminalBackground();
    expect(writes).toEqual(['\x1b]11;#1e1e2e\x07', '\x1b]111\x07', '\x1b]11;#1e1e2e\x07']);
  });

  it('resets and stops repainting when turned off', async () => {
    const bg = await load();
    bg.setTerminalBackgroundEnabled(true);
    bg.paintTerminalBackground('#1e1e2e');
    bg.setTerminalBackgroundEnabled(false);
    bg.restoreTerminalBackground();
    expect(writes).toEqual(['\x1b]11;#1e1e2e\x07', '\x1b]111\x07']);
  });
});
