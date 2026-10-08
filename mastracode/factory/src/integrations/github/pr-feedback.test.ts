import { describe, expect, it } from 'vitest';
import comments from './__fixtures__/pr-comments.json';
import { githubFeedbackTargets, isInformationalPrComment } from './pr-feedback.js';

const vercel = comments.find(comment => comment.login === 'vercel[bot]')!.body;

describe('informational PR comments', () => {
  it('recognizes the successful multi-project deployment from the reported PR', () => {
    expect(isInformationalPrComment({ sender: 'vercel[bot]', author: 'vercel[bot]', body: vercel })).toBe(true);
  });

  it.each([
    vercel.replaceAll('![Ready]', '![Error]'),
    vercel.replaceAll('![Skipped]', '![Building]'),
    `${vercel}\nAction required: update the environment configuration.`,
    vercel.replace('[Preview]', '[3 comments]'),
    '[vc]: #metadata\nThe latest updates on your projects.\nUnknown provider format',
  ])('preserves failed, pending, mixed and unfamiliar deployment notices', body => {
    expect(isInformationalPrComment({ sender: 'vercel[bot]', author: 'vercel[bot]', body })).toBe(false);
  });

  it.each([
    { sender: 'contributor', author: 'contributor' },
    { sender: 'contributor', author: 'vercel[bot]' },
    { sender: 'vercel[bot]', author: undefined },
  ])('does not infer an informational bot notice from text alone', identity => {
    expect(isInformationalPrComment({ ...identity, body: vercel })).toBe(false);
  });

  it.each(comments.filter(comment => comment.login !== 'vercel[bot]'))(
    'preserves the reported $login notice for contextual inspection',
    ({ login, body }) => {
      expect(isInformationalPrComment({ sender: login, author: login, body })).toBe(false);
    },
  );
});

describe('feedback delivery ownership', () => {
  const target = { orgId: 'org', sessionId: 'session', threadId: 'thread' };

  it('accepts only committed or replayed, fully specified targets from host hooks', () => {
    expect(githubFeedbackTargets({ status: 'committed', feedbackTargets: [target] })).toEqual([target]);
    expect(githubFeedbackTargets({ status: 'replayed', feedbackTargets: [target] })).toEqual([target]);
    for (const result of [
      undefined,
      {},
      { status: 'missing', feedbackTargets: [target] },
      { status: 'committed', feedbackTargets: [null, { sessionId: 'session' }] },
    ]) {
      expect(githubFeedbackTargets(result)).toEqual([]);
    }
  });
});
