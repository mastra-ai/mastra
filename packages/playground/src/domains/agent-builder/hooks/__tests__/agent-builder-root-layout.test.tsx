import { describe, expect, it } from 'vitest';

function buildLoginRedirect(pathname: string, search = '', hash = '') {
  const redirectPath = `${pathname}${search}${hash}`;
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}

describe('agent-builder login redirect', () => {
  it('preserves the full requested route including search and hash', () => {
    expect(buildLoginRedirect('/agent-builder/agents/create', '?draft=1', '#details')).toBe(
      '/login?redirect=%2Fagent-builder%2Fagents%2Fcreate%3Fdraft%3D1%23details',
    );
  });

  it('keeps plain agent-builder paths stable', () => {
    expect(buildLoginRedirect('/agent-builder/agents/create')).toBe('/login?redirect=%2Fagent-builder%2Fagents%2Fcreate');
  });
});
