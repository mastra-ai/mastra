import { describe, expect, it } from 'vitest';

import { WeaviateFilterTranslator } from './filter';
import type { WeaviateFilterApi } from './filter';

// Records every filter call so the tests can check what reaches Weaviate. An empty
// containsAny([]) is serialized as a number array and rejected by text[] properties.
function recordingApi() {
  const calls: Array<{ op: string; value: unknown }> = [];
  const op =
    (name: string) =>
    (value: unknown): any => {
      calls.push({ op: name, value });
      return { op: name, value };
    };
  const api: WeaviateFilterApi = {
    byProperty: () =>
      ({
        isNull: op('isNull'),
        equal: op('equal'),
        notEqual: op('notEqual'),
        greaterThan: op('greaterThan'),
        greaterOrEqual: op('greaterOrEqual'),
        lessThan: op('lessThan'),
        lessOrEqual: op('lessOrEqual'),
        containsAny: op('containsAny'),
        containsAll: op('containsAll'),
        like: op('like'),
      }) as any,
  };
  return { api, calls };
}

const emptyArrayCalls = (calls: Array<{ op: string; value: unknown }>) =>
  calls.filter(call => Array.isArray(call.value) && call.value.length === 0);

describe('WeaviateFilterTranslator empty array operators', () => {
  const translator = new WeaviateFilterTranslator();

  it('translates an empty $in to a match-nothing filter without an empty array', () => {
    const { api, calls } = recordingApi();
    const filter = translator.translate({ scope_ids: { $in: [] } }, api);
    expect(filter).toBeDefined();
    expect(emptyArrayCalls(calls)).toEqual([]);
    expect(calls.map(call => `${call.op}:${call.value}`).sort()).toEqual(['isNull:false', 'isNull:true']);
  });

  it('translates a bare empty array value to a match-nothing filter', () => {
    const { api, calls } = recordingApi();
    expect(translator.translate({ scope_ids: [] } as any, api)).toBeDefined();
    expect(emptyArrayCalls(calls)).toEqual([]);
  });

  it('translates an empty $nin to match-all', () => {
    const { api, calls } = recordingApi();
    expect(translator.translate({ scope_ids: { $nin: [] } }, api)).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('translates a negated empty $nin to match-nothing', () => {
    const { api, calls } = recordingApi();
    expect(translator.translate({ scope_ids: { $not: { $nin: [] } } } as any, api)).toBeDefined();
    expect(emptyArrayCalls(calls)).toEqual([]);
  });
});
