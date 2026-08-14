import { describe, expect, it, vi } from 'vitest';

import { reattachProjectSandbox, registerSandboxReattach } from '../sandbox-reattach.js';

describe('sandbox reattach', () => {
  it('forwards the opaque acting-user subject', async () => {
    const sandbox = {
      id: 'sandbox-1',
      executeCommand: vi.fn(),
    };
    const reattach = vi.fn().mockResolvedValue(sandbox);
    registerSandboxReattach(reattach);

    await expect(reattachProjectSandbox('provider-sandbox-1', { actingUserId: 'external-user-42' })).resolves.toBe(
      sandbox,
    );
    expect(reattach).toHaveBeenCalledWith('provider-sandbox-1', { actingUserId: 'external-user-42' });
  });
});
