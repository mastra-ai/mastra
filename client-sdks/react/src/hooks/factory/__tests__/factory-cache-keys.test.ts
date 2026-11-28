import { MastraClient } from '@mastra/client-js';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { factoryKeys } from '../keys';
import { factoryDecisionHistoryQueryOptions } from '../use-factory-decisions';

const factory = new MastraClient({ baseUrl: 'http://localhost:4111' }).getFactory('fp-1');

describe('when decision history is read under different status filters', () => {
  it('keeps each filter in its own cache entry', () => {
    const open = factoryDecisionHistoryQueryOptions(factory, 'history', ['pending']);
    const done = factoryDecisionHistoryQueryOptions(factory, 'history', ['succeeded', 'dismissed']);
    expect(open.queryKey).not.toEqual(done.queryKey);
  });

  it('stays under the decisions root so a root invalidation reaches it', () => {
    const queryClient = new QueryClient();
    const options = factoryDecisionHistoryQueryOptions(factory, 'history', ['pending']);
    queryClient.setQueryData(options.queryKey, { pages: [], pageParams: [] });
    expect(queryClient.getQueriesData({ queryKey: factoryKeys.decisionsRoot('fp-1') })).toHaveLength(1);
  });
});
