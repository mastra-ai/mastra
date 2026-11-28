import { describe, expect, it } from 'vitest';

import { connectEventFields, matchesConnectEventFields, unknownConnectEventFields } from './event-fields.js';

describe('connectEventFields', () => {
  it('lists the fields a GitHub pull request review can be filtered on', () => {
    const fields = connectEventFields('github', 'pull_request_review.submitted');
    expect(fields).toEqual(
      expect.arrayContaining(['repository.full_name', 'pull_request.number', 'review.state', 'review.user.login']),
    );
    expect(fields).not.toContain('pull_request.html_url');
    expect(fields).not.toContain('repository.permissions.admin');
  });

  it('marks array fields with []', () => {
    expect(connectEventFields('github', 'issues.labeled')).toContain('issue.labels[].name');
  });

  it('reaches into Slack events despite their open shape', () => {
    expect(connectEventFields('slack', 'message')).toEqual(
      expect.arrayContaining(['event.channel', 'event.thread_ts']),
    );
  });

  it('knows every typed event type', async () => {
    const { connectEventTypes } = await import('./event-payloads/event-types.generated.js');
    for (const [provider, types] of Object.entries(connectEventTypes)) {
      for (const type of types)
        expect(connectEventFields(provider, type)?.length, `${provider} ${type}`).toBeGreaterThan(0);
    }
  });

  it('has nothing for events without a payload type', () => {
    expect(connectEventFields('github', 'not_an_event')).toBeUndefined();
    expect(connectEventFields('acme', 'order.created')).toBeUndefined();
    expect(connectEventFields('github', 'constructor')).toBeUndefined();
  });
});

describe('unknownConnectEventFields', () => {
  it('names the paths the payload does not have', () => {
    expect(
      unknownConnectEventFields('github', 'pull_request.opened', {
        'repository.full_name': 'acme/app',
        'pull_request.numbr': 12,
      }),
    ).toEqual(['pull_request.numbr']);
  });

  it('accepts anything for events without a payload type', () => {
    expect(unknownConnectEventFields('acme', 'order.created', { 'order.id': 1 })).toEqual([]);
  });
});

describe('matchesConnectEventFields', () => {
  const review = {
    action: 'submitted',
    repository: { full_name: 'acme/app' },
    pull_request: { number: 12, labels: [{ name: 'bug' }, { name: 'p1' }] },
    review: { state: 'changes_requested', user: { login: 'octocat' } },
  };

  it('matches when every field has its value', () => {
    expect(matchesConnectEventFields(review, { 'repository.full_name': 'acme/app', 'pull_request.number': 12 })).toBe(
      true,
    );
    expect(matchesConnectEventFields(review, { 'repository.full_name': 'acme/app', 'pull_request.number': 13 })).toBe(
      false,
    );
  });

  it('takes any of a list of values', () => {
    expect(matchesConnectEventFields(review, { 'review.state': ['approved', 'changes_requested'] })).toBe(true);
    expect(matchesConnectEventFields(review, { 'review.state': ['approved', 'commented'] })).toBe(false);
  });

  it('matches any element of an array', () => {
    expect(matchesConnectEventFields(review, { 'pull_request.labels[].name': 'p1' })).toBe(true);
    expect(matchesConnectEventFields(review, { 'pull_request.labels[].name': 'p2' })).toBe(false);
  });

  it('does not match missing fields, other types or inherited keys', () => {
    expect(matchesConnectEventFields(review, { 'issue.number': 12 })).toBe(false);
    expect(matchesConnectEventFields(review, { 'pull_request.number': '12' })).toBe(false);
    expect(matchesConnectEventFields(review, { 'review.constructor': 'x' })).toBe(false);
    expect(matchesConnectEventFields(Object.create({ action: 'submitted' }), { action: 'submitted' })).toBe(false);
    expect(matchesConnectEventFields(null, { action: 'submitted' })).toBe(false);
  });

  it('matches everything with no filters', () => {
    expect(matchesConnectEventFields(review, {})).toBe(true);
  });
});
