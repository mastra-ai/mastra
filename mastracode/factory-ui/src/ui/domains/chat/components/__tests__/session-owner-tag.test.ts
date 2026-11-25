import { SESSION_OWNER_SIGNAL_TAG } from '@mastra/factory/session-owner-signal';
import { SESSION_OWNER_SIGNAL_TAG as TRANSCRIPT_TAG } from '@mastra/playground-ui/domains/chat/transcript/components/signals';
import { describe, expect, it } from 'vitest';

describe('session owner signal tag', () => {
  it('is the tag the lifted transcript hides owner signals by', () => {
    expect(TRANSCRIPT_TAG).toBe(SESSION_OWNER_SIGNAL_TAG);
  });
});
