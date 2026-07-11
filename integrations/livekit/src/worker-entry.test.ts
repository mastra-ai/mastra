import { describe, expect, it } from 'vitest';
import * as workerEntry from './worker-entry';

describe('worker entry (@mastra/livekit/worker)', () => {
  it('exposes exactly the worker surface', () => {
    expect(Object.keys(workerEntry).sort()).toEqual([
      'DEFAULT_END_CALL_DRAIN_MS',
      'DEFAULT_END_CALL_MAX_WAIT_MS',
      'DEFAULT_END_CALL_REASON',
      'DEFAULT_END_CALL_TOOL',
      'chatContextToMessages',
      'createLiveKitWorker',
      'createRemoteAgentReplyGenerator',
      'runEndCall',
      'runLiveKitWorker',
      'speakGreeting',
      'waitForAgentDoneSpeaking',
    ]);
  });
});
