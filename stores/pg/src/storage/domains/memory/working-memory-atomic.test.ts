import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PoolAdapter } from '../../client';
import { MemoryPG } from './index';

// Explicit opt-in: this suite never connects to a default or hosted database.
describe.skipIf(!process.env.MASTRA_ATOMIC_TEST_DATABASE_URL)('atomic resource working memory', () => {
  const pools = Array.from(
    { length: 3 },
    () => new Pool({ connectionString: process.env.MASTRA_ATOMIC_TEST_DATABASE_URL }),
  );
  const schemaName = `atomic_${randomUUID().replaceAll('-', '')}`;
  const stores = pools.map(pool => new MemoryPG({ client: new PoolAdapter(pool), schemaName }));
  beforeAll(async () => {
    await stores[0]!.init();
  });
  afterAll(async () => {
    await pools[0]!.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await Promise.all(pools.map(pool => pool.end()));
  });
  const read = async (resourceId: string) =>
    JSON.parse((await stores[0]!.getResourceById({ resourceId }))!.workingMemory!);

  it('preserves simultaneous first writes from independent connections', async () => {
    const resourceId = randomUUID();
    await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        stores[index % stores.length]!.mutateResourceWorkingMemory({
          resourceId,
          update: current => JSON.stringify({ ...JSON.parse(current ?? '{}'), [`field${index}`]: index }),
        }),
      ),
    );
    expect(await read(resourceId)).toEqual(
      Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`field${index}`, index])),
    );
  });

  it('preserves unrelated preferences and metadata during reset and concurrent edit', async () => {
    const resourceId = randomUUID();
    await stores[0]!.updateResource({
      resourceId,
      workingMemory: JSON.stringify({ name: 'Fad', tone: 'old' }),
      metadata: { keep: true },
    });
    await Promise.all([
      stores[1]!.mutateResourceWorkingMemory({
        resourceId,
        update: current => {
          const data = JSON.parse(current!);
          delete data.name;
          return JSON.stringify(data);
        },
      }),
      stores[2]!.mutateResourceWorkingMemory({
        resourceId,
        update: current => JSON.stringify({ ...JSON.parse(current!), tone: 'new' }),
      }),
    ]);
    expect(await read(resourceId)).toEqual({ tone: 'new' });
    expect((await stores[0]!.getResourceById({ resourceId }))!.metadata).toEqual({ keep: true });
  });

  it('rolls back a failed first write and failed update', async () => {
    const resourceId = randomUUID();
    const update = () => {
      throw new Error('invalid memory');
    };
    await expect(stores[0]!.mutateResourceWorkingMemory({ resourceId, update })).rejects.toThrow('invalid memory');
    expect(await stores[0]!.getResourceById({ resourceId })).toBeNull();
    await stores[0]!.updateResource({ resourceId, workingMemory: 'invalid JSON' });
    await expect(
      stores[1]!.mutateResourceWorkingMemory({ resourceId, update: current => JSON.stringify(JSON.parse(current!)) }),
    ).rejects.toThrow();
    expect((await stores[0]!.getResourceById({ resourceId }))!.workingMemory).toBe('invalid JSON');
  });
});
