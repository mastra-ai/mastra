import { describe, expect, it } from 'vitest';

import { TABLE_CONFIGS, TABLE_HARNESS_SESSIONS, TABLE_SCHEMAS } from './constants';

describe('storage table constants', () => {
  it('keeps Harness sessions primary key metadata at table level', () => {
    expect(TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS].id.primaryKey).toBeUndefined();
    expect(TABLE_CONFIGS[TABLE_HARNESS_SESSIONS]?.compositePrimaryKey).toEqual(['harness_name', 'id']);
  });
});
