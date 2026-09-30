import { describe, expect, it } from 'vitest';

import {
  appendArtifactAttributionFooter,
  appendPullRequestAttribution,
  commitCoAuthor,
  requireFactoryArtifactAttribution,
  resolveFactoryArtifactAttribution,
} from './artifact-attribution.js';

const session = { role: 'work', workItemRef: 'FACT-276', runId: 'run-42' };

describe('factory artifact attribution', () => {
  it('renders one provider-neutral human block without exposing email', () => {
    const attribution = resolveFactoryArtifactAttribution({
      user: { workosId: 'user-12345678', name: 'Ada Lovelace', email: 'ada@example.com' },
      userId: 'user-12345678',
      session,
    });

    expect(appendPullRequestAttribution('Ship it', attribution)).toBe(
      [
        'Ship it',
        '',
        '---',
        '🏭 Opened by Mastra Factory',
        'Actor: Ada Lovelace (user-12345678)',
        'Session: work/FACT-276 · run run-42',
      ].join('\n'),
    );
    expect(appendArtifactAttributionFooter('Looks good', attribution)).toBe(
      'Looks good\n\n— via Mastra Factory · actor: Ada Lovelace',
    );
    expect(appendPullRequestAttribution('', attribution)).not.toContain('ada@example.com');
    expect(commitCoAuthor(attribution)).toBeUndefined();
  });

  it('renders an automation trigger instead of an actor', () => {
    const attribution = resolveFactoryArtifactAttribution({
      user: { workosId: 'factory-rule-dispatcher' },
      userId: 'factory-rule-dispatcher',
      trigger: { source: 'github webhook pull_request', id: 'delivery-42' },
      session,
    });

    const body = appendPullRequestAttribution(undefined, attribution);
    expect(body).toContain('Trigger: github webhook pull_request · delivery-42');
    expect(body).not.toContain('Actor:');
    expect(appendArtifactAttributionFooter(undefined, attribution)).toBe(
      '— via Mastra Factory · trigger: github webhook pull_request delivery-42',
    );
    expect(commitCoAuthor(attribution)).toBeUndefined();
  });

  it('uses the stable id rather than raw email when no display name exists', () => {
    const attribution = resolveFactoryArtifactAttribution({
      user: { workosId: 'user-1', name: 'Ada <private@example.com>' },
      userId: 'user-1',
      session,
    });

    expect(appendArtifactAttributionFooter('', attribution)).toBe('— via Mastra Factory · actor: user-1');
  });

  it('uses an explicit GitHub noreply address for optional commit co-authorship', () => {
    const attribution = resolveFactoryArtifactAttribution({
      user: {
        workosId: 'user-1',
        name: 'Ada Lovelace',
        email: '12345+ada@users.noreply.github.com',
      },
      userId: 'user-1',
      session,
    });

    expect(commitCoAuthor(attribution)).toEqual({
      name: 'Ada Lovelace',
      email: '12345+ada@users.noreply.github.com',
    });
    expect(
      commitCoAuthor({
        ...attribution,
        email: 'private@example.com@users.noreply.github.com',
      }),
    ).toBeUndefined();
  });

  it('replaces existing Factory provenance when an artifact is updated', () => {
    const previous = resolveFactoryArtifactAttribution({
      user: { workosId: 'user-old', name: 'Old Actor' },
      userId: 'user-old',
      session: { role: 'work', workItemRef: 'FACT-275', runId: 'run-old' },
    });
    const current = resolveFactoryArtifactAttribution({
      user: { workosId: 'user-42', name: 'Ada Lovelace' },
      userId: 'user-42',
      session: { role: 'review', workItemRef: 'FACT-276', runId: 'run-42' },
    });

    const pullRequest = appendPullRequestAttribution(appendPullRequestAttribution('Body', previous), current);
    const comment = appendArtifactAttributionFooter(appendArtifactAttributionFooter('Comment', previous), current);

    expect(pullRequest.match(/Actor:/g)).toHaveLength(1);
    expect(pullRequest).toContain('Actor: Ada Lovelace (user-42)');
    expect(comment.match(/— via Mastra Factory/g)).toHaveLength(1);
    expect(comment).toContain('actor: Ada Lovelace');
  });

  it('fails closed when a source-control issue write has no server attribution', () => {
    expect(() => requireFactoryArtifactAttribution(undefined)).toThrow('Factory artifact attribution is required');
  });
});
