import { mastra } from '@/mastra';
import { NextResponse } from 'next/server';

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
  console.log(`Calling mastra.sync`)
  await mastra.sync('mySync', {
    name: entityName,
    connectionId,
  });
  console.log(' ');
  console.log(`Finished calling mastra.sync`)

  console.log('Querying `mastra.engine.getRecordsByEntityName` for entityName:', entityName, 'and connectionId:', connectionId);
  const d = await mastra.engine?.getRecordsByEntityName({ name: entityName, connectionId });

  console.log('Records', d);

  console.log('Querying `mastra.engine.getEntities` for entityName:', entityName, 'and connectionId:', connectionId);
  const entities = await mastra.engine?.getEntity({ name: entityName, connectionId });

  console.log('Entities', { entities });

  if (entities?.length) {
    console.log('Querying `mastra.engine.getRecordsByEntityId` for entityId:', entities?.[0].id);
    const records = await mastra.engine?.getRecordsByEntityId({ entityId: entities?.[0].id });
    console.log('Records', { records });
  }

  return NextResponse.json({
    message: 'Sync complete',
    records: d,
    entities,
  });
}
