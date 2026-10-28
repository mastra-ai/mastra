import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  factoryBoardUrl,
  factoryRulesUrl,
  factorySessionUrl,
  factorySettingsUrl,
  factoryUiOrigin,
  factoryWorkItemUrl,
} from './links.js';

describe('factory links', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('builds nothing when no public URL is configured', () => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', '  ');
    expect(factoryUiOrigin()).toBeNull();
    expect(factoryWorkItemUrl({ factoryProjectId: 'f', board: 'work', workItemId: 'i' })).toBeUndefined();
  });

  it('links boards, cards, comments, sessions, settings and rules', () => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', 'https://factory.example.com/');
    const base = 'https://factory.example.com/factories/f%201';
    expect(factoryBoardUrl('f 1', 'review')).toBe(`${base}/review`);
    expect(factoryBoardUrl('f 1', 'ops')).toBe(`${base}/boards/ops`);
    expect(factoryWorkItemUrl({ factoryProjectId: 'f 1', board: 'work', workItemId: 'i-1', commentId: 'c' })).toBe(
      `${base}/work?item=i-1&comment=c`,
    );
    expect(factorySessionUrl({ factoryProjectId: 'f 1', sessionId: 's', threadId: 't' })).toBe(
      `${base}/workspaces/s/threads/t`,
    );
    expect(factorySettingsUrl('f 1', 'connections/slack')).toBe(`${base}/settings/connections/slack`);
    expect(factoryRulesUrl('f 1', 'g')).toBe(`${base}/rules?group=g`);
  });
});
