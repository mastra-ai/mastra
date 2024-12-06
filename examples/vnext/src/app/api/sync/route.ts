import { mastra } from '@/mastra';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function GET() {
  const entityName = 'TESTER';
  const connectionId = '123';

  await mastra.sync('mySync', {
    name: entityName,
    connectionId,
  });

  const d = await mastra.engine?.getRecordsByEntityName({ name: entityName, connectionId });

  console.log(d);

  return new Response('Hello, world!');
}
