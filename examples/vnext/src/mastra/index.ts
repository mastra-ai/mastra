import { Mastra, createLogger } from '@mastra/core';

import { agents } from './agents/test';
import { integrations } from './integrations';
import * as syncs from './syncs';
import * as tools from './tools';

export const mastra = new Mastra<typeof integrations, typeof tools, typeof syncs>({
  tools,
  syncs,
  engine: {} as any,
  agents,
  integrations,
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});

// sync
//  await mastra.sync('mySync', {
//   createdAt: new Date(),
//   foo: 'bar',
//   name: 'test',
// });

//execute tool
// const testTool = mastra.getTool('testTool');
// testTool.execute({
//   name: 'test',
//   message: 'hello',
// });
