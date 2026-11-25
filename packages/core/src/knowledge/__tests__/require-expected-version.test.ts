import { describe, expect, it } from 'vitest';
import { standardSchemaToJSONSchema } from '../../schema';
import { KnowledgeConflictError } from '../../storage/domains/knowledge/base';
import { InMemoryStore } from '../../storage/mock';
import { Knowledge } from '../index';

const scopes = {
  'agent:$agentId': { access: [{ principal: 'self' as const, role: 'owner' as const }] },
  'team:$teamId': { access: [{ principal: 'agent:curator' as const, role: 'owner' as const }] },
};

type ToolMap = Record<string, { execute?: (input: any, context: any) => Promise<any>; inputSchema?: unknown }>;
const call = (tools: ToolMap, name: string, input: unknown) => tools[name]!.execute!(input, {});

async function setup(requireExpectedVersion?: boolean) {
  const knowledge = new Knowledge({ id: 'kb', storage: new InMemoryStore(), scopes });
  await knowledge.upsertPage({ scope: 'team:core', path: 'a', name: 'A', body: 'first body' });
  await knowledge.upsertPage({ scope: 'team:core', path: 'b', name: 'B', body: 'second body' });
  await knowledge.upsertPage({ scope: 'team:core', path: 'folder', name: 'Folder', body: 'folder' });
  const tools = knowledge.createTools({
    read: true,
    write: true,
    principals: ['agent:curator'],
    ...(requireExpectedVersion === undefined ? {} : { requireExpectedVersion }),
  }) as ToolMap;
  return { tools };
}

const ops = {
  edit: { op: 'write', page: 'team:core#a', body: 'overwritten' },
  move: { op: 'move', page: 'team:core#a', scope: 'team:core', parent: 'team:core#folder' },
  merge: { op: 'merge', page: 'team:core#a', into: 'team:core#b' },
  delete: { op: 'delete', page: 'team:core#a' },
} as const;

describe('createTools({ requireExpectedVersion })', () => {
  for (const [name, input] of Object.entries(ops)) {
    it(`refuses ${name} without expectedVersion and leaves the page as it was`, async () => {
      const { tools } = await setup(true);

      await expect(call(tools, 'knowledge_page', input)).rejects.toThrow(/expectedVersion/);

      const after = await call(tools, 'knowledge_read', { page: 'team:core#a' });
      expect(JSON.stringify(after)).toContain('first body');
      expect(JSON.stringify(after)).toContain('"version":1');
    });

    it(`allows ${name} at the version read, and refuses it at a stale one`, async () => {
      const { tools } = await setup(true);
      await expect(call(tools, 'knowledge_page', { ...input, expectedVersion: 7 })).rejects.toBeInstanceOf(
        KnowledgeConflictError,
      );
      await expect(call(tools, 'knowledge_page', { ...input, expectedVersion: 1 })).resolves.toBeDefined();
    });
  }

  it('tells the agent in the knowledge_page schema that expectedVersion is required, only when it is', async () => {
    const description = async (flag: boolean) => {
      const { tools } = await setup(flag);
      const schema = standardSchemaToJSONSchema(tools.knowledge_page!.inputSchema as never, { io: 'input' }) as {
        properties: { expectedVersion: { description: string } };
      };
      return schema.properties.expectedVersion.description;
    };
    expect(await description(true)).toContain('Required to edit, move, merge or delete a page');
    expect(await description(false)).not.toContain('Required to edit, move, merge or delete a page');
  });

  it('still creates pages without expectedVersion: there is no version to read yet', async () => {
    const { tools } = await setup(true);
    await expect(
      call(tools, 'knowledge_page', { op: 'write', scope: 'team:core', name: 'New', body: 'new page' }),
    ).resolves.toBeDefined();
  });

  for (const flag of [undefined, false]) {
    it(`falls back to the version it just read when the option is ${String(flag)}`, async () => {
      const { tools } = await setup(flag);
      await call(tools, 'knowledge_page', ops.edit);
      const after = await call(tools, 'knowledge_read', { page: 'team:core#a' });
      expect(JSON.stringify(after)).toContain('overwritten');
    });
  }
});
