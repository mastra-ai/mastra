import { describe, expect, it } from 'vitest';

import { OBSERVATION_RETRIEVAL_INSTRUCTIONS } from '../constants';

describe('OBSERVATION_RETRIEVAL_INSTRUCTIONS', () => {
  it('does not treat a missing relevant range as proof that recall is unnecessary', () => {
    expect(OBSERVATION_RETRIEVAL_INSTRUCTIONS).not.toContain(
      'There is no relevant range in your observations for the topic',
    );
  });
});
