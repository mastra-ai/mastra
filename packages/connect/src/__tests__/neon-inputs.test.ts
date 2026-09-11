import { describe, expect, it } from 'vitest';
import { compareBranchSchemaInputSchema } from '../providers/neon/tools/compare-branch-schema.js';
import { createEndpointInputSchema } from '../providers/neon/tools/create-endpoint.js';
import { createRoleInputSchema } from '../providers/neon/tools/create-role.js';
import { getBranchSchemaInputSchema } from '../providers/neon/tools/get-branch-schema.js';
import { restoreBranchInputSchema } from '../providers/neon/tools/restore-branch.js';
import { setSnapshotScheduleInputSchema } from '../providers/neon/tools/set-snapshot-schedule.js';
import { updateProjectInputSchema } from '../providers/neon/tools/update-project.js';

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

it('preserves recovery preconditions through generation', () => {
  const base = { project_id: 'project', branch_id: 'branch' };
  expect(restoreBranchInputSchema.safeParse({ ...base, body: { source_branch_id: 'branch' } }).success).toBe(false);
  expect(
    restoreBranchInputSchema.safeParse({
      ...base,
      body: { source_branch_id: 'branch', source_lsn: '0/123', preserve_under_name: 'before' },
    }).success,
  ).toBe(true);
  expect(setSnapshotScheduleInputSchema.safeParse({ ...base, body: { schedule: [] } }).success).toBe(false);
});

it('preserves the PostgreSQL role name byte limit through generation', () => {
  const base = { project_id: 'project', branch_id: 'branch' };
  expect(createRoleInputSchema.safeParse({ ...base, body: { role: { name: 'é'.repeat(32) } } }).success).toBe(false);
  expect(createRoleInputSchema.safeParse({ ...base, body: { role: { name: 'reader', no_login: true } } }).success).toBe(
    true,
  );
});

it('rejects contradictory project compute defaults', () => {
  expect(
    updateProjectInputSchema.safeParse({
      project_id: 'project',
      body: { project: { default_endpoint_settings: { autoscaling_limit_min_cu: 4, autoscaling_limit_max_cu: 1 } } },
    }).success,
  ).toBe(false);
  expect(
    updateProjectInputSchema.safeParse({
      project_id: 'project',
      body: { project: { default_endpoint_settings: { autoscaling_limit_min_cu: 4 } } },
    }).success,
  ).toBe(true);
});
