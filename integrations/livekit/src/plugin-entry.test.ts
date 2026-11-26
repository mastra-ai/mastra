import { describe, expect, it } from 'vitest';
// Imported statically so loading the LiveKit agents runtime happens while the file loads, not
// inside the test's 5s timeout, which a cold import on a loaded runner can exceed.
import * as entry from './plugin-entry';

describe('plugin entry (@mastra/livekit/plugin)', () => {
  it('exposes exactly the plugin surface', () => {
    expect(Object.keys(entry).sort()).toEqual([
      'MastraLLM',
      'VOICE_TEXT_FLUSH',
      'createRemoteAgentReplyGenerator',
      'mastraLLMNode',
      'observeVoiceSession',
    ]);
  });
});
