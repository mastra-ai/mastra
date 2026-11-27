import { describe, expect, it } from 'vitest';

import { cardSourceOf } from './card-sources';

describe('cardSourceOf', () => {
  it('shows a card with no upstream as filed by hand', () => {
    expect(cardSourceOf(null)).toBe('manual');
    expect(cardSourceOf({ integrationId: 'unknown', type: 'issue' })).toBe('manual');
  });

  it('tells issues, pull requests and alerts apart on code hosts', () => {
    expect(cardSourceOf({ integrationId: 'github', type: 'issue' })).toBe('github-issue');
    expect(cardSourceOf({ integrationId: 'github', type: 'pull-request' })).toBe('github-pr');
    expect(cardSourceOf({ integrationId: 'github', type: 'dependabot-alert' })).toBe('github-dependabot-alert');
    expect(cardSourceOf({ integrationId: 'gitlab', type: 'pull-request' })).toBe('gitlab-pr');
    expect(cardSourceOf({ integrationId: 'gitlab', type: 'issue' })).toBe('gitlab-issue');
  });

  it('maps each work source to its own mark', () => {
    expect(cardSourceOf({ integrationId: 'linear', type: 'issue' })).toBe('linear-issue');
    expect(cardSourceOf({ integrationId: 'jira', type: 'issue' })).toBe('jira-issue');
    expect(cardSourceOf({ integrationId: 'incidentio', type: 'follow-up' })).toBe('incidentio-follow-up');
    expect(cardSourceOf({ integrationId: 'vanta', type: 'vulnerability' })).toBe('vanta-vulnerability');
    expect(cardSourceOf({ integrationId: 'slack', type: 'thread' })).toBe('slack-thread');
    expect(cardSourceOf({ integrationId: 'detail', type: 'finding' })).toBe('detail-finding');
  });

  it('shows a card whose upstream is missing as filed by hand', () => {
    expect(cardSourceOf(undefined)).toBe('manual');
  });
});
