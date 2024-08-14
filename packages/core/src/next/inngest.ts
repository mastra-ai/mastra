import { Inngest } from 'inngest';
import { serve } from 'inngest/next';
import { NextRequest } from 'next/server';

const APP_ID = 'future';

// TODO: This can come be defined somewhere else in core and imported here
const client = new Inngest({
  id: APP_ID,
});

const helloWorld = client.createFunction(
  { id: 'hello-world' },
  { event: 'test/hello.world' },
  async ({ event, step }) => {
    await step.sleep('wait-a-moment', '1s');
    return { event, body: 'Hello, World!' };
  }
);

const handler = serve({
  client,
  functions: [helloWorld],
});

// @ts-ignore
export default (req: NextRequest) => handler(req);
