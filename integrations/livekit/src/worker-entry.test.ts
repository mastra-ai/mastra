import { describe, expect, it } from 'vitest';
import * as workerEntry from './worker-entry';

describe('worker entry (@mastra/livekit/worker)', () => {
  it('exposes exactly the worker surface', () => {
    expect(Object.keys(workerEntry).sort()).toEqual([
      'chatContextToMessages',
      'createLiveKitWorker',
      'runLiveKitWorker',
    ]);
  });
});
