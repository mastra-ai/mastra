import { MastraError } from '@mastra/core/error';
import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../../db';
import { AgentsDSQL } from '.';

/**
 * Unit tests for the best-effort draft cleanup in `AgentsDSQL.create()`.
 * The DB client is mocked: the draft INSERT and cleanup DELETE go through `client.none`,
 * and `createVersion` is spied so failures of the initial version can be simulated.
 */

const ID = 'agent-1';
const input = { agent: { id: ID, name: 'a', instructions: 'i', model: { provider: 'p', name: 'm' } } };

function setup() {
  const none = vi.fn();
  const domain = new AgentsDSQL({ client: { none } as unknown as DbClient });
  const createVersion = vi.spyOn(domain, 'createVersion');
  const deleteCalls = () => none.mock.calls.filter(([sql]) => String(sql).trimStart().startsWith('DELETE'));
  return { none, domain, createVersion, deleteCalls };
}

describe('AgentsDSQL create() draft cleanup', () => {
  it('does not delete the existing draft when its own draft INSERT fails (duplicate id)', async () => {
    const { none, domain, createVersion, deleteCalls } = setup();
    const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    none.mockRejectedValueOnce(duplicate);

    const error = await domain.create(input).catch(e => e);

    expect(error).toBeInstanceOf(MastraError);
    expect(error.id).toBe('MASTRA_STORAGE_DSQL_CREATE_AGENT_FAILED');
    expect(error.cause).toBe(duplicate);
    expect(createVersion).not.toHaveBeenCalled();
    expect(deleteCalls()).toHaveLength(0);
  });

  it('cleans up its own draft and rethrows the MastraError when the initial version fails', async () => {
    const { none, domain, createVersion, deleteCalls } = setup();
    none.mockResolvedValue(null);
    const versionError = new MastraError({ id: 'VERSION_FAILED', domain: 'STORAGE', category: 'THIRD_PARTY' });
    createVersion.mockRejectedValueOnce(versionError);

    await expect(domain.create(input)).rejects.toBe(versionError);

    expect(deleteCalls()).toHaveLength(1);
    expect(deleteCalls()[0]![1]).toEqual([ID]);
  });

  it('cleans up its own draft and wraps a non-Mastra error from the initial version', async () => {
    const { none, domain, createVersion, deleteCalls } = setup();
    none.mockResolvedValue(null);
    const raw = new Error('boom');
    createVersion.mockRejectedValueOnce(raw);

    const error = await domain.create(input).catch(e => e);

    expect(error).toBeInstanceOf(MastraError);
    expect(error.id).toBe('MASTRA_STORAGE_DSQL_CREATE_AGENT_FAILED');
    expect(error.cause).toBe(raw);
    expect(deleteCalls()).toHaveLength(1);
  });

  it('still throws the original error when the cleanup DELETE fails', async () => {
    const { none, domain, createVersion, deleteCalls } = setup();
    none.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('cleanup failed'));
    const versionError = new MastraError({ id: 'VERSION_FAILED', domain: 'STORAGE', category: 'THIRD_PARTY' });
    createVersion.mockRejectedValueOnce(versionError);

    await expect(domain.create(input)).rejects.toBe(versionError);
    expect(deleteCalls()).toHaveLength(1);
  });
});
