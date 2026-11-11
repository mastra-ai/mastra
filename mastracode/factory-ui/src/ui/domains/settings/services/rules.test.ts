import { describe, expect, it } from 'vitest';

import { repositoryHint } from './rules';

const repository = (value: string) => ({ field: 'source.repository', operator: 'equals', value });
const integration = (value: string) => ({ field: 'source.integration', operator: 'equals', value });

describe('repositoryHint', () => {
  it('flags a bare repository name a GitHub or GitLab condition in the same group can never match', () => {
    expect(repositoryHint({ operator: 'AND', conditions: [integration('GitHub'), repository('mastra')] })).toMatch(
      /GitHub repositories are owner\/repo/,
    );
    expect(
      repositoryHint({
        operator: 'OR',
        conditions: [
          {
            operator: 'AND',
            conditions: [{ field: 'source.provider', operator: 'equals', value: 'gitlab' }, repository('api')],
          },
        ],
      }),
    ).toMatch(/GitLab projects are group\/project/);
  });

  it('stays quiet for a full repository path, a team or project key, or conditions in different groups', () => {
    expect(
      repositoryHint({ operator: 'AND', conditions: [integration('github'), repository('mastra-ai/mastra')] }),
    ).toBeUndefined();
    expect(repositoryHint({ operator: 'AND', conditions: [integration('linear'), repository('ENG')] })).toBeUndefined();
    expect(repositoryHint({ operator: 'AND', conditions: [repository('mastra')] })).toBeUndefined();
    expect(repositoryHint(null)).toBeUndefined();
  });

  it('pairs a provider and a repository only when a card must meet both, not when either will do', () => {
    expect(repositoryHint({ operator: 'OR', conditions: [integration('github'), repository('ENG')] })).toBeUndefined();
    expect(
      repositoryHint({
        operator: 'AND',
        conditions: [{ operator: 'OR', conditions: [integration('github'), integration('linear')] }, repository('ENG')],
      }),
    ).toBeUndefined();
  });

  it('carries a provider limit into the groups inside it, where every card still meets it', () => {
    expect(
      repositoryHint({
        operator: 'AND',
        conditions: [integration('github'), { operator: 'OR', conditions: [repository('mastra'), repository('api')] }],
      }),
    ).toMatch(/GitHub repositories are owner\/repo/);
    const either = { field: 'source.provider', operator: 'in', value: ['github', 'linear'] };
    expect(repositoryHint({ operator: 'AND', conditions: [either, repository('ENG')] })).toBeUndefined();
  });

  it('flags a bare name among the values of "is any of", but not a condition that can still match', () => {
    const among = { field: 'source.repository', operator: 'in', value: ['mastra-ai/mastra', 'mastra'] };
    expect(repositoryHint({ operator: 'AND', conditions: [integration('github'), among] })).toMatch(
      /GitHub repositories are owner\/repo/,
    );
    for (const operator of ['contains', 'not_contains', 'not_equals', 'not_in']) {
      const value = operator.endsWith('_in') ? ['mastra'] : 'mastra';
      const condition = { field: 'source.repository', operator, value };
      expect(repositoryHint({ operator: 'AND', conditions: [integration('github'), condition] })).toBeUndefined();
    }
  });

  it('reads only its own provider formats, never inherited object keys', () => {
    for (const value of ['constructor', 'toString', '__proto__']) {
      expect(
        repositoryHint({ operator: 'AND', conditions: [integration(value), repository('mastra')] }),
      ).toBeUndefined();
    }
  });
});
