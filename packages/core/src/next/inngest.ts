import { Inngest } from 'inngest';
import { serve } from 'inngest/next';

const APP_ID = 'future';

// TODO: This can come be defined somewhere else in core and imported here
const client = new Inngest({
  id: APP_ID,
});

export const helloWorld = client.createFunction(
  { id: 'hello-world' },
  { event: 'test/hello.world' },
  async ({ event, step }) => {
    await step.sleep('wait-a-moment', '1s');
    return { event, body: 'Hello, World!' };
  }
);

export default serve({
  client,
  functions: [helloWorld],
});
