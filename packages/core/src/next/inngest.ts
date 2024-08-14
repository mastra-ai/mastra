import { Inngest } from 'inngest';
import { serve } from 'inngest/next';
import { NextRequest } from 'next/server';
import { IntegrationFramework } from '../index';

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

export const makeInngest = (framework: IntegrationFramework) => {
  // TODO: hook into framework to add framework functions to the inngest client
  const handler = serve({
    client,
    functions: [helloWorld],
  });

  // @ts-ignore
  return (req: NextRequest) => handler(req);
};
