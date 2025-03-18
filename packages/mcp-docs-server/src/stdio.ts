#!/usr/bin/env node

import { prepare } from './prepare-docs/prepare.js';

if (process.env.REBUILD_DOCS_ON_START === 'true') {
  await prepare();
}

const { server } = await import(`./index.js`);

void server.start({
  transportType: 'stdio',
});
