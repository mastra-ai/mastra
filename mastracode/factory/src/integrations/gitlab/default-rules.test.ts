import { describe, expect, it } from 'vitest';
import type { FactoryGitLabRuleContext } from '../../rules/types.js';
import { defaultGitLabRules } from './default-rules.js';

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
    }) as unknown as FactoryGitLabRuleContext;

  describe.each([['issueCommented'], ['issueUpdated']] as const)('%s', event => {
    const rule = defaultGitLabRules[event];

    // Triage runs once, when a person moves the card into Triage or starts the run.
    it.each([['intake'], ['triage'], ['planning']])('does not re-triage a Work card in %s', stage => {
      expect(rule?.(context(event, [stage]))).toBeUndefined();
    });

    it.each([['execute'], ['review'], ['done'], ['canceled']])('does not re-triage a Work card in %s', stage => {
      expect(rule?.(context(event, [stage]))).toBeUndefined();
    });

    it.each([['shipping'], ['shipped']])('does not re-triage a custom-board card in %s', stage => {
      expect(rule?.(context(event, [stage], { board: 'release' }))).toBeUndefined();
    });

    it('ignores factory-authored activity', () => {
      expect(rule?.(context(event, ['triage'], { factoryAuthored: true }))).toBeUndefined();
    });
  });
});
