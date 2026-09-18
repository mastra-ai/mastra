import { afterAll, describe, expect, it } from 'vitest';

import { CreateOSSandbox } from './index';

const enabled =
  Boolean(process.env.CREATEOS_SANDBOX_API_KEY?.trim()) && process.env.CREATEOS_COMPUTER_TEST?.trim() === '1';
const sandbox = new CreateOSSandbox({
  id: `mastra-createos-desktop-${Date.now()}`,
  shape: process.env.CREATEOS_COMPUTER_SHAPE?.trim() || 's-2vcpu-4gb',
  computerUse: true,
  ingress: true,
  autoPauseAfterSeconds: 300,
});

describe.skipIf(!enabled)('CreateOS computer integration', () => {
  afterAll(async () => {
    if (sandbox.status !== 'destroyed') await sandbox._destroy();
  });

  it('captures and controls the desktop and creates a noVNC URL', async () => {
    await sandbox._start();

    const size = await sandbox.computer!.getScreenSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);

    const screenshot = await sandbox.computer!.screenshot();
    expect(screenshot.mediaType).toBe('image/png');
    expect([...screenshot.data.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const target = { x: Math.min(100, size.width - 1), y: Math.min(100, size.height - 1) };
    await sandbox.computer!.moveMouse(target.x, target.y);
    await expect(sandbox.computer!.getCursorPosition()).resolves.toEqual(target);

    await expect(sandbox.computer!.streamUrl?.()).resolves.toMatch(/^https:\/\//);
  });
});
