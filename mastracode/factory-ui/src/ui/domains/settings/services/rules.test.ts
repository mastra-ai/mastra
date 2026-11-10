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
    expect(
      repositoryHint({
        operator: 'AND',
        conditions: [integration('github'), { operator: 'OR', conditions: [repository('mastra')] }],
      }),
    ).toBeUndefined();
    expect(repositoryHint(null)).toBeUndefined();
  });
});
