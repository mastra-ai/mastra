import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import { describe, expect, it } from 'vitest';

import { routeSources } from '../intake/intakeMap';

const provider = (value: string): RuleGroup['conditions'][number] => ({
  field: 'source.provider',
  operator: 'equals',
  value,
});

describe('routeSources', () => {
  it('reads an OR of sources as either source', () => {
    expect(routeSources({ operator: 'OR', conditions: [provider('github'), provider('gitlab')] })).toEqual([
      'github',
      'gitlab',
    ]);
  });

  it('takes any source when one member of an OR does not name a source', () => {
    expect(
      routeSources({
        operator: 'OR',
        conditions: [provider('github'), { field: 'source.kind', operator: 'equals', value: 'pull_request' }],
      }),
    ).toBeUndefined();
  });

  it('narrows an AND by the sources inside a nested group', () => {
    expect(
      routeSources({
        operator: 'AND',
        conditions: [
          { field: 'source.integration', operator: 'in', value: ['github', 'linear'] },
          { operator: 'OR', conditions: [provider('linear'), provider('jira')] },
        ],
      }),
    ).toEqual(['linear']);
  });

  it('reads source names the way rules compare them, trimmed and case-blind', () => {
    expect(routeSources({ operator: 'AND', conditions: [provider(' GitHub ')] })).toEqual(['github']);
    expect(
      routeSources({
        operator: 'AND',
        conditions: [{ field: 'source.integration', operator: 'not_in', value: ['LINEAR'] }],
      }),
    ).not.toContain('linear');
  });

  it('takes any source when nothing names one', () => {
    expect(routeSources(null)).toBeUndefined();
    expect(routeSources({ operator: 'AND', conditions: [] })).toBeUndefined();
  });
});
