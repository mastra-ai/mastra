import { describe, expect, it } from 'vitest';
import { getWorkflowIterationScopes } from '../workflow-iteration-scopes';

describe('when inspecting a foreach run', () => {
  it('groups parallel child steps by numeric iteration without mixing other loops', () => {
    expect(
      getWorkflowIterationScopes(
        [
          'documents[10].count-words',
          'documents[2].count-words',
          'documents[2].extract-excerpt',
          'other-documents[0].count-words',
          'documents[2].nested[0].inner',
        ],
        'documents',
      ),
    ).toEqual([
      { label: 'Item 3', value: 'documents[2]' },
      { label: 'Item 11', value: 'documents[10]' },
    ]);
  });

  it('leaves an unexecuted nested workflow without an invented iteration', () => {
    expect(getWorkflowIterationScopes(['documents'], 'documents')).toEqual([]);
  });
});
