import { describe, it, expect } from 'vitest';

import { OwnerTypeSchema, SlackInstallationDataSchema, SlackPendingDataSchema } from './schemas';

const baseInstallation = {
  appId: 'A1',
  clientId: 'C1',
  clientSecret: 'enc-secret',
  signingSecret: 'enc-signing',
  teamId: 'T1',
  botToken: 'enc-bot',
  botUserId: 'U1',
};

const basePending = {
  appId: 'A1',
  clientId: 'C1',
  clientSecret: 'enc-secret',
  signingSecret: 'enc-signing',
  authorizationUrl: 'https://slack.com/oauth/v2/authorize?x=1',
};

describe('OwnerTypeSchema', () => {
  it('accepts the two known owner types', () => {
    expect(OwnerTypeSchema.parse('agent')).toBe('agent');
    expect(OwnerTypeSchema.parse('agentController')).toBe('agentController');
  });

  it('rejects unknown owner types', () => {
    expect(() => OwnerTypeSchema.parse('workflow')).toThrow();
  });
});

describe('SlackInstallationDataSchema ownerType', () => {
  it('parses an explicit agentController ownerType', () => {
    const parsed = SlackInstallationDataSchema.parse({ ...baseInstallation, ownerType: 'agentController' });
    expect(parsed.ownerType).toBe('agentController');
  });

  it('leaves ownerType undefined when absent (back-compat with pre-existing installations)', () => {
    const parsed = SlackInstallationDataSchema.parse(baseInstallation);
    expect(parsed.ownerType).toBeUndefined();
  });

  it('rejects an invalid ownerType value', () => {
    expect(() => SlackInstallationDataSchema.parse({ ...baseInstallation, ownerType: 'nope' })).toThrow();
  });
});

describe('SlackPendingDataSchema ownerType', () => {
  it('parses an explicit agentController ownerType', () => {
    const parsed = SlackPendingDataSchema.parse({ ...basePending, ownerType: 'agentController' });
    expect(parsed.ownerType).toBe('agentController');
  });

  it('leaves ownerType undefined when absent', () => {
    const parsed = SlackPendingDataSchema.parse(basePending);
    expect(parsed.ownerType).toBeUndefined();
  });
});
