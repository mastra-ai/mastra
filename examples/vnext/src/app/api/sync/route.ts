import { FilterOperators } from '@mastra/core';

import { NextResponse } from 'next/server';

import { mastra } from '@/mastra';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function GET() {
  console.log('Running an example sync');
  console.log(' ');
  console.log('Data should be attached to a `connectionId` (userId in your system) and an `entityName` (Post)');
  console.log(' ');
  const entityName = 'TESTER';
  console.log('Entity Name', entityName);
  const connectionId = '1234';
  console.log('Connection ID', connectionId);
  console.log(' ');
  console.log(`Calling mastra.sync`);

  const records = Array.from({ length: 10 }).map((_, i) => {
    return {
      data: {
        name: 'Abhi',
        age: i,
        foo: {
          bar: {
            baz: i,
          },
        },
      },
      externalId: `A${i}`,
    };
  });

  await mastra.sync('mySync', {
    name: entityName,
    connectionId,
    records,
  });

  console.log(' ');
  console.log(`Finished calling mastra.sync`);

  console.log(
    'Querying `mastra.engine.getRecordsByEntityName` for entityName:',
    entityName,
    'and connectionId:',
    connectionId,
  );
  const d = await mastra.engine?.getRecordsByEntityName({ name: entityName, connectionId });

  console.log('Records', d);

  console.log('Querying `mastra.engine.getEntities` for entityName:', entityName, 'and connectionId:', connectionId);
  const entity = await mastra.engine?.getEntity({ name: entityName, connectionId });

  console.log('Entities', { entity });

  if (entity) {
    console.log('Querying `mastra.engine.getRecordsByEntityId` for entityId:', entity?.id);
    const records = await mastra.engine?.getRecordsByEntityId({ entityId: entity?.id });
    console.log('Records', { records });
  }
  console.log(' ');
  console.log('Querying `mastra.engine.getRecords` for entityName:', entityName, 'and connectionId:', connectionId);

  // FILTER
  let r = await mastra.engine?.getRecords({
    entityName,
    connectionId,
    options: {
      filters: [
        {
          field: 'age',
          operator: FilterOperators.EQUAL,
          value: 0,
        },
      ],
    },
  });

  console.log('Records', r);

  r = await mastra.engine?.getRecords({
    entityName,
    connectionId,
    options: {
      sort: [
        {
          field: 'age',
          direction: 'DESC',
        },
      ],
    },
  });

  console.log('Records', r);

  return NextResponse.json({
    message: 'Sync complete',
    records: d,
    entity,
  });
}
