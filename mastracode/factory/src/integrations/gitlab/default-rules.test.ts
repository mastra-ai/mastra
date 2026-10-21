import { describe, expect, it } from 'vitest';
import { defaultGitLabRules } from './default-rules.js';

type RetriageContext = Parameters<NonNullable<typeof defaultGitLabRules.issueCommented>>[0];

describe('GitLab issue re-triage', () => {
  const context = (
    event: 'issueCommented' | 'issueUpdated',
    stages: string[],
    { board = 'work', factoryAuthored = false } = {},
  ) =>
    ({
      event,
      board,
      ingress: { id: 'ingress-1' },
      actor: { type: 'gitlab', username: 'someone', trusted: true, factoryAuthored },
      item: { source: 'gitlab-issue', url: 'https://gitlab.com/acme/app/-/issues/1', stages },
    }) as unknown as RetriageContext;

  describe.each([['issueCommented'], ['issueUpdated']] as const)('%s', event => {
    const rule = defaultGitLabRules[event]!;

    it.each([['intake'], ['triage'], ['planning']])('re-triages a Work card in %s', stage => {
      expect(rule(context(event, [stage]))).toMatchObject({
        type: 'invokeSkill',
        role: 'triage',
        skillName: 'factory-triage',
      });
    });

    it.each([['execute'], ['review'], ['done'], ['canceled']])('does not re-triage a Work card in %s', stage => {
      expect(rule(context(event, [stage]))).toBeUndefined();
    });

    it.each([['shipping'], ['shipped']])('does not re-triage a custom-board card in %s', stage => {
      expect(rule(context(event, [stage], { board: 'release' }))).toBeUndefined();
    });

    it('ignores factory-authored activity', () => {
      expect(rule(context(event, ['triage'], { factoryAuthored: true }))).toBeUndefined();
    });
  });
});
