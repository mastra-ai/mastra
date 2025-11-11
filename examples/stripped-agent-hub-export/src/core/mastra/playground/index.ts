import {Mastra} from '@mastra/core/mastra';
import {config} from 'dotenv';

import {RuntimeContext} from '@mastra/core/runtime-context';
import {registerCopilotKit} from '@ag-ui/mastra';
import {Context} from 'hono';

import {PinoWrapperLogger} from '../../logger';
import {openaiServiceAdapter} from '../../copilotkit';
import {consolidateApps} from '../utils';
import {apps} from '../../../apps';
import {LibSQLStore} from '@mastra/libsql';
import {appHeadersSchema} from '../../schemas/appheaders';
import {randomUUID} from 'crypto';

config();

const consolidated = consolidateApps(apps);

export const mastra = new Mastra({
  workflows: consolidated.workflows,
  agents: consolidated.agents,
  storage: new LibSQLStore({url: ':memory:'}),
  logger: new PinoWrapperLogger({
    name: 'Mastra',
  }),
  server: {
    port: 8080,
    cors: {
      origin: '*',
      allowMethods: ['*'],
      allowHeaders: ['*'],
    },
    apiRoutes: [
      {
        path: '/ping',
        method: 'GET',
        handler: async () => ({
          status: 200,
          body: 'OK',
        }),
      },
      registerCopilotKit({
        path: '/copilotkit',
        resourceId: 'copilotkit',
        serviceAdapter: openaiServiceAdapter,
      }),
    ],
  },
});
