import { describe, expect, it } from 'vitest';

import { factoryAttentionTargetPath } from '../attention';

describe('factoryAttentionTargetPath', () => {
  it('opens a user-session park on the user thread, not a workspace', () => {
    expect(
      factoryAttentionTargetPath('factory-1', {
        kind: 'thread',
        sessionId: 'user-session',
        threadId: 'user-session',
        list: 'user',
      }),
    ).toBe('/factories/factory-1/user/threads/user-session');
  });
});
