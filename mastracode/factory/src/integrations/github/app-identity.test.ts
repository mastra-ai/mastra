import { describe, expect, it } from 'vitest';
import { GithubAppIdentity } from './app-identity.js';

describe('GithubAppIdentity', () => {
  it('recognises the App it was configured for', () => {
    const identity = new GithubAppIdentity('mastra-platform');
    expect(identity.known).toBe(true);
    expect(identity.matches('mastra-platform[bot]')).toBe(true);
  });

  it('compares logins case-insensitively', () => {
    const identity = new GithubAppIdentity('Mastra-Platform');
    expect(identity.matches('mastra-platform[bot]')).toBe(true);
    expect(identity.matches('MASTRA-PLATFORM[BOT]')).toBe(true);
  });

  it('does not mistake another App or a human for itself', () => {
    const identity = new GithubAppIdentity('mastra-platform');
    expect(identity.matches('dane-ai-mastra[bot]')).toBe(false);
    expect(identity.matches('mastra-platform')).toBe(false);
    expect(identity.matches('some-human')).toBe(false);
  });

  it('reports an unresolved identity as unknown rather than as "not Factory"', () => {
    // The distinction is the whole point: an unset slug used to collapse into a
    // `false` that silently disabled every self-loop guard. Callers that must
    // not fail open have to be able to tell the two apart.
    const identity = new GithubAppIdentity(undefined);
    expect(identity.known).toBe(false);
    expect(identity.login).toBeUndefined();
    expect(identity.matches('mastra-platform[bot]')).toBe(false);
  });

  it('treats a blank slug as unresolved instead of building "[bot]"', () => {
    expect(new GithubAppIdentity('   ').known).toBe(false);
  });

  it('learns its login from a write it made', () => {
    const identity = new GithubAppIdentity(undefined);
    identity.observeSelfAuthor('mastra-platform[bot]');
    expect(identity.known).toBe(true);
    expect(identity.matches('mastra-platform[bot]')).toBe(true);
  });

  it('prefers the observed login over the configured one', () => {
    // Configuration is a claim about which App this is; the observed author is
    // what GitHub actually attributed the write to.
    const identity = new GithubAppIdentity('stale-app');
    identity.observeSelfAuthor('mastra-platform[bot]');
    expect(identity.matches('mastra-platform[bot]')).toBe(true);
    expect(identity.matches('stale-app[bot]')).toBe(false);
  });

  it('ignores an empty observation rather than forgetting what it knew', () => {
    const identity = new GithubAppIdentity('mastra-platform');
    identity.observeSelfAuthor(null);
    identity.observeSelfAuthor(undefined);
    identity.observeSelfAuthor('  ');
    expect(identity.matches('mastra-platform[bot]')).toBe(true);
  });
});
