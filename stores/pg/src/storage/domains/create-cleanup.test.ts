import { MastraError } from '@mastra/core/error';
import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../db';
import { AgentsPG } from './agents';
import { MCPClientsPG } from './mcp-clients';
import { MCPServersPG } from './mcp-servers';
import { PromptBlocksPG } from './prompt-blocks';
import { ScorerDefinitionsPG } from './scorer-definitions';
import { SkillsPG } from './skills';
import { WorkspacesPG } from './workspaces';

/**
 * Unit tests for the best-effort draft cleanup in versioned-entity `create()`.
 * The DB client is mocked: the draft INSERT and cleanup DELETE go through `client.none`,
 * and `createVersion` is spied so failures of the initial version can be simulated.
 */

const ID = 'entity-1';

interface Domain {
  createVersion: (...args: any[]) => Promise<unknown>;
}

const cases: Array<{
  name: string;
  failedId: string;
  build: (client: DbClient) => Domain;
  create: (domain: Domain) => Promise<unknown>;
}> = [
  {
    name: 'AgentsPG',
    failedId: 'MASTRA_STORAGE_PG_CREATE_AGENT_FAILED',
    build: client => new AgentsPG({ client }),
    create: d =>
      (d as AgentsPG).create({ agent: { id: ID, name: 'a', instructions: 'i', model: { provider: 'p', name: 'm' } } }),
  },
  {
    name: 'MCPClientsPG',
    failedId: 'MASTRA_STORAGE_PG_CREATE_MCP_CLIENT_FAILED',
    build: client => new MCPClientsPG({ client }),
    create: d => (d as MCPClientsPG).create({ mcpClient: { id: ID, name: 'c', servers: {} } }),
  },
  {
    name: 'MCPServersPG',
    failedId: 'MASTRA_STORAGE_PG_CREATE_MCP_SERVER_FAILED',
    build: client => new MCPServersPG({ client }),
    create: d => (d as MCPServersPG).create({ mcpServer: { id: ID, name: 's', version: '1.0.0' } }),
  },
  {
    name: 'PromptBlocksPG',
    failedId: 'MASTRA_STORAGE_PG_CREATE_PROMPT_BLOCK_FAILED',
    build: client => new PromptBlocksPG({ client }),
    create: d => (d as PromptBlocksPG).create({ promptBlock: { id: ID, name: 'b', content: 'c' } }),
  },
  {
    name: 'ScorerDefinitionsPG',
    failedId: 'MASTRA_STORAGE_PG_CREATE_SCORER_DEFINITION_FAILED',
    build: client => new ScorerDefinitionsPG({ client }),
    create: d => (d as ScorerDefinitionsPG).create({ scorerDefinition: { id: ID, name: 's', type: 'llm-judge' } }),
  },
  {
    name: 'SkillsPG',
    failedId: 'MASTRA_STORAGE_PG_CREATE_SKILL_FAILED',
    build: client => new SkillsPG({ client }),
    create: d => (d as SkillsPG).create({ skill: { id: ID, name: 's', description: 'd', instructions: 'i' } }),
  },
  {
    name: 'WorkspacesPG',
    failedId: 'MASTRA_STORAGE_PG_CREATE_WORKSPACE_FAILED',
    build: client => new WorkspacesPG({ client }),
    create: d => (d as WorkspacesPG).create({ workspace: { id: ID, name: 'w' } }),
  },
];

function setup(build: (client: DbClient) => Domain) {
  const none = vi.fn();
  const client = { none } as unknown as DbClient;
  const domain = build(client);
  const createVersion = vi.spyOn(domain, 'createVersion');
  const deleteCalls = () => none.mock.calls.filter(([sql]) => String(sql).trimStart().startsWith('DELETE'));
  return { none, domain, createVersion, deleteCalls };
}

describe.each(cases)('$name create() draft cleanup', ({ build, create, failedId }) => {
  it('does not delete the existing draft when its own draft INSERT fails (duplicate id)', async () => {
    const { none, domain, createVersion, deleteCalls } = setup(build);
    const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    none.mockRejectedValueOnce(duplicate);

    const error = await create(domain).catch(e => e);

    expect(error).toBeInstanceOf(MastraError);
    expect(error.id).toBe(failedId);
    expect(error.cause).toBe(duplicate);
    expect(createVersion).not.toHaveBeenCalled();
    expect(deleteCalls()).toHaveLength(0);
  });

  it('cleans up its own draft and rethrows the MastraError when the initial version fails', async () => {
    const { none, domain, createVersion, deleteCalls } = setup(build);
    none.mockResolvedValue(null);
    const versionError = new MastraError({ id: 'VERSION_FAILED', domain: 'STORAGE', category: 'THIRD_PARTY' });
    createVersion.mockRejectedValueOnce(versionError);

    await expect(create(domain)).rejects.toBe(versionError);

    expect(deleteCalls()).toHaveLength(1);
    expect(deleteCalls()[0]![1]).toEqual([ID]);
  });

  it('cleans up its own draft and wraps a non-Mastra error from the initial version', async () => {
    const { none, domain, createVersion, deleteCalls } = setup(build);
    none.mockResolvedValue(null);
    const raw = new Error('boom');
    createVersion.mockRejectedValueOnce(raw);

    const error = await create(domain).catch(e => e);

    expect(error).toBeInstanceOf(MastraError);
    expect(error.id).toBe(failedId);
    expect(error.cause).toBe(raw);
    expect(deleteCalls()).toHaveLength(1);
  });

  it('still throws the original error when the cleanup DELETE fails', async () => {
    const { none, domain, createVersion, deleteCalls } = setup(build);
    none.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('cleanup failed'));
    const versionError = new MastraError({ id: 'VERSION_FAILED', domain: 'STORAGE', category: 'THIRD_PARTY' });
    createVersion.mockRejectedValueOnce(versionError);

    await expect(create(domain)).rejects.toBe(versionError);
    expect(deleteCalls()).toHaveLength(1);
  });
});
