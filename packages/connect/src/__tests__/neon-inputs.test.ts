import { describe, expect, it } from 'vitest';
import { compareBranchSchemaInputSchema } from '../providers/neon/tools/compare-branch-schema.js';
import { createEndpointInputSchema } from '../providers/neon/tools/create-endpoint.js';
import { getBranchSchemaInputSchema } from '../providers/neon/tools/get-branch-schema.js';

describe('generated Neon input constraints', () => {
  it('preserves historical selector exclusions through generation', () => {
    const base = { project_id: 'project', branch_id: 'branch', db_name: 'database' };
    expect(
      getBranchSchemaInputSchema.safeParse({ ...base, lsn: '0/123', timestamp: '2026-09-01T00:00:00Z' }).success,
    ).toBe(false);
    expect(
      compareBranchSchemaInputSchema.safeParse({ ...base, base_lsn: '0/123', base_timestamp: '2026-09-01T00:00:00Z' })
        .success,
    ).toBe(false);
    expect(
      compareBranchSchemaInputSchema.safeParse({ ...base, lsn: '0/123', base_timestamp: '2026-09-01T00:00:00Z' })
        .success,
    ).toBe(true);
  });
});

it('preserves compute sizing constraints through generation', () => {
  expect(
    createEndpointInputSchema.safeParse({
      project_id: 'project',
      body: {
        endpoint: { branch_id: 'branch', type: 'read_only', autoscaling_limit_min_cu: 4, autoscaling_limit_max_cu: 1 },
      },
    }).success,
  ).toBe(false);
});
