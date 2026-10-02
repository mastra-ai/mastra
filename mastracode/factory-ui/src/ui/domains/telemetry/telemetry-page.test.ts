import { describe, expect, it } from 'vitest';
import { telemetryPage } from './telemetry-page';

describe('telemetry page categories', () => {
  it.each([
    ['/onboarding', 'onboarding'],
    ['/factories/id/work', 'work'],
    ['/factories/id/settings/preferences', 'settings'],
    ['/factories/id/settings/connections/slack', 'slack_connection'],
    ['/factories/id/workspaces/private-session', 'workspace'],
    ['/factories/id/workspaces/private-session/threads/private-thread', 'thread'],
    ['/factories/id/user/threads/private-thread', 'thread'],
    ['/factories/id/new', 'new_session'],
    ['/factories/id/new-factory', 'new_factory'],
  ])('normalizes %s to %s', (path, page) => {
    expect(telemetryPage(path)).toBe(page);
  });
  it.each([
    '/',
    '/signin',
    '/auth/callback',
    '/factories/id',
    '/factories/id/metrics',
    '/factories/id/settings',
    '/factories/id/private-page',
  ])('ignores %s', path => {
    expect(telemetryPage(path)).toBeUndefined();
  });
});
