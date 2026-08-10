import { describe, expect, it } from 'vitest';

import { ORACLEDB_PROMPT } from './prompt';

describe('ORACLEDB_PROMPT', () => {
  it('documents the supported Oracle metadata filter surface', () => {
    expect(ORACLEDB_PROMPT).toContain('Oracle Database Vector Search');
    expect(ORACLEDB_PROMPT).toContain('$elemMatch');
    expect(ORACLEDB_PROMPT).toContain('REGEXP_LIKE');
  });
});
