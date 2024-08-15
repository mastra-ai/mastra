import { Inngest } from 'inngest';
import { serve } from 'inngest/next';
import { NextRequest } from 'next/server';
import { IntegrationFramework } from '../';

const APP_ID = 'future';

// TODO: This can come be defined somewhere else in core and imported here
export const client = new Inngest({
  id: APP_ID,
});

export const makeInngest = (framework: IntegrationFramework) => {
  // TODO: hook into framework to add framework functions to the inngest client

  const eventHandlers = framework.getGlobalEventHandlers();

  // register workflow middleware here?
  const globalEvents = eventHandlers.map((eh) => {
    return client.createFunction(
      {
        id: eh.id,
      },
      {
        event: eh.event,
      },
      eh.executor
    );
  });

  const handler = serve({
    client,
    functions: globalEvents,
  });

  // @ts-ignore
  return (req: NextRequest) => handler(req);
};
