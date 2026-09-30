import { describe, expect, it } from 'vitest';

import { computeAvatarRouteUrl, rewriteMastraAvatarUrl, rewriteStoredAgentAvatar } from './rewrite-avatar-url';

describe('computeAvatarRouteUrl', () => {
  it('defaults to /api when no prefix is provided', () => {
    expect(computeAvatarRouteUrl('agent-1')).toBe('/api/agents/agent-1/avatar');
  });

  it('respects a custom prefix', () => {
    expect(computeAvatarRouteUrl('agent-1', '/mastra')).toBe('/mastra/agents/agent-1/avatar');
  });

  it('strips a trailing slash from the prefix', () => {
    expect(computeAvatarRouteUrl('agent-1', '/mastra/')).toBe('/mastra/agents/agent-1/avatar');
  });

  it('prepends a leading slash when missing', () => {
    expect(computeAvatarRouteUrl('agent-1', 'mastra')).toBe('/mastra/agents/agent-1/avatar');
  });

  it('URL-encodes the agent id', () => {
    expect(computeAvatarRouteUrl('agent one', '/api')).toBe('/api/agents/agent%20one/avatar');
  });
});

describe('rewriteMastraAvatarUrl', () => {
  it('rewrites mastra-avatar URLs matching the agent id', () => {
    expect(rewriteMastraAvatarUrl('mastra-avatar:agent-1', 'agent-1', '/api')).toBe('/api/agents/agent-1/avatar');
  });

  it('leaves other URL shapes unchanged', () => {
    expect(rewriteMastraAvatarUrl('data:image/png;base64,xxx', 'agent-1')).toBe('data:image/png;base64,xxx');
    expect(rewriteMastraAvatarUrl('https://cdn/x.png', 'agent-1')).toBe('https://cdn/x.png');
  });

  it('leaves non-string values unchanged', () => {
    expect(rewriteMastraAvatarUrl(undefined, 'agent-1')).toBeUndefined();
    expect(rewriteMastraAvatarUrl(null, 'agent-1')).toBeNull();
  });

  it('does not rewrite when the mastra-avatar id does not match', () => {
    expect(rewriteMastraAvatarUrl('mastra-avatar:other', 'agent-1', '/api')).toBe('mastra-avatar:other');
  });
});

describe('rewriteStoredAgentAvatar', () => {
  it('rewrites the metadata avatarUrl when it matches', () => {
    const record = { id: 'agent-1', metadata: { avatarUrl: 'mastra-avatar:agent-1', foo: 'bar' } };
    const out = rewriteStoredAgentAvatar(record, '/api');
    expect(out).not.toBe(record);
    expect(out.metadata).toEqual({ avatarUrl: '/api/agents/agent-1/avatar', foo: 'bar' });
  });

  it('returns the same record when metadata avatarUrl is unset', () => {
    const record = { id: 'agent-1', metadata: { foo: 'bar' } };
    expect(rewriteStoredAgentAvatar(record)).toBe(record);
  });

  it('returns the same record when metadata is missing', () => {
    const record = { id: 'agent-1' };
    expect(rewriteStoredAgentAvatar(record)).toBe(record);
  });

  it('does not rewrite data: URLs', () => {
    const record = { id: 'agent-1', metadata: { avatarUrl: 'data:image/png;base64,xxx' } };
    expect(rewriteStoredAgentAvatar(record)).toBe(record);
  });

  it('does not rewrite absolute http URLs', () => {
    const record = { id: 'agent-1', metadata: { avatarUrl: 'https://cdn/x.png' } };
    expect(rewriteStoredAgentAvatar(record)).toBe(record);
  });
});
