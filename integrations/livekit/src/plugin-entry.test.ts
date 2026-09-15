import { describe, expect, it } from 'vitest';

describe('plugin entry (@mastra/livekit/plugin)', () => {
  it('exposes exactly the plugin surface', async () => {
    const entry = await import('./plugin-entry');

    expect(Object.keys(entry).sort()).toEqual(['MastraLLM', 'createRemoteAgentReplyGenerator']);
  });
});
