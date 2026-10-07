import { describe, expect, it, vi } from 'vitest';
import { MastraClient } from './client';

describe('working-memory merge transport', () => {
  it('uses PATCH for merge so an old POST-only server cannot replace the record', async () => {
    const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
    const request = vi.spyOn(client as any, 'request').mockResolvedValue({ success: true });
    const input = { agentId: 'a', threadId: 't', resourceId: 'r', workingMemory: '{"name":"Fad"}' };
    await client.updateWorkingMemory({ ...input, mode: 'merge' });
    expect(request).toHaveBeenLastCalledWith('/memory/threads/t/working-memory?agentId=a', expect.objectContaining({ method: 'PATCH' }));
    await client.updateWorkingMemory(input);
    expect(request).toHaveBeenLastCalledWith('/memory/threads/t/working-memory?agentId=a', expect.objectContaining({ method: 'POST' }));
  });
});
