import { describe, expect, it } from 'vitest';

import { connectSlackUrl } from './channelAccounts';

describe('connectSlackUrl', () => {
  it('includes the initiating Factory in the Slack OIDC entry URL', () => {
    expect(connectSlackUrl('http://localhost:4111', 'factory/one')).toBe(
      'http://localhost:4111/connect/slack/oidc/start?factoryId=factory%2Fone',
    );
  });

  it('keeps the Factory context optional for server-built entry points', () => {
    expect(connectSlackUrl('http://localhost:4111')).toBe('http://localhost:4111/connect/slack/oidc/start');
  });
});
