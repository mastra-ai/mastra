import { Inngest } from 'inngest';
import { serve } from 'inngest/next';
import { NextRequest } from 'next/server';
import { Framework } from '../framework';
import { createWorkflowHandler } from '../workflows/handler';

const APP_ID = 'future';

// TODO: This can come be defined somewhere else in core and imported here
export const client = new Inngest({
  id: APP_ID,
});

export const makeInngest = (framework: Framework) => {
  // TODO: hook into framework to add framework functions to the inngest client

  const eventHandlers = framework.getGlobalEventHandlers();

  const globalEventHandlers = eventHandlers.map((eh) => {
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

  const systemWorkflowHandler = createWorkflowHandler({
    blueprintDirPath: framework.config.blueprintDirPath,
    runBlueprint: framework.runBlueprint,
  });

  const handler = serve({
    client,
    functions: [...globalEventHandlers, systemWorkflowHandler],
  });

  // @ts-ignore
  return (req: NextRequest) => handler(req);
};
